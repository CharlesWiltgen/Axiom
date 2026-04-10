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

Clone the repo:

```bash
git clone https://github.com/CharlesWiltgen/Axiom.git
```

Add to your personal marketplace at `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "axiom-local",
  "interface": { "displayName": "Axiom (Local)" },
  "plugins": [
    {
      "name": "axiom",
      "source": { "source": "local", "path": "/path/to/Axiom/axiom-codex" },
      "policy": { "installation": "INSTALLED_BY_DEFAULT" },
      "category": "Development"
    }
  ]
}
```

Replace `/path/to/Axiom` with the actual path where you cloned the repo. To update, just `git pull` — the plugin reads from disk.

::: tip Verifying Installation
Use `/plugins` in Codex to open the plugin browser — Axiom should appear as installed. You can also run `/status` or `/debug-config` to check your session configuration.
:::

### Team Installation (Repo-Scoped)

To share Axiom across your team, add the plugin to your project repo. Every Codex user in the repo gets it automatically.

1. Copy the `axiom-codex` directory into your repo:

```bash
cp -r /path/to/Axiom/axiom-codex your-repo/plugins/axiom
```

2. Create `.agents/plugins/marketplace.json` at your repo root:

```json
{
  "name": "axiom-team",
  "interface": { "displayName": "Axiom iOS Development" },
  "plugins": [
    {
      "name": "axiom",
      "source": { "source": "local", "path": "./plugins/axiom" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Development"
    }
  ]
}
```

3. Commit both `plugins/axiom/` and `.agents/plugins/marketplace.json`

Team members see Axiom in their Codex plugin picker on next session. Use `"installation": "INSTALLED_BY_DEFAULT"` to enable it automatically without prompting.

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
