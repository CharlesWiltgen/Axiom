# Keychain

Discipline skill for secure credential storage on Apple platforms. Covers the Keychain Services API, debugging common SecItem errors, and building reliable storage workflows that survive app updates, device migrations, and backup restores.

## When to Use

Use this skill when:
- Storing passwords, tokens, or other credentials in the iOS keychain
- Debugging `errSecDuplicateItem`, `errSecItemNotFound`, or other SecItem errors
- Configuring keychain access groups for app extensions or multi-app sharing
- Choosing the right `kSecAttrAccessible` level for your data
- Adding biometric protection (Face ID / Touch ID) to keychain items
- Migrating from UserDefaults or plain files to keychain storage

## Example Prompts

- "How do I store an API token in the keychain?"
- "I'm getting errSecDuplicateItem when saving credentials"
- "What accessibility level should I use for keychain items?"
- "How do I share keychain items between my app and its widget?"
- "How do I add Face ID protection to a keychain item?"
- "My keychain items disappear after reinstalling the app"

## What This Skill Provides

- Quinn's 4-function model for Keychain Services (add, update, delete, search)
- Uniqueness constraint rules that prevent duplicate item errors
- Data protection level guidance mapped to real use cases
- Biometric and device passcode access control configuration
- Access group setup for app extensions and multi-app keychain sharing
- Anti-patterns with time costs (storing large blobs, ignoring error codes, wrong accessibility)
- Pressure scenarios for common shortcuts developers take under deadline

## Documentation Scope

This page documents the `axiom-keychain` discipline skill. The discipline skill provides workflows, decision trees, and anti-rationalization guidance for keychain storage decisions.

- For troubleshooting specific keychain errors, see [Keychain Diagnostics](/diagnostic/keychain-diag)
- For SecItem API details and attribute constants, see [Keychain Reference](/reference/keychain-ref)

## Related

- [Keychain Diagnostics](/diagnostic/keychain-diag) — Troubleshoot specific SecItem error codes and lost-item scenarios
- [Keychain Reference](/reference/keychain-ref) — SecItem function signatures, attribute constants, accessibility levels
- [CryptoKit](/skills/security/cryptokit) — Encryption and signing for data that goes beyond credential storage
- [File Protection Reference](/reference/file-protection-ref) — Data protection classes for files stored outside the keychain
