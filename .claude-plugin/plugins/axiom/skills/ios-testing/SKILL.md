---
name: ios-testing
description: Use when writing ANY test, debugging flaky tests, making tests faster, or asking about Swift Testing vs XCTest. Covers unit tests, UI tests, fast tests without simulator, async testing, test architecture.
---

# iOS Testing Router

**You MUST use this skill for ANY testing-related question, including writing tests, debugging test failures, making tests faster, or choosing between testing approaches.**

## When to Use

Use this router when you encounter:
- Writing new unit tests or UI tests
- Swift Testing framework (@Test, #expect, @Suite)
- XCTest or XCUITest questions
- Making tests run faster (without simulator)
- Flaky tests (pass sometimes, fail sometimes)
- Testing async code reliably
- Migrating from XCTest to Swift Testing
- Test architecture decisions
- Condition-based waiting patterns

## Routing Logic

This router invokes specialized skills based on the specific testing need:

### 1. Unit Tests / Fast Tests → **swift-testing**

**Triggers**:
- Writing new unit tests
- Swift Testing framework (`@Test`, `#expect`, `#require`, `@Suite`)
- Making tests run without simulator
- Testing async code reliably
- `withMainSerialExecutor`, `TestClock`
- Migrating from XCTest
- Parameterized tests
- Tags and traits
- Host Application: None configuration
- Swift Package tests (`swift test`)

**Why swift-testing**: Modern Swift Testing framework with parallel execution, better async support, and the ability to run without launching simulator.

**Invoke**: Read the `swift-testing` skill

---

### 2. UI Tests / XCUITest → **ui-testing**

**Triggers**:
- Recording UI Automation (Xcode 26)
- XCUIApplication, XCUIElement
- Flaky UI tests
- Tests pass locally, fail in CI
- `sleep()` or arbitrary timeouts
- Condition-based waiting
- Cross-device testing
- Accessibility-first testing

**Why ui-testing**: XCUITest requires simulator and has unique patterns for reliability.

**Invoke**: Read the `ui-testing` skill

---

### 3. Test Crashes / Environment Issues → **xcode-debugging**

**Triggers**:
- Tests crash before assertions run
- Simulator won't boot for tests
- Tests hang indefinitely
- "Unable to boot simulator" errors
- Clean test run differs from incremental

**Why xcode-debugging**: Test failures from environment issues, not test logic.

**Invoke**: Read the `xcode-debugging` skill

---

## Decision Tree

```
User has testing question
  │
  ├─ Writing unit tests or asking about Swift Testing?
  │  └─ YES → swift-testing
  │
  ├─ Writing UI tests or debugging XCUITest?
  │  └─ YES → ui-testing
  │
  ├─ Tests crash or environment seems wrong?
  │  └─ YES → xcode-debugging (via ios-build)
  │
  ├─ Tests are slow, want to speed them up?
  │  └─ YES → swift-testing (Fast Tests section)
  │
  └─ Testing async code, seeing flaky failures?
     └─ YES → swift-testing (Async Testing section)
```

## Swift Testing vs XCTest Quick Guide

| Need | Use |
|------|-----|
| Unit tests (logic, models) | Swift Testing |
| UI tests (tap, swipe, assert screens) | XCUITest (XCTest) |
| Tests without simulator | Swift Testing + Package/Framework |
| Parameterized tests | Swift Testing |
| Performance measurements | XCTest (XCTMetric) |
| Objective-C tests | XCTest |

## Anti-Rationalization

**Do NOT skip this router for:**
- "Simple" test questions (proper patterns prevent future pain)
- "I know XCTest" (Swift Testing is significantly better for unit tests)
- "Tests are slow but it's fine" (fast tests enable TDD and better feedback)

**Fast, reliable tests are foundational to code quality.**

## Example Invocations

User: "How do I write a unit test in Swift?"
→ Invoke: swift-testing

User: "My UI tests are flaky in CI"
→ Invoke: ui-testing

User: "How do I test async code without flakiness?"
→ Invoke: swift-testing (Async Testing section)

User: "I want my tests to run faster"
→ Invoke: swift-testing (Fast Tests section)

User: "Should I use Swift Testing or XCTest?"
→ Invoke: swift-testing (Migration section) + this decision tree

User: "Tests crash before any assertions"
→ Invoke: xcode-debugging
