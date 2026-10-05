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
  var execution: ExecutionContext?
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
private func moduleName(_ target: String?) -> String? {
  target.map { String($0.map { $0.isLetter || $0.isNumber || $0 == "_" ? $0 : "_" }) }
}
private func testName(_ diagnostic: Diagnostic) -> TestName {
  if let id = diagnostic.test?.id, id.hasPrefix("-["), id.hasSuffix("]") {
    let parts = id.dropFirst(2).dropLast().split(separator: " ", maxSplits: 1)
    if parts.count == 2 {
      let type = parts[0].split(separator: ".")
      return .init(
        target: moduleName(
          type.count > 1 ? String(type.dropLast().joined(separator: ".")) : diagnostic.target),
        suite: type.last.map(String.init), method: String(parts[1]))
    }
  }
  let name = diagnostic.testName ?? (diagnostic.sources == [.log] ? diagnostic.test?.id : nil)
  let parts = name?.split(separator: "/").map(String.init) ?? []
  let method = parts.last.map { $0.hasSuffix("()") ? String($0.dropLast(2)) : $0 }
  return .init(
    target: moduleName(diagnostic.target),
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
private func displayedValues(_ diagnostic: Diagnostic, counterpart: Diagnostic) -> [String: Set<
  String
>] {
  var result: [String: Set<String>] = [:]
  let details =
    (diagnostic.test?.messages ?? []) + diagnostic.message.components(separatedBy: "\n").dropFirst()
  for message in details.flatMap({ $0.components(separatedBy: "\n") }) {
    if let separator = message.range(of: " → ") {
      let key = String(message[..<separator.lowerBound]).trimmingCharacters(in: .whitespaces)
      var value = String(message[separator.upperBound...]).trimmingCharacters(in: .whitespaces)
      if diagnostic.sources.contains(.testResults) {
        let comments = (counterpart.test?.messages ?? []).filter {
          !$0.contains(" → ") && !$0.isEmpty
        }
        for comment in comments where value.hasSuffix(": " + comment) {
          value = String(value.dropLast(comment.count + 2))
          break
        }
      }
      result[key, default: []].insert(value)
    }
  }
  return result
}
private func compatibleRecords(_ left: Diagnostic, _ right: Diagnostic) -> Bool {
  guard left.kind == right.kind, left.severity == right.severity,
    Set(left.sources).isDisjoint(with: right.sources)
  else { return false }
  if let target = moduleName(left.target), let other = moduleName(right.target), target != other {
    return false
  }
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
    let leftValues = displayedValues(left, counterpart: right)
    let rightValues = displayedValues(right, counterpart: left)
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
  for (batchIndex, batch) in batches.enumerated() {
    if context.shouldStop() {
      result.issues.append(
        .init(
          kind: .timedOut, operation: "reconcile diagnostics",
          message: "Collection deadline stopped cross-source matching"))
      result.diagnostics += batches.dropFirst(batchIndex).flatMap(\.diagnostics)
      result.failedTests = nil
      for index in result.diagnostics.indices {
        result.diagnostics[index].id = .init("d\(index + 1)")
      }
      return result
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
          result.diagnostics +=
            incomingRecords + batches.dropFirst(batchIndex + 1).flatMap(\.diagnostics)
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
    var pairing: [Int: Int] = [:]
    for (offset, indices) in edges.enumerated()
    where indices.count == 1 && reverse[indices[0]] == 1 {
      pairing[offset] = indices[0]
    }
    // Repeated identical records (test iterations) form a complete block: every incoming record
    // is compatible with every candidate and with nothing else, so pairing in order is lossless.
    let blocks = Dictionary(grouping: edges.indices.filter { edges[$0].count > 1 }) { edges[$0] }
    for (indices, offsets) in blocks
    where offsets.count == indices.count && indices.allSatisfy({ reverse[$0] == offsets.count }) {
      for (offset, index) in zip(offsets, indices) { pairing[offset] = index }
    }
    for (offset, incoming) in incomingRecords.enumerated() {
      let indices = edges[offset]
      if let index = pairing[offset] {
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
  var identityGroups: [Set<TestAlias>] = []
  var uncertain = result.issues.contains {
    $0.kind == .ambiguousCorrelation || $0.kind == .timedOut
  }
  struct NameKey: Hashable {
    var target: String
    var suite: String
    var method: String
  }
  func nameKey(_ name: TestName) -> NameKey? {
    guard let target = name.target, let suite = name.suite, let method = name.method else {
      return nil
    }
    return .init(target: target, suite: suite, method: method)
  }
  var passedIDs = Set<String>()
  var passedAliases = Set<TestAlias>()
  var passedNames = Set<NameKey>()
  for execution in batches.flatMap(\.executions) where execution.failed == false {
    if let id = execution.id {
      passedIDs.insert(id)
      passedAliases.insert(.init(source: execution.source, id: id))
    }
    let summary = Diagnostic(
      id: .init("execution"), kind: .test, severity: .note, message: "",
      sources: [execution.source], test: .init(id: execution.id, isFailure: false),
      target: execution.target, testName: execution.name)
    if let key = nameKey(testName(summary)) { passedNames.insert(key) }
  }
  var finalizationStopped = false
  func stopFinalization() -> Bool {
    guard context.shouldStop() else { return false }
    finalizationStopped = true
    result.issues.append(
      .init(
        kind: .timedOut, operation: "finalize test identities",
        message: "Collection deadline stopped failed-test counting"))
    return true
  }
  for index in result.diagnostics.indices {
    result.diagnostics[index].id = .init("d\(index + 1)")
  }
  finalization: for diagnostic in result.diagnostics {
    if stopFinalization() { break }
    guard diagnostic.kind == .test else { continue }
    if diagnostic.test?.isFailure == nil { uncertain = true }
    guard diagnostic.test?.isFailure == true else { continue }
    if let id = diagnostic.test?.id,
      diagnostic.sources.contains(.events) || diagnostic.sources.contains(.testResults)
        || id.hasPrefix("-[")
    {
      var aliases = Set(
        (diagnostic.test?.aliases ?? []).filter { $0.source != .log || $0.id.hasPrefix("-[") })
      for source in diagnostic.sources
      where !(diagnostic.test?.aliases?.contains { $0.source == source } ?? false) {
        aliases.insert(.init(source: source, id: id))
      }
      var connected: [Int] = []
      for index in identityGroups.indices {
        if stopFinalization() { break finalization }
        if !identityGroups[index].isDisjoint(with: aliases) { connected.append(index) }
      }
      for index in connected { aliases.formUnion(identityGroups[index]) }
      for index in connected.reversed() { identityGroups.remove(at: index) }
      identityGroups.append(aliases)
      if passedIDs.contains(id) || nameKey(testName(diagnostic)).map(passedNames.contains) == true
        || !aliases.isDisjoint(with: passedAliases)
      {
        uncertain = true
        result.issues.append(
          .init(
            kind: .ambiguousCorrelation, operation: "reconcile test execution",
            message: "Structured pass contradicts retained failure for \(id)"))
      }
    } else {
      uncertain = true
      result.issues.append(
        .init(
          kind: .ambiguousTestIdentity, operation: "count failed tests",
          message: "Unqualified or absent test identity for \(diagnostic.id.rawValue)"))
    }
  }
  result.failedTests = uncertain || finalizationStopped ? nil : identityGroups.count
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
  var reconciled = reconcileDiagnostics(batches: batches, context: context)
  if run.command.status == .succeeded {
    for index in reconciled.diagnostics.indices {
      let diagnostic = reconciled.diagnostics[index]
      if diagnostic.kind == .tool, diagnostic.severity == .error, diagnostic.line != nil,
        ["Fatal error", "Precondition failed", "Assertion failed"].contains(where: {
          diagnostic.message.hasPrefix($0)
        })
      {
        reconciled.diagnostics[index].severity = .note
      }
    }
  }
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
  let expected = Set(batches.flatMap(\.expectedSources))
  let structuredIncomplete = !expected.isSubset(of: Set(sources))
  let testRun =
    run.command.kind == .swiftTest || expected.contains(.testResults)
    || run.execution?.invocation.requestsTests == true
  let testsStarted =
    batches.contains { $0.testsStarted || !$0.executions.isEmpty }
    || reconciled.diagnostics.contains { $0.kind == .test }
  let buildFailed =
    !testsStarted
    && reconciled.diagnostics.contains {
      ($0.kind == .compiler || $0.kind == .linker) && $0.severity == .error
    }
  let ranTests = testsStarted || run.command.status != .failed
  let unidentifiedFailure =
    testRun && run.command.status == .failed && reconciled.failedTests == 0 && testsStarted
  let swiftTestCrash =
    run.command.kind == .swiftTest && run.command.status == .failed && testsStarted
    && batches.contains(where: \.crashed)
  if unidentifiedFailure || swiftTestCrash,
    !issues.contains(where: { $0.kind == .unrecognizedFailure })
  {
    issues.append(
      .init(
        kind: .unrecognizedFailure, operation: "count failed tests",
        message: swiftTestCrash
          ? "Test process crashed; tests after the crash did not report"
          : "Test command failed but no failed test was identified", path: run.artifacts.log))
  }
  let countUnknown =
    testRun && !buildFailed && ranTests
    && (structuredIncomplete || unidentifiedFailure || swiftTestCrash
      || run.command.status == .interrupted)
  let available = !sources.isEmpty || !reconciled.diagnostics.isEmpty
  let counts =
    available
    ? DiagnosticCounts(
      errors: reconciled.diagnostics.filter { $0.severity == .error }.count,
      warnings: reconciled.diagnostics.filter { $0.severity == .warning }.count,
      notes: reconciled.diagnostics.filter { $0.severity == .note }.count,
      remarks: reconciled.diagnostics.filter { $0.severity == .remark }.count,
      failedTests: countUnknown ? nil : reconciled.failedTests)
    : .init()
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
      var fitted = false
      for keepTest in [true, false] where !fitted {
        if !keepTest {
          guard preview.test != nil else { break }
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
            fitted = true
            break
          }
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
