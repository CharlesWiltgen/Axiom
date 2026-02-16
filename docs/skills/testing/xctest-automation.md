---
name: xctest-automation
description: Reliable XCUITest patterns -- element queries, waiting strategies, test plans, and CI/CD execution
---

# XCUITest Automation

Comprehensive guide to writing reliable, maintainable UI tests with XCUITest. Covers element identification, condition-based waiting, test isolation, and CI/CD integration.

## When to Use

Use this skill when:
- Writing XCUITests for an iOS app
- Debugging flaky UI tests
- Setting up UI tests in CI/CD pipelines
- Handling alerts, keyboards, scrolling in tests
- Configuring parallel test execution or retry strategies

## Example Prompts

- "How do I write a reliable XCUITest?"
- "My UI tests are flaky -- they pass locally but fail in CI."
- "How do I wait for an element without using sleep?"
- "How do I handle permission alerts in UI tests?"
- "How do I run UI tests in parallel on CI?"

## What This Skill Provides

### Three Pillars of Reliable UI Tests

1. **Stable element identification** -- Always use `accessibilityIdentifier` instead of localized labels. The skill provides SwiftUI and UIKit patterns.

2. **Condition-based waiting** -- Never use `sleep()`. The skill provides reusable wait functions for element appearance, disappearance, and hittability using `XCTNSPredicateExpectation`.

3. **Clean test isolation** -- No shared state between tests. Each test creates its own preconditions, with launch arguments for resetting state.

### Common Interactions

Patterns for text input (including clearing), scrolling to elements, handling system and app alerts, and dismissing keyboards.

### Test Structure

Setup/teardown template with automatic failure screenshots, animation disabling, and state reset via launch arguments.

### CI/CD Integration

`xcodebuild` commands for parallel test execution, retry on failure, and code coverage export.

### Anti-Patterns

Four common mistakes with corrections:
- Hardcoded `sleep()` delays
- Index-based element queries
- Shared state between tests
- Testing implementation details instead of user-visible behavior

## Related

- [ui-recording](/skills/testing/ui-recording) -- Record UI tests in Xcode 26 instead of writing them from scratch
- [swift-testing](/skills/testing/swift-testing) -- Swift Testing for unit tests (keep XCUITest for UI tests)

## Resources

**WWDC**: 2025-344, 2024-10206, 2023-10175, 2019-413

**Docs**: /xctest/xcuiapplication, /xctest/xcuielement, /xctest/xcuielementquery
