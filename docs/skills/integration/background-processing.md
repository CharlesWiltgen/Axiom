# Background Processing

Systematic background task implementation and debugging for iOS 13+.

## Overview

Background execution is a privilege, not a right. iOS actively limits background work to protect battery life. This skill provides systematic patterns for implementing BGTaskScheduler correctly and debugging "task never runs" issues.

**Energy optimization**: For reducing battery impact of background tasks, see the [Energy](/skills/debugging/energy) skill. This skill focuses on task **mechanics** — making tasks run correctly.

## Key Features

- **7 Common Patterns** — BGAppRefreshTask, BGProcessingTask, BGContinuedProcessingTask (iOS 26), Background URLSession, beginBackgroundTask, Silent Push, SwiftUI backgroundTask modifier
- **Debugging Decision Trees** — "Task never runs", "Task terminates early", "Works in dev not prod"
- **The 7 Scheduling Factors** — Why iOS may not run your task
- **Swift 6 Cancellation Integration** — withTaskCancellationHandler for expiration
- **LLDB Testing Commands** — Force task execution during development

## When to Use

- Implementing BGTaskScheduler for the first time
- Debugging why background tasks never run
- Understanding BGAppRefreshTask vs BGProcessingTask
- Testing background execution in simulator
- Integrating Swift Concurrency with task expiration

## Task Types

| Type | Runtime | Use Case |
|------|---------|----------|
| BGAppRefreshTask | ~30s | Keep content fresh |
| BGProcessingTask | Minutes | Maintenance (overnight, charging) |
| BGContinuedProcessingTask | Extended | User-initiated work (iOS 26+) |
| beginBackgroundTask | ~30s | Finish work on background |
| Background URLSession | As needed | Large downloads/uploads |

## Quick Reference

### LLDB Debugging Commands

```text
// Trigger task launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"IDENTIFIER"]

// Trigger expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"IDENTIFIER"]
```

### Console Log Filter

```
subsystem:com.apple.backgroundtaskscheduler
```

## Common Issues

1. **Task never runs** — Check Info.plist identifier matches exactly (case-sensitive)
2. **Registration fails** — Must register in didFinishLaunchingWithOptions before return
3. **Works in dev, not prod** — Check Low Power Mode, Background App Refresh setting, app not swiped away
4. **Missing setTaskCompleted** — Must call in ALL code paths including errors

## Related Skills

- **background-processing-diag** — Symptom-based troubleshooting
- **background-processing-ref** — Complete API reference
- **energy** — Battery optimization patterns

## Requirements

- iOS 13+ (BGTaskScheduler)
- iOS 26+ (BGContinuedProcessingTask)
- Xcode 15+

## Resources

**WWDC**: 2019-707, 2020-10063, 2022-10142, 2023-10170, 2025-227

**Docs**: [BGTaskScheduler](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler)
