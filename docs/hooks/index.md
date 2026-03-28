# Automatic Hooks

Axiom includes **6 event-driven hooks** that automatically enhance your workflow by responding to specific events in Claude Code.

## What Are Hooks?

Hooks are automatic triggers that:
- Run at specific events (session start, user prompt, before/after tool use, subagent spawn)
- Provide proactive warnings and suggestions
- Route you to the right Axiom skill automatically
- Automate repetitive tasks like code formatting

## Available Hooks

### 1. Skill Routing (v2.37.0)

**Event**: UserPromptSubmit
**Trigger**: Every user message

Analyzes your prompt for iOS-related keywords and injects a specific skill recommendation before Claude responds. This is the primary mechanism that makes Axiom skills fire automatically.

**Example**:
```
You type: "My SwiftUI view is not updating when the data changes"

Hook injects: "Axiom: This prompt matches `axiom-ios-ui`. Invoke it before responding."
```

Covers 13 iOS domains: build, UI, data, concurrency, performance, networking, testing, integration, accessibility, AI, ML, vision, games, graphics, and shipping. Includes a negative gate to avoid false positives on non-iOS work (TypeScript, React, Python, etc.).

---

### 2. Session Environment Check

**Event**: SessionStart
**Trigger**: Every time a Claude Code session starts

Injects the Axiom discipline skill (`using-axiom`) into the conversation and checks for common environment issues:
- **Zombie xcodebuild processes** (warns if >5 running)
- **Large Derived Data** (warns if >10GB)
- **Xcode detection** (loads Apple for-LLM documentation if available)
- **xclog availability** (console capture tool)

---

### 3. Subagent Skill Injection (v2.37.0)

**Event**: SubagentStart
**Trigger**: When Claude spawns a subagent

Injects a compact Axiom skill menu into subagents so they can access Axiom's expertise. Without this, subagents don't inherit the session-start context and wouldn't know about Axiom skills.

Skips non-iOS agent types (beads, plugin-dev, etc.) to avoid wasting context.

---

### 4. Error Pattern Detection

**Event**: PostToolUse on Bash
**Trigger**: After any Bash command runs

Scans command output for iOS-specific error patterns and suggests the right skill:

| Error Pattern | Suggested Skill |
|---------------|----------------|
| Auto Layout constraint conflicts | `auto-layout-debugging` |
| Actor-isolated / Sendable / data race | `swift-concurrency` |
| No such column / FOREIGN KEY / migration | `database-migration` |
| Retain cycle / memory leak | `memory-debugging` |
| CKError / CKRecord | `cloudkit-ref` or `cloud-sync-diag` |
| Module not found / linker failed | `/axiom:fix-build` |

---

### 5. Swift Guardrails

**Event**: PostToolUse on Write/Edit
**Trigger**: After modifying `.swift` files

Catches critical Swift issues as code is written:
- **`@State var` without access control** — blocks the edit and requires fixing. Without an explicit access level (usually `private`), child views can create independent copies of the state, causing silent bugs.

---

### 6. Swift Auto-Format

**Event**: PostToolUse on Write/Edit
**Trigger**: After modifying `.swift` files

Automatically runs `swiftformat` to ensure consistent code style.

**Requirements**: [swiftformat](https://github.com/nicklockwood/SwiftFormat) must be installed:
```bash
brew install swiftformat
```

---

## How Hooks Work

Hooks are defined in `plugins/axiom/hooks/hooks.json` and execute shell scripts or inline commands. All hooks are synchronous by default (they complete before Claude responds).

### Hook Types

**Command Hooks** (`type: "command"`):
- Execute bash scripts or inline shell commands
- Fast, deterministic behavior
- Can inject context, block actions, or auto-approve operations

### Hook Outputs

Hooks can return JSON to control Claude's behavior:

| Output Field | Effect |
|-------------|--------|
| `additionalContext` | Injects text into Claude's context (used by skill routing, subagent injection) |
| `decision: "block"` | Blocks the action and forces Claude to fix the issue (used by swift guardrails) |
| `reason` | Explanation shown when an action is blocked |

---

## Disabling Hooks

If you want to disable specific hooks, you can modify `plugins/axiom/hooks/hooks.json` and remove entries.

Alternatively, you can disable all Axiom hooks by removing the `"hooks"` field from `plugins/axiom/claude-code.json`.
