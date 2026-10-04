# Tools

Axiom's native helpers capture build diagnostics, simulator logs, crash reports, Instruments traces, project structure and the live accessibility tree. Resolve helpers under the actual installed plugin's `bin/` directory and check executable permission and `--help` before use. Installation does not guarantee PATH discovery.

## Bundled tools

| Tool | What it does |
|------|--------------|
| **axbuild** | Capture `xcodebuild`, `swift build` or `swift test` as bounded JSON with retained full evidence |
| **xcproject** | Inspect Xcode project structure and effective settings without editing the project |
| [**xclog**](/reference/xclog-ref) | Capture simulator & device console output (`print`, `os_log`, `Logger`) as structured JSON/JSONL |
| [**xcprof**](/reference/xcprof-ref) | Record and analyze Instruments traces — CPU bottlenecks, an honest per-family support matrix, and user-code attribution |
| [**xcsym**](/reference/xcsym-ref) | Symbolicate and triage crash reports (`.ips`, MetricKit, legacy `.crash`, `.xccrashpoint`) with automatic dSYM discovery |
| [**xcui**](/reference/xcui-ref) | Drive and assert on the simulator UI and accessibility tree — wait, assert, toggle a11y settings, handle system dialogs, check VoiceOver |

xclog, xcprof, xcsym and xcui emit **compact JSON by default** (token-lean for LLM consumers); pass `--human` for a prose view, or pipe to `jq .` for indented JSON.

## axbuild

Use axbuild when a necessary build or test could overflow your assistant's output window, or when you need locations and evaluated test values from retained evidence. Prefix the original command with the verified helper path; keep the actual scheme, destination and caller flags. Before every Xcode invocation, inventory exact-name `xcodebuild` processes and investigate existing activity.

```sh
/absolute/plugin/bin/axbuild --help
pgrep -x xcodebuild | wc -l
/absolute/plugin/bin/axbuild xcodebuild -scheme App -destination 'platform=macOS' build
/absolute/plugin/bin/axbuild swift test --package-path ./Package
```

Default stdout is compact JSON within 8,000 UTF-8 bytes, including its newline. `--format json` uses two-space indentation. Inspect `command` and `collection` separately: native success can accompany partial collection. `omissions` identifies details withheld from the compact view. Read `artifacts.report` relative to the absolute `artifacts.run` directory for all records; startup stderr JSON identifies that directory before completion. Informational native commands pass through.

The raw compiler log is primary evidence; test results and validated Swift Testing events supplement it. Retain the result bundle for attachments, coverage and deeper inspection. Missing or ambiguous evidence can leave the failed-test count null. Read an existing saved log or report before rebuilding.

**Availability:** Claude Code and the full Codex plugin bundle axbuild. Pi discovers a separately installed executable on PATH. Cursor and MCP distributions do not bundle it or expose an axbuild MCP wrapper; use a unique saved native log when shell helper access is unavailable. Failure-recovery hook status remains unverified in Claude/Codex/Cursor, so those adapters emit no axbuild recovery hint.

Builds are validated on Xcode 27.2 beta build 27B5028f / Swift 6.4 build 6.4.0.34.1. Xcode 26 remains an untested gap. Axiom supports macOS 26 and newer; the binary's macOS 14 compilation target is separate from that support policy.

Example prompt: "Use axbuild for the next necessary test, inspect omissions and show the failed assertion's location and evaluated values."

## How they fit in

Each tool has a slash command and, where it makes sense, an agent that drives it:

| Tool | Command | Agent |
|------|---------|-------|
| xclog | [`/axiom:console`](/commands/) | — |
| xcprof | [`/axiom:profile`](/commands/) | [performance-profiler](/agents/performance-profiler) |
| xcsym | [`/axiom:analyze-crash`](/commands/) | [crash-analyzer](/agents/crash-analyzer) |
| xcui | [`/axiom:ui`](/commands/) | [simulator-tester](/agents/simulator-tester) |

You rarely call these directly — Axiom's skills and agents invoke them for you. The reference pages above document the full CLI surface for when you want to drive them yourself.

## Related tools

Axiom also documents the third-party and Apple CLIs the bundled tools build on:

- [**AXe**](/reference/axe-ref) – simulator HID automation; `xcui` delegates input (`tap`/`type`/`swipe`) to it.
- [**xctrace**](/reference/xctrace-ref) – Apple's Instruments CLI; `xcprof` wraps it for recording and export.

On the tested Xcode 27.2 beta, cancellation can leave build scripts in detached process groups. axbuild tears down its safely owned group and reports `cleanup-incomplete` for unverifiable detached jobs. Verify and stop only independently identified task-owned jobs; the wrapper does not claim to clean every Xcode descendant.

Xcode can interleave progress output inside a diagnostic header. An unidentified compiler basename remains literal and makes collection partial. Inspect the retained raw log; axbuild does not reconstruct a filename from separated fragments.
