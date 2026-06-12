
# Background Assets Framework — Complete API Reference

## Overview

The Background Assets framework (`BackgroundAssets`) delivers asset packs to apps through system-managed downloads. This reference covers every public API, Info.plist key, error type, manifest schema, and tooling command. For when-and-why decisions, see `skills/background-assets.md`.

### Two layers

- **Managed asset packs** (iOS 26+ / iPadOS 26+ / macOS 26+ / tvOS 26+ / visionOS 26+): high-level `AssetPackManager` actor and download policies. Use `StoreDownloaderExtension` for Apple-hosted, `ManagedDownloaderExtension` for managed server-hosted. The recommended path for new apps.
- **Unmanaged legacy** (iOS 16.1+): lower-level `BADownloadManager`, `BAURLDownload`, `BADownloaderExtension` with manual delegate logic. Use only when targeting OS versions below 26 or when you need download-level control the managed layer doesn't expose.

### Distribution

- All platforms except **watchOS** support Background Assets for App Store distribution
- Asset pack archives use the `.aar` format
- Transport is HTTPS-only — plain HTTP is not supported

### On-Demand Resources is deprecated

The entire On-Demand Resources surface (`NSBundleResourceRequest`, its preservation-priority methods, `NSBundleResourceRequestLowDiskSpaceNotification`, `NSBundleResourceRequestLoadingPriorityUrgent`) is deprecated in the 27 SDKs with the message "Use Background Assets instead." Treat Background Assets as the only supported asset-delivery channel going forward; migrate ODR tag-based apps to asset packs.

---

## When to Use This Reference

Use this reference when:
- Looking up `AssetPackManager` method signatures
- Looking up `AssetPack.Status` flags
- Looking up Info.plist keys
- Looking up `BAErrorCode` cases for error handling
- Writing a `StoreDownloaderExtension` or `BADownloaderExtension`
- Authoring a `Manifest.json` for `xcrun ba-package`
- Setting up local testing with `xcrun ba-serve`
- Integrating Background Assets with Foundation Models adapter delivery (26-era — see the Adapter Bridge status note)

**Related Skills**:
- `skills/background-assets.md` — Discipline skill with decision trees, when-not-to-use, pressure scenarios
- `axiom-ai (skills/foundation-models-adapters-ref.md)` — Foundation Models adapter runtime API that consumes Background Assets

---

## AssetPackManager (managed, iOS 26+)

### Overview

`AssetPackManager` is an actor that gives the app process visibility into managed asset packs — checking status, ensuring availability, streaming updates, reading files, and cleaning up obsolete packs.

```swift
import BackgroundAssets

let manager = AssetPackManager.shared
```

`AssetPackManager` conforms to `Sendable` and `SendableMetatype`. Always access via `AssetPackManager.shared`.

### Fetching asset pack metadata

On OS 27, the manifest is the metadata entry point:

```swift
// OS 27 — fetch the manifest, then look up packs on it
let manifest = try await AssetPackManager.shared.manifest  // AssetPackManifest
let packs = manifest.assetPacks                            // Set<AssetPack>
let assetPack = manifest.assetPack(withID: "Tutorial")     // AssetPack?
```

On 26, fetch packs directly from the manager (both deprecated in 27 in favor of the manifest path):

```swift
let assetPack = try await AssetPackManager.shared.assetPack(withID: "Tutorial")
let packs = try await AssetPackManager.shared.allAssetPacks
```

### Ensuring availability

```swift
// Block until the pack is locally available (downloads if needed)
try await AssetPackManager.shared.ensureLocalAvailability(of: assetPack)

// Force a fresh version check before returning (from 26.4)
try await AssetPackManager.shared.ensureLocalAvailability(
    of: assetPack,
    requireLatestVersion: true
)
```

`ensureLocalAvailability(of:)` returns when the pack's state is `.downloaded` or `.upToDate`. Throws on download failure or unrecoverable state. The older `of:`-only overload is deprecated from 26.4, renamed to `ensureLocalAvailability(of:requireLatestVersion:)`; since the new parameter defaults to `false`, existing `ensureLocalAvailability(of: pack)` call sites resolve to the new overload unchanged.

#### Batch variant OS27

```swift
// Ensure several packs at once
try await AssetPackManager.shared.ensureLocalAvailability(
    of: [tutorialPack, texturesPack],
    requireLatestVersions: false
)
```

The `Set`-based overload throws `AssetPackManager.LocalAvailabilityError` when any pack fails, carrying `successes: Set<AssetPack>` and `failures: [AssetPack: any Error]` so you can retry only what failed.

### Status streaming

`statusUpdates` is an `AsyncSequence` that emits each status change.

```swift
// All packs
for await update in AssetPackManager.shared.statusUpdates {
    // each update is a DownloadStatusUpdate carrying its AssetPack
}

// Specific pack
let updates = AssetPackManager.shared.statusUpdates(forAssetPackWithID: "Tutorial")
for await status in updates {
    switch status {
    case .began:
        // Download just started
        break
    case .paused:
        // System paused (Low Power Mode, Background Activity off, network)
        break
    case .downloading(_, let progress):
        // Bind progress.fractionCompleted to a ProgressView
        break
    case .finished:
        // Pack is now local — safe to consume
        break
    case .failed(_, let error):
        // Inspect error; show retry UI
        break
    @unknown default:
        break
    }
}
```

### Status queries

```swift
// Local-only status (no server round-trip)
let localStatus = await AssetPackManager.shared.localStatus(ofAssetPackWithID: "Tutorial")
let isLocal = AssetPackManager.shared.assetPackIsAvailableLocally(withID: "Tutorial")
// (nonisolated synchronous — no await needed)

// Status relative to a specific AssetPack instance (may contact the server)
let status = try await AssetPackManager.shared.status(relativeTo: someAssetPack)
```

`status(relativeTo:)`, `localStatus(ofAssetPackWithID:)`, and `assetPackIsAvailableLocally(withID:)` are all available from 26.4. The original `status(ofAssetPackWithID:)` is deprecated from 26.4 in favor of `status(relativeTo:)`. Only `assetPackIsAvailableLocally(withID:)` is synchronous; the other queries are `async`.

### Reading file contents

All three file APIs (`contents`, `descriptor`, `url`) are `nonisolated` and synchronous — bare `try`, no `await`:

```swift
// Read a file's bytes
let data = try AssetPackManager.shared.contents(
    at: "Videos/Introduction.m4v",
    searchingInAssetPackWithID: "Tutorial",
    options: []
)

// Or get a file descriptor for streaming
let descriptor = try AssetPackManager.shared.descriptor(
    for: "Videos/Introduction.m4v",
    searchingInAssetPackWithID: "Tutorial"
)
defer { try? descriptor.close() }  // errors can't propagate from defer
// Read via FileHandle(fileDescriptor: descriptor.rawValue) or System read APIs

// Resolve a URL for an opened pack
let url = try AssetPackManager.shared.url(for: "Videos/Introduction.m4v")
```

### Update lifecycle

```swift
// Force a remote check for newer versions
// (@discardableResult — returns (updatingIDs: Set<String>, removedIDs: Set<String>))
try await AssetPackManager.shared.checkForUpdates()

// Remove a pack to free storage (system does NOT auto-evict)
try await AssetPackManager.shared.remove(assetPackWithID: "Tutorial")
```

Call `checkForUpdates()` at app launch and after OS upgrades. Call `remove(assetPackWithID:)` once your code is done with a pack; the system keeps packs installed indefinitely otherwise.

---

## AssetPack.Status

`AssetPack.Status` is an `OptionSet`, not an enum. Its values are combinable bit flags, so membership-test them with `contains(_:)` — do NOT exhaustively `switch` over them.

```swift
public struct Status: OptionSet, Sendable {
    public static let downloadAvailable: AssetPack.Status
    public static let updateAvailable: AssetPack.Status
    public static let upToDate: AssetPack.Status
    public static let outOfDate: AssetPack.Status
    public static let obsolete: AssetPack.Status
    public static let downloading: AssetPack.Status
    public static let downloaded: AssetPack.Status
    public let rawValue: Int
    public init(rawValue: Int)
}

// Membership-test the flags, do NOT exhaustively switch:
if status.contains(.downloaded) || status.contains(.upToDate) {
    // Pack is local and ready to consume
}
```

The five lifecycle values streamed by `statusUpdates` are a separate `DownloadStatusUpdate` enum (not `AssetPack.Status`):

```swift
case .began(AssetPack)
case .paused(AssetPack)
case .downloading(AssetPack, Progress)
case .finished(AssetPack)
case .failed(AssetPack, Error)
```

| State | Meaning |
|-------|---------|
| `downloadAvailable` | Server has the pack, device doesn't yet |
| `downloading` | Active download in progress |
| `downloaded` | Pack is local, version unspecified |
| `upToDate` | Pack is local, matches server's latest |
| `outOfDate` | Pack is local but newer version exists on server |
| `updateAvailable` | Stronger form of `outOfDate` — system flags update should be applied |
| `obsolete` | Pack no longer in manifest; eligible for removal |

---

## Localized Asset Packs OS27

Localized asset packs let the system deliver only the assets matching the user's preferred language (selected in Settings), instead of installing every language variant. Declare a `language` tag (BCP-47) in the asset pack manifest; the system identifies the user's language and downloads only matching packs.

### Fallback chain

When no pack matches the user-selected language exactly, the system falls back automatically:

1. **Regional fallback** — another variant of the same base language (e.g. user selects English-UK, no en-GB pack exists → the en-US pack is used)
2. **Primary app language** — if no similar regional variant exists at all (e.g. user selects Spanish, no Spanish pack and no regional variant → the app's primary language, English, is used)

### Manifest declaration

```json
{
    "assetPackID": "voice-english",
    "downloadPolicy": { "onDemand": {} },
    "language": "en-US",
    "sourceRoot": ".",
    "fileSelectors": [ {"file": "Audio/voice-en.m4a"} ],
    "platforms": []
}
```

Upload localized variants of your asset packs to App Store Connect to reduce per-device install size.

### API surface

| Need | API |
|------|-----|
| Pack's language | `AssetPack.language: Locale.Language?` (`nil` = not localized) |
| Manifest's primary language | `AssetPackManifest.primaryLanguage: Locale.Language?` |
| Manifest's available languages | `AssetPackManifest.availableLanguages: [Locale.Language]` |
| Manifest's localized packs | `AssetPackManifest.localizedAssetPacks` / `.localizedAssetPacks(for:)` |
| Manifest's resolved language (read-only) | `AssetPackManifest.resolvedLanguage: Locale.Language?` |
| Resolved language (read/override) | `AssetPackManager.shared.resolvedLanguage: Locale.Language?` (get/set) |
| Languages available locally | `AssetPackManager.shared.locallyAvailableLanguages` (`get async`) |
| Reconcile downloads after change | `AssetPackManager.shared.reconcilePreferredLanguages() async throws` |
| Read a localized file | `contents(at:asLocalizedFor:options:)`, `descriptor(for:asLocalizedFor:)`, `url(for:asLocalizedFor:)` |

### Behavior notes

- `resolvedLanguage` respects a language your app sets manually; set it to `nil` to revert to the user's system-wide preference. Setting it does **not** immediately download or remove packs — call `reconcilePreferredLanguages()` to reconcile.
- `reconcilePreferredLanguages()` downloads missing localized packs, waits for those downloads, and removes unneeded ones. Don't use it if your app offers split-language functionality — handle reconciliation manually in that case.
- If the user recently changed their preferred language, `resolvedLanguage` can be temporarily out of sync with the set of locally available packs.

---

## StoreDownloaderExtension (Apple-hosted, recommended)

### Overview

`StoreDownloaderExtension` is the boilerplate-free path: Apple manages the download, the app declares which packs to allow, and that's the entire extension.

```swift
import BackgroundAssets
import ExtensionFoundation
import StoreKit

@main
struct DownloaderExtension: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        // Return true to allow the system to download this pack.
        // Filter by ID to skip variants not relevant to this device:
        // return assetPack.id.hasPrefix("highres-")
        return true
    }
}
```

### Protocol surface

```swift
public protocol StoreDownloaderExtension: ManagedDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool
}
```

`ManagedDownloaderExtension` is the parent protocol. Both extensions are `@main`-annotated entry points in the extension target.

### Foundation Models adapter pattern

> 26-era pattern: the `SystemLanguageModel.Adapter` runtime is deprecated 26.4 / obsoleted 27.0 in the 27 SDK (see the Adapter Bridge status note).

```swift
import BackgroundAssets
import ExtensionFoundation
import FoundationModels
import StoreKit  // StoreDownloaderExtension is declared in StoreKit

@main
struct AdapterDownloaderExtension: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        // Always allow non-FM-adapter packs
        if !assetPack.id.hasPrefix("fmadapter-") {
            return true
        }
        // For FM adapter packs, only download variants the runtime reports
        // compatible with the current base model
        let compatible = SystemLanguageModel.Adapter
            .compatibleAdapterIdentifiers(name: "MyAdapter")
        return compatible.contains(assetPack.id)
    }
}
```

No `AssetPack`-taking compatibility check exists in the public swiftinterface (a binary-only `isCompatible` symbol exists but doesn't compile from source) — gate by membership in `compatibleAdapterIdentifiers(name:)` or by pack-ID convention.

---

## BADownloaderExtension (server-hosted)

### Overview

`BADownloaderExtension` is the unmanaged server-download extension protocol (iOS 16.1+). Use it when:
- Hosting `.aar` archives on your own CDN with download-level control
- Supporting OS versions below iOS 26
- Needing custom download decisions beyond pack-ID filtering

For **managed** server-hosted packs, adopt `ManagedDownloaderExtension` instead — it refines `BADownloaderExtension` and adds `shouldDownload(_:)` (`StoreDownloaderExtension` is its Apple-hosted refinement).

```swift
import BackgroundAssets
import ExtensionFoundation

@main
struct DownloaderExtension: BADownloaderExtension {
    // The scheduling entry point: the system asks which downloads to start
    // for an install / periodic / update content request.
    func downloads(
        for request: BAContentRequest,
        manifestURL: URL,
        extensionInfo: BAAppExtensionInfo
    ) -> Set<BADownload> {
        // Build BAURLDownload values for the packs this device needs
        return []
    }

    func backgroundDownload(
        _ finishedDownload: BADownload,
        finishedWithFileURL fileURL: URL
    ) {
        // Move the file to your shared container
    }

    func backgroundDownload(
        _ failedDownload: BADownload,
        failedWithError error: any Error
    ) {
        // Retry policy, logging
    }

    // Optional: respond to auth challenges for protected CDNs
    func backgroundDownload(
        _ download: BADownload,
        didReceive challenge: URLAuthenticationChallenge
    ) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        (.performDefaultHandling, nil)
    }
}
```

Only the auth-challenge handler is `async`; the finished/failed handlers are synchronous. `extensionWillTerminate()` also exists on the protocol but is deprecated since iOS 16.4 ("will not be invoked in all applicable circumstances and should not be relied upon") — don't put required cleanup there. The extension runs in the system's `nsbackgroundassetsd` context, not your app process. Communication with the host app goes through the shared App Group declared in `BAAppGroupID`.

---

## Unmanaged Legacy API

For OS versions before iOS 26 or apps that need fine download control.

### BADownloadManager

```swift
import BackgroundAssets

let manager = BADownloadManager.shared
manager.delegate = self  // BADownloadManagerDelegate

// Schedule a download
let url = URL(string: "https://example.com/assets/pack.aar")!
let download = BAURLDownload(
    identifier: "pack",
    request: URLRequest(url: url),
    essential: true,
    fileSize: 50_000_000,
    applicationGroupIdentifier: "group.com.example.app",
    priority: .default
)

try manager.startForegroundDownload(download)
// or
try manager.scheduleDownload(download)
```

### BAURLDownload

```swift
// iOS 16.4+ (the essential/priority initializer); no default arguments
public init(
    identifier: String,
    request: URLRequest,
    essential: Bool,
    fileSize: Int,
    applicationGroupIdentifier: String,
    priority: BADownload.Priority
)
```

### BADownload.State

```swift
public enum State {
    case created
    case waiting
    case downloading
    case finished
    case failed
}
```

### BADownload.Priority

A typed-extensible integer (`NS_TYPED_EXTENSIBLE_ENUM`) — imports as a struct with static constants, not an enum:

```swift
public struct Priority { /* RawRepresentable over Int */ }
// BADownload.Priority.min, .default, .max
```

### BAContentRequest

The framework distinguishes three content-request types, delivered to your extension's `downloads(for:manifestURL:extensionInfo:)` scheduling entry point:

```swift
public enum BAContentRequest {
    case install     // First-install event
    case periodic    // System-scheduled periodic refresh
    case update      // App-update event
}
```

---

## Info.plist Keys

Authoritative reference of every Background Assets Info.plist key.

| Key | Type | Layer | Purpose |
|-----|------|-------|---------|
| `BAHasManagedAssetPacks` | Boolean | Managed | Opt into managed asset packs (iOS 26+) |
| `BAUsesAppleHosting` | Boolean | Managed | Use Apple-hosted asset packs (requires Apple to manage CDN and quotas) |
| `BAAppGroupID` | String | Managed + Unmanaged | App Group identifier shared between the app and its downloader extension |
| `BAManifestURL` | String | Unmanaged | URL serving the manifest JSON describing available packs |
| `BAEssentialMaxInstallSize` | Number (bytes) | Unmanaged | Maximum essential asset size for first install |
| `BAMaxInstallSize` | Number (bytes) | Unmanaged | Maximum total asset size for first install |
| `BAInitialDownloadRestrictions` | Dictionary | Unmanaged | Restrictions applied during initial download (network, power) |

### Managed Apple-hosted minimal set

```xml
<key>BAHasManagedAssetPacks</key>
<true/>
<key>BAUsesAppleHosting</key>
<true/>
<key>BAAppGroupID</key>
<string>group.com.example.app</string>
```

### Managed server-hosted minimal set

```xml
<key>BAHasManagedAssetPacks</key>
<true/>
<key>BAAppGroupID</key>
<string>group.com.example.app</string>
```

(No `BAUsesAppleHosting`; manifest URL configured by your `BADownloaderExtension`.)

### Unmanaged legacy minimal set

```xml
<key>BAManifestURL</key>
<string>https://example.com/assets/Manifest.json</string>
<key>BAEssentialMaxInstallSize</key>
<integer>104857600</integer>
<key>BAMaxInstallSize</key>
<integer>524288000</integer>
```

---

## Manifest Schema

Asset packs are described by `Manifest.json` files packaged into `.aar` archives via `xcrun ba-package`.

### Minimal example

```json
{
    "assetPackID": "Tutorial",
    "downloadPolicy": {
        "essential": {
            "installationEventTypes": ["firstInstallation"]
        }
    },
    "fileSelectors": [
        {"file": "Videos/Introduction.m4v"}
    ],
    "platforms": []
}
```

### Field reference

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `assetPackID` | String | Yes | Unique identifier for the asset pack |
| `downloadPolicy` | Object | Yes | One of `essential`, `prefetch`, `onDemand` |
| `fileSelectors` | Array | Yes | Files to include — each item has a `file` or `directory` key (relative path; `directory` is recursive) |
| `platforms` | Array | Yes | Empty array = all platforms; or list specific platforms |
| `sourceRoot` `OS27` | String | No | Relative path from the manifest's location to the root against which file selectors resolve |
| `language` `OS27` | String | No | BCP-47 tag marking the pack as localized (see Localized Asset Packs above) |

### Download policy shapes

```json
// essential — downloaded during install, contributes to App Store install progress
"downloadPolicy": {
    "essential": {
        "installationEventTypes": ["firstInstallation"]
    }
}

// prefetch — starts during install, may continue in background after
"downloadPolicy": {
    "prefetch": {
        "installationEventTypes": ["firstInstallation", "subsequentUpdate"]
    }
}

// onDemand — empty object; downloaded only on explicit API call
"downloadPolicy": {
    "onDemand": {}
}
```

`installationEventTypes` values:
- `firstInstallation` — pack is downloaded the first time the app installs
- `subsequentUpdate` — pack is re-evaluated on each app update

### Platform constraints

- Apple-Hosted asset packs must not contain macOS executable code (Apple's hosting rules exclude it)
- Asset packs can contain any file type otherwise (images, audio, video, JSON, ML model files, `.fmadapter` packs)

---

## Errors

### ManagedBackgroundAssetsError

```swift
public enum ManagedBackgroundAssetsError: CustomStringConvertible, LocalizedError {
    case assetPackNotFound(withID: String)
    case fileNotFound(at: FilePath)
}
```

| Case | Meaning | Response |
|------|---------|----------|
| `assetPackNotFound` | Pack ID not present in manifest (or not yet downloaded) | Verify `assetPackID` matches manifest and server response |
| `fileNotFound` | File missing within an otherwise-available pack | Verify `fileSelectors` in manifest match the path you're querying |

### BAErrorCode

```swift
public enum BAErrorCode: Int {
    case downloadAlreadyScheduled
    case downloadBackgroundActivityProhibited
    case downloadWouldExceedAllowance
    case sessionDownloadAllowanceExceeded
}
```

| Case | Meaning | Response |
|------|---------|----------|
| `downloadAlreadyScheduled` | A download for this pack is already pending | Subscribe to `statusUpdates` instead of restarting |
| `downloadBackgroundActivityProhibited` | User disabled "Background Activity" in Settings | Prompt user, offer foreground fallback |
| `downloadWouldExceedAllowance` | Pack would exceed per-app storage allowance | Free up storage with `remove(assetPackWithID:)` |
| `sessionDownloadAllowanceExceeded` | Cumulative session downloads exceeded quota | Wait and retry later |

### Foundation Models adapter errors

```swift
public enum SystemLanguageModel.Adapter.AssetError: Error, LocalizedError, Sendable {
    case compatibleAdapterNotFound(_:)  // No adapter variant matches current base model
    case invalidAdapterName(_:)          // Adapter name violates the /fmadapter-\w+-\w+/ regex
    case invalidAsset(_:)                // Asset pack files are malformed
}
```

The `AssetError` cases each carry a `Context` value; check `errorDescription` for human-readable detail. Like the rest of the adapter runtime, `AssetError` is deprecated from 26.4 in the 27 SDK.

---

## Tooling

### xcrun ba-package

Authors and packages asset packs. Ships with Xcode 26+ on macOS; standalone Linux and Windows downloads are also available.

```bash
# Generate a manifest template
xcrun ba-package template -o Manifest.json

# Package the manifest + referenced files into a .aar archive
xcrun ba-package Manifest.json -o Tutorial.aar

# Evaluate a manifest without packaging (Xcode 27) — validates structure
# and prints the file paths its selectors match
xcrun ba-package evaluate Manifest.json
```

A `download-manifest` subcommand additionally works with download manifests for self-hosted asset packs. (There is no archive-inspection subcommand.)

The resulting `.aar` archive is what you upload to App Store Connect (Apple-hosted) or place on your CDN (server-hosted).

#### Steam depot conversion (Xcode 27)

The `convert` subcommand turns a Steam depot build script (`.vdf`) into an asset pack manifest:

```bash
# Convert a Steam depot to an asset pack manifest
xcrun ba-package convert --asset-pack-id voice-english -l en-US --on-demand voice-english.vdf -o voice-english.json

# Then package the generated manifest as usual
xcrun ba-package voice-english.json -o voice-english.aar
```

Three arguments: the asset pack ID, the language ID (if applicable), and the desired download policy. The `convert` subcommand requires Xcode 27 on macOS; Apple says the same converter is coming soon to Linux and Windows.

### xcrun ba-serve

Runs a local HTTPS mock server for testing asset packs without uploading. Requires Developer Mode enabled on test devices.

```bash
# Serve one or more archives over HTTPS on localhost
xcrun ba-serve --host localhost Tutorial.aar HighQualityTextures.aar

# Configure a base URL the device should query (useful for managed packs)
xcrun ba-serve url-override "https://localhost:PORT"
```

Setup on the test device:
1. **Enable Developer Mode**: Settings > Privacy & Security > Developer Mode
2. **Install the root CA cert** generated by `ba-serve` via Apple Configurator (App Store ID 1037126344)
3. **Configure URL override** on iOS / iPadOS / tvOS / visionOS via Settings > Developer > Development Overrides

`ba-serve` runs HTTPS only — plain HTTP requests are rejected.

### Xcode 27 mock server

When you run your project in Xcode 27, a Background Assets mock server automatically starts and attaches to the debug session to serve assets — no manual `ba-serve` setup for the simulator/debug loop. Select the folder containing your packaged asset packs in the scheme editor: Edit Scheme > Run, next to the StoreKit Configuration drop-down.

### Unity plug-ins (Background Assets + StoreKit)

Two Apple Unity plug-ins — **Background Assets** and **StoreKit** — joined the Apple Unity plug-in portfolio at WWDC 2026, alongside Apple's existing plug-ins on GitHub. Each exposes a C#-based Unity API bridging to the native framework. Build/package/test requirements: Xcode 27, Python 3, and Unity 2022 LTS or later (built with the same Python script as the other Apple Unity plug-ins).

C# bridge shapes from the session (Background Assets side):

```csharp
using Apple.BackgroundAssets;

AssetPackManifest manifest = await AssetPackManager.GetManifestAsync();
AssetPack assetPack = manifest.GetAssetPack(assetPackId);
await foreach (AssetPackManager.DownloadStatusUpdate statusUpdate
               in AssetPackManager.DownloadStatusUpdatesAsync(assetPackId)) {
    // Update download progress in UI
}
await AssetPackManager.EnsureLocalAvailabilityOfAssetPackAsync(assetPack);
```

For the StoreKit plug-in's C# surface (`Product.FetchProducts`, `product.Purchase()`, `Transaction.Updates`, `Transaction.GetCurrentEntitlements()`), see `skills/in-app-purchases.md`.

---

## Apple-Hosted Asset Pack Quotas

| Resource | Limit | Notes |
|----------|-------|-------|
| Total compressed asset packs across versions | **200 GB** per app | Sum of "asset pack total" across all versions in the App Store Connect record |
| Asset pack count | **100** per app | Across all versions |
| Per-pack practical limit | None documented | Apple-Hosted Background Assets "hosts up to 200GB of compressed assets" total |

### "Asset pack total" calculation rules

Apple sums the maximum size over all versions of each asset pack record eligible for TestFlight or App Store. Statuses **excluded** from quota:
- Awaiting Upload
- Processing
- Failed TestFlight
- Superseded

Apple's documented example:
> "AssetPackID1 has two versions: version 1 is 4 GB, and version 2 is 2 GB. AssetPackID2 has one version: version 1 is 1 GB. The asset pack total for this app is 5 GB."

Quota warnings:
- Email + App Store Connect banner at **80% of limit**
- Archive packs to reclaim quota (removes all versions from the calculation)

### Upload paths for Apple-hosted

Asset packs upload **independently of app builds** via:
- **Transporter** (macOS app)
- **`altool`** command-line tool
- **`iTMSTransporter`** command-line tool
- **App Store Connect REST API**

---

## Foundation Models Adapter Bridge

The Foundation Models framework's adapter loading hooks directly into Background Assets. This section captures the cross-framework API surface.

**Status (27 SDK)**: the custom-adapter runtime — `SystemLanguageModel.Adapter`, `SystemLanguageModel(adapter:guardrails:)`, and `compatibleAdapterIdentifiers(name:)` — is retroactively **deprecated from 26.4 and obsoleted at 27.0** in the 27 SDK (iOS / macOS / visionOS; no deprecation appears in the 26.5 SDK). Compile-verified: building with the 27 SDK for an iOS 27 deployment target fails ("'Adapter' was obsoleted in iOS 27.0"); deployment targets of 26.x still compile. Apple states no replacement in the beta 1 interface — treat adapter delivery as a 26-era surface and re-check later betas. The Background Assets delivery mechanics below are unaffected; only the FM-side consumption API is going away.

### SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name:)

```swift
static func compatibleAdapterIdentifiers(name: String) -> [String]
```

Returns asset pack identifiers compatible with the current base model, in descending preference order. On Apple Intelligence-capable devices, the result is guaranteed to be non-empty if any compatible adapter has been uploaded for the supplied `name`.

```swift
let ids = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: "MyAdapter")
guard let preferredID = ids.first else { return }
// Use AssetPackManager.shared.statusUpdates(forAssetPackWithID: preferredID)
```

### SystemLanguageModel.Adapter.removeObsoleteAdapters()

```swift
static func removeObsoleteAdapters() throws
```

Removes adapter asset packs that no longer match any current base model. Call at app launch and after OS upgrades.

---

## Complete Patterns

### Pattern 1: Apple-hosted managed pack lifecycle

```swift
import BackgroundAssets

@MainActor
final class TutorialAssetController {
    static let packID = "Tutorial"

    func ensureReady() async throws {
        // 26 path; on OS 27 prefer: AssetPackManager.shared.manifest.assetPack(withID:)
        let pack = try await AssetPackManager.shared.assetPack(withID: Self.packID)
        try await AssetPackManager.shared.ensureLocalAvailability(of: pack)
    }

    func video() throws -> FileDescriptor {
        try AssetPackManager.shared.descriptor(
            for: "Videos/Introduction.m4v",
            searchingInAssetPackWithID: Self.packID
        )
    }

    func dispose() async throws {
        try await AssetPackManager.shared.remove(assetPackWithID: Self.packID)
    }
}
```

### Pattern 2: Stream-driven SwiftUI progress

```swift
struct AssetDownloadView: View {
    @State private var progress: Double = 0
    @State private var status: String = "Idle"
    let packID: String

    var body: some View {
        VStack {
            ProgressView(value: progress)
            Text(status)
        }
        .task {
            let updates = AssetPackManager.shared
                .statusUpdates(forAssetPackWithID: packID)
            for await update in updates {
                switch update {
                case .began: status = "Starting"
                case .paused: status = "Paused"
                case .downloading(_, let p):
                    progress = p.fractionCompleted
                    status = "Downloading"
                case .finished:
                    progress = 1
                    status = "Ready"
                case .failed(_, let error):
                    status = "Failed: \(error.localizedDescription)"
                @unknown default:
                    break
                }
            }
        }
    }
}
```

### Pattern 3: Foundation Models adapter delivery

> 26-era pattern: the `SystemLanguageModel.Adapter` runtime is deprecated 26.4 / obsoleted 27.0 in the 27 SDK (see the Adapter Bridge status note). Compiles only for pre-27 deployment targets.

```swift
import BackgroundAssets
import FoundationModels

@MainActor
final class AdapterLifecycle {
    func prepare(name: String) async throws -> LanguageModelSession {
        // Clean up adapters that don't match this OS version
        try SystemLanguageModel.Adapter.removeObsoleteAdapters()

        // Pick the compatible variant
        let ids = SystemLanguageModel.Adapter
            .compatibleAdapterIdentifiers(name: name)
        guard let preferredID = ids.first else {
            throw AdapterError.noCompatibleVariant
        }

        // Stream status until available
        let updates = AssetPackManager.shared
            .statusUpdates(forAssetPackWithID: preferredID)
        for await update in updates {
            switch update {
            case .finished:
                let adapter = try SystemLanguageModel.Adapter(name: name)
                let model = SystemLanguageModel(adapter: adapter)
                return LanguageModelSession(model: model)
            case .failed(_, let error):
                throw error
            default:
                continue
            }
        }
        throw AdapterError.streamEnded
    }

    enum AdapterError: Error {
        case noCompatibleVariant
        case streamEnded
    }
}
```

### Pattern 4: Manifest authoring + local testing

```bash
# 1. Generate manifest template
xcrun ba-package template -o Manifest.json

# 2. Edit Manifest.json
cat > Manifest.json <<EOF
{
    "assetPackID": "HighQualityTextures",
    "downloadPolicy": {"onDemand": {}},
    "fileSelectors": [
        {"directory": "Textures"}
    ],
    "platforms": []
}
EOF

# 3. Package
xcrun ba-package Manifest.json -o HighQualityTextures.aar

# 4. Evaluate the manifest (Xcode 27)
xcrun ba-package evaluate Manifest.json

# 5. Serve locally for device testing
xcrun ba-serve --host localhost HighQualityTextures.aar
```

### Pattern 5: Custom server-hosted extension

```swift
import BackgroundAssets
import ExtensionFoundation

@main
struct CustomDownloaderExtension: BADownloaderExtension {
    func downloads(
        for request: BAContentRequest,
        manifestURL: URL,
        extensionInfo: BAAppExtensionInfo
    ) -> Set<BADownload> {
        guard request == .install || request == .update else { return [] }
        let download = BAURLDownload(
            identifier: "tutorial",
            request: URLRequest(url: URL(string: "https://cdn.example.com/Tutorial.aar")!),
            essential: true,
            fileSize: 50_000_000,
            applicationGroupIdentifier: "group.com.example.app",
            priority: .default
        )
        return [download]
    }

    func backgroundDownload(
        _ finishedDownload: BADownload,
        finishedWithFileURL fileURL: URL
    ) {
        // Move to shared container
        let sharedURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.app")!
            .appendingPathComponent("Tutorial.aar")
        try? FileManager.default.moveItem(at: fileURL, to: sharedURL)
    }

    func backgroundDownload(
        _ failedDownload: BADownload,
        failedWithError error: any Error
    ) {
        // Inspect error; system retries with backoff
    }
}
```

---

## API Quick Reference

- **`AssetPackManager.shared`** — Actor. Methods: `manifest` (27; replaces `assetPack(withID:)` + `allAssetPacks`, both deprecated 27), `ensureLocalAvailability(of:)` (deprecated 26.4), `ensureLocalAvailability(of:requireLatestVersion:)` (26.4), `ensureLocalAvailability(of:requireLatestVersions:)` (Set, 27), `statusUpdates`, `statusUpdates(forAssetPackWithID:)`, `localStatus(ofAssetPackWithID:)`, `status(relativeTo:)`, `assetPackIsAvailableLocally(withID:)`, `contents(at:searchingInAssetPackWithID:options:)`, `descriptor(for:searchingInAssetPackWithID:)`, `url(for:)`, localized variants `contents(at:asLocalizedFor:options:)` / `descriptor(for:asLocalizedFor:)` / `url(for:asLocalizedFor:)` (27), `resolvedLanguage` / `locallyAvailableLanguages` / `reconcilePreferredLanguages()` (27), `checkForUpdates()`, `remove(assetPackWithID:)`
- **`AssetPackManifest`** — `assetPacks`, `assetPack(withID:)` (27), `primaryLanguage` / `availableLanguages` / `resolvedLanguage` / `localizedAssetPacks` / `localizedAssetPacks(for:)` (27)
- **`AssetPack.language: Locale.Language?`** (27) — `nil` when the pack isn't localized
- **`AssetPackManager.LocalAvailabilityError`** (27) — `successes: Set<AssetPack>`, `failures: [AssetPack: any Error]`
- **`AssetPack.Status`** — `OptionSet` flags (membership-test, don't switch): `downloadAvailable`, `downloading`, `downloaded`, `upToDate`, `outOfDate`, `obsolete`, `updateAvailable`; stream-only `DownloadStatusUpdate` enum cases (unlabeled payloads): `began(AssetPack)`, `paused(AssetPack)`, `downloading(AssetPack, Progress)`, `finished(AssetPack)`, `failed(AssetPack, Error)`
- **Extensions** — `StoreDownloaderExtension` (Apple-hosted), `BADownloaderExtension` (server-hosted), `ManagedDownloaderExtension` (parent)
- **Unmanaged types** — `BADownloadManager`, `BAURLDownload`, `BADownload`, `BADownload.State`, `BADownload.Priority`, `BAContentRequest`
- **Errors** — `ManagedBackgroundAssetsError.assetPackNotFound`, `.fileNotFound`; `BAErrorCode.downloadAlreadyScheduled`, `.downloadBackgroundActivityProhibited`, `.downloadWouldExceedAllowance`, `.sessionDownloadAllowanceExceeded`
- **Info.plist** — `BAHasManagedAssetPacks`, `BAUsesAppleHosting`, `BAAppGroupID`, `BAManifestURL`, `BAEssentialMaxInstallSize`, `BAMaxInstallSize`, `BAInitialDownloadRestrictions`
- **Tooling** — `xcrun ba-package template`, `xcrun ba-package <manifest> -o <archive>`, `xcrun ba-package download-manifest` (self-hosted), `xcrun ba-package convert` (Steam `.vdf` → manifest, Xcode 27), `xcrun ba-package evaluate` (Xcode 27), `xcrun ba-serve --host <host> <archives...>`, `xcrun ba-serve url-override <url>`, Xcode 27 auto-attached mock server (scheme Run settings)
- **FM bridge** — `SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name:)`, `.removeObsoleteAdapters()` (deprecated 26.4 / obsoleted 27.0 in the 27 SDK — see the Adapter Bridge status note)

---

## Resources

**WWDC**: 2025-325, 2026-378

**Docs**: /backgroundassets, /backgroundassets/creating-managed-asset-packs, /backgroundassets/testing-asset-packs-locally, /backgroundassets/downloading-apple-hosted-asset-packs, /help/app-store-connect/reference/app-uploads/apple-hosted-asset-pack-size-limits, /help/app-store-connect/manage-asset-packs/overview-of-apple-hosted-asset-packs

**Skills**: skills/background-assets.md, skills/background-processing.md, skills/in-app-purchases.md, axiom-ai (skills/foundation-models-adapters-ref.md)

---

**Last Updated**: 2026-06-11
**Platforms**: iOS 26+, iPadOS 26+, macOS 26+, tvOS 26+, visionOS 26+ (managed); iOS 16.1+ (unmanaged legacy)
**Skill Type**: Reference
**Content**: All public APIs, Info.plist keys, manifest schema, tooling commands, Foundation Models adapter bridge
