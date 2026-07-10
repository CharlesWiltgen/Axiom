# Axiom

Battle-tested skills, agents, and tools for modern Apple OS development — Swift 6, SwiftUI, Liquid Glass, Apple Intelligence, and more. Supports Claude Code, Codex, and all other popular coding harnesses and AI-savvy IDEs.

## What is Axiom?

Axiom gives AI coding assistants deep Apple OS development expertise — the kind that prevents data loss from bad migrations, catches memory leaks before users complain, and stops you from spending 30 minutes debugging a zombie xcodebuild process.

<!-- AXIOM_STATS_BEGIN — auto-maintained by scripts/set-version.js; do not hand-edit -->
- **262 skills** covering UI, data, concurrency, performance, networking, accessibility, and more
- **41 agents** that autonomously scan for issues (memory leaks, concurrency violations, build problems)
- **15 commands** for quick audits and diagnostics
<!-- AXIOM_STATS_END -->
- **xclog** — a built-in console capture tool that gives AI assistants access to simulator and device logs
- **xcsym** — a built-in crash symbolication tool for `.ips`, MetricKit, and Apple's legacy `.crash` text crashes, with automatic dSYM discovery and pattern categorization
- **xcui** — a built-in tool to drive and validate the simulator UI and accessibility (tap by accessibility ID, dump the accessibility tree, check VoiceOver and Dynamic Type)
- **xcprof** — a built-in tool to record and analyze CPU/performance traces (xctrace) without opening Instruments

Every discipline skill is TDD-tested against real developer pressure scenarios. [Learn more about quality](https://charleswiltgen.github.io/Axiom/start/quality).

**OS 27 in progress.** Axiom is on a `27.x` beta that tracks Apple's OS 27 developer betas — OS-27 coverage lands continuously through the beta season. Guidance for OS 26 and earlier stays stable.

## Installation

### Claude Code (native plugin)

```
/plugin marketplace add CharlesWiltgen/Axiom
```

Then search for "axiom" in the `/plugin` menu and install.

### MCP (VS Code, Cursor, Gemini CLI, and more)

See the [MCP setup guide](https://charleswiltgen.github.io/Axiom/start/mcp-install).

### Pi (terminal coding agent)

```
pi install git:github.com/CharlesWiltgen/Axiom
```

One command installs the skills plus the `/axiom-*` commands and hooks. See the [Pi setup guide](https://charleswiltgen.github.io/Axiom/start/pi-install).

### Xcode (Claude Agent / Codex)

See the [Xcode integration guide](https://charleswiltgen.github.io/Axiom/start/xcode-setup).

## Getting Started

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
"Show me what my app is logging"
"Symbolicate this crash file"
```

You can also use commands directly:

```
/axiom:console          # Capture simulator console output
/axiom:analyze-crash    # Parse and triage .ips, MetricKit, or .crash reports
/axiom:fix-build        # Diagnose build failures
/axiom:audit memory     # Scan for memory leaks
/axiom:audit concurrency # Check for data races
/axiom:health-check     # Run all relevant auditors
```

## Documentation

Full documentation, skill catalog, and guides at **[charleswiltgen.github.io/Axiom](https://charleswiltgen.github.io/Axiom)**.

## Community

- [r/axiomdev](https://www.reddit.com/r/axiomdev/) — Version announcements with changelogs
- [Report issues or request features](https://github.com/CharlesWiltgen/Axiom/issues)
- [Share usage patterns and questions](https://github.com/CharlesWiltgen/Axiom/discussions)
