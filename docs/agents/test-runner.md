# test-runner

Runs XCUITests, parses .xcresult bundles using xcresulttool, and provides structured test results with failure analysis and attachment export.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Run my UI tests and show me what failed"
- "Run tests for the LoginTests scheme"
- "Export the failure screenshots from my last test run"
- "What tests failed and why?"

**Explicit command:**
```bash
/axiom:run-tests
```

## What It Does

1. **Discover test schemes** — Finds available test targets in the project
2. **Run tests** — Executes xcodebuild test with proper configuration
3. **Parse results** — Extracts structured data from .xcresult bundles
4. **Report failures** — Shows failure messages, file:line locations, and screenshots
5. **Export attachments** — Saves failure screenshots and logs for review

## Related

- **swift-testing** — Modern Swift Testing framework patterns
- **ui-testing** — XCUITest patterns and condition-based waiting
- **test-debugger** agent — Closed-loop debugging that fixes failing tests
