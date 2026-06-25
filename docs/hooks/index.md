# Hooks

Axiom ships **event-driven hooks** — small scripts that fire automatically at points in a coding session to inject context, route you to the right skill, and catch a few high-value Swift mistakes as code is written. They work across **Claude Code, Codex, and Pi**, with some differences per harness (see the matrix below).

## What Are Hooks

Unlike skills (which Claude reads when relevant) and commands (which you invoke explicitly), hooks run on their own in response to events:

- **Session start** – inject iOS/Xcode version ground-truth and check the environment
- **Your prompt** – route the request to the right Axiom skill
- **After a command** – suggest a skill based on error output
- **After a file edit** – flag risky Swift patterns
- **Before reading a crash file** – route it to the `xcsym` symbolicator
- **Subagent start** – give spawned agents the same Axiom awareness

A hook returns JSON that either *injects context* (advisory) or *blocks an action* (forces a fix). See [Hook Outputs](#hook-outputs).

## Harness Support

The same intent runs on each harness, but the surface differs — Codex has no `Read` tool (so no crash-file routing) and no per-prompt routing hook in the same form, and Pi's tool hooks are **advisory only** (Pi appends to a tool result; it can't block it).

| Hook (event) | Claude Code | Codex | Pi |
|---|:---:|:---:|:---:|
| Skill routing (per prompt) | ✓ | ✓ | session-context instead |
| Session ground-truth + environment | ✓ | ✓ | ✓ |
| Subagent skill injection | ✓ | ✓ | — |
| Bash error → skill hint | ✓ | ✓ | ✓ |
| Crash-file → `xcsym` routing | ✓ | — (no `Read` tool) | ✓ |
| Swift guardrails (`@State`, `@Relationship`) | ✓ block + warn | ✓ block + warn | ✓ advisory |
| **Enablement** | automatic | install + `features.hooks = true` | the `axiom-pi` extension |

- **Claude Code** – bundled in the plugin; nothing to enable.
- **Codex** – install the plugin (`codex plugin marketplace add CharlesWiltgen/Axiom` → `codex plugin add axiom@axiom-marketplace`) and set `features.hooks = true`. See the [Codex guide](/start/codex-install).
- **Pi** – delivered by the `axiom-pi` extension (`pi install git:github.com/CharlesWiltgen/Axiom`). See the [Pi guide](/start/pi-install).

## The Hooks

### Skill routing

**Event** – on each user prompt (Claude Code, Codex)

Analyzes your message for iOS-related intent and injects a specific skill recommendation before the model responds — the primary mechanism that makes Axiom skills fire automatically. A negative gate avoids false positives on non-Apple work (TypeScript, React, Python, etc.).

```
You type: "My SwiftUI view isn't updating when the data changes"
Hook injects: "Axiom: this matches axiom-swiftui. Invoke it before responding."
```

On Pi there is no per-prompt hook; Axiom instead injects a compact skill menu into the session context at start.

### Session ground-truth + environment

**Event** – session start (all harnesses)

Injects the current iOS/Xcode version ground-truth (so the model never insists a newer OS "doesn't exist") and surfaces environment issues — zombie `xcodebuild` processes, oversized Derived Data, whether Xcode and the `xclog`/`xcsym` tools are available.

### Subagent skill injection

**Event** – subagent start (Claude Code, Codex)

Gives a spawned subagent the same compact Axiom skill menu, so it inherits Axiom's expertise instead of starting blind. Skips non-iOS agent types (beads, plugin-dev, etc.) to avoid wasting context.

### Bash error → skill hint

**Event** – after a Bash command (all harnesses)

Scans command output for iOS-specific error signatures and suggests the matching skill:

| Error signature | Suggested skill |
|---|---|
| Auto Layout constraint conflict | `axiom-uikit` |
| Actor-isolated / Sendable / data race | `axiom-concurrency` |
| no such column / FOREIGN KEY / migration | `axiom-data` |
| retain cycle / memory leak | `axiom-performance` |
| CKError / CKRecord | `axiom-data` |
| module not found / linker failed | `/axiom:fix-build` |

### Crash-file routing

**Event** – before a `Read` of an `.ips`, legacy `.crash`, or `.xccrashpoint` file (Claude Code, Pi)

Advises running `xcsym crash --format=summary <path>` first — it symbolicates against local dSYMs and tags the crash pattern — so the model analyzes structured output instead of a raw, unsymbolicated file. Not available on Codex, which has no `Read` tool to intercept.

### Swift guardrails

**Event** – after a Write/Edit of a `.swift` file (all harnesses)

Catches two latent bug classes the compiler can't:

- **`@State` without an access level** – *blocked* on Claude Code and Codex (advisory on Pi). Without an explicit level (usually `private`), child views can create independent copies of the state — a silent data-flow bug. Fix: `@State private var`.
- **SwiftData to-many `@Relationship` without a default** – *advisory* on all harnesses. A to-many array relationship with no `= []` compiles clean but crashes at runtime when SwiftData reads it. Fix: add `= []`. (Shipped as a warning rather than a hard block while its precision is proven in the wild.)

Add a trailing `// axiom-ignore` to silence either check on a specific line. These hooks do **not** reformat your code — format-on-save was removed because a silent reformat desyncs the file from the model's in-memory view and breaks its follow-up edits; run `swiftformat` yourself or in your own tooling.

## Hook Outputs

A hook returns JSON that controls what happens next:

| Output | Effect |
|---|---|
| `hookSpecificOutput.additionalContext` | Injects advisory text into the model's context (routing, hints, the `@Relationship` warning) |
| `decision: "block"` | Stops the action and makes the model fix it first (the `@State` guardrail on Claude Code/Codex) |
| `reason` | The explanation shown when an action is blocked |

A block is reserved for clear-cut rules with a trivial, unambiguous fix. Everything else is advisory, so the model weighs it without being forced — the safer default for an agent whose trust keeps the hooks enabled.

## Disabling

- **Claude Code** – remove entries from `plugins/axiom/hooks/hooks.json`, or drop the `"hooks"` field from the plugin manifest.
- **Codex** – set `features.hooks = false` (or omit it) in `~/.codex/config.toml`.
- **Pi** – disable or uninstall the `axiom-pi` extension.
