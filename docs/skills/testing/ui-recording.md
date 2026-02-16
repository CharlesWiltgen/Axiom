---
name: ui-recording
description: Xcode 26 Recording UI Automation -- record, replay, and review UI tests
---

# Recording UI Automation

Guide to Xcode 26's Recording UI Automation feature, which lets you create UI tests by interacting with your app in the Simulator. Based on WWDC 2025-344.

## When to Use

Use this skill when:
- Setting up UI test recording in Xcode 26
- Enhancing recorded test code for stability and CI
- Configuring test plans for multi-configuration replay
- Reviewing test results with video recordings and screenshots
- Converting fragile recorded queries into stable ones

## Example Prompts

- "How do I record a UI test in Xcode 26?"
- "My recorded test breaks when I change languages."
- "How do I run the same UI test in English and Spanish?"
- "How do I review UI test failures with video?"
- "The recorded code is too fragile for CI."

## What This Skill Provides

### Three-Phase Workflow

1. **Record** -- Interact with your app in the Simulator while Xcode generates Swift test code for taps, text input, swipes, gestures, and hardware button presses.

2. **Replay** -- Run the same tests across devices, languages, and configurations using test plans. Supports light/dark mode, multiple locales, and timeout enforcement.

3. **Review** -- Watch video recordings of each test in the test report, see screenshots at failure points, and analyze the action timeline.

### Enhancing Recorded Code

Recorded code is a starting point, not production-ready. The skill covers four essential enhancements:

- Replace localized labels with `accessibilityIdentifier` (survives localization)
- Add `waitForExistence` before interactions (prevents race conditions)
- Add assertions to verify outcomes (catches silent failures)
- Simplify overly specific queries (reduces brittleness)

### Test Plan Configuration

How to create test plans that run the same test suite across multiple configurations -- language, region, dark/light mode, and device type -- with a single `xcodebuild test` invocation.

### Common Templates

Ready-to-use patterns for login flows, navigation flows, and form validation that incorporate all stability enhancements.

## Related

- [xctest-automation](/skills/testing/xctest-automation) -- Comprehensive XCUITest patterns for element queries, waiting strategies, and CI/CD integration
- [swift-testing](/skills/testing/swift-testing) -- Swift Testing framework for unit tests (use XCUITest for UI tests)

## Resources

**WWDC**: 2025-344, 2024-10206, 2019-413

**Docs**: /xcode/testing/recording-ui-tests, /xctest/xcuiapplication
