---
name: audit-core-data
description: Scan for Core Data safety violations (launches core-data-auditor agent)
---

# Core Data Safety Audit

Launches the **core-data-auditor** agent to scan for Core Data safety violations that cause production crashes and data loss.

## What It Checks

- Schema migration safety (missing lightweight migration options)
- Thread-confinement violations (NSManagedObject accessed from wrong threads)
- N+1 query patterns (relationship access in loops without prefetching)
- Production risk patterns (hard-coded store deletion, try! on migration)
- Performance issues (missing fetchBatchSize, no faulting controls)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my Core Data code for safety issues"
- "Review my code for Core Data migration risks"
- "Scan for thread-confinement violations"
