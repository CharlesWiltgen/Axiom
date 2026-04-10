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

## Installation

::: info
The Codex plugin marketplace does not yet support third-party submissions. For now, install Axiom locally using one of the methods below. We'll update this page when marketplace publishing is available.
:::

### Option 1: Personal Marketplace (recommended)

Clone the repo somewhere under your home directory:

```bash
cd ~
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
      "source": { "source": "local", "path": "./Axiom/axiom-codex" },
      "policy": { "installation": "INSTALLED_BY_DEFAULT" },
      "category": "Development"
    }
  ]
}
```

The path must start with `./` and is relative to your home directory (the grandparent of `~/.agents/plugins/`). Absolute paths are not supported. If you cloned to a different location under `~`, adjust the path accordingly.

::: tip Verifying Installation
Use `/plugins` in Codex to open the plugin browser — Axiom should appear as installed. You can also run `/status` or `/debug-config` to check your session configuration.
:::

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
      "source": { "source": "local", "path": "./plugins/axiom" },
      "policy": { "installation": "INSTALLED_BY_DEFAULT" },
      "category": "Development"
    }
  ]
}
```

Copy the `axiom-codex` directory into your project first:

```bash
cp -r ~/Axiom/axiom-codex ./plugins/axiom
```

The path is relative to the project root (grandparent of `.agents/plugins/`).

## Usage

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
```

## Updating

Pull the latest changes:

```bash
cd ~/Axiom
git pull
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

### Skills not appearing in Codex

Verify the path in your `marketplace.json` points to the `axiom-codex/` directory (not the repo root), and that the directory contains `.codex-plugin/plugin.json`.

## Also Available

- **[Claude Code](/start/install)** — Full Axiom experience with 38 autonomous agents and 12 commands
- **[MCP Server](/start/mcp-install)** — Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** — Direct Xcode MCP bridge for in-editor assistance
