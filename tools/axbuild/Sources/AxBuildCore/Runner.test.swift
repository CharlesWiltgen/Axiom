import Foundation
import Testing

@testable import AxBuildCore

@Suite struct RunnerTests {
  @Test func readerDeadlineUsesRemainingSharedBudget() {
    let limits = CollectionLimits(probe: 5, reader: 30, collection: 60, grace: 5, reap: 1)
    #expect(limits.readerDeadline(start: 145, sharedDeadline: 160) == 160)
    #expect(limits.readerDeadline(start: 110, sharedDeadline: 160) == 140)
    #expect(limits.cleanupDeadline(start: 160) == 166)
  }
  @Test func embeddedNULCannotChangeNativeArguments() {
    let result = parseInvocation(
      args: ["swift", "build", "literal\0hidden"], cwd: URL(fileURLWithPath: "/fixture"))
    guard case .failure(let issue) = result else {
      Issue.record("Embedded NUL was accepted")
      return
    }
    #expect(issue.kind == .invalidInvocation)
  }
}
