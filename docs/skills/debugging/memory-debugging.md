---
name: memory-debugging
description: Use when debugging retain cycles, memory leaks, crashes after 10+ minutes, or progressive memory growth from 50MB → 200MB — provides systematic diagnosis, Instruments patterns, and production-ready fixes for iOS/macOS apps under time pressure
---

# Memory Debugging

Systematic memory leak diagnosis using Instruments. This skill covers the 5 leak patterns responsible for 90% of real-world iOS memory issues.

## When to Use This Skill

Use this skill when you're:
- Seeing app memory grow progressively during use (50MB → 100MB → 200MB)
- Finding multiple instances of the same view controller in Instruments
- Getting crashes after 10-15 minutes with no error message
- Instruments shows retain cycles or leaked objects
- View controllers don't deallocate after dismiss

**Time investment:** 15-30 minutes with this skill vs 2-3 hours hunting without it.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My app crashes after 10-15 minutes of use with no error messages. How do I find the leak?"
- "Memory jumps from 50MB to 200MB+ on a specific action. Is this a leak or normal caching?"
- "View controllers don't deallocate after dismiss. How do I find the retain cycle?"
- "I have timers and observers that might be leaking. How do I verify and fix?"
- "My app uses 200MB. Is that normal or do I have multiple leaks?"
- "How do I set up Instruments to track memory leaks?"
- "How do I verify my fix actually worked?"

## What's Covered

### The 5 Leak Patterns (90% of Real Issues)

1. **Closure Capture Leaks** — `self` captured strongly in escaping closures
2. **Delegate Cycles** — Strong delegate references creating mutual retention
3. **Timer Leaks** — Repeating timers holding strong references
4. **NotificationCenter Leaks** — Observers not removed in deinit
5. **Parent-Child Cycles** — Navigation or container relationships

### Instruments Workflows
- Allocations instrument setup and heap snapshots
- Reference count tracking and retain cycle visualization
- Mark Generation technique for isolating leaks
- Memory Graph Debugger for finding retainers

### Diagnostic Decision Tree
- Progressive growth vs temporary spikes
- Leak vs expected cache behavior
- Normal memory use vs problematic patterns

### Verification Patterns
- `deinit` logging to confirm deallocation
- Heap snapshot comparison before/after
- Regression testing for leaks

## Key Pattern

### Closure Capture Fix

```swift
// ❌ LEAKS: Strong capture of self
viewModel.onUpdate = {
    self.updateUI()  // self captured strongly
}

// ✅ SAFE: Weak capture
viewModel.onUpdate = { [weak self] in
    self?.updateUI()
}

// ✅ Verify fix worked
deinit {
    print("ViewController deallocated")  // Should print on dismiss
}
```

### Quick Diagnosis Checklist

1. Does the class have `deinit`? Add one with a print statement
2. Does `deinit` fire when expected? If not, leak exists
3. Check: closures, delegates, timers, observers
4. Use Memory Graph Debugger to find the retainer

## Documentation Scope

This page documents the `axiom-memory-debugging` skill—systematic leak diagnosis workflows Claude uses when helping you debug memory issues. The skill contains complete Instruments setup, pattern recognition, heap analysis techniques, and production crisis handling.

**For quick scanning:** Use [/axiom:audit-memory](/commands/debugging/audit-memory) to scan your codebase for the 6 most common leak patterns automatically.

## Related

- [/axiom:audit-memory](/commands/debugging/audit-memory) — Quick automated scan for leak patterns in code
- [memory-auditor](/agents/memory-auditor) — Autonomous agent for codebase-wide leak detection
- [performance-profiling](/skills/debugging/performance-profiling) — Broader profiling including CPU and energy
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Actor patterns that prevent some leak types

## Resources

**WWDC**: 2021-10180, 2022-10106, 2024-10173

**Docs**: /instruments, /xcode/debugging-and-testing
