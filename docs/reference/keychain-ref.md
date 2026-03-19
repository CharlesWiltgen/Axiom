# Keychain Reference

Complete API reference for Keychain Services on Apple platforms. Covers SecItem functions, query attribute constants, accessibility levels, and access control flags for developers who need precise API details.

## When to Use This Reference

Use this reference when:
- Looking up SecItem function signatures or return types
- Finding the correct `kSecAttr*` constant for a query dictionary
- Choosing between `kSecAttrAccessible` levels
- Configuring `SecAccessControl` flags for biometric or passcode protection
- Understanding keychain item class differences (generic password, internet password, certificate, key)
- Checking which attributes are required vs optional for each operation

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What attributes does SecItemAdd require for a generic password?"
- "What's the difference between kSecAttrAccessibleWhenUnlocked and kSecAttrAccessibleAfterFirstUnlock?"
- "How do I create a SecAccessControl with biometry and device passcode fallback?"
- "What's the query format for SecItemCopyMatching with multiple results?"
- "Which kSecClass should I use for an OAuth token?"

## What's Covered

- `SecItemAdd`, `SecItemUpdate`, `SecItemDelete`, `SecItemCopyMatching` function signatures and behavior
- Item class constants (`kSecClassGenericPassword`, `kSecClassInternetPassword`, `kSecClassKey`, `kSecClassCertificate`)
- Attribute constants for queries, matching, and return types
- `kSecAttrAccessible` levels with data protection class mappings
- `SecAccessControl` creation and flag combinations
- Access group configuration for sharing between apps and extensions
- Keychain error codes (OSStatus) with descriptions
- Platform differences between iOS, macOS, Mac Catalyst, and Simulator

## Documentation Scope

This page documents the `axiom-keychain-ref` reference skill. It provides API-level detail for developers who already understand keychain concepts and need specific function signatures or constant values.

- For workflow guidance and decision trees, see [Keychain](/skills/security/keychain)
- For troubleshooting specific errors, see [Keychain Diagnostics](/diagnostic/keychain-diag)

## Related

- [Keychain](/skills/security/keychain) — Discipline skill with workflows, anti-patterns, and decision guidance
- [Keychain Diagnostics](/diagnostic/keychain-diag) — Error triage and root cause analysis for SecItem failures
