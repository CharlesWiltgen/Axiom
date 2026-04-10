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

This installs all 184 skills globally using [npx skills](https://skills.sh/). To update later, run `npx skills update`.

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

## Troubleshooting

### Skills Not Activating

Axiom skills route automatically based on iOS-specific keywords in your questions. If skills aren't firing:

1. **Use specific terms**: "SwiftUI", "build failed", "memory leak", "@MainActor", "SwiftData" trigger routing
2. **Use `/axiom:ask`** (Claude Code): Explicitly routes your question to the right skill
3. **Restart**: Reload Claude Code or Codex

### Getting Help

- [Report issues](https://github.com/CharlesWiltgen/Axiom/issues)
- [Discussions](https://github.com/CharlesWiltgen/Axiom/discussions)

## Also Available

- **[MCP Server](/start/mcp-install)** — Use Axiom in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** — Direct Xcode MCP bridge setup
