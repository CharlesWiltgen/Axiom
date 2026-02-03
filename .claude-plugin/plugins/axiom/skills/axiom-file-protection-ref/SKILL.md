---
name: axiom-file-protection-ref
description: Use when asking about 'FileProtectionType', 'file encryption iOS', 'NSFileProtection', 'data protection', 'secure file storage', 'encrypt files at rest', 'complete protection', 'file security' - comprehensive reference for iOS file encryption and data protection APIs
license: MIT
compatibility: iOS 4.0+, iPadOS 4.0+, macOS 10.0+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-12"
---

# iOS File Protection Reference

**Purpose**: Comprehensive reference for file encryption and data protection APIs
**Availability**: iOS 4.0+ (all protection levels), latest enhancements in iOS 26
**Context**: Built on iOS Data Protection architecture using hardware encryption

## When to Use This Skill

Use this skill when you need to:
- Protect sensitive user data at rest
- Choose appropriate FileProtectionType for files
- Understand when files are accessible/encrypted
- Debug "file not accessible" errors after device lock
- Implement secure file storage
- Compare Keychain vs file protection approaches
- Handle background file access requirements

## Overview

iOS Data Protection provides **hardware-accelerated file encryption** tied to the device passcode. When a user sets a passcode, every file can be encrypted with keys protected by that passcode.

**Key concepts**:
- Files are encrypted **automatically** when protection is enabled
- Encryption keys are derived from device hardware + user passcode
- Files become **inaccessible** when device is locked (depending on protection level)
- No performance cost (hardware AES encryption)

---

## Protection Levels Comparison

| Level | Encrypted Until | Accessible When | Use For | Background Access |
|-------|-----------------|-----------------|---------|-------------------|
| **complete** | Device unlocked | Only while unlocked | Sensitive data (health, finances) | ❌ No |
| **completeUnlessOpen** | File closed | After first unlock, while open | Large downloads, videos | ✅ If already open |
| **completeUntilFirstUserAuthentication** | First unlock after boot | After first unlock | Most app data | ✅ Yes |
| **none** | Never | Always | Public caches, temp files | ✅ Yes |

### Detailed Level Descriptions

#### .complete

**Full Description**:
> "The file is stored in an encrypted format on disk and cannot be read from or written to while the device is locked or booting."

**Use For**:
- User health data
- Financial information
- Password vaults
- Sensitive documents
- Personal photos (if app requires maximum security)

**Behavior**:
- Encrypted: ✅ Always
- Accessible: Only when device unlocked
- Background access: ❌ No (app can't read while locked)
- Available after boot: ❌ No (until user unlocks)

**Code Example**:

```swift
// ✅ CORRECT: Maximum security for sensitive data
func saveSensitiveData(_ data: Data, to url: URL) throws {
    try data.write(to: url, options: .completeFileProtection)
}

// Or set on existing file
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: url.path
)
```

**Tradeoffs**:
- ✅ Maximum security
- ❌ Can't access in background
- ❌ User sees errors if app tries to access while locked

#### .completeUnlessOpen

**Full Description**:
> "The file is stored in an encrypted format on disk after it is closed."

**Use For**:
- Large file downloads (continue in background)
- Video files being played
- Documents being edited
- Any file that needs background access while open

**Behavior**:
- Encrypted: ✅ When closed
- Accessible: After first unlock, remains accessible while open
- Background access: ✅ Yes (if file was already open)
- Available after boot: ❌ No (until first unlock)

**Code Example**:

```swift
// ✅ CORRECT: Download in background, but encrypted when closed
func startBackgroundDownload(url: URL, destination: URL) throws {
    try Data().write(to: destination, options: .completeFileProtectionUnlessOpen)

    // Open file handle for writing
    let fileHandle = try FileHandle(forWritingTo: destination)

    // Download continues in background
    // File remains accessible because it's open
    // When closed, file becomes encrypted

    // Later, when download complete:
    try fileHandle.close()  // Now encrypted until next unlock
}
```

**Tradeoffs**:
- ✅ Good security (encrypted when not in use)
- ✅ Background access (if already open)
- ⚠️ Vulnerable while open

#### .completeUntilFirstUserAuthentication

**Full Description**:
> "The file is stored in an encrypted format on disk and cannot be accessed until after the device has booted."

**Use For**:
- Most application data
- User preferences
- Downloaded content
- Database files
- Anything that needs background access

**Behavior**:
- Encrypted: ✅ Always
- Accessible: After first unlock following boot
- Background access: ✅ Yes (after first unlock)
- Available after boot: ❌ No (until user unlocks once)

**This is the recommended default for most files.**

**Code Example**:

```swift
// ✅ CORRECT: Balanced security for most app data
func saveAppData(_ data: Data, to url: URL) throws {
    try data.write(
        to: url,
        options: .completeFileProtectionUntilFirstUserAuthentication
    )
}

// ✅ This file can be accessed in background after first unlock
func backgroundTaskCanAccessFile() {
    // This works even if device is locked (after first unlock)
    let data = try? Data(contentsOf: url)
}
```

**Tradeoffs**:
- ✅ Protected during boot (device stolen while off)
- ✅ Background access (normal operation)
- ⚠️ Accessible while locked (less protection than .complete)

#### .none

**Full Description**:
> "The file has no special protections associated with it."

**Use For**:
- Public cache data
- Temporary files
- Non-sensitive downloads
- Thumbnails
- Only when absolutely necessary

**Behavior**:
- Encrypted: ❌ Never
- Accessible: ✅ Always
- Background access: ✅ Always
- Available after boot: ✅ Always

**Code Example**:

```swift
// ⚠️ USE SPARINGLY: Only for truly non-sensitive data
func cachePublicThumbnail(_ data: Data, to url: URL) throws {
    try data.write(to: url, options: .noFileProtection)
}
```

**Tradeoffs**:
- ✅ Always accessible
- ❌ No encryption
- ❌ Vulnerable if device is stolen

---

## Setting File Protection

### At File Creation

```swift
// ✅ RECOMMENDED: Set protection when writing
let sensitiveData = userData.jsonData()
try sensitiveData.write(
    to: fileURL,
    options: .completeFileProtection
)
```

### On Existing Files

```swift
// ✅ CORRECT: Change protection on existing file
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: fileURL.path
)
```

### Default Protection for Directory

```swift
// ✅ CORRECT: Set default protection for directory
// New files inherit this protection
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
    ofItemAtPath: directoryURL.path
)
```

### Checking Current Protection

```swift
// ✅ Check file's current protection level
func checkFileProtection(at url: URL) throws -> FileProtectionType? {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    return attributes[.protectionKey] as? FileProtectionType
}

// Usage
if let protection = try? checkFileProtection(at: fileURL) {
    switch protection {
    case .complete:
        print("Maximum protection")
    case .completeUntilFirstUserAuthentication:
        print("Standard protection")
    default:
        print("Other protection")
    }
}
```

---

## File Protection vs Keychain

### Decision Matrix

| Use Case | Recommended | Why |
|----------|-------------|-----|
| Passwords, tokens, keys | **Keychain** | Designed for small secrets |
| Small sensitive values (<few KB) | **Keychain** | More secure, encrypted separately |
| Files >1 KB | **File Protection** | Keychain not designed for large data |
| User documents | **File Protection** | Natural file-based storage |
| Structured secrets | **Keychain** | Query by key, access control |

### Code Comparison

```swift
// ✅ CORRECT: Small secrets in Keychain
let passwordData = password.data(using: .utf8)!
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "userPassword",
    kSecValueData as String: passwordData,
    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
]
SecItemAdd(query as CFDictionary, nil)

// ✅ CORRECT: Files with file protection
let userData = try JSONEncoder().encode(user)
try userData.write(to: fileURL, options: .completeFileProtection)
```

**Keychain advantages**:
- More granular access control (Face ID/Touch ID)
- Separate encryption (not tied to file system)
- Survives app deletion (if configured)

**File protection advantages**:
- Works with existing file operations
- Handles large data efficiently
- Automatic with minimal code

---

## Background Access Considerations

### iOS Background Modes and File Protection

```swift
// ❌ WRONG: .complete files can't be accessed in background
class BackgroundTask {
    func performBackgroundSync() {
        // This FAILS if file has .complete protection and device is locked
        let data = try? Data(contentsOf: sensitiveFileURL)
        // data will be nil if device locked
    }
}

// ✅ CORRECT: Use .completeUntilFirstUserAuthentication
// Files accessible in background after first unlock
try data.write(
    to: fileURL,
    options: .completeFileProtectionUntilFirstUserAuthentication
)
```

### Handling Protection Errors

```swift
// ✅ CORRECT: Handle protection errors gracefully
func readFile(at url: URL) -> Data? {
    do {
        return try Data(contentsOf: url)
    } catch let error as NSError {
        if error.domain == NSCocoaErrorDomain &&
           error.code == NSFileReadNoPermissionError {
            // File is protected and device is locked
            print("File protected, device locked")
            return nil
        }
        throw error
    }
}
```

---

## iCloud and File Protection

### How Protection Works with iCloud

**Local file protection**:
- Applied to local cached copies
- Does NOT affect iCloud-stored versions
- iCloud has its own encryption (in transit and at rest)

**iCloud encryption**:
- All iCloud data encrypted at rest (Apple-managed keys)
- End-to-end encryption available for some data types (Advanced Data Protection)
- File protection only affects local device

```swift
// ✅ CORRECT: Protection on iCloud file affects local copy only
func saveToICloud(data: Data, filename: String) throws {
    guard let iCloudURL = FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    ) else { return }

    let fileURL = iCloudURL.appendingPathComponent(filename)

    // This protection applies to local cached copy
    try data.write(to: fileURL, options: .completeFileProtection)

    // iCloud has separate encryption for cloud storage
}
```

---

## Common Patterns

### Pattern 1: Default Protection for New Apps

```swift
// ✅ RECOMMENDED: Set default protection at app launch
func configureDefaultFileProtection() {
    let fileManager = FileManager.default

    let directories: [FileManager.SearchPathDirectory] = [
        .documentDirectory,
        .applicationSupportDirectory
    ]

    for directory in directories {
        guard let url = fileManager.urls(
            for: directory,
            in: .userDomainMask
        ).first else { continue }

        try? fileManager.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: url.path
        )
    }
}

// Call during app initialization
func application(_ application: UIApplication, didFinishLaunchingWithOptions...) {
    configureDefaultFileProtection()
    return true
}
```

### Pattern 2: Encrypting Database Files

```swift
// ✅ CORRECT: Protect SwiftData/SQLite database
let appSupportURL = FileManager.default.urls(
    for: .applicationSupportDirectory,
    in: .userDomainMask
)[0]

let databaseURL = appSupportURL.appendingPathComponent("app.sqlite")

// Set protection before creating database
try? FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
    ofItemAtPath: appSupportURL.path
)

// Now create database - it inherits protection
let container = try ModelContainer(
    for: MyModel.self,
    configurations: ModelConfiguration(url: databaseURL)
)
```

### Pattern 3: Downgrading Protection for Background Tasks

```swift
// ⚠️ SOMETIMES NECESSARY: Lower protection for background access
func enableBackgroundAccess(for url: URL) throws {
    try FileManager.default.setAttributes(
        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
        ofItemAtPath: url.path
    )
}

// Only do this if:
// 1. Background access is truly required
// 2. Data sensitivity allows it
// 3. You've considered security tradeoffs
```

---

## Debugging File Protection Issues

### Issue: File Not Accessible in Background

**Symptom**: Background tasks fail to read files

```swift
// Debug: Check current protection
if let protection = try? FileManager.default.attributesOfItem(
    atPath: url.path
)[.protectionKey] as? FileProtectionType {
    print("Protection: \(protection)")
    if protection == .complete {
        print("❌ Can't access in background when locked")
    }
}
```

**Solution**: Use `.completeUntilFirstUserAuthentication` instead

### Issue: Files Inaccessible After Restart

**Symptom**: App can't access files immediately after device reboot

**Cause**: Using `.complete` or `.completeUntilFirstUserAuthentication` (works as designed)

**Solution**: This is expected behavior. Either:
1. Wait for user to unlock device
2. Handle gracefully with appropriate UI
3. Use `.none` for files that must be accessible (security tradeoff)

---

## Entitlements

File protection generally works without special entitlements, but some features require:

### Data Protection Entitlement

```xml
<!-- Required for: .complete protection level -->
<key>com.apple.developer.default-data-protection</key>
<string>NSFileProtectionComplete</string>
```

**When needed**:
- Using `.complete` protection
- Some iOS versions for any protection (check documentation)

**How to add**:
1. Xcode → Target → Signing & Capabilities
2. "+ Capability" → Data Protection
3. Select protection level

---

## Quick Reference Table

| Scenario | Recommended Protection | Accessible When Locked? | Background Access? |
|----------|------------------------|-------------------------|---------------------|
| User health data | `.complete` | ❌ No | ❌ No |
| Financial records | `.complete` | ❌ No | ❌ No |
| Most app data | `.completeUntilFirstUserAuthentication` | ✅ Yes (after first unlock) | ✅ Yes |
| Downloads (large files) | `.completeUnlessOpen` | ✅ While open | ✅ While open |
| Database files | `.completeUntilFirstUserAuthentication` | ✅ Yes | ✅ Yes |
| Downloaded images | `.completeUntilFirstUserAuthentication` | ✅ Yes | ✅ Yes |
| Public caches | `.none` | ✅ Yes | ✅ Yes |
| Temp files | `.none` | ✅ Yes | ✅ Yes |

---

## Related Skills

- `axiom-storage` — Decide when to use file protection vs other security measures
- `axiom-storage-management-ref` — File lifecycle, purging, and disk management
- `axiom-storage-diag` — Debug file access issues

---

**Last Updated**: 2025-12-12
**Skill Type**: Reference
**Minimum iOS**: 4.0 (all protection levels)
**Latest Updates**: iOS 26
