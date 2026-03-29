# Codex Plugin

Axiom is available as a native plugin for OpenAI Codex, bringing its iOS development skills directly into the Codex CLI, web app, and IDE extensions.

## What You Get

The Codex plugin includes 164 specialized skills covering:

- **SwiftUI** — layout, navigation, animations, performance, architecture, debugging
- **Data** — SwiftData, Core Data, GRDB, CloudKit, migrations, Codable
- **Concurrency** — Swift 6, actors, Sendable, async/await, synchronization
- **Performance** — memory leaks, profiling, energy, Instruments workflows
- **Networking** — URLSession, Network.framework, connection diagnostics
- **Build** — Xcode debugging, code signing, build optimization, SPM
- **Integration** — StoreKit, widgets, push notifications, camera, contacts, haptics
- **Apple Intelligence** — Foundation Models, on-device AI, CoreML
- **Accessibility** — VoiceOver, Dynamic Type, WCAG compliance

## Prerequisites

- **Codex CLI** or Codex web app
- **Deno** — required to build the plugin. Check with `deno --version` or install from [deno.com](https://deno.com)

## Installation

::: info
The Codex plugin marketplace does not yet support third-party submissions. For now, install Axiom locally using one of the methods below. We'll update this page when marketplace publishing is available.
:::

### Option 1: Personal Marketplace (recommended)

Clone the repo and build the plugin:

```bash
git clone https://github.com/CharlesWiltgen/Axiom.git
cd Axiom
npm run build:codex
```

This creates the `axiom-codex/` directory containing the plugin. Use its full path in the config below.

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

Replace `/path/to/Axiom` with the actual path where you cloned the repo.

### Option 2: Project-Scoped

To make Axiom available only within a specific project, add a marketplace file at your repo root:

```bash
mkdir -p .agents/plugins
```

Create `.agents/plugins/marketplace.json`:

```json
{
  "name": "project-plugins",
  "interface": { "displayName": "Project Plugins" },
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

## Usage

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
```

## Updating

Pull the latest changes and rebuild:

```bash
cd /path/to/Axiom
git pull
npm run build:codex
```

The plugin reads skills from disk, so the update takes effect immediately.

## Differences from Claude Code

The Codex plugin includes the same skill content as the Claude Code plugin, with a few differences:

| Feature | Claude Code | Codex |
|---------|-------------|-------|
| Skills | 164 specialized + 17 routers | 164 specialized (Codex has native routing) |
| Agents | 38 autonomous auditors | Not supported in Codex plugins |
| Commands | 12 `/axiom:*` commands | Not supported in Codex plugins |
| Installation | `/plugin marketplace add` | Local marketplace |

## Troubleshooting

### `deno: command not found`

Install Deno from [deno.com](https://deno.com):

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### `axiom-codex/` directory not found

Run the build step first:

```bash
cd /path/to/Axiom
npm run build:codex
```

### Skills not appearing in Codex

Verify the path in your `marketplace.json` points to the `axiom-codex/` directory (not the repo root), and that the directory contains `.codex-plugin/plugin.json`.

## Also Available

- **[Claude Code](/guide/quick-start)** — Full Axiom experience with 38 autonomous agents and 12 commands
- **[MCP Server](/guide/mcp-install)** — Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool; no build step required
- **[Xcode Integration](/guide/xcode-setup)** — Direct Xcode MCP bridge for in-editor assistance
