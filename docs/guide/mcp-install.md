# MCP Server

Axiom includes an MCP (Model Context Protocol) server that brings its iOS development skills to any MCP-compatible AI coding tool — VS Code with GitHub Copilot, Claude Desktop, Cursor, Gemini CLI, and more.

## What You Get

The MCP server exposes Axiom's full catalog through the MCP protocol:

- **133 skills** as MCP Resources (on-demand loading)
- **31 agents** as MCP Tools (autonomous scanning and fixing)
- **10 commands** as MCP Prompts (structured workflows)

## Prerequisites

- **Node.js 18+** — check with `node --version`

That's it. No cloning, no building.

## Installation by Tool

Each tool needs a configuration snippet that tells it how to launch the Axiom MCP server.

### VS Code + GitHub Copilot

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "axiom": {
      "command": "npx",
      "args": ["-y", "axiom-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "axiom": {
      "command": "npx",
      "args": ["-y", "axiom-mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "axiom": {
      "command": "npx",
      "args": ["-y", "axiom-mcp"]
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/config.toml`:

```toml
[[mcp_servers]]
name = "axiom"
command = "npx"
args = ["-y", "axiom-mcp"]
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `AXIOM_MCP_MODE` | `development`, `production` | `production` | Runtime mode |
| `AXIOM_DEV_PATH` | File path | — | Plugin directory for development mode |
| `AXIOM_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Logging verbosity |

### Development Mode (Live Skills)

For Axiom contributors who want live-reloading skills during development:

```bash
AXIOM_MCP_MODE=development \
AXIOM_DEV_PATH=/path/to/Axiom/.claude-plugin/plugins/axiom \
node /path/to/Axiom/mcp-server/dist/index.js
```

Changes to skill files are reflected immediately — no rebuild needed.

### Production Mode (Bundled)

The default when installed via npm. Reads from a pre-compiled snapshot with no file system access after initialization.

```bash
npx axiom-mcp
```

## Verify It Works

### Quick Test

Run the server directly to confirm it launches without errors:

```bash
npx axiom-mcp
```

The server should start and wait for stdin input (MCP uses stdio transport). Press `Ctrl+C` to stop.

### MCP Inspector

For interactive testing, use the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx axiom-mcp
```

This opens a web UI where you can browse resources, test prompts, and invoke tools.

### In Your Tool

Once configured, try asking your AI tool:

> "What iOS debugging skills do you have?"

It should list Axiom's available skills via the MCP resources protocol.

## Troubleshooting

### Server Won't Start

**Check Node version** — must be 18+:
```bash
node --version
```

### Skills Not Appearing

**Enable debug logging** to see what the server loads:
```bash
AXIOM_LOG_LEVEL=debug npx axiom-mcp 2>&1 | grep -i skill
```

### Client Can't Connect

MCP uses stdin/stdout for communication. Common issues:

- **Wrong config** — ensure `command` is `"npx"` and `args` is `["-y", "axiom-mcp"]`
- **Other stdout writers** — make sure nothing else writes to stdout; logs go to stderr only

Test the command from your config manually:
```bash
npx axiom-mcp
# Should start without errors, waiting for stdin
```

## What's Next

- [View all skills →](/skills/) — Browse the complete skill catalog
- [Agents overview →](/agents/) — See what autonomous agents can do
- [Example Workflows →](/guide/workflows) — Step-by-step guides for common tasks
