# Timer Patterns Reference

Complete API reference for iOS timer mechanisms — Timer, DispatchSourceTimer, Combine Timer.publish, AsyncTimerSequence, and Task.sleep.

## When to Use This Reference

Use this reference when:
- Looking up specific timer API syntax or parameters
- Understanding DispatchSourceTimer lifecycle state machine
- Choosing the right timer API for your use case
- Checking platform availability for timer APIs
- Debugging timer behavior with LLDB commands

## Example Prompts

- "What's the API for Timer.publish in Combine?"
- "How do I schedule a DispatchSourceTimer with leeway?"
- "What RunLoop modes are available for Timer?"
- "How do I use ContinuousClock.timer for async polling?"
- "What's the platform availability for AsyncTimerSequence?"

## What's Covered

- Timer API (scheduledTimer, tolerance, RunLoop modes, invalidate lifecycle)
- DispatchSourceTimer API (makeTimerSource, schedule, activate, suspend/resume/cancel, state machine)
- Combine Timer (Timer.publish, autoconnect, RunLoop mode parameter)
- AsyncTimerSequence (ContinuousClock.timer, SuspendingClock.timer, structured concurrency)
- Task.sleep patterns (one-shot delays vs repeating timers)
- LLDB timer inspection commands
- Platform availability matrix

## Documentation Scope

This page documents the `axiom-timer-patterns-ref` skill — the API reference Claude uses for timer syntax and lifecycle details.

**For decision trees and crash prevention:** See [Timer Safety Patterns](/skills/debugging/timer-patterns) for when to use which timer API and how to prevent DispatchSourceTimer crashes.

## Related

- [Timer Safety Patterns](/skills/debugging/timer-patterns) — Decision trees, crash patterns, SafeDispatchTimer wrapper (use this for "which timer should I use?" questions)
- [Energy Optimization](/skills/debugging/energy) — Timer as energy subsystem (tolerance, coalescing)
- [Memory Debugging](/skills/debugging/memory-debugging) — Timer retain cycle as leak pattern

## Resources

**Skills**: axiom-timer-patterns, axiom-energy-ref, axiom-memory-debugging
