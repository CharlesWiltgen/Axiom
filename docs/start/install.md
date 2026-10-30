# Install

Install Axiom in Claude Code or Codex, then ask your assistant about your Apple-platform code. For other assistants, see [Also Available](#also-available).

## Install for Claude Code

In Claude Code, run:

```
/plugin marketplace add CharlesWiltgen/Axiom
```

Then install the plugin:

1. Use `/plugin` to open the plugin menu
2. Search for "axiom"
3. Click "Install"

Verify with `/plugin` → "Manage and install" — Axiom should be listed.

If you already added Axiom at claude.ai or in Claude Desktop, Claude Code loads it as a synced plugin when a session starts. See [Claude App](/start/claude-app-install).

## Install for Codex

```bash
npx skills add CharlesWiltgen/Axiom -a codex -g
```

This installs all <!--ax:skills-->286<!--/ax--> skills globally using [npx skills](https://skills.sh/). To update later, run `npx skills update`.

::: tip Verifying Installation
Use `/plugins` in Codex to open the plugin browser — Axiom should appear as installed. You can also run `npx skills list -g` to see installed skills.
:::

For more installation options (project-scoped, team sharing, MCP server), see the [Codex install guide](/start/codex-install).

### MCP Server (Optional)

Axiom's MCP server lets Codex search across all skills by keyword. Add it with one command:

```bash
codex mcp add axiom -- npx -y axiom-mcp
```

Or add it manually to `~/.codex/config.toml`:

```toml
[mcp_servers.axiom]
command = "npx"
args = ["-y", "axiom-mcp"]
```

For project-scoped config, use `.codex/config.toml` in your repo root instead.

## Use Skills

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
"Check my SwiftUI code for performance issues"
```

Skills cover SwiftUI, concurrency, data persistence, performance, networking, accessibility, Apple Intelligence, build debugging, and more. See the [full skill catalog](/skills/) for everything available.

## Controlling When Axiom Activates

Axiom's routers are meant to fire on their own — that's how a question about a build failure reaches the build skill without you naming it. Two things follow from that.

**Commands never fire on their own.** Every `/axiom:*` command carries `disable-model-invocation: true`, so your assistant loads one only when you type it. That includes `/axiom:ask`, the manual escape hatch for when automatic routing misses; it must not compete with the routers it backs up.

**Routers are all-or-nothing.** To make Axiom quieter, the only supported control is disabling the plugin in `/plugin`. Claude Code's per-skill `skillOverrides` setting does **not** apply: its documentation says *"Plugin skills are not affected by `skillOverrides`. Manage those through `/plugin` instead."* If a `skillOverrides` entry seemed to suppress an `axiom:*` skill, it did so by an unsupported route that won't survive a version bump — plugin skills can also appear under a version-prefixed namespace that a hand-written override key won't match.

If Axiom fires on work where it doesn't belong, that's usually a routing bug worth [reporting](https://github.com/CharlesWiltgen/Axiom/issues) rather than something to suppress. See [Non-Apple Projects](#non-apple-projects) for the case Axiom already guards against.

## Troubleshooting

### Skills Not Activating

Axiom skills route automatically based on Apple-platform terms in your questions. If skills aren't firing:

1. **Use specific terms** – "SwiftUI", "build failed", "memory leak", "@MainActor", and "SwiftData" all trigger routing
2. **Use `/axiom:ask`** – In Claude Code, this command routes your question to the right skill explicitly
3. **Restart** – Quit and reopen Claude Code or Codex

### Getting Help

- [Report issues](https://github.com/CharlesWiltgen/Axiom/issues)
- [Discussions](https://github.com/CharlesWiltgen/Axiom/discussions)

## Non-Apple Projects

Axiom's hooks detect whether your working directory is part of an Apple project (an Xcode project or workspace, a Swift package, Swift source files, a playground, or a Podfile) and stay **silent** when it isn't: no session context, skill routing, terminal hints, Swift write guardrails, crash-report routing, or subagent guidance. Opening Claude Code in a web, Node, or game-engine project stays clean. The one thing the hooks still do everywhere is add Axiom's bundled tools to your `PATH`.

Override detection with the `AXIOM_SESSION_CONTEXT` environment variable, which survives plugin updates, unlike edits to plugin files:

- `AXIOM_SESSION_CONTEXT=always` – Force Axiom's hooks on, for example in an Apple project with a nonstandard layout the detector misses
- `AXIOM_SESSION_CONTEXT=never` – Force them off for a given project or shell

Set it in your shell profile or a project `.envrc`.

Your home directory is never treated as a project in its own right. Everything lives under `~`, so asking whether it *contains* an Apple project tells you nothing — some project is always in there somewhere. Detection looks only at markers sitting directly in `~`, which normally means Axiom stays quiet there. If you start sessions from `~` and want the context anyway, set `AXIOM_SESSION_CONTEXT=always`. You can't scope `never` to `~` through settings, because a home directory's project-level settings file is the user-global one.

The same applies at the top of the filesystem. If your project is checked out at a single-level path such as `/app` or `/workspace`, as containers often do, detection needs either a marker or a `.git` at that top level. An image built with `COPY . /app` that excludes `.git`, with its Xcode project in a subdirectory, falls through both; `AXIOM_SESSION_CONTEXT=always` turns Axiom back on.

## Also Available

- **[Claude App](/start/claude-app-install)** – Skills in chat, plus agents and hooks in Cowork
- **[Codex Plugin](/start/codex-install)** – Native skills for the OpenAI Codex CLI, web app, and IDE extensions
- **[Cursor Plugin](/start/cursor-install)** – Native skills, agents, commands, and hooks for Cursor on macOS
- **[Pi Coding Agent](/start/pi-install)** – Native skills for the Pi terminal coding agent
- **[MCP Server](/start/mcp-install)** – Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Axiom's skills inside Xcode's Claude Agent and Codex, through MCP
