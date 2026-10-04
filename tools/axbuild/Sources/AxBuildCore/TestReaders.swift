import Foundation

private struct StreamVersion: Decodable {
  let value: String
  init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()
    do { value = "numeric:\(try container.decode(Int.self))" } catch DecodingError.typeMismatch {
      value = try container.decode(String.self)
    }
  }
}
private struct EventHeader: Decodable {
  var version: StreamVersion
  var kind: String
}
private struct StreamRecord<Payload: Decodable>: Decodable { var payload: Payload }
private struct EventLocation: Decodable {
  var filePath: String?
  var _filePath: String?
  var fileID: String?
  var line: Int?
  var column: Int?
}
private struct TestDescriptor: Decodable {
  var id: String
  var name: String
  var sourceLocation: EventLocation?
}
private struct EventMessage: Decodable {
  var symbol: String
  var text: String
}
private struct EventExpression: Decodable {
  var runtimeValue: String?
  var children: [EventExpression]?
  var values: [String] {
    if let children, !children.isEmpty { return children.flatMap(\.values) }
    return runtimeValue.map { [$0] } ?? []
  }
}
private struct EventIssue: Decodable {
  var isKnown: Bool?
  var isFailure: Bool?
  var severity: String?
  var sourceLocation: EventLocation?
  var _expression: EventExpression?
}
private struct TestEvent: Decodable {
  var kind: String
  var testID: String?
  var issue: EventIssue?
  var messages: [EventMessage]?
  var iteration: Int?
  var _sourceLocation: EventLocation?
}

func readEvents(data: Data, context: ReaderContext) -> ReadBatch {
  var batch = ReadBatch()
  var descriptors: [String: TestDescriptor] = [:]
  let decoder = JSONDecoder()
  for (index, row) in data.split(separator: 10).enumerated() {
    if context.shouldStop() {
      batch.issues.append(
        .init(
          kind: .timedOut, operation: "decode events",
          message: "Collection stopped before event record \(index + 1)"))
      return batch
    }
    do {
      let input = Data(row)
      let header = try decoder.decode(EventHeader.self, from: input)
      guard ["numeric:0", "6.3.0"].contains(header.version.value) else {
        batch.issues.append(
          .init(
            kind: .unsupportedSource, operation: "decode events",
            message: "Unsupported event schema \(header.version.value) at record \(index + 1)"))
        return batch
      }
      if header.kind == "test" {
        let descriptor = try decoder.decode(StreamRecord<TestDescriptor>.self, from: input).payload
        descriptors[descriptor.id] = descriptor
        batch.executions.append(
          .init(
            id: descriptor.id, name: descriptor.name,
            target: descriptor.sourceLocation?.fileID?.components(separatedBy: "/").first,
            source: .events))
      } else if header.kind == "event" {
        let event = try decoder.decode(StreamRecord<TestEvent>.self, from: input).payload
        guard event.kind == "issueRecorded" else { continue }
        guard let issue = event.issue, let messages = event.messages, let headline = messages.first
        else {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "decode issue event",
              message: "Missing issue/message at record \(index + 1)"))
          continue
        }
        var failure: Bool?
        let warning = issue.severity == "warning" || messages.contains { $0.symbol == "warning" }
        if header.version.value == "numeric:0" {
          if issue.isKnown == true || warning {
            failure = false
          } else if issue.isKnown == false && messages.contains(where: { $0.symbol == "fail" }) {
            failure = true
          }
        } else if let explicit = issue.isFailure, issue.isKnown != nil,
          ["warning", "error"].contains(issue.severity ?? "")
        {
          if explicit && (issue.isKnown == true || warning) {
            failure = nil
          } else if !explicit && issue.isKnown != true && issue.severity == "error" {
            failure = nil
          } else {
            failure = explicit
          }
        }
        if failure == nil {
          batch.issues.append(
            .init(
              kind: .unclassifiedTestIssue, operation: "classify test issue",
              message:
                "Insufficient or contradictory issue semantics for \(event.testID ?? "unknown test") at record \(index + 1)"
            ))
        }
        let location = issue.sourceLocation ?? event._sourceLocation
        if let location,
          location.line.map { $0 <= 0 } == true || location.column.map { $0 <= 0 } == true
        {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "validate event location",
              message: "Nonpositive location for \(event.testID ?? "unknown test")"))
        }
        let rawPath = location?.filePath ?? location?._filePath
        let file = rawPath.map { diagnosticPath($0, context: context, basenameOnly: true) }
        let descriptor = event.testID.flatMap { descriptors[$0] }
        let remaining = messages.dropFirst().map(\.text)
        let values = issue._expression?.children?.flatMap(\.values)
        let aliases = event.testID.map { [TestAlias(source: .events, id: $0)] }
        let metadata = TestMetadata(
          id: event.testID, isFailure: failure, framework: .swiftTesting,
          messages: remaining.isEmpty ? nil : remaining, isKnown: issue.isKnown,
          evaluatedValues: values?.isEmpty == false ? values : nil,
          aliases: aliases, issueSeverity: issue.severity, iteration: event.iteration)
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .test,
            severity: failure == true
              ? .error : failure == false && warning && issue.isKnown != true ? .warning : .note,
            message: headline.text, sources: [.events], file: file,
            line: location?.line.flatMap { $0 > 0 ? $0 : nil },
            column: location?.column.flatMap { $0 > 0 ? $0 : nil },
            test: metadata,
            target: descriptor?.sourceLocation?.fileID?.components(separatedBy: "/").first,
            testName: descriptor?.name))
      }
    } catch {
      batch.issues.append(
        .init(
          kind: .parseFailed, operation: "decode event record",
          message: "Malformed event record \(index + 1): \(error)"))
      return batch
    }
  }
  if !batch.issues.contains(where: { $0.kind == .parseFailed }) {
    batch.completedSources = [.events]
  }
  return batch
}

private struct ResultLocation: Decodable {
  var filePath: String?
  var lineNumber: Int?
}
private struct ResultNode: Decodable {
  var nodeType: String
  var name: String?
  var nodeIdentifier: String?
  var nodeIdentifierURL: String?
  var result: String?
  var sourceLocation: ResultLocation?
  var children: [DecodedResultNode]?
}
private enum DecodedResultNode: Decodable {
  case node(ResultNode)
  case invalid(String)
  init(from decoder: any Decoder) throws {
    do { self = .node(try ResultNode(from: decoder)) } catch {
      self = .invalid(String(describing: error))
    }
  }
}
private struct ResultTree: Decodable { var testNodes: [DecodedResultNode] }

func readTestResults(data: Data, context: ReaderContext) -> ReadBatch {
  var batch = ReadBatch()
  do {
    let tree = try JSONDecoder().decode(ResultTree.self, from: data)
    var pending = tree.testNodes.reversed().map { ($0, Optional<TestExecution>.none) }
    while let (decoded, inherited) = pending.popLast() {
      if context.shouldStop() {
        batch.issues.append(
          .init(
            kind: .timedOut, operation: "decode test results",
            message: "Collection deadline stopped result traversal"))
        return batch
      }
      guard case .node(let node) = decoded else {
        if case .invalid(let error) = decoded {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "decode result node",
              message: "Malformed result node: \(error)"))
        }
        continue
      }
      var execution = inherited
      if node.nodeType == "Unit test bundle" {
        execution = .init(name: node.name, target: node.name, source: .testResults)
      }
      if node.nodeType == "Test Case" {
        execution = .init(
          id: node.nodeIdentifierURL ?? node.nodeIdentifier, name: node.nodeIdentifier ?? node.name,
          target: inherited?.target, source: .testResults,
          failed: node.result == "Failed" ? true : node.result == "Passed" ? false : nil)
        if let execution { batch.executions.append(execution) }
        if node.result == "Failed"
          && !(node.children ?? []).contains(where: {
            if case .node(let child) = $0 { return child.nodeType == "Failure Message" }
            return false
          })
        {
          batch.diagnostics.append(
            .init(
              id: .init("d\(batch.diagnostics.count + 1)"), kind: .test, severity: .error,
              message: "Test failed without a detailed failure message", sources: [.testResults],
              test: .init(id: execution?.id, isFailure: true),
              target: execution?.target, testName: execution?.name, synthetic: true))
        }
      }
      if node.nodeType == "Failure Message" {
        guard let name = node.name else {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "decode failure message",
              message: "Failure message missing its text for \(execution?.id ?? "unknown test")"))
          continue
        }
        if let line = node.sourceLocation?.lineNumber, line <= 0 {
          batch.issues.append(
            .init(
              kind: .parseFailed, operation: "validate result location",
              message: "Nonpositive line for \(execution?.id ?? "unknown test")"))
        }
        let alias = execution?.id.map { [TestAlias(source: .testResults, id: $0)] }
        let file = node.sourceLocation?.filePath.map {
          diagnosticPath($0, context: context, basenameOnly: true)
        }
        batch.diagnostics.append(
          .init(
            id: .init("d\(batch.diagnostics.count + 1)"), kind: .test, severity: .error,
            message: name,
            sources: [.testResults], file: file,
            line: node.sourceLocation?.lineNumber.flatMap { $0 > 0 ? $0 : nil },
            test: .init(id: execution?.id, isFailure: true, aliases: alias),
            target: execution?.target, testName: execution?.name))
      }
      for child in (node.children ?? []).reversed() { pending.append((child, execution)) }
    }
    if batch.issues.isEmpty { batch.completedSources = [.testResults] }
  } catch {
    batch.issues.append(
      .init(
        kind: .parseFailed, operation: "decode test results",
        message: "Malformed test-results tree: \(error)"))
  }
  return batch
}
