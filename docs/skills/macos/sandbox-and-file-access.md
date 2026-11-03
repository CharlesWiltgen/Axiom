---
name: sandbox-and-file-access
description: Use when building a sandboxed macOS app, debugging "Operation not permitted" or sandbox-violation errors, implementing file open/save/import workflows, persisting access to user-selected files via security-scoped bookmarks, or choosing sandbox entitlements.
---

# macOS App Sandbox and File Access

How the kernel-enforced App Sandbox works: what it restricts, why debug builds hide it, and the security-scoped bookmark pattern developers most often get wrong.

## When to Use

Use this skill when you're:
- Building a new macOS app destined for the Mac App Store
- Diagnosing an app that works in debug but fails in release, TestFlight, or production
- Seeing "Operation not permitted" or sandbox-violation errors
- Implementing file open/save/import workflows on macOS
- Persisting access to user-selected files across app launches
- Preparing a macOS app for App Store review or notarization
- Deciding which sandbox entitlements to request
- Finding that access to another developer team's app container stopped working on macOS 27

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "My app works in Xcode but fails to open files in release. Why?"
- "How do I keep access to a user-selected folder across app launches?"
- "My app's file access stops working after many open/close cycles. What's leaking?"
- "Should I request `files.all` or `files.user-selected.read-write`?"
- "Where do I check why an operation was denied?"
- "What's the difference between starting access on a panel URL vs. a resolved bookmark?"
- "My app can no longer read another team's app container on macOS 27, and no prompt appears. Why?"

## What This Skill Provides

### The Sandbox Model
- What the sandbox restricts at the kernel level (container, user-selected files, entitled resources)
- Why Xcode debug builds bypass the sandbox, the leading cause of "works on my machine" bugs
- Four ways to test in the sandbox: Activity Monitor's Sandbox column, enabling it in debug builds, an exported archive, and TestFlight

### File Access Patterns
- A decision tree across container files, `fileImporter`, security-scoped bookmarks, standard folder entitlements, App Groups, and Full Disk Access
- SwiftUI `.fileImporter`/`.fileExporter`: call `startAccessingSecurityScopedResource()`, as Apple's documentation says, and balance it with a deferred stop
- AppKit `NSOpenPanel`/`NSSavePanel` with the same balance rule
- Which URLs arrive with access already started (`NSOpenPanel`, `NSSavePanel`, Dock drag and drop) and which need an explicit start (`fileImporter` and resolved bookmarks)

### Security-Scoped Bookmarks
- The bookmark entitlements (`files.bookmarks.app-scope`, `files.bookmarks.document-scope`) that creating them requires
- Step by step: create the bookmark as soon as access is granted, store it in a file (not `UserDefaults`), resolve it with `bookmarkDataIsStale`, and refresh stale bookmarks
- Read-only mode via `.securityScopeAllowOnlyReadAccess`
- Document-relative bookmarks for project-file references
- The critical distinction: resolved bookmarks need `startAccessingSecurityScopedResource()`; panel URLs don't

### Entitlements
- The core `com.apple.security.app-sandbox` entitlement, which the Mac App Store requires
- File access entitlements (`files.user-selected.*`, `files.downloads.*`, `files.pictures.*`, `files.music.*`, `files.movies.*`, `files.all`)
- Network entitlements (`network.client`, `network.server`)
- Device, personal-information, and App Group entitlements
- Why temporary exceptions draw App Review scrutiny, and the principle of least privilege

### Diagnosing Violations
- Filtering Console.app on the `com.apple.sandbox.reporting` subsystem and its `violation` category
- `log stream` for live diagnostic output
- Apple DTS engineer Quinn's diagnostic flow: confirm the sandbox is the cause, then check entitlements, stale bookmarks, and the code signing identity

### Cross-Team Container Access (macOS 27)
- macOS 27 denies access to other developer teams' app data and app group containers by default, without prompting; the user manages exceptions in Privacy & Security settings

## Key Pattern

Resolved bookmarks need explicit `start`/`stop`. Always pair them with `defer`:

```swift
guard url.startAccessingSecurityScopedResource() else { return nil }
defer { url.stopAccessingSecurityScopedResource() }

return try Data(contentsOf: url)
```

Every unbalanced `start` leaks a kernel resource, and after enough leaks all file access fails until the user quits and relaunches your app. Store bookmark data in a file in your app's container, never in `UserDefaults`.

## Documentation Scope

This page documents the `sandbox-and-file-access` skill (in the `axiom-macos` suite), which your assistant uses when you work with the App Sandbox, file access, and entitlements.

## Related

- [direct-distribution](/skills/macos/direct-distribution) – Code signing, entitlements file format, and notarization that pair with sandbox entitlements
- [settings](/skills/macos/settings) – App Group `UserDefaults(suiteName:)` for sharing preferences with extensions inside the sandbox
- [appkit-interop](/skills/macos/appkit-interop) – When `NSOpenPanel` is needed for capabilities `.fileImporter` doesn't expose (directory selection, accessory views)
- [axiom-security](/skills/security/) – Keychain, encryption, passkeys, and certificate management that complement file-access entitlements

## Resources

**WWDC**: 2022-10096, 2023-10053, 2024-10123

**Docs**: /security/app-sandbox, /security/accessing-files-from-the-macos-app-sandbox, /security/discovering-and-diagnosing-app-sandbox-violations, /xcode/configuring-the-macos-app-sandbox
