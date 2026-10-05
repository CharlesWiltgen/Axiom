import Foundation
import Testing

@testable import AxBuildCore

@Suite struct LogReaderTests {
  @Test(arguments: [false, true]) func resolvesCompilerBasenameOnlyWhenIdentified(identified: Bool)
  {
    let context = ReaderContext(
      cwd: "/fixture", effectiveCwd: "/fixture", source: .log,
      canonicalPath: { identified ? $0 : nil })
    let result = readLog(
      data: Data("gs.swift:23:10: warning: observed warning\n".utf8), context: context)
    #expect(result.diagnostics.map(\.file) == [identified ? "/fixture/gs.swift" : "gs.swift"])
    #expect(result.issues.map(\.kind) == (identified ? [] : [.parseFailed]))
  }

  @Test(arguments: ["gs.swift", "orpus/Warnings.swift", "/Charles/Projects/Warnings.swift"])
  func retainsUnidentifiedSourcePathLiterally(path: String) {
    let context = ReaderContext(
      cwd: "/fixture", effectiveCwd: "/fixture", source: .log, canonicalPath: { _ in nil })
    let result = readLog(
      data: Data("\(path):23:10: warning: observed warning\n".utf8), context: context)
    #expect(result.diagnostics.map(\.file) == [path])
    #expect(result.issues.map(\.operation) == ["identify compiler source"])
  }

  @Test func retainsTabIndentedFailedCommands() {
    let log =
      "The following build commands failed:\n\tPhaseScriptExecution Controlled\\ script /p/s.sh (in target 'App' from project 'App')\n\tBuilding project App with scheme App and configuration Debug\n(2 failures)\n"
    #expect(
      readLog(data: Data(log.utf8), context: context).diagnostics.map(\.message) == [
        "The following build commands failed:\n\tPhaseScriptExecution Controlled\\ script /p/s.sh (in target 'App' from project 'App')\n\tBuilding project App with scheme App and configuration Debug\n(2 failures)"
      ])
  }

  @Test(arguments: [
    (
      "/p/App.xcodeproj: error: Signing for \"App\" requires a development team.",
      "/p/App.xcodeproj", "Signing for \"App\" requires a development team."
    ),
    (
      "/p/App.xcodeproj: Tool: clang: error: linker command failed with exit code 1",
      "/p/App.xcodeproj", "linker command failed with exit code 1"
    ),
    (
      "clang: error: linker command failed with exit code 1", nil,
      "linker command failed with exit code 1"
    ),
    ("Fetching from https://github.com/a/b.git: error: unreachable", nil, "unreachable"),
  ])
  func keepsToolDiagnosticPathPrefix(line: String, file: String?, message: String) {
    let result = readLog(data: Data(line.utf8), context: context)
    #expect(result.diagnostics.map(\.file) == [file])
    #expect(result.diagnostics.map(\.message) == [message])
  }

  @Test func locatesSwiftTestingIssueWhoseMessageContainsALocation() {
    let line =
      "✘ Test parse() recorded an issue at P.swift:12:5: Expectation failed: (out → \"x.swift:3:4: error: bad\")"
    let result = readLog(data: Data(line.utf8), context: context)
    #expect(result.diagnostics.map(\.file) == ["P.swift"])
    #expect(result.diagnostics.map(\.line) == [12])
    #expect(
      result.diagnostics.map(\.message) == [
        "Expectation failed: (out → \"x.swift:3:4: error: bad\")"
      ])
    #expect(result.diagnostics.map(\.kind) == [.test])
  }

  @Test func acceptsUnlocatedVirtualSourceWithoutParseIssue() {
    let result = readLog(
      data: Data("<unknown>:0: error: unable to load standard library\n".utf8), context: context)
    #expect(result.diagnostics.map(\.file) == ["<unknown>"])
    #expect(result.diagnostics.map(\.line) == [nil])
    #expect(result.issues == [])
  }

  @Test(arguments: [
    "Build cancelled because of other errors", "xcodebuild: error: Build cancelled",
    "note: Build cancelled",
  ])
  func recognizesBuildCancellation(line: String) {
    #expect(readLog(data: Data(line.utf8), context: context).stoppedEarly)
  }

  @Test(arguments: [
    ("Test Suite 'All tests' started at 2026-10-04 16:05:06.095.", true),
    ("Testing started", true),
    ("\u{1007C8}  Test run started.", true),
    ("Test Suite 'All tests' passed at 2026-10-04 16:05:06.095.", false),
  ])
  func recordsThatTestsStarted(line: String, started: Bool) {
    #expect(readLog(data: Data(line.utf8), context: context).testsStarted == started)
  }

  @Test func doesNotTreatATestNameAsBuildCancellation() {
    let line = "✔ Test buildCancelledFlow() passed after 0.001 seconds."
    #expect(!readLog(data: Data(line.utf8), context: context).stoppedEarly)
  }

  @Test(arguments: [
    "Fatal error: Index out of range", "Precondition failed: count > 0", "Assertion failed",
  ])
  func retainsSwiftRuntimeTrapLocation(message: String) {
    let result = readLog(data: Data("Calc.swift:5: \(message)\n".utf8), context: context)
    #expect(result.diagnostics.map(\.file) == ["/project/Calc.swift"])
    #expect(result.diagnostics.map(\.line) == [5])
    #expect(result.diagnostics.map(\.severity) == [.error])
    #expect(result.diagnostics.map(\.message) == [message])
    #expect(!result.crashed)
  }

  @Test(arguments: [
    (
      "Support.m:3:9: fatal error: 'Foo.h' file not found", "/project/Support.m",
      DiagnosticKind.compiler
    ),
    ("clang: fatal error: no input files", nil, DiagnosticKind.tool),
  ])
  func retainsFatalErrors(line: String, file: String?, kind: DiagnosticKind) {
    let result = readLog(data: Data(line.utf8), context: context)
    #expect(result.diagnostics.map(\.file) == [file])
    #expect(result.diagnostics.map(\.severity) == [.error])
    #expect(result.diagnostics.map(\.kind) == [kind])
  }

  @Test func retainsStandaloneNativeLinkerFailure() {
    let result = readLog(
      data: Data(
        "ld: library 'AXBUILD_MISSING_LIBRARY' not found\nclang: error: linker command failed with exit code 1\n"
          .utf8), context: context)
    #expect(
      result.diagnostics.map(\.message) == [
        "ld: library 'AXBUILD_MISSING_LIBRARY' not found", "linker command failed with exit code 1",
      ])
    #expect(result.diagnostics.map(\.kind) == [.linker, .tool])
  }

  @Test(arguments: ["↳", "􀄵"]) func retainsArbitrarySwiftTestingComments(symbol: String) {
    let data = Data(
      "✘ Test example() recorded an issue at Test.swift:1:1: bad\n\(symbol)  User-supplied explanation\n"
        .utf8)
    let result = readLog(data: data, context: context)
    #expect(result.diagnostics.map { $0.test?.messages } == [["User-supplied explanation"]])
  }

  @Test func nonpositiveTextLocationsAreOmittedAndReported() {
    let context = ReaderContext(cwd: "/fixture", effectiveCwd: "/fixture", source: .log)
    let data = Data("✘ Test example() recorded an issue at Test.swift:0:0: bad\n".utf8)
    let result = readLog(data: data, context: context)
    #expect(result.diagnostics.map(\.line) == [nil])
    #expect(result.diagnostics.map(\.column) == [nil])
    #expect(result.issues.contains { $0.kind == .parseFailed })
  }

  let context = ReaderContext(cwd: "/project", effectiveCwd: "/project", source: .log)

  @Test func excludesSnippetEchoesAndAttachesOnlyKnownNotes() {
    let log = """
      note: Planning build
      \u{1B}[31mA.swift:2:4: error: missing member\u{1B}[0m
        2 | error: missing member
          | ^ error: missing member
      A.swift:1:1: note: declared here
      B.swift:3:2: warning: unused value
      B.swift:3:2: warning: unused value
      """
    let batch = readLog(data: Data(log.utf8), context: context)
    #expect(
      batch.diagnostics == [
        .init(
          id: .init("d1"), kind: .tool, severity: .note, message: "Planning build", sources: [.log]),
        .init(
          id: .init("d2"), kind: .compiler, severity: .error, message: "missing member",
          sources: [.log], file: "/project/A.swift", line: 2, column: 4,
          notes: [
            .init(
              message: "declared here", file: "/project/A.swift", line: 1, column: 1,
              sources: [.log])
          ]),
        .init(
          id: .init("d3"), kind: .compiler, severity: .warning, message: "unused value",
          sources: [.log], file: "/project/B.swift", line: 3, column: 2),
        .init(
          id: .init("d4"), kind: .compiler, severity: .warning, message: "unused value",
          sources: [.log], file: "/project/B.swift", line: 3, column: 2),
      ])
    #expect(batch.issues == [])
  }

  @Test func retainsLinkerBlocksToolFailuresAndFailedCommands() {
    let log = """
      Undefined symbols for architecture arm64:
        "_missing", referenced from:
            _main in app.o
      ld: symbol(s) not found for architecture arm64
      clang: error: linker command failed with exit code 1
      Command PhaseScriptExecution failed with a nonzero exit code
      The following build commands failed:
          PhaseScriptExecution Script /build/script.sh (in target 'App' from project 'App')
      (1 failure)
      """
    #expect(
      readLog(data: Data(log.utf8), context: context).diagnostics.map(\.message) == [
        "Undefined symbols for architecture arm64:\n  \"_missing\", referenced from:\n      _main in app.o\nld: symbol(s) not found for architecture arm64",
        "linker command failed with exit code 1",
        "Command PhaseScriptExecution failed with a nonzero exit code",
        "The following build commands failed:\n    PhaseScriptExecution Script /build/script.sh (in target 'App' from project 'App')\n(1 failure)",
      ])
  }

  @Test func retainsXCTestAndSwiftTestingIdentityAndDetails() {
    let log = """
      /project/XCTestCases.swift:4: error: -[CalcTests.XCTestCases testAdd] : XCTAssertEqual failed
      􀢄 Test addFailsST() recorded an issue at SwiftTestingCases.swift:3:27: Expectation failed: result == 2
      􀄵 result → 3
      􀄵 expected → 2
      􀢄 Test addFailsST() failed after 0.001 seconds with 1 issue.
      """
    let batch = readLog(data: Data(log.utf8), context: context)
    #expect(
      batch.diagnostics == [
        .init(
          id: .init("d1"), kind: .test, severity: .error, message: "XCTAssertEqual failed",
          sources: [.log], file: "/project/XCTestCases.swift", line: 4,
          test: .init(id: "-[CalcTests.XCTestCases testAdd]", isFailure: true, framework: .xctest)),
        .init(
          id: .init("d2"), kind: .test, severity: .error,
          message: "Expectation failed: result == 2", sources: [.log],
          file: "SwiftTestingCases.swift", line: 3, column: 27,
          test: .init(
            id: "addFailsST()", isFailure: true, framework: .swiftTesting,
            messages: ["result → 3", "expected → 2"])),
      ])
  }

  @Test func preservesReadableDiagnosticsWithInvalidEncoding() {
    let data = Data([0xFF]) + Data("\r\nA.swift:2:4: error: broken\r\n".utf8)
    let batch = readLog(data: data, context: context)
    #expect(batch.diagnostics.map(\.message) == ["broken"])
    #expect(batch.issues.map(\.kind) == [.parseFailed])
  }

  @Test(arguments: [
    (
      "Bad.swift:1:19: \u{1B}[1;31merror: \u{1B}[1;39mcannot convert\u{1B}[0m\n",
      "Bad.swift:1:19: error: cannot convert\n"
    ),
    ("\u{1B}[2K\r[1/5] Calc\n", "\r[1/5] Calc\n"),
    ("no color here\n", "no color here\n"),
    ("incomplete \u{1B}[", "incomplete \u{1B}["),
    ("\u{1B}[\u{1B}[1mbold", "\u{1B}[bold"),
    ("\u{1B}[ 1m", "\u{1B}[ 1m"),
    ("\u{1B}[1@x\u{1B}[1~y", "xy"),
    ("\u{1B}[1\u{7F}", "\u{1B}[1\u{7F}"),
    ("lone \u{1B} escape", "lone \u{1B} escape"),
  ]) func removingControlSequencesDropsOnlyCSISequences(example: (String, String)) {
    #expect(removingControlSequences(Data(example.0.utf8)) == Data(example.1.utf8))
  }

  @Test func removingControlSequencesKeepsInvalidBytes() {
    #expect(
      removingControlSequences(Data([0x1B, 0x5B, 0x31, 0x6D, 0xFF, 0x0A])) == Data([0xFF, 0x0A]))
  }

  @Test func removingControlSequencesMatchesTheRegularExpression() throws {
    let regex = try NSRegularExpression(pattern: "\\u001B\\[[0-?]*[ -/]*[@-~]")
    let alphabet = ["\u{1B}", "[", "0", "?", " ", "/", "@", "~", "\u{7F}", "m", "\n"]
    var inputs = [""]
    var layer = [""]
    for _ in 1...5 {
      layer = layer.flatMap { prefix in alphabet.map { prefix + $0 } }
      inputs += layer
    }
    let mismatches = inputs.filter { input in
      let expected = regex.stringByReplacingMatches(
        in: input, range: NSRange(input.startIndex..<input.endIndex, in: input), withTemplate: "")
      return removingControlSequences(Data(input.utf8)) != Data(expected.utf8)
    }
    #expect(mismatches == [])
  }

  @Test func preservesVirtualLocationsAndCanonicalizesThroughResolver() {
    let context = ReaderContext(
      cwd: "/project", effectiveCwd: "/project", source: .log,
      canonicalPath: { path in path.replacingOccurrences(of: "/tmp/", with: "/private/tmp/") })
    let log = "/tmp/A.swift:1:2: error: bad\n@__swiftmacro_A.swift:2:3: error: expansion"
    #expect(
      readLog(data: Data(log.utf8), context: context).diagnostics.map(\.file) == [
        "/private/tmp/A.swift", "@__swiftmacro_A.swift",
      ])
  }

  @Test func deadlinePreservesPartialEvidenceAndCancellationCoverage() {
    let stopped = ReaderContext(
      cwd: "/project", effectiveCwd: "/project", source: .log, shouldStop: { true })
    #expect(
      readLog(data: Data("A.swift:1:1: error: broken".utf8), context: stopped).issues.map(\.kind)
        == [.timedOut])
    #expect(
      readLog(data: Data("Build cancelled because of other errors".utf8), context: context)
        .stoppedEarly)
  }

  @Test func extractsIndependentCompilerAnswerKeyFromRetainedBuild() throws {
    let url = try #require(
      Bundle.module.url(
        forResource: "compiler-continue", withExtension: "txt", subdirectory: "Fixtures/logs"))
    let batch = readLog(data: try Data(contentsOf: url), context: context)
    let actual = batch.diagnostics.filter { $0.kind == .compiler && $0.severity != .note }.map {
      "\($0.file ?? "nil"):\($0.line ?? 0):\($0.column ?? 0):\($0.severity.rawValue):\($0.message)"
    }.sorted()
    var expected = [
      "/fixture/Sources/Fixture/A.swift:1:37:error:cannot convert return expression of type 'String' to return type 'Int'",
      "/fixture/Sources/Fixture/B.swift:1:36:error:cannot find 'undefinedSymbolErrTwo' in scope",
      "/fixture/Sources/Fixture/C.swift:2:36:error:cannot convert value of type 'String' to expected argument type 'Int'",
    ]
    for file in ["D", "E"] {
      for index in 0..<20 {
        expected.append(
          "/fixture/Sources/Fixture/\(file).swift:\(index + 1):\(index < 10 ? 21 : 22):warning:initialization of immutable value 'unused\(file)\(index)' was never used; consider replacing with assignment to '_' or removing it [#NoUsage]"
        )
      }
    }
    #expect(actual == expected.sorted())
  }
}
