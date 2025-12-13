---
name: audit-icloud
description: Scan for iCloud integration issues (launches icloud-auditor agent)
---

# iCloud Integration Audit

Launches the **icloud-auditor** agent to scan for unsafe file coordination, missing CloudKit error handling, entitlement check issues, and iCloud anti-patterns.

## What It Checks

- Missing NSFileCoordinator on iCloud Drive files (data corruption risk)
- CloudKit operations without error handling
- Missing iCloud availability checks
- SwiftData + CloudKit anti-patterns
- Missing conflict resolution
- Legacy CloudKit APIs

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my iCloud integration"
- "Audit my CloudKit code"
- "My iCloud sync isn't working"
- "Review my file coordination code"
