import Foundation
import Testing
import os

@testable import AxBuildCore

@Suite struct TestReadersTests {
  let context = ReaderContext(cwd: "/fixture", effectiveCwd: "/fixture", source: .events)

  @Test func deadlineStopsFailureFallbackWithoutDroppingDecodedExecutions() {
    let calls = OSAllocatedUnfairLock(initialState: 0)
    let stopped = ReaderContext(
      cwd: "/fixture", effectiveCwd: "/fixture", source: .testResults,
      shouldStop: {
        calls.withLock {
          $0 += 1
          return $0 >= 2
        }
      })
    let data = Data(
      #"{"testNodes":[{"nodeType":"Test Case","nodeIdentifier":"Case/testOne","result":"Failed"}]}"#
        .utf8)
    let batch = readTestResults(data: data, context: stopped)
    #expect(batch.executions.map(\.id) == ["Case/testOne"])
    #expect(batch.diagnostics == [])
    #expect(batch.issues.map(\.kind) == [.timedOut])
    #expect(batch.completedSources == [])
  }
  func fixture(_ name: String, extension suffix: String) throws -> Data {
    try Data(
      contentsOf: #require(
        Bundle.module.url(forResource: name, withExtension: suffix, subdirectory: "Fixtures/tests"))
    )
  }

  @Test(arguments: [false, true]) func retainsProvenFailureWhenDetailIsMalformedOrNested(
    nested: Bool
  ) {
    let children =
      nested
      ? "[{\"nodeType\":\"Group\",\"children\":[{\"nodeType\":\"Failure Message\",\"name\":\"nested failure\"}]}]"
      : "[{\"nodeType\":\"Failure Message\"}]"
    let json =
      "{\"testNodes\":[{\"nodeType\":\"Test Case\",\"nodeIdentifierURL\":\"test://fixture/Case/testOne\",\"result\":\"Failed\",\"children\":\(children)}]}"
    let batch = readTestResults(data: Data(json.utf8), context: context)
    #expect(
      batch.diagnostics.map(\.message) == [
        nested ? "nested failure" : "Test failed without a detailed failure message"
      ])
    #expect(batch.diagnostics.map { $0.test?.isFailure } == [true])
    #expect(batch.issues.contains { $0.kind == .parseFailed } == !nested)
  }

  @Test func preservesAvailableParameterizedCaseIDs() throws {
    let batch = readEvents(data: try fixture("semantics-0", extension: "jsonl"), context: context)
    let actual = batch.diagnostics.filter { $0.test?.id?.contains("parameterized") == true }.map {
      $0.test?.caseID
    }
    #expect(
      actual == [
        "Parameterized test case ID: argumentIDs: [Testing.Test.Case.Argument.ID(bytes: [107, 134, 178, 115, 255, 52, 252, 225, 157, 107, 128, 78, 255, 90, 63, 87, 71, 173, 164, 234, 162, 47, 29, 73, 192, 30, 82, 221, 183, 135, 91, 75])], discriminator: 0, isStable: true",
        "Parameterized test case ID: argumentIDs: [Testing.Test.Case.Argument.ID(bytes: [212, 115, 94, 58, 38, 94, 22, 238, 224, 63, 89, 113, 139, 155, 93, 3, 1, 156, 7, 216, 182, 197, 31, 144, 218, 58, 102, 110, 236, 19, 171, 53])], discriminator: 0, isStable: true",
      ])
  }

  @Test func retainsVersionZeroFailureLocationValuesAndOpaqueIdentity() throws {
    let batch = readEvents(data: try fixture("events-0", extension: "jsonl"), context: context)
    #expect(
      batch.diagnostics == [
        .init(
          id: .init("d1"), kind: .test, severity: .error,
          message: "Expectation failed: add(1, 1) == 2", sources: [.events],
          file: "/fixture/Tests/CalcTests/SwiftTestingCases.swift", line: 3, column: 27,
          test: .init(
            id: "CalcTests.addFailsST()/SwiftTestingCases.swift:3:2", isFailure: true,
            framework: .swiftTesting,
            messages: ["ST_MARKER sum wrong", "add(1, 1) == 2 → false", "add(1, 1) → 3"],
            isKnown: false, evaluatedValues: ["3", "2"],
            aliases: [
              .init(source: .events, id: "CalcTests.addFailsST()/SwiftTestingCases.swift:3:2")
            ]), target: "CalcTests", testName: "addFailsST()")
      ])
    #expect(batch.issues == [])
  }

  @Test func retainsSavedXcodeFailuresWithOneBasedLocations() throws {
    let context = ReaderContext(cwd: "/fixture", effectiveCwd: "/fixture", source: .testResults)
    let batch = readTestResults(
      data: try fixture("test-results", extension: "json"), context: context)
    #expect(
      batch.diagnostics == [
        .init(
          id: .init("d1"), kind: .test, severity: .error,
          message: "Expectation failed: add(1, 1) == 2\nadd(1, 1) → 3: ST_MARKER sum wrong",
          sources: [.testResults], file: "/fixture/Tests/CalcTests/SwiftTestingCases.swift",
          line: 3,
          test: .init(
            id: "test://com.apple.xcode/Calc/CalcTests/addFailsST()", isFailure: true,
            aliases: [
              .init(source: .testResults, id: "test://com.apple.xcode/Calc/CalcTests/addFailsST()")
            ]), target: "CalcTests", testName: "addFailsST()"),
        .init(
          id: .init("d2"), kind: .test, severity: .error,
          message: "XCTAssertEqual failed: (\"5\") is not equal to (\"4\") - XC_MARKER sum wrong",
          sources: [.testResults], file: "/fixture/Tests/CalcTests/XCTestCases.swift", line: 4,
          test: .init(
            id: "test://com.apple.xcode/Calc/CalcTests/XCTestCases/testAddFailsXC", isFailure: true,
            aliases: [
              .init(
                source: .testResults,
                id: "test://com.apple.xcode/Calc/CalcTests/XCTestCases/testAddFailsXC")
            ]), target: "CalcTests", testName: "XCTestCases/testAddFailsXC()"),
      ])
    #expect(batch.issues == [])
  }

  @Test func separatesKnownWarningsUnexpectedPassAndParameterizedFailures() throws {
    let batch = readEvents(data: try fixture("semantics-6.3", extension: "jsonl"), context: context)
    let observed = batch.diagnostics.map {
      "\($0.testName ?? "nil"):\($0.severity.rawValue):\($0.test?.isFailure.map(String.init) ?? "null"):\($0.test?.isKnown.map(String.init) ?? "null")"
    }.sorted()
    #expect(
      observed == [
        "knownFailure():note:false:true", "ordinaryFailure():error:true:false",
        "parameterized(value:):error:true:false", "parameterized(value:):error:true:false",
        "unexpectedPass():error:true:false", "warningOnly():warning:false:false",
      ])
    #expect(batch.issues == [])
  }

  @Test(arguments: [
    ("0", "{\"isKnown\":false}", "fail", Optional(true), Severity.error, false),
    ("0", "{\"isKnown\":true}", "fail", Optional(false), .note, false),
    ("0", "{}", "fail", nil, .note, true),
    (
      "\"6.3.0\"", "{\"isKnown\":false,\"isFailure\":false,\"severity\":\"warning\"}", "warning",
      Optional(false), .warning, false
    ),
    (
      "\"6.3.0\"", "{\"isKnown\":true,\"isFailure\":true,\"severity\":\"error\"}", "fail", nil,
      .note, true
    ),
    (
      "\"6.3.0\"", "{\"isKnown\":false,\"isFailure\":true,\"severity\":\"future\"}", "fail", nil,
      .note, true
    ),
    ("\"6.3.0\"", "{\"isFailure\":true,\"severity\":\"error\"}", "fail", nil, .note, true),
  ]) func pinsFailureSemantics(example: (String, String, String, Bool?, Severity, Bool)) throws {
    let json =
      "{\"version\":\(example.0),\"kind\":\"event\",\"payload\":{\"kind\":\"issueRecorded\",\"testID\":\"opaque\",\"issue\":\(example.1),\"messages\":[{\"symbol\":\"\(example.2)\",\"text\":\"Evidence\"}]}}"
    let batch = readEvents(data: Data(json.utf8), context: context)
    let diagnostic = try #require(batch.diagnostics.first)
    #expect(diagnostic.test?.isFailure == example.3)
    #expect(diagnostic.severity == example.4)
    #expect(batch.issues.contains(where: { $0.kind == .unclassifiedTestIssue }) == example.5)
  }

  @Test func retainsEarlierEvidenceOnMalformedOrUnsupportedRecords() throws {
    let data = try fixture("events-0", extension: "jsonl")
    let malformed = readEvents(data: data + Data("{\"version\":0".utf8), context: context)
    #expect(malformed.diagnostics.map(\.message) == ["Expectation failed: add(1, 1) == 2"])
    #expect(malformed.issues.map(\.kind) == [.parseFailed])
    #expect(malformed.completedSources == [])
    let unsupported = readEvents(
      data: Data("{\"version\":\"99.0\",\"kind\":\"event\"}".utf8), context: context)
    #expect(unsupported.issues.map(\.kind) == [.unsupportedSource])
    #expect(
      readTestResults(data: Data("{}".utf8), context: context).issues.map(\.kind) == [.parseFailed])
  }

  @Test func synthesizesOnlyUndetailedFailedExecutions() {
    let json =
      #"{"testNodes":[{"nodeType":"Test Case","name":"fails()","nodeIdentifierURL":"test://fixture/fails","result":"Failed"},{"nodeType":"Test Case","name":"passes()","result":"Passed"}]}"#
    let batch = readTestResults(data: Data(json.utf8), context: context)
    #expect(batch.diagnostics.map(\.message) == ["Test failed without a detailed failure message"])
    #expect(batch.diagnostics.first?.test?.isFailure == true)
    #expect(batch.diagnostics.first?.synthetic == true)
  }

  @Test func preservesRepeatedIssuesAndIgnoresAdditiveEventKinds() throws {
    let data = try fixture("events-0", extension: "jsonl")
    let record = try #require(
      String(data: data, encoding: .utf8)?.split(separator: "\n").first {
        $0.contains("issueRecorded")
      })
    let batch = readEvents(
      data: data + Data((String(record) + "\n{\"version\":0,\"kind\":\"futureRecord\"}\n").utf8),
      context: context)
    #expect(
      batch.diagnostics.map(\.message) == [
        "Expectation failed: add(1, 1) == 2", "Expectation failed: add(1, 1) == 2",
      ])
    #expect(batch.issues == [])
  }

  @Test func malformedSiblingAndInvalidLocationPreserveOtherEvidence() {
    let json =
      #"{"testNodes":[{"nodeType":42},{"nodeType":"Test Case","name":"fails()","nodeIdentifier":"fails()","result":"Failed","children":[{"nodeType":"Failure Message","name":"bad value","sourceLocation":{"filePath":"/fixture/Tests.swift","lineNumber":0}}]}]}"#
    let batch = readTestResults(data: Data(json.utf8), context: context)
    #expect(batch.diagnostics.map(\.message) == ["bad value"])
    #expect(batch.diagnostics.first?.line == nil)
    #expect(batch.issues.map(\.kind) == [.parseFailed, .parseFailed])
    #expect(batch.completedSources == [])
  }
}
