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
enum IssueKind: String, Codable, Sendable { case invalidInvocation = "invalid-invocation" }
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
struct TestMetadata: Codable, Sendable {
  var id: String?
  var isFailure: Bool?
  enum CodingKeys: String, CodingKey { case id, isFailure }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(isFailure, forKey: .isFailure)
  }
}
