# storage-auditor

Scans for file storage mistakes and architectural gaps — both known anti-patterns like persistent data in `tmp/`, missing backup exclusions, and large UserDefaults payloads, and architectural issues like sensitive data on disk instead of Keychain, missing App Group containers for extensions, unbounded cache growth, and orphan files left behind when entities are deleted.

## What It Does

- Detects 5 known anti-patterns (persistent data in `tmp/`, large files in backed-up directories without `isExcludedFromBackup`, missing `FileProtectionType` on writes, wrong location for content type, large data in UserDefaults)
- Identifies architectural gaps (auth tokens stored in files instead of Keychain, missing App Group containers when extensions need shared access, no eviction policy for unbounded `Caches/` growth, missing cleanup of associated files when entities are deleted, no fallback for low-storage events, file-protection levels misaligned with data sensitivity, missing migration path when storage layout changes between versions)
- Correlates findings that compound into higher severity (user data in `tmp/`, sensitive data + missing protection, wrong location + extension dependency, large UserDefaults + frequent updates)
- Produces a Storage Health Score (SAFE / FRAGILE / DANGEROUS)

## How to Use

**Natural language:**
- "Check my file storage usage"
- "Audit my app for storage issues"
- "My app backup is too large"
- "Users are reporting lost data"
- "Review my file management code"

**Explicit command:**
```bash
/axiom:audit storage
```

## Related

- **storage** skill — storage decision framework for choosing where to store what
- **storage-diag** skill — debugging missing files and data loss
- **file-protection-ref** skill — FileProtectionType and encryption details
- **storage-management-ref** skill — purging policies and URL resource values
- **icloud-auditor** agent — overlaps on iCloud Drive containers and file coordination
- **swiftdata-auditor** agent — overlaps on `@Attribute(.externalStorage)` blob cleanup
- **security-privacy-scanner** agent — overlaps on sensitive data placement (tokens, credentials)
- **database-schema-auditor** agent — overlaps on `.sqlite` file location and protection
- **health-check** agent — includes storage-auditor in project-wide scans
