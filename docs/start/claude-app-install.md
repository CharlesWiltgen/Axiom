# Claude App

Add Axiom in your browser at claude.ai or in Claude Desktop to use its skills in chat and the fuller plugin in Cowork. The plugin is saved to your Claude account, so it also reaches the Claude mobile app's chat and Claude Code on any machine where you sign in.

## What You Get

Each place you use your account loads a different part of the plugin:

| Part of Axiom | Chat (browser, desktop, mobile) | Cowork (desktop app) | Claude Code (terminal, IDE, desktop app Code tab) |
|---------------|-----------------------------|----------------------|----------------------------------------------|
| <!--ax:routers-->27<!--/ax--> skill routers and the <!--ax:skills-->286<!--/ax--> skills beneath them | Yes | Yes | Yes |
| <!--ax:commands-->17<!--/ax--> commands | Applied as skills when they fit | Yes, as `/axiom:<command>` | Yes |
| <!--ax:agents-->43<!--/ax--> agents | No | Yes | Yes |
| Hooks (session context, skill routing, write guardrails) | No | Yes | Yes |

Axiom's command-line tools (`axbuild`, `xcproject`, `xclog`, `xcsym`, `xcui`, `xcprof`) are macOS programs for Apple Silicon. They need a session that runs commands on your Mac, which Claude Code does, including Claude Desktop's Code tab. Chat never runs them. See [Tools](/tools/).

## Prerequisites

- A Claude account. You add plugins in your browser or Claude Desktop; the Claude mobile app can't add them. On Team and Enterprise plans, an Owner decides whether members can add their own marketplaces (see [Troubleshooting](#no-add-marketplace-option)).
- For the agents and hooks: Cowork in Claude Desktop, or Claude Code.
- For the command-line tools: Claude Code on an Apple Silicon Mac.

## Installation

1. Open [**Customize > Plugins**](https://claude.ai/customize/plugins) in claude.ai or Claude Desktop.
2. Select **Add > Add marketplace**, and enter `CharlesWiltgen/Axiom`.
3. Find **axiom** among your plugins, open it, and select **Add**.

::: tip Verifying Installation
In a chat, type `/` and then `axiom`. The menu lists Axiom's skills, each marked with the plugin it came from.
:::

### Claude Code picks it up too

Because the plugin is saved to your account, Claude Code downloads it as a synced plugin the next time you start a session signed in to the same account. In a session that's already open, run `/reload-plugins` to load it. To install from the Claude Code command line instead, see [Claude Code](/start/install).

## Usage

Describe the problem and your assistant loads the matching Axiom skill:

```
"I'm getting BUILD FAILED in Xcode"
"How do I fix Swift 6 concurrency errors?"
"My app has memory leaks"
"I need to add a database column safely"
```

To pick a skill yourself, type `/axiom` in the message box and choose from the list. In Cowork, run a command directly, for example `/axiom:fix-build`.

## Updating

Plugins added from a marketplace update from it automatically once a new version syncs. To pull the latest right away, open Axiom in **Customize > Plugins** and select **Check for updates**. To keep it current without checking, turn on **Sync automatically** for the marketplace.

## Removing

Open Axiom in **Customize > Plugins**, open its menu, and select **Remove**. To keep it but stop using it, turn on its **Disable plugin** toggle instead.

## Differences from Claude Code

Claude Code gets everything in [What You Get](#what-you-get); chat gets the skills and commands. The audits the agents run still work in chat as skills: ask your assistant to "audit my code for memory leaks". What chat can't do is run the parallel, separate-context agents that Cowork and Claude Code provide.

## Troubleshooting

### No Add marketplace option

On Team and Enterprise plans, an Owner can turn off members' own marketplaces. Ask an Owner to allow them, or to add Axiom for your organization.

### Axiom's skills don't appear in Claude Code

Synced plugins load when a session starts. Run `/reload-plugins`, or start Claude Code again, signed in to the same Claude account.

### Agents or hooks don't run in chat

That's expected: chat loads only skills and commands. Use Cowork or Claude Code for the agents and hooks.

## Also Available

- **[Claude Code](/start/install)** – Install from the Claude Code command line
- **[Codex Plugin](/start/codex-install)** – Native skills for the OpenAI Codex CLI, web app, and IDE extensions
- **[Cursor Plugin](/start/cursor-install)** – Native skills, agents, commands, and hooks for Cursor on macOS
- **[Pi Coding Agent](/start/pi-install)** – Native skills for the Pi terminal coding agent
- **[MCP Server](/start/mcp-install)** – Skills in VS Code, Cursor, Gemini CLI, and any MCP-compatible tool
- **[Xcode Integration](/start/xcode-setup)** – Axiom's skills inside Xcode's Claude Agent and Codex, through MCP
