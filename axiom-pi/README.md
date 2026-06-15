# axiom-pi

Axiom's commands and hooks for the [Pi coding agent](https://pi.dev/).

Axiom's iOS/Apple-platform expertise lives in **skills**, which Pi loads natively
(`npx skills add CharlesWiltgen/Axiom -a pi -g`). This extension adds the two
layers Pi can't get from skills alone:

- **`/axiom-*` commands** — the Axiom commands, ported to Pi. In Claude Code each
  launches a sub-agent; Pi has no sub-agents, so each command sends a
  natural-language prompt that triggers the matching skill inline.
- **Session and tool hooks** — the parts of Axiom's Claude Code hooks that are
  additive on Pi (skills cover the rest).

## What it adds

### Commands

`/axiom-fix-build`, `/axiom-audit <area>`, `/axiom-health-check`,
`/axiom-analyze-crash`, `/axiom-triage`, `/axiom-console`, `/axiom-ui`,
`/axiom-profile`, `/axiom-compare-traces`, `/axiom-optimize-build`,
`/axiom-run-tests`, `/axiom-test-simulator`, `/axiom-screenshot`,
`/axiom-status`, `/axiom-ask`.

`/axiom-audit` offers the audit areas (memory, concurrency, security, …) as
argument completions.

### Hooks

- **Session ground truth** (`before_agent_start`) — injects the iOS/Xcode
  version behavioral rules (so the agent never claims iOS 26 "doesn't exist")
  and lists which Axiom command-line tools (`xclog`, `xcsym`, `xcui`, `xcprof`)
  are on your `PATH`. Gated to Apple projects; override with
  `AXIOM_SESSION_CONTEXT=always|never`.
- **Swift write guardrail** (`tool_result`) — runs `swiftformat` on written
  `.swift` files (when installed) and flags `@State` declarations missing an
  explicit access level.
- **Crash-file routing** (`tool_result`) — when a `.ips`/`.crash`/`.xccrashpoint`
  file is read, suggests the right `xcsym` command.
- **Bash skill hints** (`tool_result`) — scans command output for known iOS
  error signatures and points at the matching skill.

## Install

The recommended install gets the skills **and** this extension in one command —
the repo's root `package.json` declares both via a `pi` manifest (`pi.skills` +
`pi.extensions`):

```bash
pi install git:github.com/CharlesWiltgen/Axiom
```

To work on just the extension from a local checkout, symlink it into Pi's
extensions directory instead:

```bash
ln -s "$(pwd)/axiom-pi" ~/.pi/agent/extensions/axiom-pi
```

Pi discovers extensions from `~/.pi/agent/extensions/` (global) and
`.pi/extensions/` (project), reading the entry point from each package's
`pi.extensions` field.

## Develop

```bash
npm install      # dev dependencies (Pi types, TypeScript, vitest)
npm run typecheck
npm test
```

The command table, session context, and guardrail logic are pure functions in
`src/{commands,session,guardrails}.ts` with colocated tests; `src/index.ts` is
the thin Pi wiring. Pi loads TypeScript directly — no build step.
