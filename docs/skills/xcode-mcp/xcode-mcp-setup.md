---
name: xcode-mcp-setup
description: Setup, agent launch (`run-agent`), skills export, and agent extension for Xcode's built-in MCP server (`xcrun mcpbridge`). Covers the Xcode 27 external-agents gate, per-client config, the permission dialog, and connection troubleshooting.
---

# Xcode MCP Setup

Discipline skill for connecting external AI clients (Claude Code, Cursor, Codex, VS Code, Gemini CLI) to Xcode's MCP server. Covers the Xcode 27 "Allow external agents to use Xcode tools" gate, per-client configuration, the PID-based permission dialog, the `run-agent` launch path, multi-Xcode targeting via `MCP_XCODE_PID`, and the schema-compliance workaround for strict clients.

## When to Use

Use this skill when:
- Setting up Xcode MCP for the first time on this machine
- Configuring a new MCP client (Claude Code, Cursor, Codex, VS Code, Gemini CLI)
- A client connects but `tools/list` returns empty
- Seeing "Connection refused" or "No windows" errors from mcpbridge
- The permission dialog keeps reappearing every session
- Targeting one of multiple running Xcode instances
- A strict MCP client (Cursor, some Zed configs) rejects mcpbridge responses

## Example Prompts

- "How do I set up Xcode MCP with Claude Code?"
- "My mcpbridge connection keeps failing"
- "Cursor can't parse Xcode's MCP responses"
- "I have two Xcode windows open and MCP keeps hitting the wrong one"
- "Why does Xcode show the permission dialog every time I restart Claude Code?"
- "Where do I enable MCP in Xcode Settings?"
- "How do I let Xcode launch Claude Code with my project's config?"
- "How do I add a custom MCP server or plug-in to Xcode's agent?"

## What This Skill Provides

- **Prerequisites checklist** — Xcode 26.3+, MCP toggle in Settings > Intelligence, at least one open project
- **Per-client config** for Claude Code, Codex, Cursor, VS Code + GitHub Copilot, Gemini CLI
- **Connection verification** — call `XcodeListWindows` to confirm bridge is alive
- **Permission dialog model** — PID-based grants, why dialogs reappear, where they must be approved
- **Multi-Xcode targeting** — auto-detection fallback chain plus manual `MCP_XCODE_PID` and `MCP_XCODE_SESSION_ID` overrides
- **Schema compliance workaround** — XcodeMCPWrapper proxy for strict clients that need `structuredContent`
- **Troubleshooting decision tree** — connection failed, empty tools list, wrong project, repeated prompts, response rejected
- **Letting Xcode launch the agent** — `xcrun mcpbridge run-agent` starts an agent with Xcode's resolved config (auth, env, MCP tools); `run-agent skills export` (Xcode 27) dumps Xcode's built-in skill bundles to disk
- **Extending Xcode's agent** — per-agent config folders (Claude, Codex, Gemini) for custom models, MCP servers, and skills, plus Agents → Permissions and Plug-ins

## Related

- [Xcode MCP Tools](/skills/xcode-mcp/xcode-mcp-tools) — once setup works, this skill covers workflow patterns and tool gotchas
- [Xcode MCP Reference](/reference/xcode-mcp-ref) — full parameter and return-shape reference for all 20 MCP tools
- [Xcode Debugging](/skills/debugging/xcode-debugging) — environment diagnostics for problems that aren't MCP-related (Derived Data, zombie xcodebuild processes, simulators)
