---
name: sandbox-and-file-access
description: Use when building a sandboxed macOS app, debugging "Operation not permitted" or sandbox-violation errors, implementing file open/save/import workflows, persisting access to user-selected files via security-scoped bookmarks, or choosing sandbox entitlements.
---

# macOS App Sandbox and File Access

The kernel-enforced access-control model — what the sandbox restricts, why debug builds hide it, and the security-scoped bookmark pattern developers get wrong most often.

## When to Use This Skill

Use this skill when you're:
- Building a new macOS app destined for the Mac App Store
- Diagnosing an app that works in debug but fails in release, TestFlight, or production
- Seeing "Operation not permitted" or sandbox violation errors
- Implementing file open/save/import workflows on macOS
- Persisting access to user-selected files across app launches
- Preparing a macOS app for App Store review or notarization
- Deciding which sandbox entitlements to request

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My app works in Xcode but fails to open files in release. Why?"
- "How do I keep access to a user-selected folder across app launches?"
- "My app's file access stops working after many open/close cycles. What's leaking?"
- "Should I request `files.all` or `files.user-selected.read-write`?"
- "Where do I check why an operation was denied?"
- "What's the difference between starting access on a panel URL vs. a resolved bookmark?"

## What This Skill Provides

### The Sandbox Model
- What the sandbox restricts at the kernel level (container, user-selected files, entitled resources)
- Why Xcode debug builds bypass the sandbox — the #1 cause of "works on my machine"
- Four ways to test in the sandbox: Activity Monitor's Sandbox column, enabling in debug, exported archive, TestFlight

### File Access Patterns
- Decision tree across container files, fileImporter, security-scoped bookmarks, standard folder entitlements, App Groups, and Full Disk Access
- SwiftUI `.fileImporter`/`.fileExporter` with proper `defer { stopAccessingSecurityScopedResource() }`
- AppKit `NSOpenPanel`/`NSSavePanel` with the same balance rule
- The auto-started access rule — panel URLs come with access started; you only need to stop

### Security-Scoped Bookmarks
- Step-by-step: create immediately on grant, store in a file (not UserDefaults), resolve with `bookmarkDataIsStale`, refresh stale bookmarks
- Read-only mode via `.securityScopeAllowOnlyReadAccess`
- Document-relative bookmarks for project-file references
- The critical distinction: resolved bookmarks need `startAccessingSecurityScopedResource()`; panel URLs do not

### Entitlements
- Core sandbox entitlement and Mac App Store requirement
- File access entitlements (`files.user-selected.*`, `files.downloads.*`, `files.pictures.*`, `files.music.*`, `files.movies.*`, `files.all`)
- Network entitlements (`network.client`, `network.server`)
- Device, personal-information, and App Group entitlements
- Why temporary exceptions raise App Review scrutiny and the principle of least privilege

### Diagnosing Violations
- Console.app subsystem `com.apple.sandbox.reporting` filter and the `violation` category
- `log stream` for live diagnostic output
- Quinn's diagnostic flow: confirm sandbox is the cause, check entitlements, check for stale bookmarks, check code signing identity

## Key Pattern

Resolved bookmarks need explicit `start`/`stop`. Always pair them with `defer`:

```swift
guard url.startAccessingSecurityScopedResource() else { return nil }
defer { url.stopAccessingSecurityScopedResource() }

return try Data(contentsOf: url)
```

Failing to call `stop` leaks a kernel resource. Enough leaks and ALL file access stops working until the user force-quits your app. Store bookmark data in a file in your app's container — never in `UserDefaults`.

## Documentation Scope

This page documents the `sandbox-and-file-access` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about the sandbox, file access, and entitlements.

**For code signing and notarization** — Use [direct-distribution](/skills/macos/direct-distribution) for the signing, notarization, and packaging side of shipping.

## Related

- [direct-distribution](/skills/macos/direct-distribution) — Code signing, entitlements file format, and notarization that pair with sandbox entitlements
- [settings](/skills/macos/settings) — App Group `UserDefaults(suiteName:)` for sharing preferences with extensions inside the sandbox
- [appkit-interop](/skills/macos/appkit-interop) — When `NSOpenPanel` is needed for capabilities `.fileImporter` doesn't expose (directory selection, accessory views)
- [axiom-security](/skills/security/) — Keychain, encryption, passkeys, and certificate management that complement file-access entitlements

## Resources

**WWDC**: 2022-10096, 2023-10053, 2024-10123

**Docs**: /security/app-sandbox, /security/accessing-files-from-the-macos-app-sandbox, /security/discovering-and-diagnosing-app-sandbox-violations, /xcode/configuring-the-macos-app-sandbox

**Skills**: axiom-macos, direct-distribution, settings, appkit-interop
