# Axiom Installation Guide

## Quick Start

### 1. Add the Marketplace

In Claude Code, run:

```
/plugin marketplace add https://charleswiltgen.github.io/Axiom/
```

### 2. Install the Plugin

Use `/plugin` to open the plugin menu, search for "axiom", and click Install.

### 3. Verify Installation

In Claude Code, use `/help` to see installed plugins:

```
/help
# You should see axiom's skills listed
```

## Skills Available

After installation, these skills are automatically available:

- `axiom:xcode-debugging` - Environment-first Xcode diagnostics
- `axiom:swift-concurrency` - Swift 6 concurrency patterns
- `axiom:database-migration` - Safe database schema evolution
- `axiom:memory-debugging` - Memory leak diagnosis
- `axiom:ui-testing` - Reliable XCTest patterns
- `axiom:build-troubleshooting` - Dependency resolution

## Using Skills

Skills are automatically suggested by Claude Code based on context, or you can invoke them manually:

```bash
# When you encounter a build error
/skill axiom:xcode-debugging

# When you see actor isolation errors
/skill axiom:swift-concurrency

# When adding database columns
/skill axiom:database-migration

# When debugging memory leaks
/skill axiom:memory-debugging

# When tests are flaky
/skill axiom:ui-testing

# When dependencies fail to resolve
/skill axiom:build-troubleshooting
```

## Testing the Installation

Try this example:

```bash
# In a Claude Code session:
# "I'm getting BUILD FAILED with no details in Xcode"

# Claude Code should automatically suggest axiom:xcode-debugging
# Or you can invoke it manually:
/skill axiom:xcode-debugging
```

## Documentation

- **Plugin README**: `plugins/axiom/README.md`
- **Skills Summary**: `SKILLS-SUMMARY.md`
- **VitePress Docs**: Run `npm run docs:dev` for full documentation site

## Troubleshooting

### Plugin not found
```bash
# Check plugin path is correct
ls -la /Users/you/Projects/Axiom/plugins/axiom/

# Should see claude-code.json and skills/ directory
```

### Skills not loading
```
# Restart Claude Code by closing and reopening it

# Or check in Claude Code with /help to see installed plugins
/help
```

### Need to update
```
# If you make changes to skills, restart Claude Code for changes to take effect
```

## Development Setup

If you want to modify skills or contribute:

```bash
# 1. Clone the repository
git clone https://github.com/CharlesWiltgen/Axiom.git
cd Axiom

# 2. Make changes to skill files
vim plugins/axiom/skills/xcode-debugging.md

# 3. Restart Claude Code to reload changes

# 4. Commit changes
git add plugins/axiom/skills/
git commit -m "Improve xcode-debugging skill"
git push
```

## Requirements

- **Claude Code**: 2.0.13 or later
- **Platform**: macOS 12+ (for iOS development)
- **Tools**: Xcode Command Line Tools, Python 3

## Support

For issues or questions:
- Check `SKILLS-SUMMARY.md` for detailed documentation
- Review individual skill files in `plugins/axiom/skills/`
- File issues on GitHub (when repository is published)

---

**Installation complete!** Start using skills by invoking them in Claude Code sessions.
