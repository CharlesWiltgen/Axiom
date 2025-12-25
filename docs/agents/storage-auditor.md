# storage-auditor

Automatically scans for file storage mistakes: files in wrong locations, missing backup exclusions, missing file protection, and storage anti-patterns that cause data loss and backup bloat.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my file storage usage"
- "Audit my app for storage issues"
- "My app backup is too large"
- "Users are reporting lost data"
- "Review my file management code"

**Explicit command:**
```bash
/axiom:audit-storage
```

## What It Checks

1. **Files in tmp/ Directory** (CRITICAL) — Anything in NSTemporaryDirectory() that isn't truly temporary → iOS purges tmp/, users lose data
2. **Large Files Missing isExcludedFromBackup** (HIGH) — Files >1MB in Documents/ without backup exclusion → wastes user's iCloud quota
3. **Missing File Protection** (MEDIUM) — File writes without FileProtectionType → sensitive data not encrypted at rest
4. **Wrong Storage Location** (HIGH) — User content in Application Support/, re-downloadable content in Documents/, app data in tmp/
5. **UserDefaults Abuse** (MEDIUM) — Storing >1MB data in UserDefaults → performance degradation

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: blue
- **Scan Time**: <2 seconds

## Related Skills

- **storage** — Storage decision framework (where to store what)
- **storage-diag** — Debugging missing files and data loss
- **file-protection-ref** — FileProtectionType and encryption details
- **storage-management-ref** — Purging policies and URL resource values
