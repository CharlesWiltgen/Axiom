import Foundation
import Testing

@testable import AxBuildCore

@Suite struct InvocationTests {
  let cwd = URL(fileURLWithPath: "/project")

  @Test(arguments: [
    (["xcodebuild", "-scheme", "build"], InvocationAction.build, true),
    (["xcodebuild", "-scheme", "test", "clean"], .maintenance, false),
    (["xcodebuild", "-list"], .informational, false),
    (["xcodebuild", "build-for-testing"], .build, true),
    (["xcodebuild", "test-without-building"], .test, false),
    (["xcodebuild", "-help", "build"], .build, true),
    (["xcodebuild", "-unknown", "build"], .nativeValidation, false),
    (["xcrun", "--sdk", "macosx", "--toolchain", "swift", "xcodebuild", "test"], .test, true),
    (["/tools/swift", "build", "--package-path", "Some Folder"], .build, true),
    (["swift", "test", "--help"], .informational, false),
    (["swift", "--version"], .informational, false),
    (["--format", "json", "--", "swift", "test"], .test, true),
  ]) func classifiesArguments(example: ([String], InvocationAction, Bool)) throws {
    let invocation = try parseInvocation(args: example.0, cwd: cwd).get()
    #expect(invocation.action == example.1)
    #expect(invocation.producesBuild == example.2)
    #expect(invocation.originalArgs == example.0)
  }

  @Test(arguments: [
    [], ["rm", "-rf", "somewhere"], ["swift", "run"], ["swift", "package"],
    ["xcrun", "--sdk"], ["xcrun", "--find", "xcodebuild"], ["xcrun", "--unknown", "swift", "test"],
    ["--format", "xml", "swift", "build"],
  ])
  func refusesUnsupportedBeforeLaunch(args: [String]) {
    guard case .failure(let issue) = parseInvocation(args: args, cwd: cwd) else {
      Issue.record("Unsupported argv accepted: \(args)")
      return
    }
    #expect(issue.kind == .invalidInvocation)
    #expect(!issue.operation.isEmpty && !issue.message.isEmpty)
  }

  @Test func retainsExplicitArtifactsAndDisablement() throws {
    let args = [
      "xcodebuild", "test", "-resultBundlePath", "my results.xcresult",
      "-IDEBuildingContinueBuildingAfterErrors=NO",
    ]
    let invocation = try parseInvocation(args: args, cwd: cwd).get()
    let prepared = applyDiagnosticDefaults(
      invocation: invocation, artifacts: .init(run: "/run"), capabilities: .init())
    #expect(prepared.childArgs == invocation.childArgs)
    #expect(prepared.defaults == [])
  }

  @Test func addsDefaultsToImplicitBuildWithoutAnActionToken() throws {
    let invocation = try parseInvocation(args: ["xcodebuild", "-scheme", "App"], cwd: cwd).get()
    let prepared = applyDiagnosticDefaults(
      invocation: invocation, artifacts: .init(run: "/run"), capabilities: .init())
    #expect(
      prepared.childArgs == [
        "-scheme", "App", "-resultBundlePath", "/run/result.xcresult",
        "-IDEBuildingContinueBuildingAfterErrors=YES",
      ])
  }

  @Test func resolvesPackageDirectoryAndPreservesCallerStream() throws {
    let args = [
      "swift", "test", "--package-path", "Some Folder", "--event-stream-output-path",
      "caller.jsonl", "--event-stream-version", "future", "--color-diagnostics",
    ]
    let invocation = try parseInvocation(args: args, cwd: cwd).get()
    #expect(invocation.effectiveCwd.path == "/project/Some Folder")
    let prepared = applyDiagnosticDefaults(
      invocation: invocation, artifacts: .init(run: "/run"),
      capabilities: .init(eventVersion: "6.3", noColor: true))
    #expect(prepared.childArgs == invocation.childArgs)
  }
}
