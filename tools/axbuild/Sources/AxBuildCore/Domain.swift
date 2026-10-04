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
  case timedOut = "timed-out"
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
  enum CodingKeys: String, CodingKey { case id, isFailure, framework, messages }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(isFailure, forKey: .isFailure)
    try c.encodeIfPresent(framework, forKey: .framework)
    try c.encodeIfPresent(messages, forKey: .messages)
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
  enum CodingKeys: String, CodingKey {
    case id, kind, severity, message, sources, line, column, notes, test
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
}
