# Install

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

## Install for Codex

```bash
npx skills add CharlesWiltgen/Axiom -a codex -g
```

This installs all <!--ax:skills-->273<!--/ax--> skills globally using [npx skills](https://skills.sh/). To update later, run `npx skills update`.

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

Axiom's routers are meant to fire on their own — that is how a question about a build failure reaches the build skill without you naming it. Two things follow from that, and it is worth knowing which lever exists for which problem.

**Commands never fire on their own.** All 17 `/axiom:*` commands carry `disable-model-invocation: true`, so Claude loads them only when you type them. That includes `/axiom:ask` — it is the manual escape hatch for when auto-routing misses, so it must not compete with the routers it backstops.

**Routers are all-or-nothing.** If you want Axiom quieter than that, the only supported control is disabling the plugin in `/plugin`. Claude Code's per-skill `skillOverrides` setting does **not** apply here: its documentation states plainly that *"Plugin skills are not affected by `skillOverrides`. Manage those through `/plugin` instead."* If you have seen a `skillOverrides` entry appear to suppress an `axiom:*` skill, it was not doing so by a supported route, and it will not survive a version bump — plugin skills can also appear under a version-prefixed namespace that a hand-written override key won't match.

If Axiom is firing on work where it doesn't belong, that is usually a routing bug worth [reporting](https://github.com/CharlesWiltgen/Axiom/issues) rather than something to suppress — see [Non-Apple Projects](#non-apple-projects) for the case Axiom already guards against.

## Troubleshooting

### Skills Not Activating

Axiom skills route automatically based on iOS-specific keywords in your questions. If skills aren't firing:

1. **Use specific terms**: "SwiftUI", "build failed", "memory leak", "@MainActor", "SwiftData" trigger routing
2. **Use `/axiom:ask`** (Claude Code): Explicitly routes your question to the right skill
3. **Restart**: Reload Claude Code or Codex

### Getting Help

- [Report issues](https://github.com/CharlesWiltgen/Axiom/issues)
- [Discussions](https://github.com/CharlesWiltgen/Axiom/discussions)

## Non-Apple Projects

Axiom's session hook auto-detects whether your working directory is part of an
Apple project (Xcode project/workspace, Swift package, or Swift sources) and
**skips** its context injection when it isn't — so opening Claude Code in a web,
Node, or game-engine project stays clean.

Override with the `AXIOM_SESSION_CONTEXT` environment variable (it survives plugin
updates, unlike editing plugin files):

- `AXIOM_SESSION_CONTEXT=always` – force Axiom context on (e.g. an Apple project
  with a non-standard layout the auto-detector misses).
- `AXIOM_SESSION_CONTEXT=never` – force it off for a given project or shell.

Set it in your shell profile or a project `.envrc`.

Your home directory is never treated as a project in its own right. Everything
lives under `~`, so asking whether it *contains* an Apple project tells you
nothing — some project is always in there somewhere. Detection falls back to
markers sitting directly in `~`, which normally means Axiom stays quiet. If you habitually start sessions from `~` and want the
context anyway, `AXIOM_SESSION_CONTEXT=always` is the switch. Note that `never`
cannot be scoped to `~` through settings, because a home directory's
project-level settings file is the user-global one.

The same applies to the very top of the filesystem. If your project is checked
out at a single-level path — `/app` or `/workspace`, as containers often do —
detection needs either a marker at that top level or a `.git` there. An image
built with `COPY . /app` that excludes `.git`, and whose Xcode project sits in a
subdirectory, is the one case that falls through both; `AXIOM_SESSION_CONTEXT=always`
turns it back on.

## Also Available

- **[Codex Plugin](/start/codex-install)** – Native skills for the OpenAI Codex CLI, web app, and IDE extensions
- **[Pi Coding Agent](/start/pi-install)** – Native skills for the Pi terminal coding agent
- **[MCP Server](/start/mcp-install)** – Use Axiom in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Direct Xcode MCP bridge setup
