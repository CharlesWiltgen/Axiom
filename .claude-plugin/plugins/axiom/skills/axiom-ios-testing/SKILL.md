---
name: axiom-ios-testing
description: Use when writing ANY test, debugging flaky tests, making tests faster, or asking about Swift Testing vs XCTest. Covers unit tests, UI tests, fast tests without simulator, async testing, test architecture.
user-invocable: false
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

**Invoke**: Read the `axiom-swift-testing` skill

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

**Invoke**: Read the `axiom-ui-testing` skill

---

### 3. Flaky Tests / Race Conditions → **test-failure-analyzer** (Agent)

**Triggers**:
- Tests fail randomly in CI
- Tests pass locally but fail in CI
- Flaky tests (pass sometimes, fail sometimes)
- Race conditions in Swift Testing
- Missing `await confirmation` for async callbacks
- Missing `@MainActor` on UI tests
- Shared mutable state in `@Suite`
- Tests pass individually, fail when run together

**Why test-failure-analyzer**: Specialized agent that scans for patterns causing intermittent failures in Swift Testing.

**Invoke**: Launch `test-failure-analyzer` agent

---

### 4. Async Testing Patterns → **testing-async**

**Triggers**:
- Testing async/await functions
- `confirmation` for callbacks (Swift Testing)
- `expectedCount` for multiple callbacks
- Testing MainActor code with `@MainActor @Test`
- Migrating XCTestExpectation → confirmation
- Parallel test execution concerns
- Test timeout configuration

**Why testing-async**: Dedicated patterns for async code in Swift Testing framework.

**Invoke**: Read the `axiom-testing-async` skill

---

### 5. Test Crashes / Environment Issues → **xcode-debugging**

**Triggers**:
- Tests crash before assertions run
- Simulator won't boot for tests
- Tests hang indefinitely
- "Unable to boot simulator" errors
- Clean test run differs from incremental

**Why xcode-debugging**: Test failures from environment issues, not test logic.

**Invoke**: Read the `axiom-xcode-debugging` skill

---

### 6. Running XCUITests from Command Line → **test-runner** (Agent)

**Triggers**:
- Run tests with xcodebuild
- Parse xcresult bundles
- Export failure screenshots/videos
- Code coverage reports
- CI/CD test execution

**Why test-runner**: Specialized agent for command-line test execution with xcresulttool parsing.

**Invoke**: Launch `test-runner` agent

---

### 7. Closed-Loop Test Debugging → **test-debugger** (Agent)

**Triggers**:
- Fix failing tests automatically
- Debug persistent test failures
- Run → analyze → fix → verify cycle
- Need to iterate until tests pass
- Analyze failure screenshots

**Why test-debugger**: Automated cycle of running tests, analyzing failures, suggesting fixes, and re-running.

**Invoke**: Launch `test-debugger` agent

---

### 8. Recording UI Automation (Xcode 26) → **ui-recording**

**Triggers**:
- Record user interactions in Xcode
- Test plans for multi-config replay
- Video review of test runs
- Xcode 26 recording workflow
- Enhancing recorded test code

**Why ui-recording**: Focused guide for Xcode 26's Record/Replay/Review workflow.

**Invoke**: Read the `axiom-ui-recording` skill

---

### 9. UI Automation Without XCUITest → **simulator-tester** + **axe-ref**

**Triggers**:
- Automate app without test target
- AXe CLI usage (tap, swipe, type)
- describe-ui for accessibility tree
- Quick automation outside XCUITest
- Scripted simulator interactions

**Why simulator-tester + axe-ref**: AXe provides accessibility-based UI automation when XCUITest isn't available.

**Invoke**: Launch `simulator-tester` agent (uses axiom-axe-ref)

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
  ├─ Testing async/await code patterns?
  │  ├─ confirmation, expectedCount, @MainActor @Test? → testing-async
  │  └─ General async questions? → testing-async
  │
  ├─ Tests fail randomly / flaky in CI / race conditions?
  │  ├─ Check: Uses XCUIApplication/XCUIElement? → ui-testing
  │  └─ Check: Uses @Test/#expect? → test-failure-analyzer (Agent)
  │
  ├─ Tests crash or environment seems wrong?
  │  └─ YES → xcode-debugging (via ios-build)
  │
  ├─ Tests are slow, want to speed them up?
  │  └─ YES → swift-testing (Fast Tests section)
  │
  ├─ Run tests from command line / CI / parse results?
  │  └─ YES → test-runner (Agent)
  │
  ├─ Fix failing tests automatically / closed-loop debugging?
  │  └─ YES → test-debugger (Agent)
  │
  ├─ Record UI interactions in Xcode 26?
  │  └─ YES → ui-recording
  │
  └─ Automate without XCUITest / use AXe CLI?
     └─ YES → simulator-tester + axe-ref
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
→ Invoke: axiom-swift-testing

User: "My UI tests are flaky in CI"
→ Check codebase: XCUIApplication/XCUIElement patterns? → ui-testing
→ Check codebase: @Test/#expect patterns? → test-failure-analyzer

User: "Tests fail randomly, pass sometimes fail sometimes"
→ Invoke: test-failure-analyzer (Agent)

User: "Tests pass locally but fail in CI"
→ Invoke: test-failure-analyzer (Agent)

User: "How do I test async code without flakiness?"
→ Invoke: testing-async

User: "How do I test callback-based APIs with Swift Testing?"
→ Invoke: testing-async

User: "What's the Swift Testing equivalent of XCTestExpectation?"
→ Invoke: testing-async

User: "How do I use confirmation with expectedCount?"
→ Invoke: testing-async

User: "I want my tests to run faster"
→ Invoke: axiom-swift-testing (Fast Tests section)

User: "Should I use Swift Testing or XCTest?"
→ Invoke: axiom-swift-testing (Migration section) + this decision tree

User: "Tests crash before any assertions"
→ Invoke: axiom-xcode-debugging

User: "Run my tests and show me what failed"
→ Invoke: test-runner (Agent)

User: "Help me fix these failing tests"
→ Invoke: test-debugger (Agent)

User: "Parse the xcresult from my last test run"
→ Invoke: test-runner (Agent)

User: "Export failure screenshots from my tests"
→ Invoke: test-runner (Agent)

User: "How do I record UI automation in Xcode 26?"
→ Invoke: axiom-ui-recording

User: "How do I use test plans for multi-language testing?"
→ Invoke: axiom-ui-recording

User: "Can I automate my app without writing XCUITests?"
→ Invoke: simulator-tester (Agent) + axiom-axe-ref

User: "How do I tap a button using AXe?"
→ Invoke: axiom-axe-ref (via simulator-tester)
