---
name: audit-memory
description: Quick audit for memory leaks — detects timer leaks, observer leaks, closure captures, delegate cycles, view callbacks, and PhotoKit accumulation with file:line references and severity ratings
allowed-tools: Glob(*.swift), Grep(*)
---

# Memory Leak Audit

Scan your Swift codebase for the 6 most common memory leak patterns that cause crashes and progressive memory growth.

## What This Command Checks

1. **Timer Leaks** — Repeating timers without `invalidate()`
2. **Observer/Notification Leaks** — `addObserver` without `removeObserver`
3. **Closure Capture Leaks** — Closures in arrays capturing self strongly
4. **Delegate Cycle Leaks** — Strong delegate references
5. **View Callback Leaks** — Completion handlers retaining view controllers
6. **PhotoKit Accumulation** — Missing `stopCachingImages` calls

## When to Use

Run this command when:
- App memory grows progressively during use
- Seeing multiple instances of same view controller in Instruments
- Crashes with "Memory limit exceeded" errors
- Before shipping production releases
- After adding timers, observers, or closure-based APIs

## Leak Patterns

### 🔴 Critical (Crashes in Minutes)

#### Timer Leaks
```swift
// ❌ LEAKS: Timer never stops
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateUI()  // Timer still runs even with weak self!
}

// ✅ SAFE: Invalidate in deinit
deinit {
    timer?.invalidate()
}
```

**Memory growth** 10-30MB/minute until crash

### 🟡 High Priority (Leaks Over Time)

#### Observer Leaks
```swift
// ❌ LEAKS: Observer never removed
NotificationCenter.default.addObserver(
    self,
    selector: #selector(handleNotification),
    name: .someNotification,
    object: nil
)

// ✅ SAFE: Remove in deinit
deinit {
    NotificationCenter.default.removeObserver(self)
}
```

#### Closure Capture Leaks
```swift
// ❌ LEAKS: Closure array captures self strongly
var callbacks: [(Int) -> Void] = []
callbacks.append { value in
    self.process(value)  // Strong capture!
}

// ✅ SAFE: Use weak self
callbacks.append { [weak self] value in
    self?.process(value)
}
```

#### Delegate Cycles
```swift
// ❌ LEAKS: Parent holds child, child holds parent
class Parent {
    var child = Child()
}
class Child {
    var delegate: Parent?  // Strong reference!
}

// ✅ SAFE: Weak delegate
class Child {
    weak var delegate: Parent?
}
```

### 🟢 Medium Priority (Accumulation)

#### View Callback Leaks
```swift
// ❌ LEAKS: Completion retains view controller
present(picker, animated: true) { [self] in
    self.processResult()  // Captures self strongly!
}

// ✅ SAFE: Weak capture
present(picker, animated: true) { [weak self] in
    self?.processResult()
}
```

#### PhotoKit Accumulation
```swift
// ❌ LEAKS: Images cached indefinitely
imageManager.startCachingImages(for: assets, ...)
// Never calls stopCachingImages!

// ✅ SAFE: Stop when done
deinit {
    imageManager.stopCachingImages(for: assets, ...)
}
```

## Running the Audit

```bash
# In Claude Code
/audit-memory
```

The command will:
1. Find all Swift files in your project
2. Scan for the 6 leak patterns above
3. Report findings with `file:line` references
4. Prioritize by severity (Critical → Medium)
5. Estimate memory impact per leak

## Example Output

```
🔴 CRITICAL: Timer Leaks (2 issues)
  - VideoPlayerVC.swift:67 - Repeating timer, no invalidate()
  - DashboardVC.swift:102 - Polling timer without cleanup
  Impact: ~20MB/minute memory growth

🟡 HIGH: Observer Leaks (5 issues)
  - UserProfileVC.swift:34 - NotificationCenter observer not removed
  - SettingsVC.swift:45 - KVO observer without cleanup

🟡 HIGH: Closure Capture Leaks (3 issues)
  - NetworkManager.swift:78 - Completion array captures self

🟢 MEDIUM: View Callback Leaks (1 issue)
  - ImagePickerWrapper.swift:23 - Present completion captures self
```

## Next Steps

After running the audit:

1. **Fix Critical leaks immediately** — These cause production crashes
2. **Profile with Instruments** — Verify leaks are gone
3. **Add to CI/CD** — Run before each release

For detailed fix patterns, use the [memory-debugging](/skills/debugging/memory-debugging) skill:

```
"How do I fix these memory leaks?"
```

The skill provides:
- Complete fix patterns for all 6 leak types
- Instruments profiling workflows
- Debug reproduction strategies
- Production crash defense

## Real-World Impact

#### Before audit
- 2-3 hours with Instruments finding leaks
- Crashes discovered in production
- Non-reproducible memory issues

#### After audit
- 2-5 minutes to identify leak candidates
- Catch issues before Instruments needed
- Proactive leak prevention

Most leaks detected by this command can be fixed with 1-3 lines of code in `deinit`.
