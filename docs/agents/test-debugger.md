# test-debugger

Closed-loop test debugging — automatically analyzes test failures, suggests fixes, and re-runs tests until passing. Combines test-runner with intelligent failure analysis.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My LoginTests are failing, help me fix them"
- "Debug why testCheckout keeps timing out"
- "Fix my flaky UI tests"

**Explicit command:** Use natural language ("fix my failing tests") to trigger test-debugger. The `/axiom:run-tests` command invokes test-runner for execution only — test-debugger adds the fix-and-retry loop.

## What It Does

1. **Run failing tests** — Executes xcodebuild test for the specified target
2. **Analyze failures** — Parses .xcresult bundles for error details
3. **Suggest fixes** — Identifies root cause using screenshots, logs, and patterns
4. **Apply fixes** — Edits test code to resolve issues
5. **Re-run tests** — Verifies fixes pass, repeats if needed

## Related

- **swift-testing** — Modern Swift Testing framework patterns
- **ui-testing** — XCUITest patterns and condition-based waiting
- **testing-async** — Async test patterns with confirmation
