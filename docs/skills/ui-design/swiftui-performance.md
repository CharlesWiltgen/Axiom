---
name: swiftui-performance
description: SwiftUI performance optimization with the new SwiftUI Instrument in Instruments 26
skill_type: discipline
version: 1.1.0
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+
---

# SwiftUI Performance Optimization

Performance optimization for SwiftUI using the new SwiftUI Instrument in Instruments 26. Covers long view body updates, unnecessary view updates, and the Cause & Effect Graph.

## When to Use This Skill

Use this skill when you're:
- App feels less responsive (hitches, hangs, delayed scrolling)
- Animations pause or jump during execution
- Scrolling performance is poor
- Profiling reveals SwiftUI is the bottleneck
- Views are updating more frequently than expected
- Need to understand cause-and-effect of SwiftUI updates

**Core principle:** Ensure your view bodies update quickly and only when needed.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My app has janky scrolling and animations are stuttering. How do I figure out if SwiftUI is the cause?"
- "I see orange/red bars in SwiftUI Instrument showing long updates. How do I know what's causing them?"
- "Some views are updating way too often even though their data hasn't changed."
- "I have large data structures and complex view hierarchies. How do I optimize them?"
- "We have a performance deadline and I need to understand what's slow in SwiftUI."

## What's Covered

### SwiftUI Instrument (Instruments 26)
- Four track lanes: Update Groups, Long View Body Updates, Long Representable Updates, Other Long Updates
- Color-coding: Red (investigate first) → Orange → Gray
- Cause & Effect Graph for data flow visualization
- Integration with Time Profiler

### Problem 1: Long View Body Updates
- Identifying with Long View Body Updates lane
- Time Profiler integration for CPU analysis
- Common expensive operations: formatters, calculations, I/O, image processing
- Caching patterns for expensive work

### Problem 2: Unnecessary View Updates
- Counting updates (more than expected?)
- Cause & Effect Graph to trace data flow
- Whole array/collection dependencies
- Granular view model patterns
- @Observable dependency tracking

### iOS 26 Framework Improvements
- 6x faster list loading (macOS, 100k+ items)
- 16x faster list updates
- Reduced dropped frames during scrolling
- Nested ScrollView lazy loading optimization

### Production Crisis Decision-Making
- When to profile vs when to guess
- 30-minute diagnostic protocol
- Time cost comparison (guess vs diagnose)
- Verification before shipping

## Key Pattern

### The Two Performance Problems

```
Problem 1: Long View Body Updates
├─ One view body too slow → misses frame deadline
└─ Solution: Move expensive work to model layer

Problem 2: Unnecessary View Updates
├─ Many fast updates add up → misses deadline
└─ Solution: Granular dependencies, per-item view models
```

### Fixing Long View Bodies

```swift
// ❌ WRONG — Creating formatters in view body
var distance: String {
    let formatter = MeasurementFormatter() // Expensive!
    return formatter.string(from: measurement)
}

// ✅ CORRECT — Cache formatter, pre-calculate
@Observable
class LocationFinder {
    private let formatter = MeasurementFormatter() // Created once
    private var distanceCache: [ID: String] = [:]  // Pre-calculated

    func distanceString(for id: ID) -> String {
        distanceCache[id] ?? "Unknown"  // Fast lookup
    }
}
```

### Fixing Unnecessary Updates

```swift
// ❌ WRONG — All views depend on whole array
func isFavorite(_ landmark: Landmark) -> Bool {
    favoritesCollection.landmarks.contains(landmark) // Array dependency
}

// ✅ CORRECT — Each view depends only on its view model
@Observable
class LandmarkViewModel {
    var isFavorite: Bool = false
}
// Tapping button updates only that view model → only one view body runs
```

## Documentation Scope

This page documents the `axiom-swiftui-performance` skill—SwiftUI performance optimization patterns Claude uses when you're diagnosing hitches, long view body updates, or unnecessary re-renders.

**For view update debugging:** Use [swiftui-debugging](/skills/ui-design/swiftui-debugging) when views aren't updating at all (not slow, just not updating).

**For general profiling:** Use [performance-profiling](/skills/debugging/performance-profiling) for non-SwiftUI performance issues (memory, CPU, network).

## Related

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — View update failures, preview crashes, layout issues
- [performance-profiling](/skills/debugging/performance-profiling) — Time Profiler, Allocations, general profiling workflows
- [swiftui-26-ref](/reference/swiftui-26-ref) — All iOS 26 SwiftUI features including performance improvements

## Resources

**WWDC**: 2025-306 (Optimize SwiftUI performance with Instruments)

**Docs**: /xcode/understanding-hitches-in-your-app, /xcode/analyzing-hangs-in-your-app
