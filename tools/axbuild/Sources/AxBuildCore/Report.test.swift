import Foundation
import Testing
import os

@testable import AxBuildCore

@Suite struct ReportTests {
  let context = ReaderContext(cwd: "/fixture", effectiveCwd: "/fixture", source: .log)
  let run = CapturedRun(
    command: .init(kind: .swiftTest, status: .failed, exitCode: 1),
    artifacts: .init(run: "/run", log: "build.log", report: "report.json"))
  func fixture(_ name: String, suffix: String, folder: String) throws -> Data {
    try Data(
      contentsOf: #require(
        Bundle.module.url(
          forResource: name, withExtension: suffix, subdirectory: "Fixtures/\(folder)")))
  }

  @Test(arguments: [1, 3]) func deadlinePreservesPreviouslyDecodedRecords(stopAt: Int) {
    let calls = OSAllocatedUnfairLock(initialState: 0)
    let stopped = ReaderContext(
      cwd: "/fixture", effectiveCwd: "/fixture", source: .log,
      shouldStop: {
        calls.withLock {
          $0 += 1
          return $0 >= stopAt
        }
      })
    let records = ["first", "second", "third"].map { message in
      Diagnostic(
        id: .init("pending"), kind: .compiler, severity: .error, message: message, sources: [.log])
    }
    let batches = records.map { ReadBatch(diagnostics: [$0], completedSources: [.log]) }
    let result = reconcileDiagnostics(batches: batches, context: stopped)
    #expect(result.diagnostics.map(\.message) == ["first", "second", "third"])
    #expect(result.diagnostics.map(\.id.rawValue) == ["d1", "d2", "d3"])
    #expect(result.failedTests == nil)
    #expect(result.issues.contains { $0.kind == .timedOut })
  }

  @Test(arguments: [false, true]) func reconcilesTwoSavedFailuresWithRichEvidence(xcode: Bool)
    throws
  {
    let log = readLog(
      data: try fixture(xcode ? "xcode-tests" : "swift-tests", suffix: "txt", folder: "logs"),
      context: context)
    let structured =
      xcode
      ? readTestResults(
        data: try fixture("test-results", suffix: "json", folder: "tests"), context: context)
      : readEvents(
        data: try fixture("events-0", suffix: "jsonl", folder: "tests"), context: context)
    let merged = reconcileDiagnostics(batches: [log, structured], context: context)
    #expect(merged.failedTests == 2)
    let tests = merged.diagnostics.filter { $0.kind == .test }
    #expect(
      tests.map { "\($0.file ?? "nil"):\($0.line ?? 0)" }.sorted() == [
        "/fixture/Tests/CalcTests/SwiftTestingCases.swift:3",
        "/fixture/Tests/CalcTests/XCTestCases.swift:4",
      ])
    #expect(tests.map(\.sources).contains { $0 == [.log, xcode ? .testResults : .events] })
    #expect(merged.issues == [])
    if !xcode {
      #expect(
        tests.first { $0.test?.framework == .swiftTesting }?.test?.evaluatedValues == ["3", "2"])
    }
  }

  @Test func preservesSameSourceRepetitionAndConflictingEvaluatedValues() {
    let a = Diagnostic(
      id: .init("d1"), kind: .test, severity: .error, message: "Expectation failed: value == 2",
      sources: [.log], file: "/fixture/T.swift", line: 1,
      test: .init(id: "test()", isFailure: true, framework: .swiftTesting, evaluatedValues: ["3"]),
      testName: "test()")
    var b = a
    b.sources = [.events]
    b.test?.id = "opaque"
    b.test?.evaluatedValues = ["4"]
    let merged = reconcileDiagnostics(
      batches: [.init(diagnostics: [a, a]), .init(diagnostics: [b])], context: context)
    #expect(merged.diagnostics.map { $0.test?.evaluatedValues } == [["3"], ["3"], ["4"]])
    #expect(merged.failedTests == nil)
  }

  @Test func ambiguousOneToManyKeepsEveryRecordAndReportsUncertainty() {
    let a = Diagnostic(
      id: .init("d1"), kind: .test, severity: .error, message: "Failure", sources: [.log],
      file: "Shared.swift", line: 2,
      test: .init(id: "same()", isFailure: true, framework: .swiftTesting), testName: "same()")
    var b = a
    b.sources = [.events]
    b.file = "/one/Shared.swift"
    b.test?.id = "opaque-1"
    var c = b
    c.file = "/two/Shared.swift"
    c.test?.id = "opaque-2"
    let merged = reconcileDiagnostics(
      batches: [.init(diagnostics: [a]), .init(diagnostics: [b, c])], context: context)
    #expect(
      merged.diagnostics.map(\.file) == ["Shared.swift", "/one/Shared.swift", "/two/Shared.swift"])
    #expect(merged.failedTests == nil)
    #expect(merged.issues.map(\.kind).contains(.ambiguousCorrelation))
  }

  @Test func compilerErrorsNeverCountAsFailedTests() {
    let diagnostic = Diagnostic(
      id: .init("d1"), kind: .compiler, severity: .error, message: "bad source", sources: [.log],
      file: "/fixture/A.swift", line: 1)
    let report = makeReport(
      run: run, batches: [.init(diagnostics: [diagnostic], completedSources: [.log])],
      context: context)
    #expect(report.counts == .init(errors: 1, warnings: 0, notes: 0, remarks: 0, failedTests: 0))
    #expect(report.command.exitCode == 1)
    #expect(report.collection.status == .complete)
  }

  @Test(arguments: [RenderFormat.compact, .pretty]) func oversizedValuesHaveHonestPreviewAccounting(
    format: RenderFormat
  ) throws {
    let diagnostic = Diagnostic(
      id: .init("stable"), kind: .test, severity: .error,
      message: "Expectation failed: payload == expected", sources: [.events],
      file: "/fixture/T.swift", line: 1,
      test: .init(
        id: "opaque", isFailure: true, framework: .swiftTesting,
        evaluatedValues: [
          String(repeating: "🧩\n\"", count: 4000), String(repeating: "x", count: 16000),
        ]), testName: "payload()")
    let report = makeReport(
      run: run, batches: [.init(diagnostics: [diagnostic], completedSources: [.events])],
      context: context)
    let full = try encodeFullReport(report: report).get()
    let fullDecoded = try JSONDecoder().decode(Report.self, from: full)
    #expect(
      fullDecoded.diagnostics.first?.items.first?.test?.evaluatedValues
        == diagnostic.test?.evaluatedValues)
    #expect(fullDecoded.omissions == .init())
    let rendered = try renderReport(report: report, format: format, byteLimit: 8000).get()
    #expect(rendered.data.count <= 8000 && rendered.data.last == 10)
    let decoded = try JSONDecoder().decode(Report.self, from: rendered.data)
    #expect(decoded.counts == report.counts)
    let shown = decoded.diagnostics.flatMap(\.items)
    #expect(shown.count + decoded.omissions.diagnostics == 1)
    #expect(shown.first?.id == report.diagnostics.first?.items.first?.id)
    let details = shown.reduce(0) {
      $0 + ($1.preview?.changes.reduce(0) { $0 + $1.count } ?? 0)
        + ($1.preview?.messageTruncated == true ? 1 : 0)
    }
    #expect(decoded.omissions.details == details)
    #expect(decoded.omissions.details == 2)
  }

  @Test(arguments: [RenderFormat.compact, .pretty]) func warningFloodFitsAndReconcilesCounts(
    format: RenderFormat
  ) throws {
    let diagnostics = (0..<300).map { index in
      Diagnostic(
        id: .init("d\(index)"), kind: .compiler, severity: .warning,
        message: "Unused value \(index)", sources: [.log], file: "/fixture/\(index).swift", line: 1)
    }
    let report = makeReport(
      run: run, batches: [.init(diagnostics: diagnostics, completedSources: [.log])],
      context: context)
    let rendered = try renderReport(report: report, format: format, byteLimit: 8000).get()
    #expect(rendered.data.count <= 8000)
    #expect(
      rendered.report.diagnostics.flatMap(\.items).count + rendered.report.omissions.diagnostics
        == 300)
    #expect(
      rendered.report.diagnostics.filter { $0.warningCount != nil }.count
        + rendered.report.omissions.warningFiles == 300)
  }

  @Test func failedEmptyLogStaysFailedAndCollectionIsPartial() {
    var failedRun = run
    failedRun.logTail = "native failure without a compiler header"
    let report = makeReport(
      run: failedRun, batches: [.init(completedSources: [.log])], context: context)
    #expect(report.command.status == .failed)
    #expect(report.collection.status == .partial)
    #expect(report.collection.issues.map(\.kind) == [.unrecognizedFailure])
    #expect(report.logExcerpt?.text == failedRun.logTail)
  }

  @Test func tooSmallBudgetReturnsTypedFailureInsteadOfInvalidJSON() {
    let report = makeReport(run: run, batches: [], context: context)
    guard case .failure(let issue) = renderReport(report: report, format: .compact, byteLimit: 10)
    else {
      Issue.record("Impossible budget was accepted")
      return
    }
    #expect(issue.kind == .writeFailed)
  }

  @Test func emptyDetailArraysDoNotCreateOmissionCounts() throws {
    let diagnostic = Diagnostic(
      id: .init("large"), kind: .compiler, severity: .error,
      message: String(repeating: "large error ", count: 4000), sources: [.log], notes: [])
    let report = makeReport(
      run: run, batches: [.init(diagnostics: [diagnostic], completedSources: [.log])],
      context: context)
    let bounded = try renderReport(report: report, format: .compact).get().report
    #expect(bounded.omissions.details == 1)
    #expect(bounded.diagnostics.first?.items.first?.preview?.changes == [])
  }

  @Test func failedExecutionSummaryDoesNotDuplicateDetailedFailure() {
    let failure = Diagnostic(
      id: .init("d1"), kind: .test, severity: .error, message: "XCTAssertEqual failed",
      sources: [.log], file: "/fixture/T.swift", line: 3,
      test: .init(id: "-[CalcTests.XCTestCases testAdd]", isFailure: true, framework: .xctest))
    let summary = Diagnostic(
      id: .init("d1"), kind: .test, severity: .error,
      message: "Test failed without a detailed failure message", sources: [.testResults],
      test: .init(id: "test://fixture/CalcTests/XCTestCases/testAdd", isFailure: true),
      target: "CalcTests", testName: "XCTestCases/testAdd()", synthetic: true)
    let merged = reconcileDiagnostics(
      batches: [.init(diagnostics: [failure]), .init(diagnostics: [summary])], context: context)
    #expect(merged.diagnostics.map(\.message) == ["XCTAssertEqual failed"])
    #expect(merged.failedTests == 1)
    #expect(merged.diagnostics.first?.sources == [.log, .testResults])
  }

  @Test func conflictingMultilineResultValuesAreNotMerged() {
    var log = Diagnostic(
      id: .init("log"), kind: .test, severity: .error, message: "Expectation failed: value == 2",
      sources: [.log], file: "/fixture/T.swift", line: 1,
      test: .init(id: "test()", isFailure: true, framework: .swiftTesting, messages: ["value → 3"]))
    log.testName = "test()"
    var result = log
    result.sources = [.testResults]
    result.message += "\nvalue → 4"
    result.test?.messages = nil
    let merged = reconcileDiagnostics(
      batches: [.init(diagnostics: [log]), .init(diagnostics: [result])], context: context)
    #expect(
      merged.diagnostics.map(\.message) == [
        "Expectation failed: value == 2", "Expectation failed: value == 2\nvalue → 4",
      ])
    #expect(merged.issues.contains { $0.kind == .ambiguousCorrelation })
  }

  @Test func conflictingDisplayedValuesCannotEnrichTheSameHeadline() {
    let log = Diagnostic(
      id: .init("d1"), kind: .test, severity: .error, message: "Expectation failed: value == 2",
      sources: [.log], file: "T.swift", line: 1,
      test: .init(id: "test()", isFailure: true, framework: .swiftTesting, messages: ["value → 3"]),
      testName: "test()")
    var event = log
    event.sources = [.events]
    event.file = "/fixture/T.swift"
    event.test?.id = "opaque"
    event.test?.messages = ["value → 4"]
    let merged = reconcileDiagnostics(
      batches: [.init(diagnostics: [log]), .init(diagnostics: [event])], context: context)
    #expect(merged.diagnostics.map { $0.test?.messages } == [["value → 3"], ["value → 4"]])
    #expect(merged.failedTests == nil)
    #expect(merged.issues.map(\.kind).contains(.ambiguousCorrelation))
  }

  @Test func unavailableReportRetainsAllRequiredNullFields() throws {
    let unavailableRun = CapturedRun(command: .init(), artifacts: .init())
    let report = makeReport(run: unavailableRun, batches: [], context: context)
    let data = try renderReport(report: report, format: .compact).get().data
    let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let counts = try #require(object["counts"] as? [String: Any])
    let artifacts = try #require(object["artifacts"] as? [String: Any])
    #expect(Set(counts.keys) == Set(["errors", "warnings", "notes", "remarks", "failedTests"]))
    #expect(counts.values.allSatisfy { $0 is NSNull })
    #expect(Set(artifacts.keys) == Set(["run", "log", "report"]))
    #expect(artifacts.values.allSatisfy { $0 is NSNull })
  }
}
