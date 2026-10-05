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
2. **Run tests** – Runs `xcodebuild test` through axbuild on the right simulator, keeping the full log and result bundle
3. **Parse results** – Combines the build log with structured test results and flags anything axbuild couldn't collect or left out of the summary
4. **Report failures** – Shows failure messages, file:line locations, and screenshots
5. **Export attachments** – Saves failure screenshots and logs, and keeps the result bundle for coverage and deeper inspection

axbuild saves the full report even when failure details don't fit in the chat, and the agent reads it before re-running anything. If the report can't tell how many tests failed, the agent says so instead of reporting zero. Where axbuild isn't available (Cursor, MCP, or Pi without it on PATH), the agent saves test output to a log file instead.

## Related

- [swift-testing](/skills/testing/swift-testing) – Modern Swift Testing framework patterns
- [ui-testing](/skills/ui-design/ui-testing) – XCUITest patterns and condition-based waiting
- [test-debugger](/agents/test-debugger) – Closed-loop debugging that fixes failing tests
- [Tools](/tools/) – Where axbuild is available and what its report contains
