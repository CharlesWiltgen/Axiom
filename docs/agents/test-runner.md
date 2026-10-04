# test-runner

Runs selected tests with axbuild and analyzes retained logs and structured test results. It reports failure locations and evaluated values, then exports attachments or inspects coverage when needed.

## How to Use

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

1. **Discover test schemes** – Finds available test targets in the project
2. **Run tests** – Discovers the actual scheme/destination and captures xcodebuild test with axbuild
3. **Parse results** – Combines compiler logs and structured test evidence, checking collection issues and omissions
4. **Report failures** – Shows failure messages, file:line locations, and screenshots
5. **Export evidence** – Keeps result bundles for screenshots, coverage, console logs and deeper inspection

The full report retains omitted details; a null failed-test count means uncertainty. Read saved evidence before rebuilding. If the helper is unavailable, capture the necessary native run to a unique log and inspect it after completion.

## Related

- [swift-testing](/skills/testing/swift-testing) – Modern Swift Testing framework patterns
- [ui-testing](/skills/ui-design/ui-testing) – XCUITest patterns and condition-based waiting
- [test-debugger](/agents/test-debugger) – Closed-loop debugging that fixes failing tests
