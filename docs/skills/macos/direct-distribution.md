---
name: direct-distribution
description: Use when distributing a macOS app outside the Mac App Store via Developer ID — code signing, notarization with notarytool, hardened runtime, stapling, DMG/zip/pkg packaging, Sparkle auto-updates, and Gatekeeper troubleshooting.
---

# macOS Direct Distribution

The end-to-end flow from signed binary to delivered product — Developer ID signing inside-out, hardened runtime, `notarytool` submission, stapling, packaging, and Sparkle for auto-updates.

## When to Use This Skill

Use this skill when you're:
- Distributing a macOS app outside the Mac App Store via Developer ID
- Setting up code signing for direct distribution (not App Store)
- Notarizing software with `notarytool`
- Troubleshooting Gatekeeper blocks, notarization failures, or code signing errors
- Adding auto-updates to a directly distributed app via Sparkle
- Packaging apps as DMG, zip, or installer package
- Migrating from deprecated `altool` to `notarytool`

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "What's the right order to sign an app with embedded frameworks and XPC services?"
- "My notarization fails with 'signature does not include a secure timestamp.' How do I fix it?"
- "Why does my app open fine from Xcode but get blocked by Gatekeeper after download?"
- "Should I use `--deep` for code signing?"
- "How do I set up Sparkle auto-updates for a sandboxed app?"
- "What's the difference between stapling a DMG and a zip archive?"

## What This Skill Provides

### Distribution Checklist
- Five-phase workflow — Prepare, Sign (inside-out), Package, Notarize, Staple & Deliver
- Identity verification with `security find-identity`
- Distribution entitlements: removing `com.apple.security.get-task-allow`, setting APS environment

### Code Signing
- Signing order from inside-out (dylibs → frameworks → XPC services → helpers → extensions → main app)
- Essential `codesign` flags: `-s`, `-f`, `--timestamp`, `-o runtime`, `--entitlements`
- Why `--deep` is "Considered Harmful" — different components need different entitlements
- Why `sudo codesign` breaks identity lookup

### Hardened Runtime
- The protections — code injection, DLL hijacking, memory tampering
- Runtime exceptions (JIT, library validation, DYLD env vars) and when each is justified
- Resource access entitlements (camera, microphone, location, contacts, Apple Events)

### Notarization with notarytool
- One-time `store-credentials` with Apple ID or App Store Connect API key
- `submit`, `info`, `log`, `history` commands
- Why you always check the log on success (warnings matter)
- Accepted formats and their staple-ability — DMG (yes), pkg (yes), zip (no, staple the .app first)
- Common failures: missing `--timestamp`, missing `-o runtime`, signed-in-wrong-order, ancient SDK, `get-task-allow` in distribution build

### Stapling
- `xcrun stapler staple` + `validate`
- Why stapling matters — offline Gatekeeper still verifies
- Stapler troubleshooting (`trustd` reset, error 65)

### Packaging
- DMG with `hdiutil` (recommended for user-facing distribution)
- Zip with `ditto` — never Finder Archive (Unicode normalization corrupts signatures)
- Installer pkg with `productbuild` + `productsign` (different identity: Developer ID Installer)

### Sparkle Auto-Updates
- EdDSA key generation and `SUPublicEDKey` Info.plist setup
- Sandboxed-app additions (`SUEnableInstallerLauncherService`, XPC temporary exceptions)
- SwiftUI integration with `SPUStandardUpdaterController` and a "Check for Updates" command
- Appcast generation, signing Sparkle inside-out without `--deep`

### Troubleshooting
- Gatekeeper isolation: download without quarantine vs. `xattr -d com.apple.quarantine`
- `syspolicy_check distribution` (macOS 14+)
- Dangling load command paths via `otool -L` — the most common Gatekeeper failure
- cdhash matching for notarization mismatches
- `log stream` predicate for trusted-execution diagnostics

## Key Pattern

Sign inside-out. The outer signature includes hashes of inner signatures — signing inner components after the outer signature invalidates it:

```bash
# 1. Frameworks first
codesign -f -s "Developer ID Application: ..." \
  --timestamp -o runtime \
  MyApp.app/Contents/Frameworks/Sparkle.framework

# 2. XPC services
codesign -f -s "Developer ID Application: ..." \
  --timestamp -o runtime \
  MyApp.app/Contents/XPCServices/Helper.xpc

# 3. Main app last, with entitlements
codesign -f -s "Developer ID Application: ..." \
  --timestamp -o runtime \
  --entitlements MyApp.entitlements \
  MyApp.app
```

Never use `--deep`. Hardened Runtime (`-o runtime`) and a secure timestamp (`--timestamp`) are mandatory for notarization.

## Documentation Scope

This page documents the `direct-distribution` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about signing, notarization, packaging, and Sparkle.

**For App Store submission** — Use [app-store-submission](/skills/shipping/) for the App Store-bound macOS app path with privacy manifests, age ratings, and review specifics.

## Related

- [sandbox-and-file-access](/skills/macos/sandbox-and-file-access) — Distribution entitlements pair with sandbox entitlements; both live in the entitlements file
- [axiom-security](/skills/security/) — Keychain, encryption, passkeys, and certificate management
- [axiom-shipping](/skills/shipping/) — App Store submission specifics for the App Store-bound path

## Resources

**WWDC**: 2018-702, 2019-703, 2021-10261, 2022-10109, 2023-10266

**Docs**: /security/notarizing-macos-software-before-distribution, /xcode/creating-distribution-signed-code-for-the-mac, /xcode/packaging-mac-software-for-distribution, /security/hardened-runtime, /technotes/tn3147-migrating-to-the-latest-notarization-tool

**Skills**: axiom-macos, sandbox-and-file-access
