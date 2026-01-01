---
name: concurrency-profiling
description: Instruments workflows for async/await — Swift Concurrency template, actor contention diagnosis, thread pool exhaustion debugging
---

# Concurrency Profiling — Instruments Workflows

**Purpose**: Profile and optimize Swift async/await code using Instruments
**Xcode Version**: Xcode 14+ (Swift Concurrency template)
**iOS Version**: iOS 13+

## When to Use This Skill

✅ **Use this skill when**:
- UI stutters during async operations
- Suspecting actor contention
- Tasks queued but not executing
- Main thread blocked during async work
- Need to visualize task execution flow

❌ **Do NOT use this skill for**:
- Pure CPU performance (use Time Profiler)
- Memory issues unrelated to concurrency (use Allocations)
- Haven't confirmed concurrency is the bottleneck

## Swift Concurrency Template

### What It Shows

| Track | Information |
|-------|-------------|
| **Swift Tasks** | Task lifetimes, parent-child relationships |
| **Swift Actors** | Actor access, contention visualization |
| **Thread States** | Blocked vs running vs suspended |

### Color Coding

- **Blue**: Task executing
- **Red**: Task waiting (contention)
- **Gray**: Task suspended (awaiting)

## Key Workflows

### Workflow 1: Main Thread Blocking

**Symptom**: UI freezes, main thread timeline full

1. Profile with Swift Concurrency template
2. Look at main thread → "Swift Tasks" lane
3. Find long blue bars (task executing on main)
4. Offload with `Task.detached` or `nonisolated`

### Workflow 2: Actor Contention

**Symptom**: Tasks serializing unexpectedly

1. Enable "Swift Actors" instrument
2. High red:blue ratio = contention problem
3. Fix: Split actors, use `nonisolated`, or Mutex for hot paths

### Workflow 3: Thread Pool Exhaustion

**Symptom**: Tasks queued but not executing

**Cause**: Blocking calls (`semaphore.wait()`, sync I/O) exhaust cooperative pool

**Debug flag**:
```
SWIFT_CONCURRENCY_COOPERATIVE_THREAD_BOUNDS=1
```

## Related Skills

- [Swift Concurrency](./swift-concurrency) — Concurrency patterns
- [Synchronization](./synchronization) — Mutex vs actor decisions
- [Performance Profiling](/skills/debugging/performance-profiling) — General profiling

## Resources

- **WWDC**: [Visualize and optimize Swift concurrency (110350)](https://developer.apple.com/videos/play/wwdc2022/110350/)
- **WWDC**: [Swift concurrency: Behind the scenes (10254)](https://developer.apple.com/videos/play/wwdc2021/10254/)
