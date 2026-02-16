---
name: background-processing-ref
description: Complete background task API reference for BGTaskScheduler, BGAppRefreshTask, BGProcessingTask, BGContinuedProcessingTask (iOS 26), beginBackgroundTask, and background URLSession
---

# Background Processing Reference

Complete API reference for iOS background execution. Covers all task types from BGTaskScheduler registration through SwiftUI integration, with code examples from WWDC sessions.

## When to Use This Reference

Use this reference when you need:
- BGTaskScheduler registration and Info.plist configuration
- BGAppRefreshTask scheduling and handler patterns
- BGProcessingTask with power and network constraints
- BGContinuedProcessingTask (iOS 26+) for user-initiated work with progress UI
- beginBackgroundTask for finishing critical work on background transition
- Background URLSession for downloads that survive app termination
- Silent push notification handling
- SwiftUI `.backgroundTask` modifier patterns

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I register a BGTaskScheduler handler correctly?"
- "What's the difference between BGAppRefreshTask and BGProcessingTask?"
- "How do I use BGContinuedProcessingTask in iOS 26 for photo export?"
- "How do I set up a background URLSession that continues after app termination?"
- "What's the correct AppDelegate handler for background URLSession events?"
- "How do I use the SwiftUI backgroundTask modifier?"
- "How do I handle silent push notifications for background refresh?"
- "What are the LLDB commands to test background tasks?"

## What's Covered

- **BGTaskScheduler registration** -- Info.plist configuration, handler registration timing, identifier matching
- **BGAppRefreshTask** -- ~30s runtime, scheduling with earliestBeginDate, continuous refresh pattern
- **BGProcessingTask** -- Multi-minute runtime, requiresExternalPower and requiresNetworkConnectivity constraints, progress checkpointing
- **BGContinuedProcessingTask (iOS 26+)** -- User-initiated work with system progress UI, dynamic registration, wildcard identifiers, GPU access
- **beginBackgroundTask** -- ~30s finalization window, proper endBackgroundTask cleanup
- **Background URLSession** -- Discretionary downloads, sessionSendsLaunchEvents, delegate lifecycle
- **Silent push notifications** -- Payload format, APNS priority, rate limiting behavior
- **SwiftUI integration** -- `.backgroundTask(.appRefresh)` and `.backgroundTask(.urlSession)` modifiers
- **Testing** -- LLDB simulate launch/expiration commands, console log filters, getPendingTaskRequests
- **System constraints** -- 7 scheduling factors, thermal state, Low Power Mode detection

## Documentation Scope

This page documents the `axiom-background-processing-ref` reference skill -- comprehensive API coverage Claude uses when you need specific background task APIs, configuration details, or implementation patterns.

- For implementation guidance and decision trees, see [background-processing](/skills/integration/background-processing)
- For troubleshooting "task never runs" and other issues, see [background-processing-diag](/diagnostic/background-processing-diag)

## Related

- [background-processing](/skills/integration/background-processing) — Patterns, decision trees, and implementation guidance
- [background-processing-diag](/diagnostic/background-processing-diag) — Symptom-based troubleshooting
- [energy](/skills/debugging/energy) — Battery optimization for background work
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async/await and task cancellation patterns

## Resources

**WWDC**: 2019-707, 2020-10063, 2022-10142, 2023-10170, 2025-227

**Docs**: /backgroundtasks, /backgroundtasks/bgtaskscheduler, /foundation/urlsessionconfiguration
