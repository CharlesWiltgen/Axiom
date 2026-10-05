import Foundation

func captures(_ regex: NSRegularExpression, in text: String) -> [String]? {
  let range = NSRange(text.startIndex..<text.endIndex, in: text)
  guard let match = regex.firstMatch(in: text, range: range) else { return nil }
  return (1..<match.numberOfRanges).map { index in
    guard let range = Range(match.range(at: index), in: text) else { return "" }
    return String(text[range])
  }
}

func diagnosticPath(_ path: String, context: ReaderContext, basenameOnly: Bool = false) -> String? {
  if path.hasPrefix("@") || path.hasPrefix("<") || path.contains("://") { return path }
  if basenameOnly && !path.contains("/") { return path }
  let absolute = URL(
    fileURLWithPath: path, relativeTo: URL(fileURLWithPath: context.effectiveCwd, isDirectory: true)
  ).standardizedFileURL.path
  return context.canonicalPath(absolute)
}

func readLog(data: Data, context: ReaderContext) -> ReadBatch {
  var batch = ReadBatch()
  if String(data: data, encoding: .utf8) == nil {
    batch.issues.append(
      .init(
        kind: .parseFailed, operation: "decode log",
        message: "Invalid UTF-8; readable diagnostics retained using replacement characters"))
  }
  do {
    let ansi = try NSRegularExpression(pattern: "\\u001B\\[[0-?]*[ -/]*[@-~]")
    let located = try NSRegularExpression(
      pattern: "^(.+?):([0-9]+)(?::([0-9]+))?: (error|warning|note|remark): (.*)$")
    let xctest = try NSRegularExpression(pattern: "^(-\\[.+?\\]) : (.*)$")
    let swiftTest = try NSRegularExpression(
      pattern:
        "^\\S+\\s+Test (.+?) recorded (an issue|a known issue|a warning)(?:.*?) at (.+?):([0-9]+):([0-9]+): (.*)$"
    )
    let tool = try NSRegularExpression(
      pattern: "^(?:([^|]+?): )?(error|warning|note|remark): (.+)$")
    let detail = try NSRegularExpression(pattern: "^(?:↳|􀄵)\\s+(.*)$")
    let trap = try NSRegularExpression(
      pattern: "^(.+?):([0-9]+): ((?:Fatal error|Precondition failed|Assertion failed)(?:: .*)?)$")
    var block: Int?
    var testDetails: Int?
    let text = String(decoding: data, as: UTF8.self).replacingOccurrences(of: "\r\n", with: "\n")
    for raw in text.components(separatedBy: "\n") {
      if context.shouldStop() {
        batch.issues.append(
          .init(
            kind: .timedOut, operation: "parse log",
            message: "Collection deadline or cancellation stopped log parsing"))
        return batch
      }
      let line = ansi.stringByReplacingMatches(
        in: raw, range: NSRange(raw.startIndex..<raw.endIndex, in: raw), withTemplate: "")
      if line.range(
        of: "^(?:[A-Za-z][\\w-]*: )*build cancelled",
        options: [.regularExpression, .caseInsensitive]
      ) != nil {
        batch.stoppedEarly = true
      }
      if line == "Testing started"
        || line.hasPrefix("Test Suite '") && line.contains("' started at ")
        || line.range(of: "^\\S+\\s+Test run started\\.$", options: .regularExpression) != nil
      {
        batch.testsStarted = true
      }
      if line.range(
        of: "^error: (?:Process '.*' )?exited with unexpected signal code",
        options: [.regularExpression, .caseInsensitive]) != nil
      {
        batch.crashed = true
      }
      if let found = captures(swiftTest, in: line) {
        block = nil
        let known = found[1] == "a known issue"
        let warning = found[1] == "a warning"
        let row = Int(found[3]).flatMap { $0 > 0 ? $0 : nil }
        let column = Int(found[4]).flatMap { $0 > 0 ? $0 : nil }
        if row == nil || column == nil {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "validate Swift Testing text location",
              message: "Nonpositive or invalid location: \(found[3]):\(found[4])", path: found[2]))
        }
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .test,
            severity: known ? .note : warning ? .warning : .error,
            message: found[5], sources: [.log],
            file: diagnosticPath(found[2], context: context, basenameOnly: true) ?? found[2],
            line: row, column: column,
            test: .init(id: found[0], isFailure: !known && !warning, framework: .swiftTesting)))
        testDetails = batch.diagnostics.count - 1
      } else if let found = captures(located, in: line), let severity = Severity(rawValue: found[3])
      {
        block = nil
        testDetails = nil
        let identified = diagnosticPath(found[0], context: context)
        let file = identified ?? found[0]
        if identified == nil {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "identify compiler source",
              message:
                "Cannot identify compiler source \(file); retained location is literal",
              path: file))
        }
        let row = Int(found[1]).flatMap { $0 > 0 ? $0 : nil }
        let column = Int(found[2]).flatMap { $0 > 0 ? $0 : nil }
        let unlocatedVirtual = (file.hasPrefix("<") || file.hasPrefix("@")) && found[1] == "0"
        if !unlocatedVirtual, row == nil || (!found[2].isEmpty && column == nil) {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "validate log location",
              message: "Nonpositive or invalid location: \(found[1]):\(found[2])", path: file))
        }
        if severity == .note, let last = batch.diagnostics.indices.last,
          batch.diagnostics[last].kind == .compiler,
          batch.diagnostics[last].severity == .error, batch.diagnostics[last].file == file
        {
          batch.diagnostics[last].notes =
            (batch.diagnostics[last].notes ?? []) + [
              .init(message: found[4], file: file, line: row, column: column, sources: [.log])
            ]
          continue
        }
        var message = found[4]
        var metadata: TestMetadata?
        var kind = DiagnosticKind.compiler
        if let test = captures(xctest, in: message) {
          kind = .test
          message = test[1]
          metadata = .init(id: test[0], isFailure: severity == .error, framework: .xctest)
        }
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: kind, severity: severity,
            message: message, sources: [.log], file: file, line: row, column: column, test: metadata
          ))
      } else if let index = testDetails, let found = captures(detail, in: line) {
        let messages =
          (batch.diagnostics[index].test?.messages ?? []) + [
            found[0].trimmingCharacters(in: .whitespaces)
          ]
        batch.diagnostics[index].test?.messages = messages
      } else if line.hasPrefix("Undefined symbols") || line.hasPrefix("duplicate symbol")
        || line == "The following build commands failed:"
      {
        testDetails = nil
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"),
            kind: line == "The following build commands failed:" ? .tool : .linker,
            severity: .error, message: line, sources: [.log]))
        block = batch.diagnostics.count - 1
      } else if let index = block,
        line.hasPrefix(" ") || line.hasPrefix("\t") || line.hasPrefix("ld:") || line.hasPrefix("(")
      {
        batch.diagnostics[index].message += "\n" + line
      } else if line.hasPrefix("ld: ") && !line.hasPrefix("ld: warning: ")
        && !line.hasPrefix("ld: note: ")
      {
        block = nil
        testDetails = nil
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .linker, severity: .error,
            message: line, sources: [.log]))
      } else if let found = captures(trap, in: line) {
        block = nil
        testDetails = nil
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .tool, severity: .error,
            message: found[2], sources: [.log],
            file: diagnosticPath(found[0], context: context) ?? found[0],
            line: Int(found[1]).flatMap { $0 > 0 ? $0 : nil }))
      } else if let found = captures(tool, in: line), !line.contains(" | "),
        let severity = Severity(rawValue: found[1])
      {
        block = nil
        testDetails = nil
        let location = found[0].components(separatedBy: ": ")[0]
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: found[0] == "ld" ? .linker : .tool,
            severity: severity, message: found[2], sources: [.log],
            file: location.contains("/") && !location.contains("://")
              ? diagnosticPath(location, context: context) : nil))
      } else if line.hasPrefix("Command ") && line.contains("failed")
        || line.hasPrefix("xcodebuild: error:")
      {
        block = nil
        testDetails = nil
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .tool, severity: .error,
            message: line, sources: [.log]))
      } else if !line.isEmpty && !line.hasPrefix(" ") && !line.hasPrefix("\t") {
        block = nil
        testDetails = nil
      }
    }
    batch.completedSources = [.log]
  } catch {
    batch.issues.append(
      .init(
        kind: .parseFailed, operation: "initialize log patterns",
        message: "Could not compile log diagnostic patterns: \(error)"))
  }
  return batch
}
