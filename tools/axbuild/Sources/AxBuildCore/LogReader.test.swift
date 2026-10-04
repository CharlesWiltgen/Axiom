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
