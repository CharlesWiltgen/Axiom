# Tools

Axiom ships four native command-line tools in its `bin/` directory. They give an AI coding assistant — and you — direct access to the things an assistant otherwise can't see: simulator logs, crash reports, Instruments traces, and the live accessibility tree. They're auto-resolved on `PATH` once the plugin is installed, so you (or Claude) can just run `xclog`, `xcprof`, `xcsym`, or `xcui`.

## Bundled tools

| Tool | What it does |
|------|--------------|
| [**xclog**](/reference/xclog-ref) | Capture simulator & device console output (`print`, `os_log`, `Logger`) as structured JSON/JSONL |
| [**xcprof**](/reference/xcprof-ref) | Record and analyze Instruments traces — CPU bottlenecks, an honest per-family support matrix, and user-code attribution |
| [**xcsym**](/reference/xcsym-ref) | Symbolicate and triage crash reports (`.ips`, MetricKit, legacy `.crash`, `.xccrashpoint`) with automatic dSYM discovery |
| [**xcui**](/reference/xcui-ref) | Drive and assert on the simulator UI and accessibility tree — wait, assert, toggle a11y settings, handle system dialogs, check VoiceOver |

All four emit **compact JSON by default** (token-lean for LLM consumers); pass `--human` for a prose view, or pipe to `jq .` for indented JSON.

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
