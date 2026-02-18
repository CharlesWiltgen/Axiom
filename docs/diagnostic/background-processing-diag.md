---
name: background-processing-diag
description: Symptom-based background task troubleshooting with decision trees for task never runs, terminates early, works in dev not prod, and delegate not called
---

# Background Processing Diagnostics

Symptom-based troubleshooting for iOS background task issues. Decision trees for the 7 most common failures, with time-cost analysis for each diagnosis path.

## Symptoms This Diagnoses

Use when you're experiencing:
- Background task handler never called despite successful `submit()`
- Task starts but terminates before completing work
- Background URLSession delegate callbacks never fire
- Tasks work in development with the debugger but fail in production or release builds
- Inconsistent scheduling where tasks run sometimes but not predictably
- App crashes when launched by the system for a background task
- Same task appears to run repeatedly or in parallel

## Example Prompts

- "My BGTaskScheduler handler never gets called. What's wrong?"
- "Background task works in Xcode but not for users in production."
- "My background download finishes but didFinishDownloadingTo is never called."
- "Why does my background task get terminated before it finishes?"
- "How do I test background task expiration handling?"
- "My background task scheduling is inconsistent. Sometimes it runs, sometimes not."
- "App crashes when iOS launches it for a background task."

## Diagnostic Workflow

### 30-Second Check

1. Info.plist has BGTaskSchedulerPermittedIdentifiers with exact identifier?
2. Registration happens in `didFinishLaunchingWithOptions` before `return true`?
3. App not swiped away from App Switcher?

### 5-Minute Check

4. Identifiers match exactly (case-sensitive) between code and Info.plist?
5. Background mode enabled (fetch for refresh, processing for processing tasks)?
6. `setTaskCompleted` called in ALL code paths including errors?
7. Expiration handler set as first line in handler?

### 15-Minute Investigation

8. LLDB simulate launch triggers handler?
9. LLDB simulate expiration is handled gracefully?
10. Console shows registration and scheduling logs?
11. Testing on real device (not just simulator)?
12. Release build matches debug behavior?
13. Background App Refresh enabled in Settings?

### LLDB Quick Test

```text
// Trigger task launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.yourapp.refresh"]

// Force expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"com.yourapp.refresh"]
```

### Console Log Filter

```
subsystem:com.apple.backgroundtaskscheduler
```

## The 7 Scheduling Factors

All affect whether iOS runs your task in production:

| Factor | Impact |
|--------|--------|
| Critically Low Battery | Discretionary work paused below ~20% |
| Low Power Mode | Limited background activity |
| App Usage Frequency | Rarely used apps get lower priority |
| App Switcher | Swiped away = no background until foreground |
| Background App Refresh | User can disable per-app in Settings |
| System Budgets | Depletes with frequent launches, refills daily |
| Rate Limiting | System spaces out launches |

## Related

- [background-processing](/skills/integration/background-processing) — Implementation patterns and decision trees
- [background-processing-ref](/reference/background-processing-ref) — Complete API reference for all task types
- [energy](/skills/debugging/energy) — Battery optimization for background work

## Resources

**WWDC**: 2019-707, 2020-10063

**Docs**: /backgroundtasks, /backgroundtasks/bgtaskscheduler
