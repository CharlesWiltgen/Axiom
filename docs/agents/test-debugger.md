# test-debugger

Closed-loop test debugging — automatically analyzes test failures, suggests fixes, and re-runs tests until passing. Combines test-runner with intelligent failure analysis.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My LoginTests are failing, help me fix them"
- "Debug why testCheckout keeps timing out"
- "Fix my flaky UI tests"

**Explicit command:**
```bash
/axiom:run-tests
```

## What It Does

1. **Run failing tests** — Executes xcodebuild test for the specified target
2. **Analyze failures** — Parses .xcresult bundles for error details
3. **Suggest fixes** — Identifies root cause using screenshots, logs, and patterns
4. **Apply fixes** — Edits test code to resolve issues
5. **Re-run tests** — Verifies fixes pass, repeats if needed

## Model & Tools

- **Model**: sonnet
- **Tools**: Bash, Read, Grep, Glob, Edit
- **Color**: magenta

## Related

- **swift-testing** — Modern Swift Testing framework patterns
- **ui-testing** — XCUITest patterns and condition-based waiting
- **testing-async** — Async test patterns with confirmation
