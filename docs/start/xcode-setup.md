# Xcode Integration

Use Axiom's full skill catalog inside Xcode's Claude Agent or Codex (Xcode 26.3 and later), through MCP (Model Context Protocol), the standard way AI assistants connect to outside tools.

## What You Get

The same catalog Axiom's MCP server gives other MCP clients:

- **<!--ax:skills-->286<!--/ax--> skills** – searchable Apple-platform development guidance
- **<!--ax:agents-->43<!--/ax--> agents** – instructions for code scanning and fixing, which your assistant fetches and follows
- **<!--ax:commands-->17<!--/ax--> commands** – structured workflows

## Prerequisites

- **Xcode 26.3+** with Claude Agent or Codex enabled
- **Node.js 18+** – check with `node --version`

## Xcode 27 Plug-ins

Xcode 27 adds plug-ins: packages of subagents, MCP servers, and skills that extend the agents Xcode runs. Manage them under Xcode's Intelligence settings, in **Agents → Plug-ins**. Choose **Add Plug-in**, then use **Add from URL** to import one and select which of its components to install.

We haven't yet confirmed that Axiom installs this way. The setup below uses each agent's configuration folder instead.

## Claude Agent Setup

Xcode's Claude Agent uses its own configuration folder; it does **not** read your global `~/.claude.json`.

### 1. Create the config directory

```bash
mkdir -p ~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig
```

### 2. Find your absolute npx path

Xcode doesn't inherit your shell configuration (`.zshrc`, `.bash_profile`), so `npx` alone won't resolve. Find its absolute path:

```bash
which npx
```

Common locations:

| Install method | Typical path |
|----------------|--------------|
| Homebrew | `/opt/homebrew/bin/npx` |
| nvm | `~/.nvm/versions/node/v22.x.x/bin/npx` |
| Volta | `~/.volta/bin/npx` |
| fnm | `~/.local/share/fnm/node-versions/v22.x.x/installation/bin/npx` |
| System Node | `/usr/local/bin/npx` |

### 3. Create the config file

Create `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig/.claude.json` with your absolute npx path:

```json
{
  "projects": {
    "*": {
      "mcpServers": {
        "axiom": {
          "type": "stdio",
          "command": "/opt/homebrew/bin/npx",
          "args": ["-y", "axiom-mcp"],
          "env": {
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
          }
        }
      }
    }
  }
}
```

Replace `/opt/homebrew/bin/npx` with the path from `which npx`. The `"*"` wildcard applies the configuration to all projects; replace it with a specific project path to limit it to one.

### 4. Restart Xcode

Quit and reopen Xcode for the configuration to take effect.

### 5. Verify

Type `/context` in the Claude Agent panel. You should see Axiom listed as a connected MCP server.

## Codex Setup

Like Claude Agent, Xcode's Codex reads its own configuration folder, `~/Library/Developer/Xcode/CodingAssistant/codex`, rather than your global Codex settings.

### 1. Add the MCP server

Add this to `config.toml` in that folder, creating the file if it doesn't exist:

```toml
[mcp_servers.axiom]
command = "/opt/homebrew/bin/npx"
args = ["-y", "axiom-mcp"]
env = { "PATH" = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" }
```

Replace the `npx` path with the one from `which npx`.

### 2. Restart Xcode

Quit and reopen Xcode for the configuration to take effect.

## Gotchas

**Absolute paths are required.** Xcode runs agents in a restricted environment that doesn't inherit your shell configuration. A bare `npx` without the full path fails silently.

**Include `PATH` in `env`.** The MCP server starts child processes that also need to find `node`, and setting `PATH` in the configuration lets them.

**Restart Xcode after configuration changes.** Xcode reads MCP configuration at launch, so editing the file while Xcode is open has no effect.

**This is different from Claude Code.** Xcode's Claude Agent doesn't support hooks, the `/plugin` menu, or session-start context. Axiom reaches it only through MCP: you get the skill catalog, agent instructions, and commands, but not Axiom's hooks, which add version context at session start and route each question to the right skill automatically.

## Troubleshooting

### Axiom not appearing in `/context`

1. Check that the configuration file exists at the correct path
2. Check that the `npx` path is absolute and correct by running it directly in Terminal
3. Check Xcode's debug logs at `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig/debug/latest`

### Skills not loading

Turn on debug logging to see what the server loads:

```bash
AXIOM_LOG_LEVEL=debug /opt/homebrew/bin/npx -y axiom-mcp 2>&1 | head -20
```

If the server starts and lists skills, the problem is in Xcode's MCP connection, not Axiom.

## What's Next

- [View all skills →](/skills/) – Browse the complete skill catalog
- [MCP Server guide →](/start/mcp-install) – Setup for other MCP clients (VS Code, Claude Desktop, Cursor, Gemini CLI) and the server's environment variables
- [Xcode MCP skills →](/skills/xcode-mcp/) – The other direction: letting your assistant drive Xcode through Xcode's own MCP server
- [Example Workflows →](/start/workflows) – Step-by-step guides for common tasks
