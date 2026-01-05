---
name: energy-ref
description: Complete energy optimization API reference with Power Profiler, timers, network, and location
version: 1.0.0
---

# Energy Optimization Reference

Complete API reference for iOS energy efficiency. Covers Power Profiler, timer efficiency, network efficiency, location efficiency, background execution, and display/GPU optimization with WWDC code examples.

## When to Use This Reference

Use this reference when you need:
- Power Profiler workflow and interpretation
- Timer API patterns for energy efficiency
- Network coalescing and batching APIs
- Location accuracy and monitoring options
- Background execution best practices
- Display and GPU energy optimization

**For discipline patterns:** See [energy](/skills/debugging/energy) for decision trees and workflows.

**For symptom-based diagnosis:** See [energy-diag](/diagnostic/energy-diag) for troubleshooting.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I configure DispatchSource timers with proper leeway?"
- "What's the discretionary flag for URLSession and when should I use it?"
- "How do I set up significant-change location monitoring?"
- "What are the background task duration limits?"
- "How do I use MetricKit to monitor energy in production?"
- "What's the difference between continuous and significant-change location?"

## What's Covered

### Power Profiler Workflow
- Recording traces in Instruments 26
- Interpreting the 5 power impact lanes
- On-device profiling (iOS 26+)
- Comparing implementations

### Timer Efficiency
- DispatchSource vs NSTimer
- Leeway configuration for coalescing
- Timer invalidation patterns
- Common timer leaks

### Network Efficiency
- Discretionary transfers
- Request batching
- Connection coalescing
- Background URLSession

### Location Efficiency
- Accuracy levels and energy impact
- Continuous vs significant-change monitoring
- Deferred location updates
- Region monitoring
- Background location modes

### Background Execution
- BGTaskScheduler patterns
- Processing task duration limits
- Refresh task timing
- App refresh budgets

### Display/GPU Optimization
- Dark mode battery benefits on OLED
- Animation energy impact
- Blur effect costs
- EDR and brightness

### MetricKit Integration
- MXDiagnosticPayload for energy diagnostics
- Production monitoring
- Hang and crash correlation

## Key Pattern

### Timer with Proper Leeway

```swift
// ✅ GOOD — Leeway allows system to coalesce
let source = DispatchSource.makeTimerSource(queue: .main)
source.schedule(
    deadline: .now(),
    repeating: .seconds(30),
    leeway: .seconds(5)  // 5 seconds flexibility
)
source.setEventHandler { [weak self] in
    self?.update()
}
source.resume()

// ❌ BAD — Zero leeway prevents coalescing
source.schedule(deadline: .now(), repeating: .seconds(30), leeway: .never)
```

### Significant-Change Location

```swift
// ✅ GOOD — Low power, event-driven
locationManager.startMonitoringSignificantLocationChanges()
// Updates only on significant movement (500m+ or cell tower change)

// ❌ BAD — Continuous GPS drain
locationManager.desiredAccuracy = kCLLocationAccuracyBest
locationManager.startUpdatingLocation()
```

### Discretionary Network Transfer

```swift
// ✅ GOOD — System schedules for optimal energy
let config = URLSessionConfiguration.background(withIdentifier: "sync")
config.isDiscretionary = true  // Defer until optimal conditions
config.allowsCellularAccess = false
```

## Documentation Scope

This page documents the `axiom-energy-ref` reference skill—complete API coverage Claude uses when you need specific energy optimization APIs and patterns.

**For discipline patterns:** See [energy](/skills/debugging/energy) for Power Profiler workflows and decision trees.

**For symptom-based diagnosis:** See [energy-diag](/diagnostic/energy-diag) for troubleshooting.

## Related

- [energy](/skills/debugging/energy) — Discipline skill with Power Profiler workflows
- [energy-diag](/diagnostic/energy-diag) — Symptom-based troubleshooting

## Resources

**WWDC**: 2025-226, 2025-227, 2022-10083

**Docs**: /instruments, /xcode/improving-your-app-s-performance, /backgroundtasks
