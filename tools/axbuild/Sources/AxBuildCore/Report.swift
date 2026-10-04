import Foundation

enum CollectionStatus: String, Codable, Sendable { case complete, partial, unavailable }
struct Collection: Codable, Sendable {
  var status: CollectionStatus = .unavailable
  var buildCoverage = "unknown"
  var sources: [Source] = []
  var issues: [CollectionIssue] = []
}
struct DiagnosticCounts: Codable, Equatable, Sendable {
  var errors: Int?
  var warnings: Int?
  var notes: Int?
  var remarks: Int?
  var failedTests: Int?
  enum CodingKeys: String, CodingKey { case errors, warnings, notes, remarks, failedTests }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(errors, forKey: .errors)
    try c.encode(warnings, forKey: .warnings)
    try c.encode(notes, forKey: .notes)
    try c.encode(remarks, forKey: .remarks)
    try c.encode(failedTests, forKey: .failedTests)
  }
}
struct Omissions: Codable, Equatable, Sendable {
  var diagnostics = 0
  var details = 0
  var issues = 0
  var warningFiles = 0
}
struct DiagnosticGroup: Codable, Sendable {
  var file: String?
  var items: [Diagnostic] = []
  var warningCount: Int?
  enum CodingKeys: String, CodingKey { case file, items, warningCount }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(file, forKey: .file)
    try c.encode(items, forKey: .items)
    try c.encodeIfPresent(warningCount, forKey: .warningCount)
  }
}
struct ArtifactReferences: Codable, Sendable {
  var run: String?
  var log: String?
  var report: String?
  var resultBundle: String?
  var eventStream: String?
  enum CodingKeys: String, CodingKey { case run, log, report, resultBundle, eventStream }
  func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(run, forKey: .run)
    try c.encode(log, forKey: .log)
    try c.encode(report, forKey: .report)
    try c.encodeIfPresent(resultBundle, forKey: .resultBundle)
    try c.encodeIfPresent(eventStream, forKey: .eventStream)
  }
}
struct InvocationRecord: Codable, Sendable {
  var originalArgs: [String]
  var executedArgs: [String]
  var executable: String
  var cwd: String
  var effectiveCwd: String
  var defaults: [String]
}
struct CapturedRun: Sendable {
  var command: CommandOutcome
  var artifacts: ArtifactReferences
  var issues: [CollectionIssue] = []
  var logTail: String?
  var invocation: InvocationRecord?
}
struct LogExcerpt: Codable, Sendable {
  var text: String
  var position = "tail"
  var truncated = false
}
struct Report: Codable, Sendable {
  var schemaVersion = 1
  var command: CommandOutcome
  var collection: Collection = .init()
  var counts: DiagnosticCounts = .init()
  var diagnostics: [DiagnosticGroup] = []
  var omissions: Omissions = .init()
  var artifacts: ArtifactReferences
  var logExcerpt: LogExcerpt?
  var invocation: InvocationRecord?
}
struct ReconciledDiagnostics: Sendable {
  var diagnostics: [Diagnostic] = []
  var issues: [CollectionIssue] = []
  var failedTests: Int?
}
struct RenderedReport: Sendable {
  var data: Data
  var report: Report
}

private struct TestName {
  var target: String?
  var suite: String?
  var method: String?
}
private func testName(_ diagnostic: Diagnostic) -> TestName {
  if let id = diagnostic.test?.id, id.hasPrefix("-["), id.hasSuffix("]") {
    let parts = id.dropFirst(2).dropLast().split(separator: " ", maxSplits: 1)
    if parts.count == 2 {
      let type = parts[0].split(separator: ".")
      return .init(
        target: type.count > 1 ? String(type.dropLast().joined(separator: ".")) : diagnostic.target,
        suite: type.last.map(String.init), method: String(parts[1]))
    }
  }
  let name = diagnostic.testName ?? (diagnostic.sources == [.log] ? diagnostic.test?.id : nil)
  let parts = name?.split(separator: "/").map(String.init) ?? []
  let method = parts.last.map { $0.hasSuffix("()") ? String($0.dropLast(2)) : $0 }
  return .init(
    target: diagnostic.target,
    suite: parts.count > 1 ? parts.dropLast().joined(separator: "/") : nil, method: method)
}
private func normalizedMessage(_ message: String, test: Bool) -> String {
  var text =
    test
    ? String(
      message.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first ?? "")
    : message
  if !test, let marker = text.range(of: " [#"), text.hasSuffix("]") {
    text = String(text[..<marker.lowerBound])
  }
  return text.trimmingCharacters(in: .whitespacesAndNewlines)
}
private func sameTestExecution(_ left: Diagnostic, _ right: Diagnostic) -> Bool {
  guard left.kind == .test, right.kind == .test else { return false }
  if let a = left.test?.id, let b = right.test?.id, a == b { return true }
  let a = testName(left)
  let b = testName(right)
  return a.target != nil && a.target == b.target && a.suite != nil && a.suite == b.suite
    && a.method != nil && a.method == b.method
}
private func executionEvidence(_ actual: Diagnostic, summary: Diagnostic) -> Diagnostic {
  var merged = actual
  for source in summary.sources {
    if !merged.sources.contains(source) { merged.sources.append(source) }
  }
  if var metadata = merged.test {
    var aliases = metadata.aliases ?? []
    for (record, id) in [(actual, metadata.id), (summary, summary.test?.id)] {
      if let id {
        for source in record.sources {
          let alias = TestAlias(source: source, id: id)
          if !aliases.contains(alias) { aliases.append(alias) }
        }
      }
    }
    metadata.aliases = aliases.isEmpty ? nil : aliases
    if summary.sources.contains(.testResults) || summary.sources.contains(.events) {
      metadata.id = summary.test?.id ?? metadata.id
    }
    merged.test = metadata
  }
  return merged
}
private func displayedValues(_ diagnostic: Diagnostic) -> [String: String] {
  var result: [String: String] = [:]
  for message in diagnostic.test?.messages ?? [] {
    if let separator = message.range(of: " → ") {
      result[String(message[..<separator.lowerBound]).trimmingCharacters(in: .whitespaces)] =
        String(message[separator.upperBound...]).trimmingCharacters(in: .whitespaces)
    }
  }
  return result
}
private func compatibleRecords(_ left: Diagnostic, _ right: Diagnostic) -> Bool {
  guard left.kind == right.kind, left.severity == right.severity,
    Set(left.sources).isDisjoint(with: right.sources)
  else { return false }
  if let target = left.target, let other = right.target, target != other { return false }
  if let a = left.line, let b = right.line, a != b { return false }
  if let a = left.column, let b = right.column, a != b { return false }
  var sameFile = left.file == right.file
  if let a = left.file, let b = right.file, a != b {
    let partial = !a.contains("/") || !b.contains("/")
    sameFile =
      partial
      && URL(fileURLWithPath: a).lastPathComponent == URL(fileURLWithPath: b).lastPathComponent
    if !sameFile { return false }
  } else if left.file == nil || right.file == nil {
    sameFile = left.file == right.file
  }
  if left.kind == .test {
    if let a = left.test?.framework, let b = right.test?.framework, a != b { return false }
    if let a = left.test?.isFailure, let b = right.test?.isFailure, a != b { return false }
    for (a, b) in [
      (left.test?.caseID, right.test?.caseID), (left.test?.executionID, right.test?.executionID),
    ] {
      if let a, let b, a != b { return false }
    }
    if let a = left.test?.iteration, let b = right.test?.iteration, a != b { return false }
    if let a = left.test?.evaluatedValues, let b = right.test?.evaluatedValues, a != b {
      return false
    }
    let leftValues = displayedValues(left)
    let rightValues = displayedValues(right)
    for (key, value) in leftValues {
      if let other = rightValues[key], value != other { return false }
    }
    let a = testName(left)
    let b = testName(right)
    if let target = a.target, let other = b.target, target != other { return false }
    if let suite = a.suite, let other = b.suite, suite != other { return false }
    let sameID = left.test?.id != nil && left.test?.id == right.test?.id
    guard
      sameID
        || (a.method != nil && a.method == b.method && sameFile && left.line != nil
          && right.line != nil)
    else { return false }
  } else if !sameFile || left.line != right.line || left.column != right.column {
    return false
  }
  return normalizedMessage(left.message, test: left.kind == .test)
    == normalizedMessage(right.message, test: right.kind == .test)
}

func reconcileDiagnostics(batches: [ReadBatch], context: ReaderContext) -> ReconciledDiagnostics {
  var result = ReconciledDiagnostics()
  for batch in batches {
    if context.shouldStop() {
      result.issues.append(
        .init(
          kind: .timedOut, operation: "reconcile diagnostics",
          message: "Collection deadline stopped cross-source matching"))
      break
    }
    var incomingRecords = batch.diagnostics
    for summary in result.diagnostics.filter({ $0.synthetic }) {
      for index in incomingRecords.indices
      where !incomingRecords[index].synthetic && incomingRecords[index].test?.isFailure == true
        && Set(summary.sources).isDisjoint(with: incomingRecords[index].sources)
        && sameTestExecution(summary, incomingRecords[index])
      {
        incomingRecords[index] = executionEvidence(incomingRecords[index], summary: summary)
      }
    }
    result.diagnostics.removeAll { summary in
      summary.synthetic
        && incomingRecords.contains {
          !$0.synthetic && $0.test?.isFailure == true && sameTestExecution(summary, $0)
        }
    }
    for summary in incomingRecords.filter({ $0.synthetic }) {
      for index in result.diagnostics.indices
      where !result.diagnostics[index].synthetic
        && result.diagnostics[index].test?.isFailure == true
        && Set(summary.sources).isDisjoint(with: result.diagnostics[index].sources)
        && sameTestExecution(result.diagnostics[index], summary)
      {
        result.diagnostics[index] = executionEvidence(result.diagnostics[index], summary: summary)
      }
    }
    incomingRecords.removeAll { summary in
      summary.synthetic
        && result.diagnostics.contains {
          !$0.synthetic && $0.test?.isFailure == true && sameTestExecution($0, summary)
        }
    }
    var edges: [[Int]] = []
    for incoming in incomingRecords {
      var candidates: [Int] = []
      for index in result.diagnostics.indices {
        if context.shouldStop() {
          result.issues.append(
            .init(
              kind: .timedOut, operation: "match diagnostics",
              message: "Collection deadline stopped candidate matching"))
          result.failedTests = nil
          for index in result.diagnostics.indices {
            result.diagnostics[index].id = .init("d\(index + 1)")
          }
          return result
        }
        if compatibleRecords(result.diagnostics[index], incoming) { candidates.append(index) }
      }
      edges.append(candidates)
    }
    var reverse: [Int: Int] = [:]
    for indices in edges { for index in indices { reverse[index, default: 0] += 1 } }
    for (offset, incoming) in incomingRecords.enumerated() {
      let indices = edges[offset]
      if indices.count == 1, let index = indices.first, reverse[index] == 1 {
        var merged = result.diagnostics[index]
        if merged.message != incoming.message {
          merged.alternateMessages =
            (merged.alternateMessages ?? [])
            + incoming.sources.map { .init(source: $0, message: incoming.message) }
        }
        merged.sources += incoming.sources
        if merged.file == nil || !(merged.file?.contains("/") ?? false) {
          merged.file = incoming.file ?? merged.file
        }
        merged.line = merged.line ?? incoming.line
        merged.column = merged.column ?? incoming.column
        merged.target = merged.target ?? incoming.target
        if var metadata = merged.test, let richer = incoming.test {
          let originalID = metadata.id
          if incoming.sources.contains(.events) || incoming.sources.contains(.testResults) {
            metadata.id = richer.id ?? metadata.id
          }
          metadata.framework = metadata.framework ?? richer.framework
          metadata.isFailure = metadata.isFailure ?? richer.isFailure
          metadata.isKnown = metadata.isKnown ?? richer.isKnown
          metadata.issueSeverity = metadata.issueSeverity ?? richer.issueSeverity
          metadata.evaluatedValues = metadata.evaluatedValues ?? richer.evaluatedValues
          if metadata.messages == nil {
            metadata.messages = richer.messages
          } else if metadata.messages != richer.messages, let extra = richer.messages {
            metadata.messages = (metadata.messages ?? []) + extra
          }
          var aliases = metadata.aliases ?? []
          if let originalID {
            for source in merged.sources.filter({ !incoming.sources.contains($0) }) {
              let alias = TestAlias(source: source, id: originalID)
              if !aliases.contains(alias) { aliases.append(alias) }
            }
          }
          for alias in richer.aliases ?? richer.id.map({ id in
            incoming.sources.map { TestAlias(source: $0, id: id) }
          }) ?? [] {
            if !aliases.contains(alias) { aliases.append(alias) }
          }
          metadata.aliases = aliases.isEmpty ? nil : aliases
          metadata.caseID = metadata.caseID ?? richer.caseID
          metadata.iteration = metadata.iteration ?? richer.iteration
          metadata.executionID = metadata.executionID ?? richer.executionID
          merged.test = metadata
        }
        merged.testName = merged.testName ?? incoming.testName
        merged.notes = merged.notes ?? incoming.notes
        merged.fixIts = merged.fixIts ?? incoming.fixIts
        result.diagnostics[index] = merged
      } else {
        var possibleDuplicate = false
        if indices.isEmpty && incoming.kind == .test {
          possibleDuplicate = result.diagnostics.contains { prior in
            var a = prior
            var b = incoming
            a.test?.messages = nil
            b.test?.messages = nil
            a.test?.evaluatedValues = nil
            b.test?.evaluatedValues = nil
            b.severity = a.severity
            b.test?.isFailure = a.test?.isFailure
            return compatibleRecords(a, b)
          }
        }
        if !indices.isEmpty || possibleDuplicate {
          result.issues.append(
            .init(
              kind: .ambiguousCorrelation, operation: "match diagnostics",
              message:
                "No unique one-to-one match for \(incoming.id.rawValue) from \(incoming.sources.map(\.rawValue).joined(separator: ","))"
            ))
        }
        result.diagnostics.append(incoming)
      }
    }
  }
  var identities = Set<String>()
  var uncertain = result.issues.contains {
    $0.kind == .ambiguousCorrelation || $0.kind == .timedOut
  }
  for index in result.diagnostics.indices {
    result.diagnostics[index].id = .init("d\(index + 1)")
    let diagnostic = result.diagnostics[index]
    guard diagnostic.kind == .test else { continue }
    if diagnostic.test?.isFailure == nil { uncertain = true }
    guard diagnostic.test?.isFailure == true else { continue }
    if let id = diagnostic.test?.id,
      diagnostic.sources.contains(.events) || diagnostic.sources.contains(.testResults)
        || id.hasPrefix("-[")
    {
      identities.insert(id)
    } else {
      uncertain = true
      result.issues.append(
        .init(
          kind: .ambiguousTestIdentity, operation: "count failed tests",
          message: "Unqualified or absent test identity for \(diagnostic.id.rawValue)"))
    }
  }
  result.failedTests = uncertain ? nil : identities.count
  return result
}

private func groupedDiagnostics(_ diagnostics: [Diagnostic], warningCounts: [String?: Int]? = nil)
  -> [DiagnosticGroup]
{
  let groups = Dictionary(grouping: diagnostics, by: \.file)
  let ranks: [Severity: Int] = [.error: 0, .warning: 1, .note: 2, .remark: 3]
  return groups.map { file, items in
    let sorted = items.sorted {
      let a = ranks[$0.severity, default: 4]
      let b = ranks[$1.severity, default: 4]
      if a != b { return a < b }
      if $0.line != $1.line { return ($0.line ?? Int.max) < ($1.line ?? Int.max) }
      if $0.column != $1.column { return ($0.column ?? Int.max) < ($1.column ?? Int.max) }
      return $0.id.rawValue < $1.id.rawValue
    }
    let warnings = warningCounts?[file] ?? items.filter { $0.severity == .warning }.count
    return DiagnosticGroup(file: file, items: sorted, warningCount: warnings > 0 ? warnings : nil)
  }.sorted {
    let a = $0.items.contains { $0.severity == .error }
    let b = $1.items.contains { $0.severity == .error }
    if a != b { return a }
    return ($0.file ?? "") < ($1.file ?? "")
  }
}

func makeReport(run: CapturedRun, batches: [ReadBatch], context: ReaderContext) -> Report {
  let reconciled = reconcileDiagnostics(batches: batches, context: context)
  var issues = run.issues + batches.flatMap(\.issues) + reconciled.issues
  var sources: [Source] = []
  for source in batches.flatMap(\.completedSources) {
    if !sources.contains(source) { sources.append(source) }
  }
  var excerpt: LogExcerpt?
  if run.command.status == .failed && reconciled.diagnostics.isEmpty {
    issues.append(
      .init(
        kind: .unrecognizedFailure, operation: "collect diagnostics",
        message: "Native command failed but no diagnostic was recognized", path: run.artifacts.log))
    if let tail = run.logTail { excerpt = .init(text: tail) }
  }
  let available = !sources.isEmpty || !reconciled.diagnostics.isEmpty
  let counts =
    available
    ? DiagnosticCounts(
      errors: reconciled.diagnostics.filter { $0.severity == .error }.count,
      warnings: reconciled.diagnostics.filter { $0.severity == .warning }.count,
      notes: reconciled.diagnostics.filter { $0.severity == .note }.count,
      remarks: reconciled.diagnostics.filter { $0.severity == .remark }.count,
      failedTests: reconciled.failedTests) : .init()
  return .init(
    command: run.command,
    collection: .init(
      status: issues.isEmpty && available ? .complete : available ? .partial : .unavailable,
      buildCoverage: batches.contains { $0.stoppedEarly } ? "stopped-early" : "unknown",
      sources: sources, issues: issues), counts: counts,
    diagnostics: groupedDiagnostics(reconciled.diagnostics), artifacts: run.artifacts,
    logExcerpt: excerpt, invocation: run.invocation)
}

private func reportData(_ report: Report, format: RenderFormat) throws -> Data {
  let encoder = JSONEncoder()
  encoder.outputFormatting =
    format == .pretty
    ? [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    : [.sortedKeys, .withoutEscapingSlashes]
  return try encoder.encode(report) + Data([10])
}
func encodeFullReport(report: Report) -> Result<Data, CollectionIssue> {
  do { return .success(try reportData(report, format: .pretty)) } catch {
    return .failure(
      .init(
        kind: .writeFailed, operation: "encode full report",
        message: "Could not serialize retained report: \(error)", path: report.artifacts.report))
  }
}

private func updateOmissions(_ selected: inout Report, full: Report) {
  let shown = selected.diagnostics.flatMap(\.items)
  selected.omissions.diagnostics = full.diagnostics.reduce(0) { $0 + $1.items.count } - shown.count
  selected.omissions.details = shown.reduce(0) { total, item in
    total + (item.preview?.changes.reduce(0) { $0 + $1.count } ?? 0)
      + (item.preview?.messageTruncated == true ? 1 : 0)
  }
  selected.omissions.issues = full.collection.issues.count - selected.collection.issues.count
  selected.omissions.warningFiles =
    full.diagnostics.filter { $0.warningCount != nil }.count
    - selected.diagnostics.filter { $0.warningCount != nil }.count
}
private func addingDiagnostic(_ diagnostic: Diagnostic, to selected: Report, full: Report) -> Report
{
  var trial = selected
  if let index = trial.diagnostics.firstIndex(where: { $0.file == diagnostic.file }) {
    trial.diagnostics[index].items.append(diagnostic)
  } else {
    trial.diagnostics.append(
      .init(
        file: diagnostic.file, items: [diagnostic],
        warningCount: full.diagnostics.first { $0.file == diagnostic.file }?.warningCount))
  }
  updateOmissions(&trial, full: full)
  return trial
}

func renderReport(report: Report, format: RenderFormat, byteLimit: Int = 8000) -> Result<
  RenderedReport, CollectionIssue
> {
  do {
    var selected = report
    selected.invocation = nil
    selected.artifacts.resultBundle = nil
    selected.artifacts.eventStream = nil
    selected.diagnostics = []
    selected.collection.issues = []
    selected.logExcerpt = nil
    updateOmissions(&selected, full: report)
    guard try reportData(selected, format: format).count <= byteLimit else {
      return .failure(
        .init(
          kind: .writeFailed, operation: "render report",
          message: "Mandatory fields exceed the \(byteLimit)-byte output limit",
          path: report.artifacts.report))
    }
    let all = report.diagnostics.flatMap(\.items)
    let roots = all.filter { $0.severity == .error } + all.filter { $0.severity != .error }
    for original in roots.filter({ $0.severity == .error }) {
      var trial = addingDiagnostic(original, to: selected, full: report)
      if try reportData(trial, format: format).count <= byteLimit {
        selected = trial
        continue
      }
      var preview = original
      var changes: [DetailChange] = []
      if let values = preview.test?.evaluatedValues, !values.isEmpty {
        preview.test?.evaluatedValues = nil
        changes.append(.init(path: "/test/evaluatedValues", kind: "omitted", count: values.count))
      }
      if let messages = preview.test?.messages, !messages.isEmpty {
        preview.test?.messages = nil
        changes.append(.init(path: "/test/messages", kind: "omitted", count: messages.count))
      }
      preview.preview = .init(changes: changes)
      trial = addingDiagnostic(preview, to: selected, full: report)
      if try reportData(trial, format: format).count <= byteLimit {
        selected = trial
        continue
      }
      if let notes = preview.notes, !notes.isEmpty {
        preview.notes = nil
        changes.append(.init(path: "/notes", kind: "omitted", count: max(1, notes.count)))
      }
      if let fixes = preview.fixIts, !fixes.isEmpty {
        preview.fixIts = nil
        changes.append(.init(path: "/fixIts", kind: "omitted", count: max(1, fixes.count)))
      }
      if let alternate = preview.alternateMessages, !alternate.isEmpty {
        preview.alternateMessages = nil
        changes.append(
          .init(path: "/alternateMessages", kind: "omitted", count: max(1, alternate.count)))
      }
      if let aliases = preview.test?.aliases, !aliases.isEmpty {
        preview.test?.aliases = nil
        changes.append(.init(path: "/test/aliases", kind: "omitted", count: max(1, aliases.count)))
      }
      if preview.target != nil {
        preview.target = nil
        changes.append(.init(path: "/target", kind: "omitted", count: 1))
      }
      preview.preview = .init(changes: changes)
      trial = addingDiagnostic(preview, to: selected, full: report)
      if try reportData(trial, format: format).count <= byteLimit {
        selected = trial
        continue
      }
      if preview.test != nil {
        preview.test = nil
        changes.removeAll { $0.path.hasPrefix("/test/") }
        changes.append(.init(path: "/test", kind: "omitted", count: 1))
      }
      for length in [1024, 512, 128, 32] {
        preview.message = String(original.message.prefix(length))
        preview.preview = .init(
          messageTruncated: preview.message != original.message, changes: changes)
        trial = addingDiagnostic(preview, to: selected, full: report)
        if try reportData(trial, format: format).count <= byteLimit {
          selected = trial
          break
        }
      }
    }
    for issue in report.collection.issues {
      var trial = selected
      trial.collection.issues.append(issue)
      updateOmissions(&trial, full: report)
      if try reportData(trial, format: format).count <= byteLimit { selected = trial }
    }
    for group in report.diagnostics
    where group.warningCount != nil
      && !selected.diagnostics.contains(where: { $0.file == group.file })
    {
      var trial = selected
      trial.diagnostics.append(.init(file: group.file, warningCount: group.warningCount))
      updateOmissions(&trial, full: report)
      if try reportData(trial, format: format).count <= byteLimit { selected = trial }
    }
    for diagnostic in roots where diagnostic.severity != .error {
      let trial = addingDiagnostic(diagnostic, to: selected, full: report)
      if try reportData(trial, format: format).count <= byteLimit { selected = trial }
    }
    if let excerpt = report.logExcerpt {
      for length in [2000, 1000, 256, 64] {
        var trial = selected
        trial.logExcerpt = .init(
          text: String(excerpt.text.suffix(length)),
          truncated: excerpt.truncated || excerpt.text.count > length)
        if try reportData(trial, format: format).count <= byteLimit {
          selected = trial
          break
        }
      }
    }
    let ranks: [Severity: Int] = [.error: 0, .warning: 1, .note: 2, .remark: 3]
    for index in selected.diagnostics.indices {
      selected.diagnostics[index].items.sort {
        let a = ranks[$0.severity, default: 4]
        let b = ranks[$1.severity, default: 4]
        if a != b { return a < b }
        if $0.line != $1.line { return ($0.line ?? Int.max) < ($1.line ?? Int.max) }
        return $0.id.rawValue < $1.id.rawValue
      }
    }
    selected.diagnostics.sort {
      let a = $0.items.contains { $0.severity == .error }
      let b = $1.items.contains { $0.severity == .error }
      return a != b ? a : ($0.file ?? "") < ($1.file ?? "")
    }
    let data = try reportData(selected, format: format)
    guard data.count <= byteLimit else {
      return .failure(
        .init(
          kind: .writeFailed, operation: "render report",
          message: "Selected report exceeded \(byteLimit) bytes after ordering"))
    }
    return .success(.init(data: data, report: selected))
  } catch {
    return .failure(
      .init(
        kind: .writeFailed, operation: "render report",
        message: "Could not encode bounded report: \(error)", path: report.artifacts.report))
  }
}
