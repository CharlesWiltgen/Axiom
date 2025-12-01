# Custom Commands

Custom commands are user-invoked tools that perform automated scans and checks. Type `/command-name` in Claude Code to run them.

## Available Commands

### Concurrency & Async
- **[`/audit-concurrency`](./concurrency/audit-concurrency)** – Comprehensive concurrency analysis (Swift 6 strict mode, @MainActor, Sendable, actor isolation)

### Debugging
- **[`/prescan-memory`](./debugging/prescan-memory)** – Quick memory leak triage (timers, observers, closures, delegates, PhotoKit)

---

## Usage

```bash
# Run a command
/audit-concurrency
/prescan-memory

# Commands accept arguments
/prescan-memory MyViewController.swift
```

Commands output results with `file:line` references and link to relevant skills for deeper analysis.
