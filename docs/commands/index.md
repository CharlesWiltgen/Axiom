# Custom Commands

Custom commands are **user-invoked** tools (type `/command-name`) that perform quick automated scans and setup tasks. They complement skills by giving you a roadmap before diving into deep skill work.

## Overview

Commands are different from skills:
- **Skills** are model-suggested based on context (automatic)
- **Commands** are user-invoked when you need them (explicit)

Commands are organized by category to match your workflow:

### ⚡ Concurrency & Async
- **[`/audit-concurrency`](./concurrency/audit-concurrency)** – Scan Swift code for concurrency issues before running the swift-concurrency skill

---

## Future Commands

Axiom has plans for more commands across other categories:

- **Persistence** – `/realm-readiness-check`, `/validate-cloudkit-schema`, `/generate-swiftdata-migration`
- **Debugging** – `/memory-leak-prescan`
- **Testing** – `/generate-ui-test-scaffold`
- **Release** – `/ios-release-checklist`

See [IDEAS.md](https://github.com/CharlesWiltgen/Axiom/blob/main/IDEAS.md) in the repository for the full roadmap.

---

## Quick Reference

```bash
# In Claude Code, invoke any command:
/audit-concurrency

# Commands can accept arguments:
/command-name argument1 argument2
```

Commands run in your current project context and output results with file:line references.
