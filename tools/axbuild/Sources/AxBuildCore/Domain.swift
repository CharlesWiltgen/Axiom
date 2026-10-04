import Foundation

struct RunID: Codable, Hashable, Sendable {
  let rawValue: String
  init(_ value: String) { rawValue = value }
  init(from decoder: any Decoder) throws {
    rawValue = try decoder.singleValueContainer().decode(String.self)
  }
  func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }
}
struct DiagnosticID: Codable, Hashable, Sendable {
  let rawValue: String
  init(_ value: String) { rawValue = value }
  init(from decoder: any Decoder) throws {
    rawValue = try decoder.singleValueContainer().decode(String.self)
  }
  func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }
}
enum IssueKind: String, Codable, Sendable {
  case invalidInvocation = "invalid-invocation"
  case parseFailed = "parse-failed"
  case unsupportedSource = "unsupported-source"
  case unclassifiedTestIssue = "unclassified-test-issue"
  case timedOut = "timed-out"
  case ambiguousTestIdentity = "ambiguous-test-identity"
  case ambiguousCorrelation = "ambiguous-correlation"
  case unrecognizedFailure = "unrecognized-failure"
  case writeFailed = "write-failed"
  case toolUnavailable = "tool-unavailable"
  case captureUnavailable = "capture-unavailable"
  case internalFailure = "internal-failure"
  case readFailed = "read-failed"
  case missingArtifact = "missing-artifact"
  case cleanupIncomplete = "cleanup-incomplete"
}
struct CollectionIssue: Error, Codable, Equatable, Sendable {
  var kind: IssueKind
  var operation: String
  var message: String
  var path: String?
}
enum CommandKind: String, Codable, Sendable {
  case xcodebuild
  case swiftBuild = "swift-build"
  case swiftTest = "swift-test"
}
enum CommandStatus: String, Codable, Sendable {
  case succeeded, failed, interrupted
  case notStarted = "not-started"
}
struct CommandOutcome: Codable, Sendable {
  var kind: CommandKind?
  var status: CommandStatus = .notStarted
  var exitCode: Int?
  var signal: Int?
  var interruptionSignal: Int?
  var durationMs: Int?
  enum CodingKeys: String, CodingKey {
    case kind, status, exitCode, signal, interruptionSignal, durationMs
  }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(kind, forKey: .kind)
    try c.encode(status, forKey: .status)
    try c.encode(exitCode, forKey: .exitCode)
    try c.encode(signal, forKey: .signal)
    try c.encode(interruptionSignal, forKey: .interruptionSignal)
    try c.encode(durationMs, forKey: .durationMs)
  }
}
struct TestMetadata: Codable, Equatable, Sendable {
  var id: String?
  var isFailure: Bool?
  var framework: TestFramework?
  var messages: [String]?
  var isKnown: Bool?
  var evaluatedValues: [String]?
  var aliases: [TestAlias]?
  var issueSeverity: String?
  var caseID: String?
  var iteration: Int?
  var executionID: String?
  enum CodingKeys: String, CodingKey {
    case id, isFailure, framework, messages, isKnown, evaluatedValues, aliases, issueSeverity,
      caseID, iteration, executionID
  }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(isFailure, forKey: .isFailure)
    try c.encodeIfPresent(framework, forKey: .framework)
    try c.encodeIfPresent(messages, forKey: .messages)
    try c.encodeIfPresent(isKnown, forKey: .isKnown)
    try c.encodeIfPresent(evaluatedValues, forKey: .evaluatedValues)
    try c.encodeIfPresent(aliases, forKey: .aliases)
    try c.encodeIfPresent(issueSeverity, forKey: .issueSeverity)
    try c.encodeIfPresent(caseID, forKey: .caseID)
    try c.encodeIfPresent(iteration, forKey: .iteration)
    try c.encodeIfPresent(executionID, forKey: .executionID)
  }
}

enum Source: String, Codable, Sendable {
  case log
  case testResults = "test-results"
  case events
}
enum DiagnosticKind: String, Codable, Sendable { case compiler, linker, tool, test }
enum Severity: String, Codable, Sendable { case error, warning, note, remark }
enum TestFramework: String, Codable, Sendable {
  case xctest
  case swiftTesting = "swift-testing"
}
struct Note: Codable, Equatable, Sendable {
  var message: String
  var file: String?
  var line: Int?
  var column: Int?
  var sources: [Source]?
}
struct Diagnostic: Codable, Equatable, Sendable {
  var id: DiagnosticID
  var kind: DiagnosticKind
  var severity: Severity
  var message: String
  var sources: [Source]
  var file: String? = nil
  var line: Int?
  var column: Int?
  var notes: [Note]?
  var test: TestMetadata?
  var target: String?
  var testName: String? = nil
  var synthetic = false
  var preview: Preview?
  var alternateMessages: [AlternateMessage]?
  var fixIts: [FixIt]?
  enum CodingKeys: String, CodingKey {
    case id, kind, severity, message, sources, line, column, notes, test, target, preview,
      alternateMessages, fixIts
  }
}
struct ReaderContext: Sendable {
  var cwd: String
  var effectiveCwd: String
  var source: Source
  var canonicalPath: @Sendable (String) -> String? = { $0 }
  var shouldStop: @Sendable () -> Bool = { false }
}
struct ReadBatch: Equatable, Sendable {
  var diagnostics: [Diagnostic] = []
  var issues: [CollectionIssue] = []
  var completedSources: [Source] = []
  var stoppedEarly = false
  var executions: [TestExecution] = []
}

struct TestAlias: Codable, Equatable, Sendable {
  var source: Source
  var id: String
}
struct TestExecution: Equatable, Sendable {
  var id: String?
  var name: String?
  var target: String?
  var source: Source
  var failed: Bool?
}

struct Location: Codable, Equatable, Sendable {
  var file: String
  var line: Int?
  var column: Int?
}
struct FixIt: Codable, Equatable, Sendable {
  var replacement: String
  var location: Location
  var end: Location?
}
struct AlternateMessage: Codable, Equatable, Sendable {
  var source: Source
  var message: String
}
struct DetailChange: Codable, Equatable, Sendable {
  var path: String
  var kind: String
  var count: Int
}
struct Preview: Codable, Equatable, Sendable {
  var messageTruncated: Bool = false
  var changes: [DetailChange] = []
}
