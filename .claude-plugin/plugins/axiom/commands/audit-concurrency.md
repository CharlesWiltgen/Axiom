---
name: audit-concurrency
description: Scan for Swift 6 concurrency violations (launches concurrency-validator agent)
---

# Swift Concurrency Audit

Launches the **concurrency-validator** agent to scan for Swift 6 strict concurrency violations and data race risks.

## What It Checks

- Missing @MainActor on UI classes
- Unsafe Task captures without [weak self]
- Sendable violations
- Actor isolation problems
- Thread confinement violations

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my code for Swift 6 concurrency issues"
- "Review my async code for concurrency safety"
- "Scan for data race violations"
