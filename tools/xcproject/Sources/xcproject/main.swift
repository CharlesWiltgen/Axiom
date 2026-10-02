import Foundation
import XcodeProjectFormat

enum ProjectError: Error, CustomStringConvertible {
  case invalid(String)
  var description: String {
    switch self {
    case .invalid(let context): context
    }
  }
}

struct Options {
  let command: String
  let values: [String: String]
  let valueOnly: Bool

  init(_ arguments: [String]) throws {
    guard let command = arguments.first, ["discover", "inspect", "settings"].contains(command)
    else {
      throw ProjectError.invalid("Expected discover, inspect or settings; use --help")
    }
    self.command = command
    let allowed: Set<String> =
      switch command {
      case "discover": ["--root"]
      case "inspect": ["--root", "--project", "--target", "--configuration"]
      default: ["--project", "--input", "--target", "--configuration", "--sdk", "--arch", "--key"]
      }
    var values: [String: String] = [:]
    var valueOnly = false
    var index = 1
    while index < arguments.count {
      let option = arguments[index]
      if option == "--value-only", command == "settings", !valueOnly {
        valueOnly = true
        index += 1
        continue
      }
      guard allowed.contains(option) else {
        throw ProjectError.invalid("Unknown option \(option) for \(command)")
      }
      guard values[option] == nil else { throw ProjectError.invalid("Duplicate option \(option)") }
      guard index + 1 < arguments.count, !arguments[index + 1].hasPrefix("--"),
        !arguments[index + 1].isEmpty
      else {
        throw ProjectError.invalid("Expected a value for \(option)")
      }
      values[option] = arguments[index + 1]
      index += 2
    }
    guard values["--root"] == nil || values["--project"] == nil else {
      throw ProjectError.invalid("Select --project or --root, not both")
    }
    self.values = values
    self.valueOnly = valueOnly
  }

  func required(_ name: String) throws -> String {
    guard let value = values[name] else {
      throw ProjectError.invalid("Missing required option \(name) for \(command)")
    }
    return value
  }
}

func discover(root: URL) throws -> [URL] {
  let keys: Set<URLResourceKey> = [.isDirectoryKey, .isSymbolicLinkKey]
  guard try root.resourceValues(forKeys: keys).isDirectory == true else {
    throw ProjectError.invalid("Discovery root is not a directory: \(root.path)")
  }
  let excluded: Set<String> = [
    "Pods", "Carthage", ".build", "DerivedData", "node_modules", "scratch", ".git", ".swiftpm",
  ]
  var enumerationError: (any Error)?
  guard
    let enumerator = FileManager.default.enumerator(
      at: root, includingPropertiesForKeys: Array(keys), options: [],
      errorHandler: { _, error in
        enumerationError = error
        return false
      }
    )
  else { throw ProjectError.invalid("Cannot enumerate discovery root \(root.path)") }
  var projects: [URL] = []
  for case let url as URL in enumerator {
    let values = try url.resourceValues(forKeys: keys)
    if values.isSymbolicLink == true || excluded.contains(url.lastPathComponent) {
      enumerator.skipDescendants()
      continue
    }
    if values.isDirectory == true, url.pathExtension == "xcodeproj" {
      projects.append(url.standardizedFileURL)
      enumerator.skipDescendants()
    }
  }
  if let enumerationError { throw enumerationError }
  return projects.sorted { $0.path < $1.path }
}

func inspect(_ options: Options) throws -> [String: Any] {
  let project: URL
  if let path = options.values["--project"] {
    project = URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath()
  } else {
    let root = URL(
      fileURLWithPath: options.values["--root"] ?? FileManager.default.currentDirectoryPath)
    let projects = try discover(root: root)
    guard projects.count == 1, let only = projects.first else {
      throw ProjectError.invalid(
        projects.isEmpty
          ? "No Xcode project in \(root.path); use --project"
          : "Ambiguous project selection: \(projects.map(\.path).joined(separator: ", ")); use --project"
      )
    }
    project = only
  }
  guard project.pathExtension == "xcodeproj" else {
    throw ProjectError.invalid("Expected .xcodeproj container: \(project.path)")
  }
  let files = ["xcproj", "pbxproj"].filter {
    FileManager.default.fileExists(atPath: project.appendingPathComponent("project.\($0)").path)
  }
  guard files.count == 1, let format = files.first else {
    throw ProjectError.invalid(
      files.isEmpty
        ? "Neither project.pbxproj nor project.xcproj exists in \(project.path)"
        : "Both project.pbxproj and project.xcproj exist in \(project.path); select the authoritative format before inspection"
    )
  }
  let file = project.appendingPathComponent("project.\(format)")
  let declarations: [String: Any]
  let targets: [String]
  let configurations: [String]
  var targetConfigurations: [String: [String]] = [:]
  do {
    let data = try Data(contentsOf: file)
    if format == "xcproj" {
      let model = try XCSchema.Project(jsonRepresentation: data)
      guard
        let dictionary = try JSONSerialization.jsonObject(with: data, options: [.json5Allowed])
          as? [String: Any]
      else {
        throw ProjectError.invalid("Expected project dictionary")
      }
      declarations = dictionary
      targets = model.targets.map(\.name)
      configurations = model.configurations.map { $0.name.rawValue }
    } else {
      guard
        let dictionary = try PropertyListSerialization.propertyList(from: data, format: nil)
          as? [String: Any],
        let objects = dictionary["objects"] as? [String: [String: Any]],
        let root = dictionary["rootObject"] as? String, let pbx = objects[root],
        pbx["isa"] as? String == "PBXProject",
        let targetIDs = pbx["targets"] as? [String],
        let configList = pbx["buildConfigurationList"] as? String,
        objects[configList]?["isa"] as? String == "XCConfigurationList",
        let configIDs = objects[configList]?["buildConfigurations"] as? [String]
      else { throw ProjectError.invalid("Missing PBXProject, target list or configuration list") }
      declarations = dictionary
      targets = try targetIDs.map { id in
        guard let target = objects[id], let name = target["name"] as? String,
          let kind = target["isa"] as? String,
          ["PBXNativeTarget", "PBXAggregateTarget", "PBXLegacyTarget"].contains(kind),
          let listID = target["buildConfigurationList"] as? String,
          objects[listID]?["isa"] as? String == "XCConfigurationList",
          let ids = objects[listID]?["buildConfigurations"] as? [String]
        else {
          throw ProjectError.invalid("Missing or invalid target/configuration reference \(id)")
        }
        let names = try ids.map { configID in
          guard let config = objects[configID], config["isa"] as? String == "XCBuildConfiguration",
            let configName = config["name"] as? String
          else {
            throw ProjectError.invalid(
              "Missing or invalid target configuration reference \(configID) for \(name)")
          }
          return configName
        }
        guard !names.isEmpty, Set(names).count == names.count, !names.contains("") else {
          throw ProjectError.invalid("Missing or ambiguous target configurations for \(name)")
        }
        targetConfigurations[name] = names
        return name
      }
      configurations = try configIDs.map { id in
        guard objects[id]?["isa"] as? String == "XCBuildConfiguration",
          let name = objects[id]?["name"] as? String
        else {
          throw ProjectError.invalid("Missing or invalid project configuration reference \(id)")
        }
        return name
      }
    }
    guard Set(targets).count == targets.count, Set(configurations).count == configurations.count,
      !targets.contains(""), !configurations.contains("")
    else {
      throw ProjectError.invalid("Duplicate or empty target/configuration names")
    }
  } catch { throw ProjectError.invalid("Reading \(file.path): \(error)") }
  var selection: [String: String] = [:]
  for (option, label, candidates) in [
    ("--target", "target", targets), ("--configuration", "configuration", configurations),
  ] {
    if let value = options.values[option] {
      guard candidates.contains(value) else {
        throw ProjectError.invalid(
          "Missing \(label) \(value) in \(project.path); available: \(candidates.joined(separator: ", "))"
        )
      }
      selection[label] = value
    }
  }
  if let target = selection["target"], let configuration = selection["configuration"],
    let names = targetConfigurations[target], !names.contains(configuration)
  {
    throw ProjectError.invalid(
      "Missing configuration \(configuration) for target \(target) in \(project.path); available: \(names.joined(separator: ", "))"
    )
  }
  return [
    "project": project.path, "format": format, "semantics": "declarations", "targets": targets,
    "configurations": configurations, "selection": selection, "declarations": declarations,
  ]
}

func settings(_ options: Options) throws -> [String: Any] {
  let requestedProject = try options.required("--project")
  let input = try options.required("--input")
  let target = try options.required("--target")
  let configuration = try options.required("--configuration")
  let sdk = try options.required("--sdk")
  let key = try options.required("--key")
  let inspection = try inspect(
    Options([
      "inspect", "--project", requestedProject, "--target", target, "--configuration",
      configuration,
    ]))
  guard let project = inspection["project"] as? String else {
    throw ProjectError.invalid("Cannot select settings project \(requestedProject)")
  }
  let records: [[String: Any]]
  do {
    let data = try Data(contentsOf: URL(fileURLWithPath: input))
    guard let value = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      throw ProjectError.invalid("Expected Xcode settings array")
    }
    records = value
  } catch { throw ProjectError.invalid("Reading settings capture \(input): \(error)") }
  let matches = records.filter { $0["target"] as? String == target }
  guard matches.count == 1, let record = matches.first,
    let settings = record["buildSettings"] as? [String: Any]
  else {
    throw ProjectError.invalid(
      "Settings capture \(input) must contain exactly one target record with buildSettings for \(target); found \(matches.count)"
    )
  }
  guard let capturedProject = settings["PROJECT_FILE_PATH"] as? String,
    URL(fileURLWithPath: capturedProject).standardizedFileURL.resolvingSymlinksInPath().path
      == project,
    settings["TARGET_NAME"] as? String == target,
    settings["CONFIGURATION"] as? String == configuration,
    let platform = settings["PLATFORM_NAME"] as? String, !platform.isEmpty,
    let sdkName = settings["SDK_NAME"] as? String, sdkName.hasPrefix(platform),
    sdkName.dropFirst(platform.count).first?.isNumber == true,
    sdk == platform || sdk == sdkName
  else {
    throw ProjectError.invalid(
      "Settings capture \(input) identity mismatch or missing metadata: expected PROJECT_FILE_PATH=\(project), TARGET_NAME=\(target), CONFIGURATION=\(configuration), SDK_NAME/PLATFORM_NAME=\(sdk)"
    )
  }
  let architectures = (settings["ARCHS"] as? String ?? "").split(whereSeparator: \.isWhitespace)
    .map(String.init)
  if let architecture = options.values["--arch"], architectures != [architecture] {
    throw ProjectError.invalid(
      "Settings capture \(input) architecture selection mismatch: expected only \(architecture); ARCHS=\(architectures.joined(separator: " "))"
    )
  }
  guard let value = settings[key] as? String,
    !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  else {
    throw ProjectError.invalid(
      "Settings capture \(input) has a missing, empty or non-string \(key) for \(target)/\(configuration)/\(sdk)"
    )
  }
  return [
    "evaluation": "xcodebuild-general-settings", "project": project, "target": target,
    "configuration": configuration, "sdk": sdkName, "architectures": architectures, "key": key,
    "value": value,
  ]
}

let help = """
  xcproject — read-only Xcode project inspection (macOS 14+, Swift 6.4 build)
    discover [--root DIRECTORY]
    inspect [--project FILE.xcodeproj | --root DIRECTORY] [--target NAME] [--configuration NAME]
    settings --project FILE.xcodeproj --input SETTINGS.json --target NAME --configuration NAME --sdk SDK --key KEY [--arch ARCH] [--value-only]
  inspect emits declarations, including conditionals and references, never effective settings.
  settings reads captured xcodebuild -showBuildSettings -json output; no subprocesses are launched.
  """

do {
  let arguments = Array(CommandLine.arguments.dropFirst())
  if arguments == ["--help"] {
    print(help)
  } else {
    let options = try Options(arguments)
    let result: [String: Any]
    switch options.command {
    case "discover":
      let root = URL(
        fileURLWithPath: options.values["--root"] ?? FileManager.default.currentDirectoryPath)
      result = ["projects": try discover(root: root).map(\.path)]
    case "inspect": result = try inspect(options)
    default: result = try settings(options)
    }
    if options.valueOnly, let value = result["value"] as? String {
      print(value)
    } else {
      let data = try JSONSerialization.data(
        withJSONObject: result, options: [.sortedKeys, .withoutEscapingSlashes])
      FileHandle.standardOutput.write(data + Data("\n".utf8))
    }
  }
} catch {
  FileHandle.standardError.write(Data("xcproject: \(error)\n".utf8))
  exit(1)
}
