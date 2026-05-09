---
name: audit-testing
description: Scan test suites for flaky patterns, slow tests, Swift Testing migration opportunities, quality issues
---

# audit-testing

Scan test code for patterns that cause flakes, slow CI, or weak coverage — and surface migration opportunities from XCTest to Swift Testing.

## What This Command Does

Launches the **testing-auditor** agent to find tests that pass locally but fail in CI, tests that take too long, and tests that pass without actually verifying anything meaningful.

## What It Checks

1. **Flaky patterns** — `sleep()` calls, time-based waits, shared mutable state across tests, ordering dependencies
2. **Slow tests** — synchronous network calls, real database access where mocks would suffice, oversized fixtures
3. **Swift Testing migration** — `XCTestCase` patterns that would simplify under `@Test` / `@Suite` / `#expect`
4. **Quality issues** — tests with no assertions, assertions on tautologies, snapshot tests that auto-record
5. **Concurrency issues** — `@MainActor` violations, missing `await`s on async assertions, unchecked Sendable

## Related Agent

- [testing-auditor](/agents/testing-auditor) — The agent that powers this command
