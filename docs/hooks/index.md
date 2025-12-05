# Automatic Hooks

Axiom includes **4 event-driven hooks** that automatically enhance your workflow by responding to specific events in Claude Code.

## What Are Hooks?

Hooks are automatic triggers that:
- Run at specific events (session start, before/after tool use)
- Provide proactive warnings and suggestions
- Automate repetitive tasks
- Enhance code quality without manual intervention

## Available Hooks

### 1. Build Failure Auto-Trigger

**Event**: PostToolUse on Bash
**Trigger**: When `xcodebuild` or `swift build` fails with non-zero exit

Automatically suggests running `/axiom:fix-build` for environment-first diagnostics.

**Example**:
```bash
# You run a build that fails
xcodebuild build

# Hook automatically suggests:
# "Build failed. Run /axiom:fix-build for automatic diagnostics?"
```

**Value**: Zero-friction entry to build diagnostics when you need it most.

---

### 2. Session Environment Check

**Event**: SessionStart
**Trigger**: Every time a Claude Code session starts

Checks for common environment issues:
- **Zombie xcodebuild processes** (warns if >5 running)
- **Large Derived Data** (warns if >10GB)

**Example output** (only shown if issues detected):
```
Axiom Environment Check:
⚠️ 12 xcodebuild processes running (consider: killall xcodebuild)
⚠️ Derived Data is 15.3GB (consider cleaning)
```

**Value**: Catch environment issues before they waste your time.

---

### 3. Core Data Model Protection

**Event**: PreToolUse on Edit/Write
**Trigger**: When editing `.xcdatamodeld` files

Warns about migration planning risks and suggests running `/axiom:audit-core-data` after changes.

**Example**:
```swift
// You start editing MyModel.xcdatamodeld

// Hook adds context:
// "Warning: Core Data model changes require migration planning.
//  Run /axiom:audit-core-data after changes to verify safety."
```

**Value**: Prevent accidental schema changes that cause production crashes.

---

### 4. Swift Auto-Format

**Event**: PostToolUse on Write/Edit
**Trigger**: After modifying `.swift` files

Automatically runs `swiftformat` to ensure consistent code style.

**Requirements**: [swiftformat](https://github.com/nicklockwood/SwiftFormat) must be installed:
```bash
brew install swiftformat
```

**Example**:
```swift
// You write or edit a Swift file
// Hook automatically formats it with swiftformat

// If swiftformat not installed:
// "⚠️ Axiom: swiftformat not found. Install with: brew install swiftformat"
```

**Value**: Consistent code style without manual formatting.

---

## How Hooks Work

Hooks are defined in `plugins/axiom/hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matcher": "Bash",
      "hook": {
        "type": "prompt",
        "prompt": "If this bash command was xcodebuild/swift build and it failed..."
      }
    },
    {
      "event": "SessionStart",
      "hook": {
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/environment-check.sh"
      }
    }
  ]
}
```

### Hook Types

**Prompt Hooks** (`type: "prompt"`):
- Use LLM (Haiku) to analyze context
- Make intelligent decisions
- Add contextual warnings or suggestions

**Command Hooks** (`type: "command"`):
- Execute bash scripts
- Fast, deterministic behavior
- Direct system interaction

---

## Disabling Hooks

If you want to disable specific hooks, you can modify `plugins/axiom/hooks/hooks.json` and remove or comment out entries.

Alternatively, you can disable all Axiom hooks by removing the `"hooks"` field from `plugins/axiom/claude-code.json`.

---

## Future Hooks

Potential future hooks based on community feedback:
- Pre-commit git safety checks
- Automatic test running on code changes
- Performance profiling suggestions
- Accessibility audit reminders

[Let us know](https://github.com/CharlesWiltgen/Axiom/issues) what hooks would be valuable for your workflow!
