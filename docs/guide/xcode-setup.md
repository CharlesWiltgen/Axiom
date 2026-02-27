# Xcode Integration

Use Axiom's full skill catalog inside Xcode 26.3+ with Claude Agent or Codex via MCP.

## What You Get

The same catalog available to other MCP clients:

- **133 skills** — searchable iOS development guidance
- **31 agents** — autonomous code scanning and fixing
- **10 commands** — structured workflows

## Prerequisites

- **Xcode 26.3+** with Claude Agent or Codex enabled
- **Node.js 18+** — check with `node --version`

## Claude Agent Setup

Xcode's Claude Agent uses its own config directory — it does **not** read your global `~/.claude.json`.

### 1. Create the config directory

```bash
mkdir -p ~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig
```

### 2. Find your absolute npx path

Xcode doesn't inherit your shell config (`.zshrc`, `.bash_profile`), so `npx` alone won't resolve. Find the absolute path:

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

Replace `/opt/homebrew/bin/npx` with the path from `which npx`. The `"*"` wildcard applies the config to all projects — replace with a specific project path if preferred.

### 4. Restart Xcode

Close and reopen Xcode completely for the config to take effect.

### 5. Verify

Type `/context` in the Claude Agent panel. You should see Axiom listed as a connected MCP server.

## Codex Setup

Codex uses a `.codex/config.toml` file at your project root (or `~/.codex/config.toml` for global config).

### 1. Add the MCP server

Add to your `config.toml`:

```toml
[mcp_servers.axiom]
command = "/opt/homebrew/bin/npx"
args = ["-y", "axiom-mcp"]
env = { "PATH" = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" }
```

Replace the npx path with your actual path from `which npx`.

### 2. Restart Xcode

Close and reopen Xcode for the config to take effect.

## Gotchas

**Absolute paths are required.** Xcode creates a restricted environment that doesn't inherit your shell config. Using just `npx` without the full path will fail silently.

**Include PATH in env.** The MCP server spawns child processes that also need to find `node`. Setting `PATH` in the config ensures this works.

**Restart Xcode after config changes.** MCP configs are read at launch. Editing the file while Xcode is open has no effect.

**This is different from Claude Code.** Xcode's Claude Agent doesn't support hooks, the `/plugin` menu, or SessionStart injection. Axiom's skills are delivered purely through MCP — you get the full skill catalog, agents, and commands, but not Axiom's discipline injection or router architecture.

## Troubleshooting

### MCP not appearing in /context

1. Check that the config file exists at the correct path
2. Verify the npx path is absolute and correct: run it directly in Terminal
3. Check Xcode's debug logs: `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig/debug/latest`

### Skills not loading

Enable debug logging to see what the server loads:

```bash
AXIOM_LOG_LEVEL=debug /opt/homebrew/bin/npx -y axiom-mcp 2>&1 | head -20
```

If the server starts and lists skills, the issue is in Xcode's MCP connection, not Axiom.

## What's Next

- [View all skills →](/skills/) — Browse the complete skill catalog
- [MCP Server guide →](/guide/mcp-install) — Setup for other MCP clients (VS Code, Claude Desktop, Cursor, Gemini CLI)
- [Example Workflows →](/guide/workflows) — Step-by-step guides for common tasks
