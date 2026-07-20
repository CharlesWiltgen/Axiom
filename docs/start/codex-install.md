# Codex Plugin

Axiom is available as a native plugin for OpenAI Codex, bringing its iOS development skills directly into the Codex CLI, web app, and IDE extensions.

## What You Get

The Codex plugin includes 184 specialized skills covering:

- **SwiftUI** – layout, navigation, animations, performance, architecture, debugging
- **Data** – SwiftData, Core Data, GRDB, CloudKit, migrations, Codable
- **Concurrency** – Swift 6, actors, Sendable, async/await, synchronization
- **Performance** – memory leaks, profiling, energy, Instruments workflows
- **Networking** – URLSession, Network.framework, connection diagnostics
- **Build** – Xcode debugging, code signing, build optimization, SPM
- **Integration** – StoreKit, widgets, push notifications, camera, contacts, haptics
- **Apple Intelligence** – Foundation Models, on-device AI, CoreML
- **Accessibility** – VoiceOver, Dynamic Type, WCAG compliance

## Prerequisites

- **Codex CLI** or Codex web app
- **Node.js 18+** (for npx)

## Installation

### npx skills (recommended)

```bash
npx skills add CharlesWiltgen/Axiom -a codex -g
```

This installs all <!--ax:skills-->265<!--/ax--> skills globally using [npx skills](https://skills.sh/). The `-g` flag makes skills available across all projects.

To install for the current project only (omit `-g`):

```bash
npx skills add CharlesWiltgen/Axiom -a codex
```

::: tip Verifying Installation
Run `npx skills list -g` (or `npx skills list` for project-scoped) to see installed skills. You can also use `/plugins` in Codex to check.
:::

### Codex plugin marketplace (full plugin, including hooks)

`npx skills` installs the skill content. To install the **full Codex plugin** — skills *plus* Axiom's lifecycle hooks (iOS-version ground-truth at session start, automatic skill routing, and the `@State` write-time guardrail) — add Axiom as a native Codex plugin from its bundled marketplace:

```bash
codex plugin marketplace add CharlesWiltgen/Axiom
codex plugin add axiom@axiom-marketplace
```

Hooks are gated behind a Codex feature flag and a one-time trust review. Enable the feature in `~/.codex/config.toml`:

```toml
[features]
hooks = true
```

On first run after enabling, Codex asks you to trust the plugin's hooks (they ship in the plugin's `hooks/` directory). Approve to activate them.

### Manual Marketplace (alternative)

If you prefer not to use npx skills, you can configure the plugin manually.

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

The path must start with `./` and is relative to your home directory (the grandparent of `~/.agents/plugins/`). Absolute paths are not supported.

### Team Installation (Repo-Scoped)

To share Axiom across your team, install at the project level:

```bash
npx skills add CharlesWiltgen/Axiom -a codex
```

This creates skills in `.agents/skills/` which you can commit to your repo. Team members get Axiom automatically.

## Usage

Skills activate automatically based on your questions. Just ask:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
```

## Updating

```bash
npx skills update
```

If using the manual marketplace method, run `cd ~/Axiom && git pull` instead.

## Removing

```bash
npx skills remove -a codex -g
```

## Differences from Claude Code

The Codex plugin includes the same skill content as the Claude Code plugin, with a few differences:

| Feature | Claude Code | Codex |
|---------|-------------|-------|
| Skills | 175 specialized + 23 routers | 175 specialized (Codex has native routing) |
| Agents | 38 autonomous auditors | Not supported in Codex plugins |
| Commands | 12 `/axiom:*` commands | Not supported in Codex plugins |
| Hooks | Lifecycle hooks (skill routing, `@State` guardrail, version ground-truth) | Supported via the native plugin install — set `features.hooks = true` |
| Installation | `/plugin marketplace add` | `npx skills add`, native `codex plugin`, or manual marketplace |

## Troubleshooting

### Skills not appearing in Codex

- Run `npx skills list -g` to verify skills are installed
- If using manual marketplace, verify the path points to the `axiom-codex/` directory (not the repo root) and starts with `./`

### Hooks not firing

- Hooks only run with the **native plugin install** (`codex plugin add axiom@axiom-marketplace`), not the `npx skills` skills-only install
- Confirm `features.hooks = true` is set in `~/.codex/config.toml`, and that you approved the hook trust prompt on first run
- Codex runs hook commands through `sh -lc`, which sources your login profile — make sure your profile writes nothing to **stdout** (send any echoes to stderr or guard them behind a TTY check), or it can corrupt a hook's output

## Also Available

- **[Claude Code](/start/install)** – Full Axiom experience with <!--ax:agents-->41<!--/ax--> autonomous agents and <!--ax:commands-->15<!--/ax--> commands
- **[Pi Coding Agent](/start/pi-install)** – Native skills for the Pi terminal coding agent
- **[MCP Server](/start/mcp-install)** – Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Direct Xcode MCP bridge for in-editor assistance
