---
name: getting-started
description: Interactive onboarding that recommends skills based on your project
---

# Getting Started with Axiom

Welcome to Axiom! This guide helps you find the right skills for your iOS development needs.

## How Axiom Works

Axiom provides skills, agents, and commands that enhance Claude's iOS development capabilities:

- **Skills** — Domain knowledge Claude uses to help you (68 skills)
- **Agents** — Autonomous tools that scan and analyze code (18 agents)
- **Commands** — Explicit actions you can invoke (20 commands)

**You don't need to memorize anything.** Just describe your problem — Claude will use the right skill automatically.

## Updating Axiom

To update Axiom, use `/plugin marketplace update axiom-marketplace`, then restart Claude Code to activate.

Or, enable auto-updates for `axiom-marketplace` and restart Claude Code twice — once to check for and download updates (which takes several seconds), and again to activate.

## Quick Start

### Debugging Something?

Tell Claude what's happening:
- "My build is failing with [error]" → Claude uses xcode-debugging
- "My app has a memory leak" → Claude uses memory-debugging
- "SwiftUI view isn't updating" → Claude uses swiftui-debugging

### Building Something New?

Ask about the feature:
- "How do I implement Liquid Glass?" → Claude uses liquid-glass
- "Help me add deep linking" → Claude uses swiftui-nav
- "I need to add in-app purchases" → Claude uses in-app-purchases

### Want a Code Review?

Run audit commands:
```bash
/axiom:audit              # Smart mode — suggests relevant audits
/axiom:audit concurrency  # Check Swift 6 violations
/axiom:audit memory       # Find leak patterns
/axiom:audit accessibility # WCAG compliance check
```

## Finding Skills by Category

### Debugging & Performance
- **xcode-debugging** — BUILD FAILED, simulator issues, environment diagnostics
- **memory-debugging** — Memory growth, retain cycles, leak detection
- **swiftui-debugging** — View update issues, preview crashes
- **performance-profiling** — Instruments decision trees

### UI & Design
- **liquid-glass** — iOS 26 material design system
- **swiftui-nav** — NavigationStack, deep linking, state restoration
- **hig** — Human Interface Guidelines quick decisions

### Data & Persistence
- **swiftdata** — @Model, @Query, CloudKit integration
- **database-migration** — Safe schema evolution

### Concurrency
- **swift-concurrency** — Swift 6 strict concurrency, @MainActor, Sendable

### Networking
- **networking** — Network.framework patterns, URLSession

## Skill Naming

- **No suffix** — Discipline skills with workflows (e.g., `axiom-liquid-glass`)
- **-diag suffix** — Diagnostic skills for troubleshooting (e.g., `axiom-swiftui-nav-diag`)
- **-ref suffix** — Reference skills with comprehensive APIs (e.g., `axiom-storekit-ref`)

## Tips

1. **Just describe your problem** — Claude will suggest the right skill
2. **Run audits first** — Quick wins with automated scanning
3. **Use diagnostic skills** — When troubleshooting specific issues
4. **Check reference skills** — When implementing new features

## Example Prompts

Try these to see skills in action:

- "I'm getting a retain cycle warning in Xcode"
- "How do I handle SwiftData migration?"
- "My app drains battery quickly"
- "Help me implement zoom transitions"
- "Review my code for Swift 6 concurrency issues"

## Related

- [/axiom:audit](/commands/utility/audit) — Smart audit command
- [/axiom:status](/commands/utility/status) — Project environment health
