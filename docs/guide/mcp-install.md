# MCP Server (Experimental)

Axiom includes an MCP (Model Context Protocol) server that brings its iOS development skills to any MCP-compatible AI coding tool — VS Code with GitHub Copilot, Claude Desktop, Cursor, Gemini CLI, and more.

::: warning Experimental
The MCP server is functional but pre-npm-publish. Installation currently requires cloning the repository and building from source. An `npm install` workflow is planned for a future release.
:::

## What You Get

The MCP server exposes Axiom's full catalog through the MCP protocol:

- **129 skills** as MCP Resources (on-demand loading)
- **30 agents** as MCP Tools (autonomous scanning and fixing)
- **10 commands** as MCP Prompts (structured workflows)

## Prerequisites

- **Node.js 18+** — check with `node --version`
- **pnpm** (or npm) — for installing dependencies
- **Clone the Axiom repository:**

```bash
git clone https://github.com/CharlesWiltgen/Axiom.git
cd Axiom/mcp-server
```

- **Build the MCP server:**

```bash
pnpm install
pnpm build
```

This compiles the TypeScript source and produces `dist/index.js`, the server entry point.

## Installation by Tool

Each tool needs a configuration snippet that tells it how to launch the Axiom MCP server. Replace `/path/to/Axiom` with your actual clone path.

### VS Code + GitHub Copilot

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "axiom": {
      "command": "node",
      "args": ["/path/to/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/path/to/Axiom/.claude-plugin/plugins/axiom"
      }
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
      "command": "node",
      "args": ["/path/to/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/path/to/Axiom/.claude-plugin/plugins/axiom"
      }
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
      "command": "node",
      "args": ["/path/to/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/path/to/Axiom/.claude-plugin/plugins/axiom"
      }
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/config.toml`:

```toml
[[mcp_servers]]
name = "axiom"
command = "node"
args = ["/path/to/Axiom/mcp-server/dist/index.js"]

[mcp_servers.env]
AXIOM_MCP_MODE = "development"
AXIOM_DEV_PATH = "/path/to/Axiom/.claude-plugin/plugins/axiom"
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `AXIOM_MCP_MODE` | `development`, `production` | `production` | Runtime mode |
| `AXIOM_DEV_PATH` | File path | — | Plugin directory for development mode |
| `AXIOM_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Logging verbosity |

### Development Mode (Live Skills)

Reads skills directly from the Claude Code plugin directory. Changes to skill files are reflected immediately — no rebuild needed. This is the recommended mode when you've cloned the repo.

```bash
AXIOM_MCP_MODE=development \
AXIOM_DEV_PATH=/path/to/Axiom/.claude-plugin/plugins/axiom \
node dist/index.js
```

### Production Mode (Bundled)

Reads from a pre-compiled snapshot (`dist/bundle.json`). Self-contained with no file system access after initialization. Build the bundle first:

```bash
pnpm build:bundle
node dist/index.js
```

## Verify It Works

### Quick Test

Start the server manually to confirm it launches without errors:

```bash
cd /path/to/Axiom/mcp-server
AXIOM_MCP_MODE=development \
AXIOM_DEV_PATH=../.claude-plugin/plugins/axiom \
node dist/index.js
```

The server should start and wait for stdin input (MCP uses stdio transport). Press `Ctrl+C` to stop.

### MCP Inspector

For interactive testing, use the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
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

**Verify the build completed** — `dist/index.js` should exist:
```bash
ls /path/to/Axiom/mcp-server/dist/index.js
```

**Check environment variables** — in development mode, `AXIOM_DEV_PATH` must point to a valid plugin directory:
```bash
ls /path/to/Axiom/.claude-plugin/plugins/axiom/skills
```

### Skills Not Appearing

**Enable debug logging** to see what the server loads:
```bash
AXIOM_LOG_LEVEL=debug \
AXIOM_MCP_MODE=development \
AXIOM_DEV_PATH=../.claude-plugin/plugins/axiom \
node dist/index.js 2>&1 | grep -i skill
```

### Client Can't Connect

MCP uses stdin/stdout for communication. Common issues:

- **Wrong path** in your tool's config — double-check the absolute path to `dist/index.js`
- **Missing build** — run `pnpm build` if `dist/index.js` doesn't exist
- **Other stdout writers** — make sure nothing else writes to stdout; logs go to stderr only

Test the command from your config manually:
```bash
node /path/to/Axiom/mcp-server/dist/index.js
# Should start without errors, waiting for stdin
```

## What's Next

- [View all skills →](/skills/) — Browse the complete skill catalog
- [Agents overview →](/agents/) — See what autonomous agents can do
- [Example Workflows →](/guide/workflows) — Step-by-step guides for common tasks
