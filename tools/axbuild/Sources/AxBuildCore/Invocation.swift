import Foundation

enum InvocationAction: Sendable { case build, test, maintenance, informational, nativeValidation }
enum RenderFormat: String, Sendable {
  case compact = "json-compact"
  case pretty = "json"
}
struct Invocation: Sendable {
  var originalArgs: [String]
  var childArgs: [String]
  var executable: String
  var kind: CommandKind?
  var action: InvocationAction
  var producesBuild: Bool
  var format: RenderFormat
  var cwd: URL
  var effectiveCwd: URL
  var informational: Bool
  var toolIndex: Int = 0
  var unrecognized: [String] = []
  var requestsTests = false
}
struct RunArtifacts: Sendable { var run: String }
struct ToolCapabilities: Sendable {
  var eventVersion: String?
}
struct PreparedInvocation: Sendable {
  var childArgs: [String]
  var defaults: [String]
}

func parseInvocation(args: [String], cwd: URL) -> Result<Invocation, CollectionIssue> {
  guard !args.contains(where: { $0.utf8.contains(0) }) else {
    return .failure(
      .init(
        kind: .invalidInvocation, operation: "validate native arguments",
        message: "Embedded NUL cannot be passed to native argv"))
  }
  var index = 0
  var format = RenderFormat.compact
  if args.first == "--format" {
    guard args.count > 2, let selected = RenderFormat(rawValue: args[1]) else {
      return .failure(
        .init(
          kind: .invalidInvocation, operation: "parse format",
          message: "Expected json-compact or json: \(args)"))
    }
    format = selected
    index = 2
  }
  if args.indices.contains(index), args[index] == "--" { index += 1 }
  guard args.indices.contains(index) else {
    return .failure(
      .init(
        kind: .invalidInvocation, operation: "parse executable",
        message: "Missing build/test executable: \(args)"))
  }
  let executable = args[index]
  let childArgs = Array(args.dropFirst(index + 1))
  var toolIndex = 0
  var name = URL(fileURLWithPath: executable).lastPathComponent
  if name == "xcrun" {
    while toolIndex < childArgs.count && childArgs[toolIndex].hasPrefix("-") {
      let selector = childArgs[toolIndex]
      if ["--sdk", "--toolchain"].contains(selector) {
        guard toolIndex + 1 < childArgs.count, !childArgs[toolIndex + 1].hasPrefix("-") else {
          return .failure(
            .init(
              kind: .invalidInvocation, operation: "parse xcrun",
              message: "Missing value for \(selector): \(args)"))
        }
        toolIndex += 2
      } else if [
        "-v", "--verbose", "-l", "--log", "-r", "--run", "-n", "--no-cache", "-k", "--kill-cache",
      ].contains(selector) {
        toolIndex += 1
      } else {
        return .failure(
          .init(
            kind: .invalidInvocation, operation: "parse xcrun",
            message: "Unsupported selector \(selector): \(args)"))
      }
    }
    guard childArgs.indices.contains(toolIndex) else {
      return .failure(
        .init(
          kind: .invalidInvocation, operation: "parse xcrun",
          message: "Missing selected tool: \(args)"))
    }
    name = URL(fileURLWithPath: childArgs[toolIndex]).lastPathComponent
    toolIndex += 1
  }
  let toolArgs = Array(childArgs.dropFirst(toolIndex))
  var effectiveCwd = cwd
  var action = InvocationAction.nativeValidation
  var unrecognized: [String] = []
  var requestsTests = false
  var kind: CommandKind?
  var producesBuild = false
  if name == "swift" {
    if toolArgs.first == "--version" || toolArgs.first == "--help" || toolArgs.first == "-h" {
      action = .informational
    } else {
      guard let subcommand = toolArgs.first, ["build", "test"].contains(subcommand) else {
        return .failure(
          .init(
            kind: .invalidInvocation, operation: "parse swift",
            message: "Only swift build/test or help/version are supported: \(args)"))
      }
      kind = subcommand == "build" ? .swiftBuild : .swiftTest
      action = subcommand == "build" ? .build : .test
      producesBuild = !toolArgs.contains("--skip-build")
      if toolArgs.contains("--help") || toolArgs.contains("-h")
        || toolArgs.contains("--help-hidden") || toolArgs.contains("--version")
        || toolArgs.contains("--show-bin-path")
      {
        action = .informational
        producesBuild = false
      }
      for (position, arg) in toolArgs.enumerated() {
        if arg == "--package-path", toolArgs.indices.contains(position + 1) {
          effectiveCwd =
            URL(
              fileURLWithPath: toolArgs[position + 1],
              relativeTo: URL(fileURLWithPath: cwd.path, isDirectory: true)
            ).standardizedFileURL
        } else if arg.hasPrefix("--package-path=") {
          effectiveCwd =
            URL(
              fileURLWithPath: String(arg.dropFirst("--package-path=".count)),
              relativeTo: URL(fileURLWithPath: cwd.path, isDirectory: true)
            )
            .standardizedFileURL
        }
      }
    }
  } else if name == "xcodebuild" {
    kind = .xcodebuild
    let values: Set<String> = [
      "-project", "-workspace", "-scheme", "-target", "-configuration", "-sdk", "-destination",
      "-destination-timeout", "-arch", "-toolchain", "-jobs", "-derivedDataPath",
      "-resultBundlePath", "-resultBundleVersion", "-resultStreamPath", "-xcconfig", "-testPlan",
      "-only-testing", "-skip-testing", "-test-timeouts-enabled",
      "-default-test-execution-time-allowance", "-maximum-test-execution-time-allowance",
      "-parallel-testing-enabled", "-parallel-testing-worker-count",
      "-maximum-concurrent-test-simulator-destinations",
      "-maximum-concurrent-test-device-destinations", "-enableCodeCoverage", "-archivePath",
      "-exportPath", "-exportOptionsPlist", "-clonedSourcePackagesDirPath", "-packageCachePath",
      "-test-iterations", "-test-repetition-relaunch-enabled", "-collect-test-diagnostics",
      "-enableAddressSanitizer", "-enableThreadSanitizer", "-enableUndefinedBehaviorSanitizer",
      "-testLanguage", "-testRegion", "-xctestrun", "-testProductsPath", "-only-test-configuration",
      "-skip-test-configuration",
    ]
    let info: Set<String> = [
      "-help", "-list", "-showBuildSettings", "-version", "-showsdks", "-showdestinations",
      "-showTestPlans",
    ]
    let flags: Set<String> = [
      "-quiet", "-verbose", "-json", "-alltargets", "-dry-run", "-allowProvisioningUpdates",
      "-allowProvisioningDeviceRegistration", "-disableAutomaticPackageResolution",
      "-onlyUsePackageVersionsFromResolvedFile", "-skipPackageUpdates",
      "-skipPackagePluginValidation", "-skipMacroValidation", "-hideShellScriptEnvironment",
      "-retry-tests-on-failure", "-run-tests-until-failure", "-parallelizeTargets",
      "-showBuildTimingSummary",
    ]
    var actions: [String] = []
    var information = false
    var ambiguous = false
    var position = 0
    var unknown: [String] = []
    while position < toolArgs.count {
      let arg = toolArgs[position]
      if values.contains(arg) {
        if position + 1 >= toolArgs.count {
          ambiguous = true
          unknown.append(arg)
          break
        }
        position += 2
        continue
      }
      if info.contains(arg) {
        information = true
      } else if [
        "build", "test", "test-without-building", "build-for-testing", "archive", "install",
        "analyze", "clean",
      ].contains(arg) {
        actions.append(arg)
      } else if ["-only-testing:", "-skip-testing:"].contains(where: {
        arg.hasPrefix($0) && arg.count > $0.count
      }) {
      } else if flags.contains(arg) || (!arg.hasPrefix("-") && arg.contains("="))
        || (arg.hasPrefix("-IDE") && arg.contains("="))
      {
      } else {
        ambiguous = true
        unknown.append(arg)
      }
      position += 1
    }
    unrecognized = unknown
    requestsTests = actions.contains("test") || actions.contains("test-without-building")
    if !ambiguous {
      if actions.isEmpty && information {
        action = .informational
      } else if actions.isEmpty {
        action = .build
        producesBuild = true
      } else {
        producesBuild = actions.contains {
          ["build", "test", "build-for-testing", "archive", "install", "analyze"].contains($0)
        }
        if actions.contains("test") || actions.contains("test-without-building") {
          action = .test
        } else {
          action = producesBuild ? .build : .maintenance
        }
      }
    }
  } else {
    return .failure(
      .init(
        kind: .invalidInvocation, operation: "parse executable",
        message: "Unsupported executable \(executable): \(args)"))
  }
  return .success(
    .init(
      originalArgs: args, childArgs: childArgs, executable: executable, kind: kind, action: action,
      producesBuild: producesBuild, format: format, cwd: cwd, effectiveCwd: effectiveCwd,
      informational: action == .informational, toolIndex: toolIndex, unrecognized: unrecognized,
      requestsTests: requestsTests))
}

func applyDiagnosticDefaults(
  invocation: Invocation, artifacts: RunArtifacts, capabilities: ToolCapabilities
) -> PreparedInvocation {
  var args = invocation.childArgs
  var defaults: [String] = []
  guard !invocation.informational else { return .init(childArgs: args, defaults: defaults) }
  if invocation.kind == .xcodebuild, invocation.action == .build || invocation.action == .test {
    if !args.contains("-resultBundlePath") {
      let addition = ["-resultBundlePath", artifacts.run + "/result.xcresult"]
      args += addition
      defaults += addition
    }
  } else if invocation.kind == .swiftTest, !args.contains("--disable-swift-testing"),
    let version = capabilities.eventVersion
  {
    if !args.contains(where: {
      $0 == "--event-stream-output-path" || $0.hasPrefix("--event-stream-output-path=")
    }) {
      let addition = ["--event-stream-output-path", artifacts.run + "/events.jsonl"]
      args += addition
      defaults += addition
    }
    if !args.contains(where: {
      $0 == "--event-stream-version" || $0.hasPrefix("--event-stream-version=")
    }) {
      args += ["--event-stream-version", version]
      defaults += ["--event-stream-version", version]
    }
  }
  return .init(childArgs: args, defaults: defaults)
}
