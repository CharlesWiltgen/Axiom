# Axiom MCP Server

Model Context Protocol (MCP) server for Axiom's iOS development skills, agents, and commands. Enables cross-platform access to Axiom's battle-tested guidance in any MCP-compatible AI coding tool.

## Features

- **38 Skills** - iOS development expertise as MCP Resources (on-demand loading)
- **10 Commands** - Structured prompts as MCP Prompts
- **10 Agents** - Autonomous tools as MCP Tools
- **Dual Distribution** - Works standalone or bundled with Claude Code plugin
- **Hybrid Runtime** - Development mode (live files) or production mode (bundled)

## Installation

### For Claude Code Users (Bundled)

The MCP server starts automatically when you install the Axiom plugin:

```bash
claude-code plugin add axiom@axiom-marketplace
```

No additional configuration needed! The plugin's `.mcp.json` launches the server in development mode.

### For Other Tools (Standalone)

Install via pnpm (or npm):

```bash
# Install dependencies
pnpm install

# Build the server
pnpm build

# Run in development mode
AXIOM_MCP_MODE=development AXIOM_DEV_PATH=/path/to/axiom/plugin node dist/index.js
```

## Usage

### VS Code + GitHub Copilot

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "axiom": {
      "command": "node",
      "args": ["/Users/YourName/Projects/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/Users/YourName/Projects/Axiom/plugins/axiom"
      }
    }
  }
}
```

Then in GitHub Copilot Chat:

```
User: What iOS debugging skills do you have?

Copilot: [calls resources/list]
I have access to Axiom's iOS development skills:

**Debugging & Troubleshooting**
- xcode-debugging: Environment-first diagnostics
- memory-debugging: Leak diagnosis (5 patterns)
...
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "axiom": {
      "command": "node",
      "args": ["/Users/YourName/Projects/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/Users/YourName/Projects/Axiom/plugins/axiom"
      }
    }
  }
}
```

### Cursor

Add to Cursor's MCP settings (`.cursor/mcp.json` in your workspace):

```json
{
  "mcpServers": {
    "axiom": {
      "command": "node",
      "args": ["/Users/YourName/Projects/Axiom/mcp-server/dist/index.js"],
      "env": {
        "AXIOM_MCP_MODE": "development",
        "AXIOM_DEV_PATH": "/Users/YourName/Projects/Axiom/plugins/axiom"
      }
    }
  }
}
```

### Gemini CLI

Configure MCP server in `~/.gemini/config.toml`:

```toml
[[mcp_servers]]
name = "axiom"
command = "node"
args = ["/Users/YourName/Projects/Axiom/mcp-server/dist/index.js"]

[mcp_servers.env]
AXIOM_MCP_MODE = "development"
AXIOM_DEV_PATH = "/Users/YourName/Projects/Axiom/plugins/axiom"
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `AXIOM_MCP_MODE` | `development`, `production` | `production` | Runtime mode |
| `AXIOM_DEV_PATH` | File path | `~/Projects/Axiom/plugins/axiom` | Plugin directory for dev mode |
| `AXIOM_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Logging verbosity |

### Modes

#### Development Mode (Live Skills)

```bash
AXIOM_MCP_MODE=development AXIOM_DEV_PATH=/path/to/plugin node dist/index.js
```

- Reads skills directly from Claude Code plugin directory
- Changes to skills reflected immediately (no rebuild needed)
- Ideal for skill development and testing
- Used by Claude Code plugin's `.mcp.json`

#### Production Mode (Bundled Skills)

```bash
# Default mode - no environment variables needed
node dist/index.js
```

- Reads pre-bundled snapshot from `dist/bundle.json`
- Bundle contains all 38 skills, 10 commands, 10 agents
- No file system access after initialization
- Self-contained, distributable via npm
- Bundle generated via `pnpm build:bundle`

## MCP Resources

Skills are exposed as MCP Resources with URI scheme:

```
axiom://skill/{skill-name}
```

Examples:
- `axiom://skill/xcode-debugging`
- `axiom://skill/swiftui-nav`
- `axiom://skill/memory-debugging`
- `axiom://skill/liquid-glass-ref`

### Resource Discovery

```json
// resources/list response
{
  "resources": [
    {
      "uri": "axiom://skill/xcode-debugging",
      "name": "Xcode Debugging",
      "description": "Environment-first diagnostics for BUILD FAILED, test crashes, simulator hangs",
      "mimeType": "text/markdown"
    }
  ]
}
```

### Resource Reading

```json
// resources/read request
{
  "method": "resources/read",
  "params": {
    "uri": "axiom://skill/xcode-debugging"
  }
}

// Response includes full skill content as markdown
{
  "contents": [{
    "uri": "axiom://skill/xcode-debugging",
    "mimeType": "text/markdown",
    "text": "# Xcode Debugging\n\n..."
  }]
}
```

## Development

### Project Structure

```
mcp-server/
├── package.json              # npm package config
├── tsconfig.json             # TypeScript config
├── src/
│   ├── index.ts              # Entry point + stdio transport
│   ├── config.ts             # Configuration + logging
│   ├── loader/
│   │   ├── types.ts          # Loader interface
│   │   ├── parser.ts         # Frontmatter parsing
│   │   ├── dev-loader.ts     # Live file reading
│   │   └── prod-loader.ts    # Bundle reading
│   ├── resources/
│   │   └── handler.ts        # Resources protocol
│   ├── prompts/
│   │   └── handler.ts        # Prompts protocol
│   ├── tools/
│   │   └── handler.ts        # Tools protocol
│   └── scripts/
│       └── bundle.ts         # Bundle generator
└── dist/                     # Compiled output
    ├── index.js              # Server entry point
    ├── bundle.json           # Production bundle (1.15 MB)
    └── ...
```

### Build Commands

```bash
# Install dependencies
pnpm install

# Build once
pnpm build

# Build with production bundle
pnpm build:bundle

# Watch mode (rebuild on changes)
pnpm dev

# Run server
pnpm start
```

The `build:bundle` command:
1. Compiles TypeScript (`tsc`)
2. Generates `dist/bundle.json` from plugin files
3. Bundle includes all skills, commands, and agents
4. Required for production mode

### Adding Skills

Skills are automatically discovered from `{AXIOM_DEV_PATH}/skills/*.md`.

To add MCP metadata to a skill, add an `mcp:` block to the frontmatter:

```yaml
---
name: my-skill
description: Use when...
# MCP annotations (ignored by Claude Code)
mcp:
  category: debugging
  tags: [xcode, swift, performance]
  related: [other-skill, another-skill]
---
```

Changes are picked up automatically in development mode.

## Testing

### Manual Testing (Development Mode)

```bash
# Terminal 1: Start server
AXIOM_MCP_MODE=development \
AXIOM_DEV_PATH=../plugins/axiom \
AXIOM_LOG_LEVEL=debug \
node dist/index.js

# Terminal 2: Send MCP requests via stdin
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list"}' | node dist/index.js
```

### Testing with MCP Inspector

Install the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens a web UI for testing MCP protocol interactions.

### Testing Claude Code Integration

```bash
# Reload plugin (triggers .mcp.json)
claude-code plugin reload axiom

# Check MCP server logs
# (Logs go to stderr, visible in plugin console)
```

## Troubleshooting

### Server won't start

**Check Node version:**
```bash
node --version
# Should be 18.0.0 or higher
```

**Check environment variables:**
```bash
echo $AXIOM_MCP_MODE
echo $AXIOM_DEV_PATH
```

**Verify plugin path exists:**
```bash
ls $AXIOM_DEV_PATH/skills
# Should show .md files
```

### Skills not appearing

**Check log output (stderr):**
```bash
AXIOM_LOG_LEVEL=debug node dist/index.js 2>&1 | grep -i skill
```

**Verify frontmatter parsing:**
```bash
# Test parser directly
node -e "
const matter = require('gray-matter');
const fs = require('fs');
const content = fs.readFileSync('$AXIOM_DEV_PATH/skills/xcode-debugging.md', 'utf-8');
console.log(matter(content).data);
"
```

### MCP client can't connect

**Check stdio transport:**
- MCP uses stdin/stdout for communication
- Make sure nothing else writes to stdout
- Logs must go to stderr only

**Verify command in client config:**
```bash
# Test command manually
node /full/path/to/dist/index.js
# Should start without errors, waiting for stdin
```

## Roadmap

### Phase 1: Foundation ✅
- MCP server with stdio transport
- Resources protocol (skills)
- Development mode loader
- Claude Code `.mcp.json` integration

### Phase 2: MCP Annotations ✅
- Add MCP metadata to test skills
- Enhanced skill categorization
- Cross-references between skills

### Phase 3: Full Primitives ✅
- Prompts protocol (commands)
- Tools protocol (agents)
- Complete MCP feature coverage

### Phase 4: Production Bundle ✅ (Current)
- Pre-compiled skill snapshot
- Production mode loader
- Bundle generator script
- Dual-mode Loader interface

### Phase 5: Full Coverage (Next)
- All 38 skills with MCP annotations
- All 10 commands with argument schemas
- All 10 agents with input schemas
- Multi-client testing

### Phase 6: Distribution
- npm publish (@axiom-dev/mcp)
- MCP Registry listing
- Documentation site integration
- Release automation

## Architecture

### Dual Distribution Model

**Bundled (Claude Code Plugin)**
```
User installs plugin → .mcp.json → MCP server (dev mode) → Live skills
```

**Standalone (Other Tools)**
```
User configures MCP → Server (prod mode) → Bundled skills
```

**Key Insight:** Same codebase, different entry points. Development mode for rapid iteration, production mode for distribution.

### Why MCP?

**Before:** Maintain platform-specific formats for Cursor, VS Code, Gemini CLI, etc.
**After:** One MCP server works everywhere.

**Maintenance:** O(platforms × skills) → O(skills)

## Contributing

See the main Axiom repository for contribution guidelines.

## License

MIT License - See LICENSE file in main repository
