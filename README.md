# Axiom

Battle-tested skills, agents, and tools for modern Apple platform development with AI coding assistants. Native for Claude Code, MCP for everything else.

## What is Axiom?

Axiom gives AI coding assistants deep Apple platform development expertise — the kind that prevents data loss from bad migrations, catches memory leaks before users complain, and stops you from spending 30 minutes debugging a zombie xcodebuild process.

- **175 skills** covering UI, data, concurrency, performance, networking, accessibility, and more
- **38 agents** that autonomously scan for issues (memory leaks, concurrency violations, build problems)
- **12 commands** for quick audits and diagnostics
- **xclog** — a built-in console capture tool that gives AI assistants access to simulator and device logs

Every discipline skill is TDD-tested against real developer pressure scenarios. [Learn more about quality](https://charleswiltgen.github.io/Axiom/start/quality).

## Installation

### Claude Code (native plugin)

```
/plugin marketplace add CharlesWiltgen/Axiom
```

Then search for "axiom" in the `/plugin` menu and install.

### MCP (VS Code, Cursor, Gemini CLI, and more)

See the [MCP setup guide](https://charleswiltgen.github.io/Axiom/start/mcp-install).

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
```

You can also use commands directly:

```
/axiom:console          # Capture simulator console output
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
