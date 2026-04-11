# Code Signing Reference

Comprehensive CLI and API reference for iOS/macOS code signing: certificate management, provisioning profile inspection, entitlement extraction, Keychain operations, codesign verification, fastlane match, and Xcode build settings.

## When to Use This Reference

Use this reference when:
- Running CLI commands to inspect certificates, profiles, or entitlements
- Setting up Keychain management scripts for CI/CD
- Configuring fastlane match for team certificate management
- Looking up Xcode build settings for signing
- Checking ITMS error codes and their causes
- Deciding between .p8 and .p12 for APNs authentication
- Writing ExportOptions.plist for xcodebuild exports

## Example Prompts

- "What's the command to list my signing certificates?"
- "How do I decode a provisioning profile from the command line?"
- "What does ITMS-90035 mean?"
- "How do I set up a CI keychain for code signing?"
- "What are the Xcode build settings for manual signing?"
- "Should I use .p8 or .p12 for push notifications?"

## What's Covered

- Certificate CLI commands (`security find-identity`, `find-certificate`, `import`, `export`)
- Provisioning profile decoding and inspection (`security cms -D`)
- Entitlement extraction and comparison (`codesign -d --entitlements`)
- Keychain management (`create-keychain`, `unlock-keychain`, `set-key-partition-list`)
- codesign commands (signing, verification, deep signing)
- openssl commands (certificate inspection, .p12 manipulation)
- Xcode build settings reference (CODE_SIGN_IDENTITY, CODE_SIGN_STYLE, etc.)
- ExportOptions.plist format and export methods
- fastlane match setup, Matchfile, CI readonly mode
- Complete CI keychain setup/cleanup scripts (GitHub Actions example)
- APNs .p8 vs .p12 comparison table
- Error codes reference (security, codesign, ITMS)

## Documentation Scope

This page documents the `axiom-security` reference skill. The full CLI command reference, error codes, and CI scripts are in the skill file — Claude accesses them automatically.

- For setup guidance and anti-patterns, see [Code Signing](/skills/debugging/code-signing)
- For error troubleshooting with decision trees, see [Code Signing Diagnostics](/diagnostic/code-signing-diag)

## Related

- [Code Signing](/skills/debugging/code-signing) — Workflows, decision trees, and anti-patterns
- [Code Signing Diagnostics](/diagnostic/code-signing-diag) — Troubleshoot specific signing errors
- [App Store Submission Reference](/reference/app-store-ref) — Metadata and submission requirements
- [LLDB Command Reference](/reference/lldb-ref) — Another CLI reference for debugging
