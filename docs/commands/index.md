# Custom Commands

Custom commands are user-invoked tools that perform automated scans and checks. Type `/command-name` in Claude Code to run them.

## Available Commands

### Accessibility
- **[`/audit-accessibility`](./accessibility/audit-accessibility)** – Comprehensive accessibility audit (VoiceOver, Dynamic Type, color contrast, touch targets, WCAG compliance)

### Concurrency & Async
- **[`/audit-concurrency`](./concurrency/audit-concurrency)** – Comprehensive concurrency analysis (Swift 6 strict mode, @MainActor, Sendable, actor isolation)

### Debugging
- **[`/prescan-memory`](./debugging/prescan-memory)** – Quick memory leak triage (timers, observers, closures, delegates, PhotoKit)

### UI & Design
- **[`/audit-liquid-glass`](./ui-design/audit-liquid-glass)** – Liquid Glass adoption opportunities (iOS 26+): glass effects, toolbar improvements, search patterns, migration from old blur effects

## Usage

```bash
# Run a command
/audit-accessibility
/audit-concurrency
/audit-liquid-glass
/prescan-memory

# Commands accept arguments
/prescan-memory MyViewController.swift
```

Commands output results with `file:line` references and link to relevant skills for deeper analysis.
