---
name: audit-storage
description: Scan for file storage issues (launches storage-auditor agent)
---

# File Storage Audit

Launches the **storage-auditor** agent to scan for files in wrong locations, missing backup exclusions, missing file protection, and storage anti-patterns.

## What It Checks

- Files written to tmp/ (data loss risk)
- Large files missing isExcludedFromBackup (backup bloat)
- Missing FileProtectionType (security risk)
- Files in wrong storage location
- UserDefaults storing >1MB data

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my file storage usage"
- "Audit my app for storage issues"
- "My app backup is too large"
- "Review my file management code"
