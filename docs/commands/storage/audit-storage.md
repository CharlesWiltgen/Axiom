---
name: audit-storage
description: Comprehensive file storage audit — detects files in wrong locations, missing backup exclusions, missing file protection, and storage anti-patterns with file:line references and risk severity ratings
allowed-tools: Glob(*.swift), Grep(*)
---

# File Storage Audit

I'll perform a comprehensive file storage audit of your iOS/macOS codebase, checking for the most critical issues that cause data loss, backup bloat, and file access errors.

## What I'll Check

### 1. Files in tmp/ Directory (CRITICAL)
**Pattern**: File writes to `NSTemporaryDirectory()` or `tmp/` that aren't truly temporary
**Impact**: iOS aggressively purges tmp/ - users lose data
**Risk**: Data loss after device restart or storage pressure

### 2. Large Files Missing isExcludedFromBackup (HIGH)
**Pattern**: Files >1MB in Documents/ or Application Support/ without `isExcludedFromBackup`
**Impact**: User's iCloud quota filled unnecessarily
**Risk**: Backup bloat, iCloud storage pressure

### 3. Missing File Protection (MEDIUM)
**Pattern**: File writes without specifying `FileProtectionType`
**Impact**: Sensitive data not encrypted at rest
**Risk**: Security vulnerability, unauthorized data access

### 4. Wrong Storage Location (HIGH)
**Pattern**: Files stored in inappropriate directories
**Examples**:
- User content in Application Support/ (not visible in Files app)
- Re-downloadable content in Documents/ (backup bloat)
- App data in tmp/ (data loss)
**Impact**: User confusion, data loss, backup bloat

### 5. UserDefaults Abuse (MEDIUM)
**Pattern**: Storing >1MB data in UserDefaults
**Impact**: Performance degradation on app launch
**Risk**: Not designed for large data storage

## Audit Process

1. **Glob** for all Swift files: `**/*.swift`
2. **Search** for storage anti-patterns using regex
3. **Report** findings with:
   - `file:line` references
   - Severity: CRITICAL/HIGH/MEDIUM/LOW
   - Risk description
   - Fix recommendation
   - Link to `axiom:storage` skill for decision framework

## Output Format

```
=== FILE STORAGE AUDIT RESULTS ===

CRITICAL Issues (Data Loss Risk):
- src/Managers/DownloadManager.swift:45 - Writing to tmp/
  Risk: iOS purges tmp/ aggressively - downloads will be lost
  Fix: Move to Caches/ with isExcludedFromBackup:
    let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try downloadURL.setResourceValues(resourceValues)

HIGH Issues (Backup Bloat / Wrong Location):
- src/Cache/ImageCache.swift:67 - Large files in Documents/ without backup exclusion
  Impact: 500MB backed to iCloud (wastes user quota)
  Fix: Either move to Caches/ OR set isExcludedFromBackup

MEDIUM Issues (Security / Performance):
- src/Services/AuthManager.swift:34 - Writing token without file protection
  Risk: Sensitive data not encrypted at rest
  Fix: try tokenData.write(to: tokenURL, options: .completeFileProtection)

=== NEXT STEPS ===

For storage decision framework:
  /skill axiom:storage

For debugging missing files:
  /skill axiom:storage-diag

Storage Summary:
- CRITICAL Issues: 1 (immediate data loss risk)
- HIGH Issues: 2 (backup bloat, wrong location)
- MEDIUM Issues: 1 (security risk)
```

## Detection Patterns

### Files in tmp/
```swift
// BAD - Data loss risk
let tmpURL = FileManager.default.temporaryDirectory
try data.write(to: tmpURL.appendingPathComponent("download.pdf"))

// GOOD - Survives reboot
let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
let downloadURL = cacheURL.appendingPathComponent("download.pdf")
try data.write(to: downloadURL)
var resourceValues = URLResourceValues()
resourceValues.isExcludedFromBackup = true
try downloadURL.setResourceValues(resourceValues)
```

### Missing Backup Exclusion
```swift
// BAD - Backs up re-downloadable content
let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
try largeImage.write(to: documentsURL.appendingPathComponent("cached.jpg"))

// GOOD - Excluded from backup
var resourceValues = URLResourceValues()
resourceValues.isExcludedFromBackup = true
try imageURL.setResourceValues(resourceValues)
```

### Missing File Protection
```swift
// BAD - No encryption
try tokenData.write(to: tokenURL)

// GOOD - Encrypted at rest
try tokenData.write(to: tokenURL, options: .completeFileProtection)
```

### Wrong Location
```swift
// BAD - User docs in hidden location
let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
try userDocument.write(to: appSupportURL.appendingPathComponent("report.pdf"))

// GOOD - User-visible in Files app
let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
try userDocument.write(to: documentsURL.appendingPathComponent("report.pdf"))
```

### UserDefaults Abuse
```swift
// BAD - Large data in UserDefaults
UserDefaults.standard.set(largeData, forKey: "cache") // 2MB+

// GOOD - Use file storage
let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
let cacheURL = appSupportURL.appendingPathComponent("cache.json")
try largeData.write(to: cacheURL)
```

## Search Queries I'll Run

1. **tmp/ Usage**: `Grep "NSTemporaryDirectory|temporaryDirectory|/tmp/"`
2. **Backup Exclusion**: `Grep "\.write\(to:|Data\(contentsOf:" -A 5` (check for `isExcludedFromBackup`)
3. **File Protection**: `Grep "\.write\(to:|createFile" -A 5` (check for `.completeFileProtection`)
4. **UserDefaults Size**: `Grep "UserDefaults.*set.*Data\(|UserDefaults.*set.*\["`
5. **Wrong Locations**: `Grep "/Documents/|/Library/|/tmp/"` (hardcoded paths)

## Storage Location Decision Tree

```
What are you storing?

User-created documents (PDF, images, text)?
  → Documents/ (user-visible in Files app, backed up)

App data (settings, cache, state)?
  ├─ Can regenerate/re-download? → Caches/ + isExcludedFromBackup
  └─ Can't regenerate? → Application Support/ (backed up, hidden)

Truly temporary (<1 hour lifetime)?
  → tmp/ (aggressive purging)
```

## Limitations

- **Cannot detect**: Runtime file sizes, actual backup size, runtime storage pressure
- **False positives**: Truly temporary files in tmp/ (deleted within minutes)
- **Test with low storage** scenarios after fixes

## Post-Audit

After fixing issues:
1. Test file persistence after device reboot
2. Test storage pressure (fill device to <500MB free)
3. Check backup size: Settings → [Profile] → iCloud → Manage Storage → [App]
4. Verify file locations with Files app

For comprehensive storage guidance:
- `/skill axiom:storage` — Storage decision framework
- `/skill axiom:file-protection-ref` — Encryption details
- `/skill axiom:storage-management-ref` — Purging policies
