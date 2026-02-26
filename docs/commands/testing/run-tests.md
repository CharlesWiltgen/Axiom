# /axiom:run-tests

Run XCUITests and parse results using the test-runner or test-debugger agent.

## Command

```bash
/axiom:run-tests [scheme] [target]
```

## What It Does

1. **Discover schemes** — Finds available test targets in the project
2. **Run tests** — Executes xcodebuild test with proper configuration
3. **Parse results** — Extracts structured data from .xcresult bundles
4. **Report failures** — Shows failure messages with file:line locations
5. **Export attachments** — Saves failure screenshots and logs

## When to Use

- You want to run UI tests and see what failed
- You need to run a specific test scheme or class
- You want to export failure screenshots from a test run

## Related

- [test-runner](/agents/test-runner) — The agent that runs and reports test results
- [test-debugger](/agents/test-debugger) — Closed-loop debugging that fixes failing tests
- [swift-testing](/skills/testing/swift-testing) — Modern Swift Testing framework patterns
