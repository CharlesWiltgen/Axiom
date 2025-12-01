# Custom Commands

Custom commands are **user-invoked** tools (type `/command-name`) that perform quick automated scans and setup tasks. They complement skills by giving you a roadmap before diving into deep skill work.

## Overview

Commands are different from skills:
- **Skills** are model-suggested based on context (automatic)
- **Commands** are user-invoked when you need them (explicit)

## Naming Convention

Commands follow semantic prefixes that communicate their intensity and purpose:

| Prefix | Purpose | Speed | Use When |
|--------|---------|-------|----------|
| `/prescan-*` | Quick heuristic scan | 30-60s | Fast triage before deep debugging |
| `/audit-*` | Comprehensive analysis | 2-5min | Thorough review of entire codebase |
| `/check-*` | Configuration validation | 10-30s | Verify environment setup |
| `/validate-*` | Schema/model validation | 30-90s | Check data model correctness |
| `/generate-*` | Code scaffolding | Instant | Create boilerplate code |

**Two-tier workflow example:**
1. `/prescan-memory` → Quick 30s scan finds 3 timer leaks
2. Fix critical issues
3. `/audit-memory` → Comprehensive 3min analysis (future command)
4. Use `memory-debugging` skill for Instruments workflows

---

## Available Commands

Commands are organized by category to match your workflow:

### ⚡ Concurrency & Async
- **[`/audit-concurrency`](./concurrency/audit-concurrency)** – Comprehensive concurrency analysis (Swift 6 strict mode, @MainActor, Sendable, actor isolation)

### 🐛 Debugging
- **[`/prescan-memory`](./debugging/prescan-memory)** – Quick memory leak triage (timers, observers, closures, delegates, PhotoKit)

---

## Quick Reference

```bash
# Comprehensive analysis (audit)
/audit-concurrency              # Full concurrency scan (2-5 min)

# Quick triage (prescan)
/prescan-memory                 # Fast memory leak detection (30-60s)

# Commands accept arguments
/prescan-memory MyViewController.swift
```

**Command workflow:**
1. Run quick `/prescan-*` for fast triage
2. Fix high-priority issues
3. Run comprehensive `/audit-*` when needed
4. Use skills for deep debugging with Instruments

All commands output results with `file:line` references and link to relevant skills.
