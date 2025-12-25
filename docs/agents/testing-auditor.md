# testing-auditor

Audits test quality, identifies flaky patterns, and prepares for Swift Testing migration.

## When to Use

- Auditing test suite for quality issues
- Finding flaky test patterns
- Speeding up test execution
- Preparing for Swift Testing migration
- Checking tests for Swift 6 concurrency issues

## What It Detects

- **sleep() calls** — Timing-based tests that cause flakiness
- **Shared mutable state** — Test isolation violations
- **Missing assertions** — Tests that don't verify behavior
- **XCTest patterns** — Migration opportunities to Swift Testing
- **Swift 6 concurrency issues** — Unsafe actor usage in tests

## Example Triggers

- "Can you audit my tests for issues?"
- "Why are my tests flaky?"
- "How can I make my tests faster?"
- "Should I migrate to Swift Testing?"
- "Check my tests for Swift 6 issues"

## Related

- **swift-testing** — Swift Testing framework patterns
- **ui-testing** — UI test patterns and Recording UI Automation
- **ios-testing** — Testing router skill
