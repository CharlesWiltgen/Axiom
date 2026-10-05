import Darwin
import Foundation
import os

struct CollectionLimits: Sendable {
  var probe: Double = 5
  var reader: Double = 30
  var collection: Double = 60
  var grace: Double = 5
  var reap: Double = 1
  static let production = CollectionLimits()
  func readerDeadline(start: Double, sharedDeadline: Double) -> Double {
    min(start + reader, sharedDeadline)
  }
  func cleanupDeadline(start: Double) -> Double { start + grace + reap }
}

final class InterruptionState: Sendable {
  private let value = OSAllocatedUnfairLock(initialState: Int32(0))
  var signal: Int32 { value.withLock { $0 } }
  func record(_ signal: Int32) { value.withLock { if $0 == 0 { $0 = signal } } }
}

struct ArtifactSnapshot: Equatable, Sendable {
  var entries: [String: String]
}
struct ExecutionContext: Sendable {
  var invocation: Invocation
  var environment: [String: String]
  var interruption: InterruptionState
  var deadline: Double
  var snapshots: [String: ArtifactSnapshot]
  var resultReader: String?
  var resultReaderArgs: [String] = []
  var eventExpected = false
  var collectionInterruption: Int32 = 0
  var unverifiedArtifacts: Set<String> = []
}
private struct ProcessOutcome {
  var exitCode: Int?
  var signal: Int?
  var interruptionSignal: Int?
  var interruptedRunning = false
  var durationMs: Int?
  var issues: [CollectionIssue] = []
  var started = false
}
private func now() -> Double { ProcessInfo.processInfo.systemUptime }

private func resolvedExecutable(_ executable: String, cwd: String, environment: [String: String])
  -> String?
{
  let paths =
    executable.contains("/")
    ? [executable]
    : (environment["PATH"] ?? "/usr/bin:/bin").components(separatedBy: ":").map {
      ($0.isEmpty ? cwd : $0) + "/" + executable
    }
  for path in paths {
    let url = URL(fileURLWithPath: path, relativeTo: URL(fileURLWithPath: cwd, isDirectory: true))
      .standardizedFileURL
    var directory: ObjCBool = false
    if FileManager.default.fileExists(atPath: url.path, isDirectory: &directory),
      !directory.boolValue, access(url.path, X_OK) == 0
    {
      return url.path
    }
  }
  return nil
}

private func spawnOwned(
  executable: String, args: [String], cwd: String, environment: [String: String], stdout: Int32,
  stderr: Int32
) throws -> pid_t {
  var actions: posix_spawn_file_actions_t?
  var attributes: posix_spawnattr_t?
  let a = posix_spawn_file_actions_init(&actions)
  guard a == 0 else {
    throw CollectionIssue(
      kind: .internalFailure, operation: "initialize spawn actions", message: "errno \(a)",
      path: executable)
  }
  defer { posix_spawn_file_actions_destroy(&actions) }
  let b = posix_spawnattr_init(&attributes)
  guard b == 0 else {
    throw CollectionIssue(
      kind: .internalFailure, operation: "initialize spawn attributes", message: "errno \(b)",
      path: executable)
  }
  defer { posix_spawnattr_destroy(&attributes) }
  var defaults = sigset_t()
  sigemptyset(&defaults)
  for s in [SIGINT, SIGTERM, SIGHUP, SIGPIPE] { sigaddset(&defaults, s) }
  var mask = sigset_t()
  sigemptyset(&mask)
  let chdirStatus: Int32
  if #available(macOS 26, *) {
    chdirStatus = posix_spawn_file_actions_addchdir(&actions, cwd)
  } else {
    chdirStatus = posix_spawn_file_actions_addchdir_np(&actions, cwd)
  }
  let checks = [
    chdirStatus, posix_spawn_file_actions_adddup2(&actions, stdout, STDOUT_FILENO),
    posix_spawn_file_actions_adddup2(&actions, stderr, STDERR_FILENO),
    posix_spawnattr_setpgroup(&attributes, 0),
    posix_spawnattr_setsigdefault(&attributes, &defaults),
    posix_spawnattr_setsigmask(&attributes, &mask),
    posix_spawnattr_setflags(
      &attributes, Int16(POSIX_SPAWN_SETPGROUP | POSIX_SPAWN_SETSIGDEF | POSIX_SPAWN_SETSIGMASK)),
  ]
  if let error = checks.first(where: { $0 != 0 }) {
    throw CollectionIssue(
      kind: .internalFailure, operation: "configure owned spawn", message: "errno \(error)",
      path: executable)
  }
  let argv = ([executable] + args).map { strdup($0) } + [nil]
  let envp = environment.sorted { $0.key < $1.key }.map { strdup($0.key + "=" + $0.value) } + [nil]
  defer { for p in argv + envp { free(p) } }
  guard argv.dropLast().allSatisfy({ $0 != nil }), envp.dropLast().allSatisfy({ $0 != nil }) else {
    throw CollectionIssue(
      kind: .internalFailure, operation: "allocate spawn arguments", message: "Allocation failed",
      path: executable)
  }
  var pid: pid_t = 0
  let status = argv.withUnsafeBufferPointer { av in
    envp.withUnsafeBufferPointer { ev in
      posix_spawn(&pid, executable, &actions, &attributes, av.baseAddress, ev.baseAddress)
    }
  }
  guard status == 0 else {
    throw CollectionIssue(
      kind: .toolUnavailable, operation: "launch native command",
      message: "Cannot launch \(executable): errno \(status)", path: executable)
  }
  return pid
}

struct ProcessRecord: Equatable, Sendable {
  var ppid: pid_t
  var pgid: pid_t
  var start: UInt64?
  var zombie = false
  var traced = false
}

struct DetachedPass: Equatable, Sendable {
  var tracked: [pid_t: UInt64]
  var targets: [pid_t]
  var held: [pid_t]
  var unreadable: Bool
}

/// One cleanup pass over the owned child's lineage. Debugged processes and processes whose identity
/// cannot be verified (another user's) are held back and reported, never signaled.
func detachedPass(
  root: pid_t, table: [pid_t: ProcessRecord]?, tracked: [pid_t: UInt64], previous: [pid_t],
  excludedGroups: Set<pid_t>, selfPID: pid_t
) -> DetachedPass {
  guard let table else {
    return .init(tracked: tracked, targets: previous, held: [], unreadable: true)
  }
  let current = lineage(root: root, table: table, known: tracked)
  let held = current.keys.filter { pid in
    guard pid != root, pid != selfPID, let record = table[pid], !record.zombie,
      !excludedGroups.contains(record.pgid)
    else { return false }
    return record.start == nil || (record.traced && record.start == current[pid])
      || current[pid] == .max
  }.sorted()
  return .init(
    tracked: current,
    targets: detachedTargets(
      tracked: current, table: table, excludedGroups: excludedGroups, selfPID: selfPID
    ).filter { $0 != root }, held: held, unreadable: false)
}

/// Descendants of `root` across process groups. A child links to a tracked parent only while that
/// parent still has its recorded start time and the child started after it, so a reused PID never
/// adopts another process's children.
func lineage(root: pid_t, table: [pid_t: ProcessRecord], known: [pid_t: UInt64]) -> [pid_t: UInt64]
{
  var tracked = known
  if tracked[root] == nil, let record = table[root] { tracked[root] = record.start }
  var changed = true
  while changed {
    changed = false
    for (pid, record) in table where tracked[pid] == nil {
      guard let parentStart = tracked[record.ppid], table[record.ppid]?.start == parentStart
      else { continue }
      if let start = record.start {
        guard start >= parentStart else { continue }
        // A debugger becomes its target's parent, so a debugged process's children may not be ours.
        tracked[pid] = table[record.ppid]?.traced == true ? .max : start
      } else {
        tracked[pid] = .max
      }
      changed = true
    }
  }
  return tracked
}

func detachedTargets(
  tracked: [pid_t: UInt64], table: [pid_t: ProcessRecord], excludedGroups: Set<pid_t>,
  selfPID: pid_t
) -> [pid_t] {
  tracked.compactMap { pid, start in
    guard pid > 1, pid != selfPID, let record = table[pid], record.start == start, !record.zombie,
      !record.traced, !excludedGroups.contains(record.pgid)
    else { return nil }
    return pid
  }.sorted()
}

private func processTable() -> [pid_t: ProcessRecord]? {
  let estimate = proc_listallpids(nil, 0)
  guard estimate > 0 else { return nil }
  var pids = [pid_t](repeating: 0, count: Int(estimate) + 256)
  let count = pids.withUnsafeMutableBytes { proc_listallpids($0.baseAddress, Int32($0.count)) }
  guard count > 0, Int(count) < pids.count else { return nil }
  var table: [pid_t: ProcessRecord] = [:]
  for pid in pids.prefix(Int(count)) where pid > 0 {
    var info = proc_bsdinfo()
    let size = MemoryLayout<proc_bsdinfo>.size
    if proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, Int32(size)) == Int32(size) {
      table[pid] = .init(
        ppid: pid_t(info.pbi_ppid), pgid: pid_t(info.pbi_pgid),
        start: info.pbi_start_tvsec * 1_000_000 + info.pbi_start_tvusec,
        zombie: info.pbi_status == UInt32(SZOMB),
        traced: info.pbi_flags & UInt32(PROC_FLAG_TRACED) != 0)
      continue
    }
    // Another user's process: parentage is readable, its start time is not.
    var short = proc_bsdshortinfo()
    let shortSize = MemoryLayout<proc_bsdshortinfo>.size
    guard proc_pidinfo(pid, PROC_PIDT_SHORTBSDINFO, 0, &short, Int32(shortSize)) == Int32(shortSize)
    else { continue }
    table[pid] = .init(
      ppid: pid_t(short.pbsi_ppid), pgid: pid_t(short.pbsi_pgid), start: nil,
      zombie: short.pbsi_status == UInt32(SZOMB),
      traced: short.pbsi_flags & UInt32(PROC_FLAG_TRACED) != 0)
  }
  return table
}

private func groupMembers(_ pid: pid_t) -> [pid_t]? {
  var capacity = 64
  while capacity <= 65536 {
    var pids = [pid_t](repeating: 0, count: capacity)
    let bytes = pids.withUnsafeMutableBytes {
      proc_listpids(UInt32(PROC_PGRP_ONLY), UInt32(pid), $0.baseAddress, Int32($0.count))
    }
    guard bytes >= 0 else { return nil }
    if bytes < capacity * MemoryLayout<pid_t>.size {
      return Array(pids.prefix(Int(bytes) / MemoryLayout<pid_t>.size)).filter { $0 > 0 }
    }
    capacity *= 2
  }
  return nil
}

private func ownedProcess(
  executable: String, args: [String], cwd: String, environment: [String: String], output: Int32,
  errorOutput: Int32? = nil, interruption: InterruptionState, deadline: Double? = nil,
  operation: String, limits: CollectionLimits
) -> ProcessOutcome {
  let start = now()
  var outcome = ProcessOutcome()
  let pid: pid_t
  do {
    pid = try spawnOwned(
      executable: executable, args: args, cwd: cwd, environment: environment, stdout: output,
      stderr: errorOutput ?? output)
  } catch let issue as CollectionIssue {
    outcome.issues.append(issue)
    return outcome
  } catch {
    outcome.issues.append(
      .init(
        kind: .internalFailure, operation: operation, message: "Spawn failed: \(error)",
        path: executable))
    return outcome
  }
  outcome.started = true
  let groupOwned = pid != getpgrp() && getpgid(pid) == pid
  if !groupOwned {
    outcome.issues.append(
      .init(
        kind: .cleanupIncomplete, operation: "verify process group",
        message: "Child \(pid) has no safely owned group; only this waitable child can be signaled",
        path: executable))
  }
  var info = siginfo_t()
  var completed = false
  var cleanupStart: Double?
  var killed = false
  var forwarded: Int32 = 0
  var tracked: [pid_t: UInt64]?
  var detachedSignals: [pid_t: Int32] = [:]
  var detached: [pid_t] = []
  var held: [pid_t] = []
  var tableUnreadable = false
  let excludedGroups: Set<pid_t> = groupOwned ? [pid] : []
  func trackDescendants() {
    guard tracked == nil else { return }
    guard let table = processTable() else {
      tracked = [:]
      outcome.issues.append(
        .init(
          kind: .cleanupIncomplete, operation: "find detached descendants",
          message: "Process enumeration failed; detached descendants of \(pid) cannot be verified",
          path: executable))
      return
    }
    tracked = lineage(root: pid, table: table, known: [:])
  }
  while true {
    let received = interruption.signal
    let wasRunning = !completed
    if !completed {
      info = siginfo_t()
      let result = waitid(P_PID, UInt32(pid), &info, WEXITED | WNOHANG | WNOWAIT)
      if result == 0, info.si_pid == pid {
        completed = true
        outcome.durationMs = max(0, Int((now() - start) * 1000))
        if info.si_code == CLD_EXITED {
          outcome.exitCode = Int(info.si_status)
        } else {
          outcome.signal = Int(info.si_status)
        }
      } else if result != 0, errno != EINTR {
        outcome.issues.append(
          .init(
            kind: .cleanupIncomplete, operation: "wait for owned child",
            message: "waitid for \(pid) failed: errno \(errno)", path: executable))
        break
      }
    }
    if received != 0, forwarded == 0 {
      forwarded = received
      outcome.interruptionSignal = Int(received)
      outcome.interruptedRunning = wasRunning || outcome.signal == Int(received)
      cleanupStart = cleanupStart ?? now()
      trackDescendants()
      if groupOwned { _ = kill(-pid, received) } else if !completed { _ = kill(pid, received) }
    }
    if let deadline, now() >= deadline, cleanupStart == nil {
      outcome.issues.append(
        .init(
          kind: .timedOut, operation: operation, message: "Monotonic subprocess deadline reached",
          path: executable))
      cleanupStart = now()
      trackDescendants()
      if groupOwned { _ = kill(-pid, SIGTERM) } else if !completed { _ = kill(pid, SIGTERM) }
    }
    let survivors: [pid_t]?
    if groupOwned { survivors = groupMembers(pid)?.filter { $0 != pid } } else { survivors = [] }
    if let known = tracked, !known.isEmpty {
      let pass = detachedPass(
        root: pid, table: processTable(), tracked: known, previous: detached,
        excludedGroups: excludedGroups, selfPID: getpid())
      tracked = pass.tracked
      detached = pass.targets
      tableUnreadable = pass.unreadable
      if !pass.unreadable {
        held = pass.held
        let signal = killed ? SIGKILL : (forwarded != 0 ? forwarded : SIGTERM)
        for target in detached where detachedSignals[target] != signal {
          _ = kill(target, signal)
          detachedSignals[target] = signal
        }
      }
    }
    if completed && survivors?.isEmpty == true && detached.isEmpty && !tableUnreadable { break }
    if completed && cleanupStart == nil {
      cleanupStart = now()
      if groupOwned { _ = kill(-pid, SIGTERM) }
    }
    if let cleanupStart {
      if now() >= cleanupStart + limits.grace, !killed {
        killed = true
        if groupOwned { _ = kill(-pid, SIGKILL) } else if !completed { _ = kill(pid, SIGKILL) }
      }
      if now() >= limits.cleanupDeadline(start: cleanupStart) {
        if !(completed && survivors?.isEmpty == true) {
          outcome.issues.append(
            .init(
              kind: .cleanupIncomplete, operation: operation,
              message:
                "Owned child/group \(pid) did not finish within the shared cleanup allowance",
              path: executable))
        }
        if tableUnreadable {
          outcome.issues.append(
            .init(
              kind: .cleanupIncomplete, operation: "find detached descendants",
              message:
                "Process enumeration failed during cleanup; detached descendants of \(pid) cannot be verified",
              path: executable))
        }
        if !detached.isEmpty, !tableUnreadable {
          outcome.issues.append(
            .init(
              kind: .cleanupIncomplete, operation: "stop detached descendants",
              message:
                "Detached descendants of \(pid) survived the cleanup allowance: \(detached.map(String.init).joined(separator: " "))",
              path: executable))
        }
        break
      }
    }
    usleep(20_000)
  }
  if !held.isEmpty {
    outcome.issues.append(
      .init(
        kind: .cleanupIncomplete, operation: "stop detached descendants",
        message:
          "Detached descendants of \(pid) were not stopped because they could not be verified (another user's or unreadable) or are being debugged: \(held.map(String.init).joined(separator: " "))",
        path: executable))
  }
  var status: Int32 = 0
  let reaped = waitpid(pid, &status, WNOHANG)
  if reaped == pid, !completed {
    outcome.durationMs = max(0, Int((now() - start) * 1000))
    if status & 0x7f == 0 {
      outcome.exitCode = Int((status >> 8) & 0xff)
    } else {
      outcome.signal = Int(status & 0x7f)
    }
  } else if reaped != pid {
    outcome.issues.append(
      .init(
        kind: .cleanupIncomplete, operation: "reap owned child",
        message: "Could not reap child \(pid): waitpid=\(reaped), errno=\(errno)", path: executable)
    )
  }
  return outcome
}

private func artifactSnapshot(_ path: String, shouldStop: () -> Bool = { false }) throws
  -> ArtifactSnapshot?
{
  guard FileManager.default.fileExists(atPath: path) else { return nil }
  var paths = [path]
  var directory: ObjCBool = false
  if FileManager.default.fileExists(atPath: path, isDirectory: &directory), directory.boolValue {
    guard let items = FileManager.default.enumerator(atPath: path) else {
      throw CollectionIssue(
        kind: .readFailed, operation: "snapshot artifact", message: "Cannot enumerate artifact",
        path: path)
    }
    while let child = items.nextObject() as? String {
      if shouldStop() {
        throw CollectionIssue(
          kind: .timedOut, operation: "snapshot artifact", message: "Snapshot deadline reached",
          path: path)
      }
      paths.append(path + "/" + child)
    }
  }
  var entries: [String: String] = [:]
  for item in paths {
    if shouldStop() {
      throw CollectionIssue(
        kind: .timedOut, operation: "snapshot artifact", message: "Snapshot deadline reached",
        path: path)
    }
    var stat = stat()
    guard lstat(item, &stat) == 0 else {
      throw CollectionIssue(
        kind: .readFailed, operation: "snapshot artifact", message: "lstat failed: errno \(errno)",
        path: item)
    }
    entries[item] =
      "\(stat.st_ino):\(stat.st_size):\(stat.st_mtimespec.tv_sec):\(stat.st_mtimespec.tv_nsec):\(stat.st_ctimespec.tv_sec):\(stat.st_ctimespec.tv_nsec)"
  }
  return .init(entries: entries)
}

private func optionPath(_ option: String, args: [String], cwd: URL) -> String? {
  var value: String?
  for (i, arg) in args.enumerated() {
    if arg == option, args.indices.contains(i + 1) {
      value = args[i + 1]
    } else if arg.hasPrefix(option + "=") {
      value = String(arg.dropFirst(option.count + 1))
    }
  }
  return value.map {
    URL(fileURLWithPath: $0, relativeTo: URL(fileURLWithPath: cwd.path, isDirectory: true))
      .standardizedFileURL.path
  }
}

private func probe(
  executable: String, args: [String], invocation: Invocation, environment: [String: String],
  run: String, name: String, interruption: InterruptionState, limits: CollectionLimits
) -> (String?, [CollectionIssue]) {
  let path = run + "/probe-" + name + ".log"
  let fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0o600)
  guard fd >= 0 else {
    return (
      nil,
      [
        .init(
          kind: .writeFailed, operation: "capture capability probe",
          message: "Cannot open probe capture: errno \(errno)", path: path)
      ]
    )
  }
  let outcome = ownedProcess(
    executable: executable, args: args, cwd: invocation.cwd.path, environment: environment,
    output: fd, interruption: interruption, deadline: now() + limits.probe,
    operation: "probe \(name)", limits: limits)
  let closed = close(fd)
  var issues = outcome.issues
  if closed != 0 {
    issues.append(
      .init(
        kind: .writeFailed, operation: "close probe capture", message: "errno \(errno)", path: path)
    )
  }
  guard outcome.exitCode == 0, issues.isEmpty else { return (nil, issues) }
  do {
    return (
      String(decoding: try Data(contentsOf: URL(fileURLWithPath: path)), as: UTF8.self), issues
    )
  } catch {
    return (
      nil,
      issues + [
        .init(
          kind: .readFailed, operation: "read capability probe", message: "\(error)", path: path)
      ]
    )
  }
}

@concurrent
func execute(
  invocation: Invocation, environment: [String: String], limits: CollectionLimits = .production,
  interruption: InterruptionState = .init()
) async -> CapturedRun {
  var run = CapturedRun(command: .init(kind: invocation.kind), artifacts: .init())
  guard
    let executable = resolvedExecutable(
      invocation.executable, cwd: invocation.cwd.path, environment: environment)
  else {
    run.issues.append(
      .init(
        kind: .toolUnavailable, operation: "resolve native executable",
        message: "Executable unavailable: \(invocation.executable)", path: invocation.executable))
    return run
  }
  if invocation.informational {
    let outcome = ownedProcess(
      executable: executable, args: invocation.childArgs, cwd: invocation.cwd.path,
      environment: environment, output: STDOUT_FILENO, errorOutput: STDERR_FILENO,
      interruption: interruption, operation: "native information", limits: limits)
    run.command = commandOutcome(outcome, kind: invocation.kind)
    run.issues = outcome.issues
    return run
  }
  let temporary = environment["TMPDIR"] ?? NSTemporaryDirectory()
  var directory: ObjCBool = false
  guard FileManager.default.fileExists(atPath: temporary, isDirectory: &directory),
    directory.boolValue
  else {
    run.issues.append(
      .init(
        kind: .captureUnavailable, operation: "create run directory",
        message: "Temporary directory does not exist", path: temporary))
    return run
  }
  let parent = URL(fileURLWithPath: temporary, isDirectory: true).appendingPathComponent(
    "axbuild", isDirectory: true)
  let folder = parent.appendingPathComponent("run-" + UUID().uuidString, isDirectory: true).path
  do {
    if mkdir(parent.path, 0o700) != 0, errno != EEXIST {
      throw CollectionIssue(
        kind: .captureUnavailable, operation: "create capture parent", message: "errno \(errno)",
        path: parent.path)
    }
    var parentStat = stat()
    guard lstat(parent.path, &parentStat) == 0, parentStat.st_mode & S_IFMT == S_IFDIR,
      parentStat.st_uid == getuid(), parentStat.st_mode & 0o077 == 0
    else {
      throw CollectionIssue(
        kind: .captureUnavailable, operation: "validate capture parent",
        message: "Capture parent must be a private directory owned by this user, without a symlink",
        path: parent.path)
    }
    try FileManager.default.createDirectory(
      atPath: folder, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
  } catch {
    run.issues.append(
      .init(
        kind: .captureUnavailable, operation: "create run directory", message: "\(error)",
        path: folder))
    return run
  }
  run.artifacts.run = folder
  let fd = open(folder + "/build.log", O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0o600)
  guard fd >= 0 else {
    run.issues.append(
      .init(
        kind: .captureUnavailable, operation: "open raw capture", message: "errno \(errno)",
        path: folder + "/build.log"))
    return run
  }
  run.artifacts.log = "build.log"
  do {
    let startup =
      try JSONEncoder().encode(["event": "run", "path": folder, "log": "build.log"]) + Data([10])
    try FileHandle.standardError.write(contentsOf: startup)
  } catch {
    run.issues.append(
      .init(kind: .writeFailed, operation: "announce run", message: "\(error)", path: folder))
  }
  var capabilities = ToolCapabilities()
  let xcrun = URL(fileURLWithPath: invocation.executable).lastPathComponent == "xcrun"
  let prefix =
    xcrun
    ? Array(invocation.childArgs.prefix(invocation.toolIndex)).filter {
      $0 != "-k" && $0 != "--kill-cache"
    } : []
  if invocation.kind == .swiftBuild || invocation.kind == .swiftTest {
    let help = probe(
      executable: executable,
      args: prefix + [invocation.kind == .swiftTest ? "test" : "build", "--help-hidden"],
      invocation: invocation, environment: environment, run: folder, name: "help",
      interruption: interruption, limits: limits)
    run.issues += help.1
    capabilities.noColor = help.0?.contains("--no-color-diagnostics") == true
    if invocation.kind == .swiftTest, !invocation.childArgs.contains("--disable-swift-testing") {
      let version = probe(
        executable: executable, args: prefix + ["--version"], invocation: invocation,
        environment: environment, run: folder, name: "version", interruption: interruption,
        limits: limits)
      run.issues += version.1
      if version.0?.contains("swiftlang-6.4.0.34.1 clang-2100.3.34.1") == true,
        help.0?.contains("--event-stream-output-path") == true,
        help.0?.contains("--event-stream-version") == true
      {
        capabilities.eventVersion = "6.3"
      } else if optionPath(
        "--event-stream-output-path", args: invocation.childArgs, cwd: invocation.effectiveCwd)
        == nil
      {
        run.issues.append(
          .init(
            kind: .unsupportedSource, operation: "select Swift Testing stream",
            message:
              "Selected toolchain has no validated event stream mapping; retained log remains available"
          ))
      }
    }
  }
  let prepared = applyDiagnosticDefaults(
    invocation: invocation, artifacts: .init(run: folder), capabilities: capabilities)
  let result =
    invocation.kind == .xcodebuild
    ? optionPath("-resultBundlePath", args: prepared.childArgs, cwd: invocation.cwd) : nil
  let events =
    invocation.kind == .swiftTest && !invocation.childArgs.contains("--disable-swift-testing")
    ? optionPath(
      "--event-stream-output-path", args: prepared.childArgs, cwd: invocation.effectiveCwd) : nil
  var snapshots: [String: ArtifactSnapshot] = [:]
  var unverifiedArtifacts: Set<String> = []
  for path in [result, events].compactMap({ $0 }) {
    do {
      if let snapshot = try artifactSnapshot(path, shouldStop: { interruption.signal != 0 }) {
        snapshots[path] = snapshot
      }
    } catch let issue as CollectionIssue {
      unverifiedArtifacts.insert(path)
      run.issues.append(issue)
    } catch {
      unverifiedArtifacts.insert(path)
      run.issues.append(
        .init(
          kind: .readFailed, operation: "snapshot caller artifact", message: "\(error)", path: path)
      )
    }
  }
  run.artifacts.resultBundle = result
  run.artifacts.eventStream = events
  if !invocation.unrecognized.isEmpty {
    run.issues.append(
      .init(
        kind: .unsupportedSource, operation: "classify xcodebuild arguments",
        message:
          "Unrecognized or incomplete argument(s) \(invocation.unrecognized.joined(separator: " ")); ran as native validation: no diagnostic defaults were added and test results were not read"
      ))
  }
  run.invocation = .init(
    originalArgs: invocation.originalArgs, executedArgs: prepared.childArgs, executable: executable,
    cwd: invocation.cwd.path, effectiveCwd: invocation.effectiveCwd.path,
    defaults: prepared.defaults)
  if interruption.signal == 0 {
    let outcome = ownedProcess(
      executable: executable, args: prepared.childArgs, cwd: invocation.cwd.path,
      environment: environment, output: fd, interruption: interruption,
      operation: "native build/test", limits: limits)
    run.command = commandOutcome(outcome, kind: invocation.kind)
    run.issues += outcome.issues
  } else {
    run.command.interruptionSignal = Int(interruption.signal)
    run.issues.append(
      .init(
        kind: .readFailed, operation: "launch native build/test",
        message: "Interrupted before native launch"))
  }
  if close(fd) != 0 {
    run.issues.append(
      .init(
        kind: .writeFailed, operation: "close raw capture", message: "errno \(errno)",
        path: folder + "/build.log"))
  }
  var reader: String?
  var readerArgs: [String] = []
  if invocation.kind == .xcodebuild, invocation.action == .test {
    let selectedTool = xcrun ? invocation.childArgs[invocation.toolIndex - 1] : executable
    if xcrun, !selectedTool.contains("/") {
      reader = executable
      readerArgs = Array(prefix.dropLast()) + ["xcresulttool"]
    } else if selectedTool != "/usr/bin/xcodebuild" {
      let selected =
        resolvedExecutable(selectedTool, cwd: invocation.cwd.path, environment: environment)
        ?? selectedTool
      let adjacent = URL(fileURLWithPath: selected).deletingLastPathComponent()
        .appendingPathComponent("xcresulttool").path
      reader = resolvedExecutable(adjacent, cwd: invocation.cwd.path, environment: environment)
      if reader == nil {
        run.issues.append(
          .init(
            kind: .toolUnavailable, operation: "resolve selected xcresulttool",
            message: "Cannot safely use a different toolchain for explicit xcodebuild",
            path: adjacent))
      }
    } else {
      reader = resolvedExecutable("xcrun", cwd: invocation.cwd.path, environment: environment)
      readerArgs = ["xcresulttool"]
    }
  }
  run.execution = .init(
    invocation: invocation, environment: environment, interruption: interruption,
    deadline: now() + limits.collection, snapshots: snapshots, resultReader: reader,
    resultReaderArgs: readerArgs,
    eventExpected: invocation.kind == .swiftTest
      && !invocation.childArgs.contains("--disable-swift-testing") && (events != nil),
    collectionInterruption: interruption.signal, unverifiedArtifacts: unverifiedArtifacts)
  return run
}

private func commandOutcome(_ outcome: ProcessOutcome, kind: CommandKind?) -> CommandOutcome {
  .init(
    kind: kind,
    status: !outcome.started
      ? .notStarted
      : outcome.interruptedRunning
        ? .interrupted : outcome.exitCode == 0 ? .succeeded : .failed, exitCode: outcome.exitCode,
    signal: outcome.signal, interruptionSignal: outcome.interruptionSignal,
    durationMs: outcome.durationMs)
}

@concurrent
func collect(run: CapturedRun, limits: CollectionLimits = .production) async -> [ReadBatch] {
  guard let state = run.execution, let folder = run.artifacts.run else { return [] }
  let stop: @Sendable () -> Bool = {
    now() >= state.deadline || state.interruption.signal != state.collectionInterruption
  }
  var context = ReaderContext(
    cwd: state.invocation.cwd.path, effectiveCwd: state.invocation.effectiveCwd.path, source: .log,
    canonicalPath: {
      guard FileManager.default.fileExists(atPath: $0) else { return nil }
      return URL(fileURLWithPath: $0).resolvingSymlinksInPath().path
    }, shouldStop: stop)
  var batches: [ReadBatch] = []
  do {
    let data = try Data(
      contentsOf: URL(fileURLWithPath: folder + "/build.log"), options: .mappedIfSafe)
    batches.append(readLog(data: data, context: context))
  } catch {
    batches.append(
      .init(issues: [
        .init(
          kind: .readFailed, operation: "read retained log", message: "\(error)",
          path: folder + "/build.log")
      ]))
  }
  let sources: [(Source, String?, Bool)] = [
    (.events, state.eventExpected ? run.artifacts.eventStream : nil, state.eventExpected),
    (.testResults, run.artifacts.resultBundle, state.invocation.action == .test),
  ]
  for (source, path, shouldRead) in sources {
    guard let path else { continue }
    if shouldRead { batches.append(.init(expectedSources: [source])) }
    if state.unverifiedArtifacts.contains(path) {
      batches.append(
        .init(issues: [
          .init(
            kind: .readFailed, operation: "verify artifact freshness",
            message:
              "Prelaunch artifact snapshot failed; current-run evidence cannot be established",
            path: path)
        ]))
      continue
    }
    do {
      guard let current = try artifactSnapshot(path, shouldStop: stop),
        current != state.snapshots[path]
      else {
        batches.append(
          .init(issues: [
            .init(
              kind: .missingArtifact, operation: "verify current \(source.rawValue) evidence",
              message: "Artifact is missing or unchanged/stale after this invocation", path: path)
          ]))
        continue
      }
      if !shouldRead { continue }
      if state.interruption.signal != 0 {
        batches.append(
          .init(issues: [
            .init(
              kind: .readFailed, operation: "collect \(source.rawValue)",
              message: "Structured collection interrupted; retained log was read separately",
              path: path)
          ]))
        continue
      }
      if stop() {
        batches.append(
          .init(issues: [
            .init(
              kind: .timedOut, operation: "collect \(source.rawValue)",
              message: "Collection interrupted or shared deadline reached", path: path)
          ]))
        continue
      }
      context.source = source
      if source == .events {
        let data = try Data(contentsOf: URL(fileURLWithPath: path), options: .mappedIfSafe)
        batches.append(readEvents(data: data, context: context))
      } else {
        guard let reader = state.resultReader else {
          batches.append(
            .init(issues: [
              .init(
                kind: .toolUnavailable, operation: "read selected test results",
                message: "No matching xcresulttool executable available", path: path)
            ]))
          continue
        }
        let output = folder + "/test-results.json"
        let fd = open(output, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0o600)
        guard fd >= 0 else {
          throw CollectionIssue(
            kind: .writeFailed, operation: "capture test reader", message: "errno \(errno)",
            path: output)
        }
        let result = ownedProcess(
          executable: reader,
          args: state.resultReaderArgs + [
            "get", "test-results", "tests", "--path", path, "--compact",
          ], cwd: state.invocation.cwd.path, environment: state.environment, output: fd,
          interruption: state.interruption,
          deadline: limits.readerDeadline(start: now(), sharedDeadline: state.deadline),
          operation:
            "read test-results (\(limits.reader)s reader / \(limits.collection)s shared limit)",
          limits: limits)
        let closeStatus = close(fd)
        var issues = result.issues
        if closeStatus != 0 {
          issues.append(
            .init(
              kind: .writeFailed, operation: "close test reader", message: "errno \(errno)",
              path: output))
        }
        if result.exitCode == 0, issues.isEmpty {
          batches.append(
            readTestResults(
              data: try Data(contentsOf: URL(fileURLWithPath: output), options: .mappedIfSafe),
              context: context))
        } else {
          if issues.isEmpty {
            issues.append(
              .init(
                kind: .readFailed, operation: "read test-results",
                message:
                  "xcresulttool exit=\(String(describing: result.exitCode)), signal=\(String(describing: result.signal))",
                path: path))
          }
          batches.append(.init(issues: issues))
        }
      }
    } catch let issue as CollectionIssue { batches.append(.init(issues: [issue])) } catch {
      batches.append(
        .init(issues: [
          .init(
            kind: .readFailed, operation: "read \(source.rawValue)", message: "\(error)", path: path
          )
        ]))
    }
  }
  return batches
}

private func storeReport(_ report: Report, path: String) throws {
  let data = try encodeFullReport(report: report).get()
  let temporary = path + "." + UUID().uuidString + ".tmp"
  let fd = open(temporary, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0o600)
  guard fd >= 0 else {
    throw CollectionIssue(
      kind: .writeFailed, operation: "create retained report", message: "errno \(errno)", path: path
    )
  }
  do {
    try data.withUnsafeBytes { raw in
      var offset = 0
      while offset < raw.count {
        let n = write(fd, raw.baseAddress?.advanced(by: offset), raw.count - offset)
        if n < 0 && errno == EINTR { continue }
        guard n > 0 else {
          throw CollectionIssue(
            kind: .writeFailed, operation: "write retained report", message: "errno \(errno)",
            path: path)
        }
        offset += n
      }
    }
    guard fsync(fd) == 0 else {
      throw CollectionIssue(
        kind: .writeFailed, operation: "sync retained report", message: "errno \(errno)", path: path
      )
    }
  } catch {
    _ = close(fd)
    _ = unlink(temporary)
    throw error
  }
  guard close(fd) == 0, rename(temporary, path) == 0 else {
    let code = errno
    _ = unlink(temporary)
    throw CollectionIssue(
      kind: .writeFailed, operation: "publish retained report", message: "errno \(code)", path: path
    )
  }
}

@concurrent
public func runCLI() async -> Int32 {
  signal(SIGPIPE, SIG_IGN)
  let args = Array(CommandLine.arguments.dropFirst())
  if args == ["--help"] || args == ["-h"] {
    print(
      "Usage: axbuild [--format json-compact|json] [--] xcodebuild <args> | swift build/test <args>"
    )
    return 0
  }
  if args == ["--version"] {
    print("axbuild 1")
    return 0
  }
  let environment = ProcessInfo.processInfo.environment
  let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
  let interruption = InterruptionState()
  let queue = DispatchQueue(label: "axbuild.signals")
  let sources = [SIGINT, SIGTERM, SIGHUP].map { value in
    signal(value, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: value, queue: queue)
    source.setEventHandler { interruption.record(value) }
    source.resume()
    return source
  }
  defer { for source in sources { source.cancel() } }
  var run: CapturedRun
  var batches: [ReadBatch] = []
  var format = RenderFormat.compact
  switch parseInvocation(args: args, cwd: cwd) {
  case .failure(let issue):
    run = .init(command: .init(kind: nil), artifacts: .init(), issues: [issue])
  case .success(let invocation):
    format = invocation.format
    run = await execute(
      invocation: invocation, environment: environment, interruption: interruption)
    if invocation.informational { return wrapperExit(run) }
    batches = await collect(run: run)
    let missing = Set(
      batches.flatMap(\.issues).filter { $0.kind == .missingArtifact }.compactMap(\.path))
    if let path = run.artifacts.resultBundle, missing.contains(path) {
      run.artifacts.resultBundle = nil
    }
    if let path = run.artifacts.eventStream, missing.contains(path) {
      run.artifacts.eventStream = nil
    }
    run.command.interruptionSignal = interruption.signal == 0 ? nil : Int(interruption.signal)
  }
  let collectionDeadline = run.execution?.deadline ?? .infinity
  let collectionInterruption = run.execution?.collectionInterruption ?? 0
  let context = ReaderContext(
    cwd: cwd.path, effectiveCwd: run.execution?.invocation.effectiveCwd.path ?? cwd.path,
    source: .log,
    shouldStop: { collectionDeadline <= now() || interruption.signal != collectionInterruption })
  if let folder = run.artifacts.run {
    do {
      let data = try Data(
        contentsOf: URL(fileURLWithPath: folder + "/build.log"), options: .mappedIfSafe)
      run.logTail = String(decoding: data.suffix(2048), as: UTF8.self)
    } catch {
      run.issues.append(
        .init(
          kind: .readFailed, operation: "read log tail", message: "\(error)",
          path: folder + "/build.log"))
    }
  }
  var report = makeReport(run: run, batches: batches, context: context)
  if let folder = run.artifacts.run {
    report.artifacts.report = "report.json"
    do { try storeReport(report, path: folder + "/report.json") } catch {
      report.artifacts.report = nil
      report.collection.issues.append(
        (error as? CollectionIssue)
          ?? .init(
            kind: .writeFailed, operation: "store retained report", message: "\(error)",
            path: folder))
      report.collection.status = report.collection.sources.isEmpty ? .unavailable : .partial
    }
  }
  do {
    let rendered = try renderReport(report: report, format: format).get()
    try FileHandle.standardOutput.write(contentsOf: rendered.data)
  } catch {
    report.collection.issues.append(
      (error as? CollectionIssue)
        ?? .init(
          kind: .writeFailed, operation: "deliver stdout report", message: "\(error)",
          path: report.artifacts.report))
    report.collection.status = report.collection.sources.isEmpty ? .unavailable : .partial
    if let folder = run.artifacts.run, report.artifacts.report != nil {
      do { try storeReport(report, path: folder + "/report.json") } catch {
        fputs("axbuild: retained report update failed: \(error)\n", stderr)
      }
    }
  }
  return wrapperExit(run)
}

func wrapperExit(_ run: CapturedRun) -> Int32 {
  if let signal = run.command.interruptionSignal { return Int32(128 + signal) }
  if let code = run.command.exitCode { return Int32(code) }
  if let signal = run.command.signal { return Int32(128 + signal) }
  let kinds = Set(run.issues.map(\.kind))
  if kinds.contains(.invalidInvocation) { return 64 }
  if kinds.contains(.toolUnavailable) { return 69 }
  if kinds.contains(.captureUnavailable) { return 74 }
  return 70
}
