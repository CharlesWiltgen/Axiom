# Tools

Axiom's native helpers capture build diagnostics, simulator logs, crash reports, Instruments traces, project structure and the live accessibility tree. Your assistant runs each helper from the installed plugin's `bin/` directory after checking that it works. Installing the plugin doesn't necessarily put the helpers on your `PATH`.

## Bundled tools

| Tool | What it does |
|------|--------------|
| **axbuild** | Run `xcodebuild`, `swift build` or `swift test` and get a short JSON summary of errors and failed tests, while the full log and report are saved |
| **xcproject** | Inspect Xcode project structure and read captured build settings without modifying the project |
| [**xclog**](/reference/xclog-ref) | Capture simulator & device console output (`print`, `os_log`, `Logger`) as structured JSON/JSONL |
| [**xcprof**](/reference/xcprof-ref) | Record and analyze Instruments traces — CPU bottlenecks, an honest per-family support matrix, and user-code attribution |
| [**xcsym**](/reference/xcsym-ref) | Symbolicate and triage crash reports (`.ips`, MetricKit, legacy `.crash`, `.xccrashpoint`) with automatic dSYM discovery |
| [**xcui**](/reference/xcui-ref) | Drive and assert on the simulator UI and accessibility tree — wait, assert, toggle a11y settings, handle system dialogs, check VoiceOver |

xclog, xcprof, xcsym and xcui emit **compact JSON by default** (token-lean for LLM consumers); pass `--human` for a prose view, or pipe to `jq .` for indented JSON.

## axbuild

Use axbuild when a build or test might produce more output than your assistant can show, or when you need failure locations and test values afterward. Put axbuild in front of the command you'd normally run, keeping your scheme, destination and flags. Before starting an Xcode build, check whether another `xcodebuild` is already running and find out why.

```sh
"<plugin-root>/bin/axbuild" --help
pgrep -lx xcodebuild; echo "pgrep exit=$?"
"<plugin-root>/bin/axbuild" xcodebuild -scheme App -destination 'platform=macOS' build
"<plugin-root>/bin/axbuild" swift test --package-path ./Package
```

By default axbuild prints compact JSON of at most 8,000 bytes; `--format json` indents it. Check `command` (did the build or test succeed?) and `collection` (did axbuild gather every detail?) separately, because a successful build can still have incomplete collection. `omissions` lists what the summary left out. The complete report is `artifacts.report` inside the `artifacts.run` directory, whose path axbuild prints when it starts. Commands that only print information, such as `xcodebuild -list` or `swift --version`, pass through unchanged.

The saved compiler log is the main source of errors; test results and Swift Testing events add to it. Keep the result bundle for attachments, coverage and deeper inspection. If axbuild can't tell exactly how many tests failed, the count is `null`, meaning unknown, not zero. Read an existing saved log or report before rebuilding.

### Availability

The Claude Code and Codex plugins include axbuild. In Pi, put it on your `PATH`. Cursor and MCP setups don't include it, so the assistant saves build output to a log file and reads that instead.

axbuild has been tested with Xcode 27.2 beta (27B5028f) and Swift 6.4 (6.4.0.34.1). With other toolchains, `swift test` runs without automatic Swift Testing event capture and axbuild relies on the log. Xcode 26 hasn't been tested. axbuild is supported on macOS 26 and newer, like the rest of Axiom.

### Known limitations

- If you cancel a build, scripts Xcode started separately can keep running. axbuild stops the processes it owns and reports `cleanup-incomplete` when it can't confirm the rest. Stop leftover jobs only after confirming they belong to that build.
- Progress text occasionally ends up inside an error's file name in the saved log. axbuild then can't identify the file, marks collection as partial and leaves the text as printed. Check the saved raw log.

Example prompt: "Run the tests and show me where the failing assertion is and what values it compared."

## How they fit in

Most tools have a slash command and, where it makes sense, an agent that drives it:

| Tool | Command | Agent |
|------|---------|-------|
| axbuild | [`/axiom:fix-build`](/commands/build/fix-build), [`/axiom:run-tests`](/commands/testing/run-tests) | [build-fixer](/agents/build-fixer), [test-runner](/agents/test-runner) |
| xclog | [`/axiom:console`](/commands/) | — |
| xcprof | [`/axiom:profile`](/commands/) | [performance-profiler](/agents/performance-profiler) |
| xcsym | [`/axiom:analyze-crash`](/commands/) | [crash-analyzer](/agents/crash-analyzer) |
| xcui | [`/axiom:ui`](/commands/) | [simulator-tester](/agents/simulator-tester) |

You rarely call these directly — Axiom's skills and agents invoke them for you. The reference pages above document xclog, xcprof, xcsym and xcui for when you want to drive them yourself; axbuild is covered on this page.

## Related tools

Axiom also documents the third-party and Apple CLIs the bundled tools build on:

- [**AXe**](/reference/axe-ref) – simulator HID automation; `xcui` delegates input (`tap`/`type`/`swipe`) to it.
- [**xctrace**](/reference/xctrace-ref) – Apple's Instruments CLI; `xcprof` wraps it for recording and export.
