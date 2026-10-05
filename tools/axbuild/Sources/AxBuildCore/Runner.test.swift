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

  @Test func launchFailureExitIgnoresEarlierAdvisoryIssues() {
    let run = CapturedRun(
      command: .init(kind: .xcodebuild), artifacts: .init(),
      issues: [
        .init(kind: .unsupportedSource, operation: "classify xcodebuild arguments", message: "x"),
        .init(kind: .toolUnavailable, operation: "launch", message: "y"),
      ])
    #expect(wrapperExit(run) == 69)
  }

  @Test func lineageFollowsParentsAcrossProcessGroups() {
    let table: [pid_t: ProcessRecord] = [
      10: .init(ppid: 9, pgid: 10, start: 100),
      14: .init(ppid: 13, pgid: 14, start: 140),
      11: .init(ppid: 10, pgid: 11, start: 110),
      13: .init(ppid: 12, pgid: 13, start: 130),
      12: .init(ppid: 11, pgid: 11, start: 120),
      15: .init(ppid: 11, pgid: 15, start: 105),
      20: .init(ppid: 1, pgid: 20, start: 90),
      21: .init(ppid: 20, pgid: 20, start: 95),
    ]
    #expect(
      lineage(root: 10, table: table, known: [:])
        == [10: 100, 11: 110, 12: 120, 13: 130, 14: 140])
  }

  @Test func lineageAddsChildrenSpawnedAfterTrackingBegan() {
    let table: [pid_t: ProcessRecord] = [
      11: .init(ppid: 1, pgid: 11, start: 110),
      16: .init(ppid: 11, pgid: 16, start: 160),
    ]
    #expect(
      lineage(root: 10, table: table, known: [10: 100, 11: 110]) == [10: 100, 11: 110, 16: 160])
  }

  @Test func lineageKeepsAnUnreadableChildAsALeaf() {
    let table: [pid_t: ProcessRecord] = [
      10: .init(ppid: 9, pgid: 10, start: 100),
      17: .init(ppid: 10, pgid: 17, start: nil),
      18: .init(ppid: 17, pgid: 17, start: 180),
    ]
    #expect(lineage(root: 10, table: table, known: [:]) == [10: 100, 17: .max])
  }

  @Test func lineageIgnoresChildrenOfAReusedParentPID() {
    let table: [pid_t: ProcessRecord] = [
      30: .init(ppid: 1, pgid: 30, start: 300),
      31: .init(ppid: 30, pgid: 30, start: 310),
    ]
    #expect(lineage(root: 99, table: table, known: [30: 50]) == [30: 50])
  }

  @Test func detachedTargetsSkipOwnedGroupsSelfAndMismatchedProcesses() {
    let table: [pid_t: ProcessRecord] = [
      1: .init(ppid: 0, pgid: 1, start: 1),
      40: .init(ppid: 1, pgid: 40, start: 400),
      41: .init(ppid: 40, pgid: 41, start: 410),
      42: .init(ppid: 41, pgid: 41, start: 420),
      43: .init(ppid: 41, pgid: 43, start: 999),
      44: .init(ppid: 41, pgid: 44, start: 440, zombie: true),
      45: .init(ppid: 41, pgid: 50, start: 450),
      46: .init(ppid: 41, pgid: 46, start: 460),
      47: .init(ppid: 41, pgid: 47, start: 470, traced: true),
      48: .init(ppid: 41, pgid: 48, start: nil),
    ]
    let tracked: [pid_t: UInt64] = [
      1: 1, 40: 400, 41: 410, 42: 420, 43: 430, 44: 440, 45: 450, 46: 460, 47: 470, 48: .max,
    ]
    #expect(
      detachedTargets(tracked: tracked, table: table, excludedGroups: [40, 50], selfPID: 46)
        == [41, 42])
  }

  @Test func unreadableTableKeepsPreviousTargetsAndIsReported() {
    let pass = detachedPass(
      root: 10, table: nil, tracked: [10: 100, 11: 110], previous: [11], excludedGroups: [10],
      selfPID: 99)
    #expect(pass == .init(tracked: [10: 100, 11: 110], targets: [11], held: [], unreadable: true))
  }

  @Test func passHoldsBackDebuggedAndUnreadableDescendants() {
    let table: [pid_t: ProcessRecord] = [
      10: .init(ppid: 9, pgid: 10, start: 100),
      11: .init(ppid: 10, pgid: 11, start: 110),
      12: .init(ppid: 10, pgid: 12, start: 120, traced: true),
      13: .init(ppid: 10, pgid: 13, start: nil),
    ]
    let pass = detachedPass(
      root: 10, table: table, tracked: [:], previous: [], excludedGroups: [10], selfPID: 99)
    #expect(pass.targets == [11])
    #expect(pass.held == [12, 13])
    #expect(pass.unreadable == false)
  }

  @Test func childrenOfADebuggedProcessAreHeldNotSignaled() {
    let table: [pid_t: ProcessRecord] = [
      10: .init(ppid: 9, pgid: 10, start: 100),
      12: .init(ppid: 10, pgid: 12, start: 120, traced: true),
      14: .init(ppid: 12, pgid: 14, start: 140),
    ]
    let pass = detachedPass(
      root: 10, table: table, tracked: [:], previous: [], excludedGroups: [10], selfPID: 99)
    #expect(pass.targets == [])
    #expect(pass.held == [12, 14])
  }

  @Test func passNeverTargetsTheRootItself() {
    let table: [pid_t: ProcessRecord] = [
      10: .init(ppid: 9, pgid: 9, start: 100),
      11: .init(ppid: 10, pgid: 11, start: 110),
    ]
    let pass = detachedPass(
      root: 10, table: table, tracked: [:], previous: [], excludedGroups: [], selfPID: 99)
    #expect(pass.targets == [11])
  }
}
