---
name: ui-recording
description: Xcode 26 Recording UI Automation — record, replay, and review UI tests
---

# Recording UI Automation

Guide to Recording UI Automation in Xcode 26 and later, which creates UI tests as you interact with your app in the Simulator. Based on WWDC 2025-344.

## When to Use

Use this skill when:
- Setting up UI test recording in Xcode 26 or later
- Making recorded test code stable enough for CI
- Configuring test plans to replay tests across languages and regions
- Reviewing test results with video recordings and screenshots
- Converting fragile recorded queries into stable ones
- Fixing recorded tests that pass locally but fail in CI

## Example Prompts

- "How do I record a UI test in Xcode 26?"
- "My recorded test breaks when I change languages."
- "How do I run the same UI test in English and Spanish?"
- "How do I run my UI tests in Dark Mode?"
- "How do I review UI test failures with video?"
- "The recorded code is too fragile for CI."

## What This Skill Provides

### Three-Phase Workflow

1. **Record** – Interact with your app in the Simulator while Xcode generates Swift test code for taps, text input, swipes and scrolling, gestures, and hardware button presses.

2. **Replay** – Run the same tests across devices, languages, and regions with test plans, which can also enforce timeouts. Appearance isn't a test-plan option; set Dark Mode on the simulator with `xcrun simctl ui`.

3. **Review** – Watch the video of each failing run in the test report (passing runs keep theirs only when you change the attachment retention setting), see screenshots at failure points, and analyze the action timeline.

### Enhancing Recorded Code

Recorded code is a starting point, not production code. The skill covers four essential enhancements:

- Replace localized labels with `accessibilityIdentifier`, which survives localization
- Add `waitForExistence` before interactions to prevent race conditions
- Add assertions that verify outcomes, so failures can't pass silently
- Shorten overly specific queries to reduce brittleness

### Test Plan Configuration

How to build test plans that run one suite across languages and regions, with timeout enforcement, from Xcode or a single `xcodebuild test -testPlan` invocation.

### Common Templates

Ready-to-use patterns for login flows, navigation flows, and form validation that include every stability enhancement.

### Troubleshooting and Anti-Patterns

Fixes for recordings that won't start, recorded code that doesn't work, and tests that pass locally but fail in CI, plus three anti-patterns: raw recorded code in CI, hardcoded coordinates, and skipped assertions.

## Documentation Scope

This page documents the `ui-recording` skill (in the `axiom-testing` suite).

## Related

- [xctest-automation](/skills/testing/xctest-automation) – XCUITest patterns for element queries, waiting strategies, and CI/CD integration
- [ui-testing](/skills/ui-design/ui-testing) – condition-based waiting, accessibility-first testing, and network conditioning for UI tests
- [swift-testing](/skills/testing/swift-testing) – the Swift Testing framework for unit tests, and for UI tests from Xcode 27.3

## Resources

**WWDC**: 2025-344, 2023-10175, 2019-413

**Docs**: /xcuiautomation/recording-ui-automation-for-testing
