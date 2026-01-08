# test-failure-analyzer

Diagnoses WHY tests fail, especially intermittent/flaky failures in Swift Testing with focus on async patterns, race conditions, and CI-specific issues.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My tests fail randomly in CI"
- "This test passes locally but fails in CI"
- "I have a flaky test that fails 20% of the time"
- "My Swift Testing tests have race conditions"
- "Test passes individually, fails when run with others"

**Explicit command:**
```bash
/axiom:audit test-failures
```

## What It Checks

### Critical (Will Cause Intermittent Failures)
- **Missing `await confirmation`** — Async callback without proper waiting
- **Missing `@MainActor`** — Data races when accessing UI types in Swift 6

### High Priority (Parallel Execution Failures)
- **Shared mutable state** — `static var` in test suites causing race conditions
- **Order-dependent tests** — Tests that only pass in specific order

### Medium Priority (Timing Issues)
- **`Task.sleep` in assertions** — Arbitrary waits that fail in CI
- **Missing `.serialized` trait** — Tests with shared resources run in parallel

### Low Priority (Edge Cases)
- **Date comparisons** — Timezone/DST-dependent assertions

## Example Output

```markdown
# Test Failure Analysis Results

## Summary
- **CRITICAL Issues**: 2
- **HIGH Issues**: 1
- **Flakiness Risk Score**: HIGH

### CRITICAL: Missing `await confirmation`
- `Tests/NetworkTests.swift:45`
  ```swift
  @Test func fetchUser() async {
      var user: User?
      api.fetchUser { user = $0 }
      #expect(user != nil)  // FLAKY!
  }
  ```
  - **Root cause**: Test completes before async callback
  - **Fix**: Wrap in `await confirmation { ... }`

### HIGH: Shared Mutable State
- `Tests/CacheTests.swift:12` - `static var testCache`
  - **Root cause**: Parallel tests mutate same collection
  - **Fix**: Use instance property instead
```

## Verification

After fixes, verify stability:
```bash
# Run tests multiple times
swift test --parallel --num-workers 8

# Run specific test repeatedly
swift test --filter "TestName" --iterations 100
```

## Model & Tools

- **Model**: haiku (fast pattern scanning)
- **Tools**: Glob, Grep, Read
- **Color**: yellow

## Related

- [testing-auditor](/agents/testing-auditor) — Broader test quality audit
- [swift-testing](/skills/testing/swift-testing) — Swift Testing patterns and best practices
- [testing-async](/skills/testing/testing-async) — Async testing patterns
