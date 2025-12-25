---
name: file-protection-ref
description: Complete FileProtectionType reference — encryption levels, background access, security patterns
---

# File Protection Reference

Comprehensive reference for iOS file encryption and data protection APIs using FileProtectionType.

## Overview

iOS Data Protection provides hardware-accelerated file encryption tied to device passcode. Choose the right protection level based on data sensitivity and background access requirements.

## Protection Levels

### .complete
- **Encrypted**: Always
- **Accessible**: Only while unlocked
- **Use For**: Sensitive data (health, financial)
- **Background Access**: ❌ No

### .completeUnlessOpen
- **Encrypted**: When file closed
- **Accessible**: After first unlock, while open
- **Use For**: Large downloads, videos
- **Background Access**: ✅ If already open

### .completeUntilFirstUserAuthentication
- **Encrypted**: Always
- **Accessible**: After first unlock following boot
- **Use For**: Most app data (recommended default)
- **Background Access**: ✅ Yes

### .none
- **Encrypted**: Never
- **Accessible**: Always
- **Use For**: Public caches only
- **Background Access**: ✅ Yes

## Common Patterns

### Set Protection at Creation

```swift
try data.write(to: url, options: .completeFileProtection)
```

### Change Existing File

```swift
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: url.path
)
```

### Handle Background Access

```swift
// ❌ WRONG: .complete blocks background
try data.write(to: url, options: .completeFileProtection)
// Background task fails when locked

// ✅ CORRECT: Use .completeUntilFirstUserAuthentication
try data.write(
    to: url,
    options: .completeFileProtectionUntilFirstUserAuthentication
)
```

## File Protection vs Keychain

| Use Case | Recommended | Why |
|----------|-------------|-----|
| Passwords, tokens | **Keychain** | Designed for small secrets |
| Files >1 KB | **File Protection** | Efficient for large data |
| User documents | **File Protection** | Natural file storage |

## Use This Skill When

- Protecting sensitive user data
- Choosing FileProtectionType
- Debugging "file not accessible" errors when locked
- Implementing secure file storage
- Handling background file access

**Related**: storage, storage-diag, storage-management-ref
