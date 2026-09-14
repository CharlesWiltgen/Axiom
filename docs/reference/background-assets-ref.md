---
name: background-assets-ref
description: Background Assets framework — AssetPackManager actor, StoreDownloaderExtension / BADownloaderExtension protocols, Info.plist keys, manifest schema, xcrun ba-package / ba-serve tooling, error types, Foundation Models adapter bridge (iOS 26+)
---

# Background Assets Reference

Complete reference for the `BackgroundAssets` framework — `AssetPackManager` actor methods, `StoreDownloaderExtension` and `BADownloaderExtension` protocols, every public Info.plist key, the manifest JSON schema, `xcrun ba-package` / `xcrun ba-serve` tooling commands, the error type hierarchy, and the Foundation Models adapter bridge surface.

## When to Use This Reference

Use this reference when:
- Looking up `AssetPackManager` method signatures (`assetPack(withID:)`, `ensureLocalAvailability(of:)`, `statusUpdates`, `contents(at:searchingInAssetPackWithID:)`, `descriptor(for:)`, `checkForUpdates()`, `remove(assetPackWithID:)`)
- Looking up `AssetPack.Status` flags (`downloadAvailable`, `downloading`, `downloaded`, `upToDate`, `outOfDate`, `obsolete`, `updateAvailable`) and the stream-only `DownloadStatusUpdate` cases (`began`, `paused`, `downloading`, `finished`, `failed`)
- Looking up Info.plist keys (`BAHasManagedAssetPacks`, `BAUsesAppleHosting`, `BAAppGroupID`, `BAManifestURL`, `BAEssentialMaxInstallSize`, `BAMaxInstallSize`, `BAInitialDownloadRestrictions`)
- Looking up `BAErrorCode` cases for error handling (`downloadAlreadyScheduled`, `downloadBackgroundActivityProhibited`, `downloadWouldExceedAllowance`, `sessionDownloadAllowanceExceeded`) and `ManagedBackgroundAssetsError` (`assetPackNotFound`, `fileNotFound`)
- Writing a `StoreDownloaderExtension` (Apple-hosted) or `BADownloaderExtension` (server-hosted)
- Authoring a `Manifest.json` for `xcrun ba-package`
- Setting up local testing with `xcrun ba-serve`
- Integrating Background Assets with Foundation Models adapter delivery — `SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name:)`, `.removeObsoleteAdapters()` (deprecated 26.4 / obsoleted 27.0 in the 27 SDK)

## Example Prompts

Questions developers ask that this reference answers:

- "What's the full `AssetPackManager` API surface?"
- "How do I stream asset pack status changes in SwiftUI?"
- "What Info.plist keys do I need for managed Apple-hosted asset packs?"
- "What's the `Manifest.json` schema for `xcrun ba-package`?"
- "What `BAErrorCode` cases should I handle, and how should I respond to each?"
- "What's the difference between `StoreDownloaderExtension` and `BADownloaderExtension`?"
- "How do I gate Foundation Models adapter downloads to compatible variants only?"
- "What's the Apple-hosted asset pack quota and how is it calculated?"
- "Several localized asset packs ship the same file path — how do I read the copy for one language?"
- "My downloader extension's `switch` over `BAContentRequest` stopped compiling with the 27 SDK — what changed?"
- "Do both my app and my downloader extension need to call `withExclusiveControl`?"

## What's Covered

- **Two layers** – managed (iOS 26+ via `AssetPackManager` + `StoreDownloaderExtension` / `ManagedDownloaderExtension`) and unmanaged legacy (iOS 16.1+ via `BADownloadManager` + `BAURLDownload` + `BADownloaderExtension`)
- **`AssetPackManager` actor** – full method surface for fetching metadata, ensuring availability (including the batch `ensureLocalAvailability(of:requireLatestVersions:)`, OS 27), streaming status, reading files, lifecycle (`checkForUpdates`, `remove(assetPackWithID:)`); `Sendable` and `SendableMetatype` conformance
- **`AssetPack.Status` option set** – seven membership-tested flags, plus the five stream-only `DownloadStatusUpdate` cases
- **`StoreDownloaderExtension`** – Apple-hosted recommended path; minimal protocol surface (`shouldDownload(_:)`); composition example for Foundation Models adapter gating
- **`BADownloaderExtension`** – unmanaged server-hosted; the `downloads(for:manifestURL:extensionInfo:)` scheduling entry point, finished/failed download handlers, auth-challenge handler, `extensionWillTerminate()` (deprecated since iOS 16.4); `nsbackgroundassetsd` execution context. Managed server-hosted packs use `ManagedDownloaderExtension` instead
- **Unmanaged legacy API** – `BADownloadManager.shared`, `BAURLDownload` initializer, `BADownload.State`, `BADownload.Priority`, `BAContentRequest` (install / update / periodic / `languageChange` (OS 27)) and what the new case does to an existing `switch`
- **Exclusive control** – the async `BADownloadManager.withExclusiveControl(_:)` / `withExclusiveControl(before:_:)`, back-deployed to iOS 16.1 when you build with the 27 SDK; the completion-handler spellings are deprecated in Swift at 27
- **Info.plist keys** – every public key with type, layer, and purpose; managed Apple-hosted minimal set, managed server-hosted minimal set, unmanaged legacy minimal set
- **Manifest JSON schema** – `assetPackID`, `downloadPolicy`, `fileSelectors`, `platforms`; download policy shapes (`essential`, `prefetch`, `onDemand`) and their `installationEventTypes`
- **Error types** – `ManagedBackgroundAssetsError`, `AssetPackManager.LocalAvailabilityError` (OS 27), `BAErrorCode`, `SystemLanguageModel.Adapter.AssetError` with diagnosis-and-response tables for each case
- **Localized asset packs (OS 27)** – `language` manifest tag, fallback chain, `AssetPack.language`, `resolvedLanguage`, `reconcilePreferredLanguages()`, localized file reads (`contents(at:asLocalizedFor:options:)`, `descriptor(for:asLocalizedFor:)`, `url(for:asLocalizedFor:)`), and `BAContentRequest.languageChange` on the extension side
- **Manifest-based metadata (OS 27)** – `AssetPackManager.manifest`, `AssetPackManifest` lookups; `allAssetPacks` / `assetPack(withID:)` deprecations
- **On-Demand Resources deprecation** – the 27 SDKs deprecate the `NSBundleResourceRequest` family in favor of Background Assets
- **Tooling** – `xcrun ba-package template / <manifest> -o / download-manifest / evaluate / convert` (`evaluate` and Steam depot `convert` are Xcode 27); `xcrun ba-serve --host / url-override` with Developer Mode + root CA setup steps; the Xcode 27 auto-attached mock server
- **Unity plug-ins** – the Background Assets and StoreKit Apple Unity plug-ins (WWDC 2026)
- **Apple-hosted quotas** – 200 GB total, 100-pack max per app; "asset pack total" calculation rules with Apple's documented example; quota warning at 80%; upload paths (Transporter, altool, iTMSTransporter, App Store Connect REST API)
- **Foundation Models adapter bridge** – `SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name:)`, `removeObsoleteAdapters()` with the canonical adapter-download extension pattern (deprecated 26.4 / obsoleted 27.0 in the 27 SDK)
- **Five complete patterns** – Apple-hosted managed pack lifecycle, stream-driven SwiftUI progress, Foundation Models adapter delivery (with `AssetPackManager` + `SystemLanguageModel.Adapter` composition), manifest authoring + local testing, custom server-hosted extension

## Documentation Scope

This page documents the `background-assets-ref` skill — the API reference half of the Background Assets pair.

- For **when to use Background Assets vs alternatives** (bundle, iCloud, URLSession, BGProcessingTask), see [Background Assets](/skills/integration/background-assets)
- For the **adapter-side integration** consuming this API, see [Foundation Models Adapters](/skills/integration/foundation-models-adapters)
- For the **adapter runtime API** that consumes Background Assets, see [Foundation Models Adapters Reference](/reference/foundation-models-adapters-ref)
- For **background compute scheduling** (not asset delivery), see [Background Processing](/skills/integration/background-processing)
