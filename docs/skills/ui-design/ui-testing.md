# UI Testing

Reliable UI testing with condition-based waiting patterns and new Recording UI Automation features from Xcode 26.

**When to use**: Writing UI tests, recording interactions, tests have race conditions or timing dependencies, flaky tests

## Key Features

- **Recording UI Automation** – Record interactions as Swift code, replay across configurations, review video recordings
  - Three phases: Record → Replay → Review
  - Replay configurations (devices, languages, regions, orientations, accessibility)
  - Video review with scrubbing, overlays, filters
- **Condition-based waiting** – Eliminates flaky tests from sleep() timeouts
  - waitForExistence patterns
  - NSPredicate expectations
  - Custom condition polling
- Accessibility-first testing patterns
- SwiftUI and UIKit testing strategies
- Test plans and configurations
- Real-world impact: 15 min → 5 min test suite, 20% flaky → 2%

**Requirements**: Xcode 26+ for Recording UI Automation, original patterns work with earlier versions

## WWDC References

- [Recording UI Automation – Session 344](https://developer.apple.com/videos/play/wwdc2025/344/)

**Philosophy**: Wait for conditions, not arbitrary timeouts. Flaky tests come from guessing how long operations take.
