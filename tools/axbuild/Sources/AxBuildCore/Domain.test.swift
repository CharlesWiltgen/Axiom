import Foundation
import Testing

@testable import AxBuildCore

@Suite struct DomainTests {
  @Test func encodesRequiredUnavailableFieldsAsNull() throws {
    let data = try JSONEncoder().encode(CommandOutcome())
    let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    #expect(
      Set(object.keys)
        == Set(["kind", "status", "exitCode", "signal", "interruptionSignal", "durationMs"]))
    #expect(object["exitCode"] is NSNull)
    #expect(object["status"] as? String == "not-started")
  }
  @Test func testIdentityAndClassificationRemainNullable() throws {
    let data = try JSONEncoder().encode(TestMetadata())
    let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    #expect(Set(object.keys) == Set(["id", "isFailure"]))
    #expect(object["isFailure"] is NSNull)
  }
  @Test func usesStringDomainIDs() throws {
    #expect(String(data: try JSONEncoder().encode(DiagnosticID("d1")), encoding: .utf8) == "\"d1\"")
    #expect(String(data: try JSONEncoder().encode(RunID("r1")), encoding: .utf8) == "\"r1\"")
  }
}
