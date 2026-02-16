---
name: hang-diagnostics
description: Systematic diagnosis and resolution of app hangs, watchdog terminations, and main thread blocking
---

# Hang Diagnostics

Systematic diagnosis and resolution of app hangs -- when the main thread is blocked for more than 1 second, making the app unresponsive to user input.

## When to Use

Use this skill when:
- App freezes briefly during use
- UI doesn't respond to touches
- System shows "App not responding" dialog
- Xcode Organizer reports hang diagnostics
- MetricKit delivers MXHangDiagnostic payloads
- App is killed by the watchdog during launch or transitions

**Not a hang?** If animations stutter but the app stays responsive, that's a hitch -- see [swiftui-performance](/skills/ui-design/swiftui-performance). If the app feels slow but responds to touches, that's lag -- see [performance-profiling](/skills/debugging/performance-profiling).

## Example Prompts

- "My app freezes for a few seconds when loading data."
- "Users are seeing 'app not responding' dialogs."
- "Xcode Organizer shows hang reports -- how do I read them?"
- "My app gets killed on launch with a watchdog termination."
- "How do I find what's blocking my main thread?"

## What This Skill Provides

### Hang Classification

Every hang has one of two root causes:

| Root Cause | Main Thread Is... | Diagnosed With |
|------------|-------------------|----------------|
| **Busy** | Doing work (CPU high) | Time Profiler |
| **Blocked** | Waiting on something (CPU low) | System Trace |

The skill provides a decision tree to determine which type you have and which Instruments tool to use.

### Common Hang Patterns

Eight before/after code patterns covering the most frequent causes:
- Synchronous file I/O on main thread
- Unfiltered notification observers
- Expensive formatter creation in loops
- `DispatchQueue.main.sync` from background (deadlock risk)
- Semaphore blocking for async results
- Lock contention between threads
- Too much work at app launch (watchdog kills)
- Image processing on main thread

### Watchdog Termination Reference

Time limits for key app transitions (launch ~20s, background ~5s, foreground ~10s) and how to identify watchdog kills in crash logs.

### Field Diagnostics

How to use Xcode Organizer hang reports and MetricKit's MXHangDiagnostic to diagnose hangs that only occur in production.

### Prevention Checklist

A pre-ship verification checklist covering file I/O, dispatch patterns, formatters, notification observers, launch work, image processing, and database queries.

## Related

- [performance-profiling](/skills/debugging/performance-profiling) -- Instruments workflows for CPU, memory, and general performance
- [swift-concurrency](/skills/concurrency/swift-concurrency) -- Async/await patterns to replace blocking code
- [energy](/skills/debugging/energy) -- Battery drain diagnosis (hangs and energy issues share root causes)

## Resources

**WWDC**: 2021-10258, 2022-10082

**Docs**: /xcode/analyzing-responsiveness-issues-in-your-shipping-app, /metrickit/mxhangdiagnostic
