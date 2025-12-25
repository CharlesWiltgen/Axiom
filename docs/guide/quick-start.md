# Quick Start

## 1. Add the Marketplace

In Claude Code, run:

```
/plugin marketplace add CharlesWiltgen/Axiom
```

## 2. Install the Plugin

Once you've added the marketplace in Claude Code:

1. Use `/plugin` to open the plugin menu
2. Search for "axiom"
3. Click "Install"

## 3. Verify Installation

Use `/plugin` and select "Manage and install" to see installed plugins. Axiom should be listed.

## 4. Use Skills

Skills are **automatically suggested by Claude Code** based on your questions and context. Simply ask questions that match the skill's purpose:

### Examples
- "I'm getting BUILD FAILED in Xcode with stale builds" → activates `xcode-debugging`
- "How do I fix actor isolation errors in Swift 6?" → activates `swift-concurrency`
- "I need to add a column to my database safely" → activates `database-migration`
- "My app has memory leaks, where should I look?" → activates `memory-debugging`

Skills available in Axiom:
- **Apple Intelligence**: foundation-models, foundation-models-diag, foundation-models-ref, app-intents-ref, swiftui-26-ref
- **UI & Design**: hig, hig-ref, liquid-glass, liquid-glass-ref, swiftui-performance, ui-testing, swiftui-debugging
- **Debugging**: xcode-debugging, memory-debugging, build-debugging, performance-profiling
- **Concurrency**: swift-concurrency
- **Data & Persistence**: database-migration, sqlitedata, grdb, swiftdata, realm-migration-ref, core-data-diag
- **Accessibility**: accessibility-diag
- **Networking**: networking, networking-diag, network-framework-ref
- **Legacy**: objc-block-retain-cycles, uikit-animation-debugging

## Troubleshooting

### Plugin Not Showing in Claude Code

If Axiom doesn't appear after installation:

1. **Verify installation**: Run `/plugin` and check "Manage and install" list
2. **Reload Claude Code**: Restart the application
3. **Check marketplace**: Ensure you added the correct marketplace: `CharlesWiltgen/Axiom`

### Skills Not Being Suggested

If Claude Code isn't suggesting Axiom skills:

1. **Be specific**: Use keywords from skill descriptions (e.g., "BUILD FAILED", "actor isolation", "memory leak")
2. **Manual invocation**: Type `/skill axiom:` to see available skills
3. **Check context**: Skills are suggested based on your question and code context

### Skills Not Found

If you get "skill not found" errors:

1. **Use correct syntax**: `/skill axiom:skill-name` (not `/axiom:skill-name`)
2. **Check spelling**: Skill names use dashes (e.g., `swift-concurrency`, not `swift_concurrency`)
3. **List available skills**: Use `/plugin` to see which skills are installed

### Commands Not Working

If `/audit-*` commands don't execute:

1. **Verify command syntax**: Commands start with `/audit-` or `/axiom:`
2. **Check file access**: Ensure Claude Code has access to your project files
3. **Run manually**: Try using the command via `/command` menu

### Getting Help

- **Issues**: [Report bugs on GitHub](https://github.com/CharlesWiltgen/Axiom/issues)
- **Discussions**: [Ask questions and share patterns](https://github.com/CharlesWiltgen/Axiom/discussions)
- **Claude Code docs**: [Official documentation](https://docs.claude.ai/code)

## What's Next?

- [Example Workflows →](/guide/workflows)
- [View all skills →](/skills/)
- [Contributing guide →](https://github.com/CharlesWiltgen/Axiom/blob/main/CONTRIBUTING.md)
