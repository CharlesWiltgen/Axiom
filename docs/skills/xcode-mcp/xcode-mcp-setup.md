---
name: xcode-mcp-setup
description: Setup for Xcode's built-in MCP server — attached and headless modes, per-client config, agent approval, skills export, and connection troubleshooting.
---

# Xcode MCP Setup

Xcode's MCP (Model Context Protocol) server lets an AI client such as Claude Code, Cursor, or Codex build, test, and read your project through Xcode. This skill covers connecting a client to that server, approving the agent, and fixing a connection that fails or hangs.

## When to Use

Use this skill when:
- Setting up Xcode MCP on a machine for the first time
- Configuring a new MCP client (Claude Code, Cursor, Codex, VS Code, Gemini CLI)
- Running MCP in CI, or on a machine where you don't want Xcode open
- A tool call is rejected with "This agent isn't approved to use Xcode's tools yet" (Xcode 27 beta 6 and later), or hangs forever with no error (beta 5 and earlier)
- A client connects but `tools/list` returns empty
- `DocumentationSearch` is missing on Xcode 27.2 beta 2, or the `GetCodeCoverage` tool named in the 27.2 prerelease notes is missing from your tool list
- `xcrun mcpbridge` reports "Connection refused"
- Permission prompts reappear every session
- Targeting one of multiple running Xcode instances

## Example Prompts

- "How do I set up Xcode MCP with Claude Code?"
- "How do I run Xcode MCP without keeping Xcode open?"
- "My MCP tool call just hangs and never returns"
- "Why does Xcode say my agent isn't approved to use its tools?"
- "My mcpbridge connection keeps failing"
- "Why do I have to re-approve my agent every day?"
- "Where do I enable MCP in Xcode Settings?"
- "How do I let Xcode launch Claude Code with my project's config?"
- "How do I export Xcode's built-in skills?"
- "Is missing DocumentationSearch on Xcode 27.2 beta 2 an approval problem?"

## What This Skill Provides

- **Mode selection** – What attached and headless modes each require, and which to pick
- **Headless lifecycle** – `mcp-server enable`, `open <path>` to launch the service and load a project, `status`, `stop`, `disable`, and what `--unsafe-always-allow-all-agents` actually grants
- **Per-client config** – Claude Code, Codex, Cursor, VS Code with GitHub Copilot, and Gemini CLI, including the Cursor workaround that only Xcode 26.x needs
- **Connection verification** – Calling `XcodeListWorkspaces`, and how to read an empty result
- **Approval and the unapproved-agent trap** – Attached-mode dialogs, headless `sudo` grants, time-boxed trust for unsigned agents, and the `Permitted agents` check; rejected calls from beta 6 on versus silent hangs through beta 5
- **Multi-Xcode targeting** – The auto-detection fallback, plus `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`, and `DEVELOPER_DIR`
- **Troubleshooting decision tree and table** – Hangs, connection failures, empty tool lists, wrong workspace, repeated prompts
- **Build-specific tool lists** – Why 27.2 beta 2 (27B5028f) lists 53 tools without `DocumentationSearch`, approved or not, while Xcode 27.2 (27B52) and its RC list all 54, and why no build through the 27.2 release lists `GetCodeCoverage`
- **Letting Xcode launch the agent** – `xcrun agent` (an alias for `xcrun mcpbridge run-agent`) starts an agent with Xcode's resolved config; `xcrun agent skills export` writes Xcode's 10 built-in skill bundles to disk
- **Extending Xcode's agent** – Per-agent config folders (Claude Agent, Codex, Gemini) for custom models, MCP servers, and skills, plus built-in slash commands and the Agents → Permissions and Plug-ins settings

## Two Modes

Which setup you need depends on whether a human is at the keyboard.

| Mode | Needs | Xcode.app running? |
|------|-------|--------------------|
| Attached (Xcode 26.3+) | A project open in Xcode, and external agents allowed in Settings → Intelligence | Yes |
| Headless (Xcode 27) | A one-time `sudo` opt-in | No |

Attached mode suits a developer already working in Xcode. Headless mode suits CI, agents that shouldn't depend on a GUI session, or anyone who'd rather not keep Xcode open. Either way, your client runs the same command, `xcrun mcpbridge`, which relays its requests to whichever service is running: Xcode itself in attached mode, or `xcrun mcp-server` in headless mode. `mcp-server` doesn't exist before Xcode 27.

## Documentation Scope

This page documents the `xcode-mcp-setup` skill in the `axiom-xcode-mcp` suite. The skill file holds the full guidance your assistant draws on, including each client's configuration, the headless permission commands, and the troubleshooting decision tree.

## Related

- [Xcode MCP Tools](/skills/xcode-mcp/xcode-mcp-tools) – Once setup works, this skill covers workspace bootstrap, workflow patterns, and tool gotchas
- [Xcode MCP Reference](/reference/xcode-mcp-ref) – Parameters and return shapes for Xcode 27.2, plus the fields that differ on earlier builds
- [Xcode Debugging](/skills/debugging/xcode-debugging) – Environment diagnostics for problems that aren't MCP-related (Derived Data, zombie xcodebuild processes, simulators)
- [Device Control](/reference/device-control-ref) – Driving simulators and devices without MCP at all
