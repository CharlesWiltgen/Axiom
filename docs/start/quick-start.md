# Quick Start

## Install the Claude Code Plugin

In Claude Code, run:

```
/plugin marketplace add CharlesWiltgen/Axiom
```

Then install the plugin:

1. Use `/plugin` to open the plugin menu
2. Search for "axiom"
3. Click "Install"

Verify with `/plugin` → "Manage and install" — Axiom should be listed.

## Install the Codex Plugin

Clone the repo and build:

```bash
git clone https://github.com/CharlesWiltgen/Axiom.git
cd Axiom
npm run build:codex
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

Replace `/path/to/Axiom` with the actual path where you cloned the repo. See the [full Codex setup guide](/start/codex-install) for project-scoped installation and troubleshooting.

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
3. **Restart**: Reload Claude Code or rebuild the Codex plugin

### Getting Help

- [Report issues](https://github.com/CharlesWiltgen/Axiom/issues)
- [Discussions](https://github.com/CharlesWiltgen/Axiom/discussions)

## Also Available

- **[MCP Server](/start/mcp-install)** — Use Axiom in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** — Direct Xcode MCP bridge setup
