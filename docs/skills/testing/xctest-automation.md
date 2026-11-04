---
name: xctest-automation
description: Reliable XCUITest patterns — element queries, waiting strategies, test plans, and CI/CD execution
---

# XCUITest Automation

Guide to writing reliable, maintainable UI tests with XCUITest: element identification, condition-based waiting, test isolation, and CI/CD integration.

## When to Use

Use this skill when:
- Writing XCUITests for an iOS app
- Debugging flaky UI tests
- Running UI tests in CI/CD pipelines
- Handling alerts, keyboards, and scrolling in tests
- Running the same tests across languages and regions with test plans
- Configuring parallel test execution or retries

## Example Prompts

- "How do I write a reliable XCUITest?"
- "My UI tests are flaky. They pass locally but fail in CI."
- "How do I wait for an element without using sleep?"
- "How do I handle permission alerts in UI tests?"
- "How do I run UI tests in parallel on CI?"

## What This Skill Provides

### Three Pillars of Reliable UI Tests

1. **Stable element identification** – Use `accessibilityIdentifier` instead of localized labels, with patterns for SwiftUI and UIKit.

2. **Condition-based waiting** – Never use `sleep()`. Reusable wait functions built on `XCTNSPredicateExpectation` wait for an element to appear, disappear, or become hittable.

3. **Clean test isolation** – No shared state between tests. Each test sets up its own preconditions and resets app state through launch arguments.

### Common Interactions

Patterns for text input (including clearing a field), scrolling to elements, handling system and app alerts, and dismissing the keyboard.

### Test Structure

A setup and teardown template that captures a screenshot on failure, launches the app from a `@MainActor` test method for Swift 6, and passes launch arguments that reset state and disable animations.

### Test Plans

Multi-configuration test plans for languages and regions. Appearance isn't a test-plan option, so the skill sets Dark Mode on the simulator instead.

### CI/CD Integration

`xcodebuild` commands for parallel test execution, retry on failure, and code coverage export.

### Debugging Failed Tests

Manual screenshots, video capture of failing runs, and printing the element hierarchy.

### Anti-Patterns

Four common mistakes with corrections:
- Hardcoded `sleep()` delays
- Index-based element queries
- Shared state between tests
- Testing implementation details instead of user-visible behavior

## Documentation Scope

This page documents the `xctest-automation` skill (in the `axiom-testing` suite).

## Related

- [ui-recording](/skills/testing/ui-recording) – record UI tests in Xcode 26 instead of writing them from scratch
- [ui-testing](/skills/ui-design/ui-testing) – accessibility-first testing, multi-device configurations, and network conditioning
- [swift-testing](/skills/testing/swift-testing) – Swift Testing for unit tests, and for UI tests from Xcode 27.3

## Resources

**WWDC**: 2025-344, 2023-10175, 2019-413
