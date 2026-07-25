---
name: audit-test-failures
description: Diagnose why a specific test fails or flakes — missing await confirmation, @MainActor gaps, shared suite state, ordering dependencies
---

# audit-test-failures

Diagnose the root cause of a test that fails intermittently, passes locally but fails in CI, or only fails when run alongside other tests.

## What This Command Does

Launches the **test-failure-analyzer** agent, which scans test files for the concurrency and isolation patterns that produce non-deterministic failures, and reports each with a root cause rather than just a location.

This is the *diagnostic* counterpart to [audit-testing](/commands/testing/audit-testing). Reach for `testing` to survey overall suite quality; reach for `test-failures` when a specific test is already misbehaving and you need to know why.

## What It Checks

1. **Missing `await confirmation`** – async work with no wait, so the test finishes before the callback fires
2. **Missing `@MainActor`** – UI tests touching main-actor-isolated state without isolation
3. **Shared mutable state in a `@Suite`** – parallel tests mutating the same collection
4. **`Task.sleep` standing in for a wait** – timing assumptions that hold on a fast machine and break in CI
5. **Missing `.serialized` trait** – tests that cannot safely run in parallel but are not marked
6. **Test-generated crashes** – force unwraps and precondition failures inside test code
7. **Date comparisons in `#expect`** – assertions that depend on wall-clock timing

## Usage

```
/axiom:audit test-failures
```

## Related

- [test-failure-analyzer](/agents/test-failure-analyzer) – The agent that powers this command
- [audit-testing](/commands/testing/audit-testing) – Suite-wide quality survey rather than one failing test
- [test-debugger](/agents/test-debugger) – Closed-loop debugging that re-runs tests until they pass, once you know the cause
- [run-tests](/commands/testing/run-tests) – Run tests and parse the `.xcresult` for failures
