
# Background Assets Framework — Complete API Reference

## Overview

The Background Assets framework (`BackgroundAssets`) delivers asset packs to apps through system-managed downloads. This reference covers every public API, Info.plist key, error type, manifest schema, and tooling command. For when-and-why decisions, see `skills/background-assets.md`.

### Two layers

- **Managed asset packs** (iOS 26+ / iPadOS 26+ / macOS 26+ / tvOS 26+ / visionOS 26+): high-level `AssetPackManager` actor and download policies. Use `StoreDownloaderExtension` for Apple-hosted, `BADownloaderExtension` for server-hosted. The recommended path for new apps.
- **Unmanaged legacy** (iOS 16+ / 15+ unmanaged): lower-level `BADownloadManager`, `BAURLDownload`, `BADownloaderExtension` with manual delegate logic. Use only when targeting OS versions below 26 or when you need download-level control the managed layer doesn't expose.

### Distribution

- All platforms except **watchOS** support Background Assets for App Store distribution
- Asset pack archives use the `.aar` format
- Transport is HTTPS-only — plain HTTP is not supported

---

## When to Use This Reference

Use this reference when:
- Looking up `AssetPackManager` method signatures
- Looking up `AssetPack.Status` cases
- Looking up Info.plist keys
- Looking up `BAErrorCode` cases for error handling
- Writing a `StoreDownloaderExtension` or `BADownloaderExtension`
- Authoring a `Manifest.json` for `xcrun ba-package`
- Setting up local testing with `xcrun ba-serve`
- Integrating Background Assets with Foundation Models adapter delivery

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

```swift
// Single pack
let assetPack = try await AssetPackManager.shared.assetPack(withID: "Tutorial")

// All packs declared for the app
let packs = AssetPackManager.shared.allAssetPacks
```

### Ensuring availability

```swift
// Block until the pack is locally available (downloads if needed)
try await AssetPackManager.shared.ensureLocalAvailability(of: assetPack)

// Force a fresh version check before returning
try await AssetPackManager.shared.ensureLocalAvailability(
    of: assetPack,
    requireLatestVersion: true
)
```

`ensureLocalAvailability(of:)` returns when the pack's state is `.downloaded` or `.upToDate`. Throws on download failure or unrecoverable state.

### Status streaming

`statusUpdates` is an `AsyncSequence` that emits each status change.

```swift
// All packs
for await update in AssetPackManager.shared.statusUpdates {
    // update is keyed by asset pack
}

// Specific pack
let updates = AssetPackManager.shared.statusUpdates(forAssetPackWithID: "Tutorial")
for await status in updates {
    switch status {
    case .began(let pack):
        // Download just started
        break
    case .paused(let pack):
        // System paused (Low Power Mode, Background Activity off, network)
        break
    case .downloading(let pack, let progress):
        // Bind progress.fractionCompleted to a ProgressView
        break
    case .finished(let pack):
        // Pack is now local — safe to consume
        break
    case .failed(let pack, let error):
        // Inspect error; show retry UI
        break
    @unknown default:
        break
    }
}
```

### Status queries

```swift
// Synchronous status query
let status = AssetPackManager.shared.status(ofAssetPackWithID: "Tutorial")
let localStatus = AssetPackManager.shared.localStatus(ofAssetPackWithID: "Tutorial")
let isLocal = AssetPackManager.shared.assetPackIsAvailableLocally(withID: "Tutorial")

// Pack-relative comparison
let cmp = AssetPackManager.shared.status(relativeTo: someAssetPack)
```

### Reading file contents

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
defer { try descriptor.close() }
// Read from descriptor.fileHandle as needed

// Resolve a URL for an opened pack
let url = try AssetPackManager.shared.url(for: "Videos/Introduction.m4v")
```

### Update lifecycle

```swift
// Force a remote check for newer versions
try await AssetPackManager.shared.checkForUpdates()

// Remove a pack to free storage (system does NOT auto-evict)
try await AssetPackManager.shared.remove(assetPackWithID: "Tutorial")
```

Call `checkForUpdates()` at app launch and after OS upgrades. Call `remove(assetPackWithID:)` once your code is done with a pack; the system keeps packs installed indefinitely otherwise.

---

## AssetPack.Status

```swift
public enum Status {
    case downloadAvailable
    case downloading
    case downloaded
    case upToDate
    case outOfDate
    case obsolete
    case updateAvailable
}
```

Stream-only cases produced by `statusUpdates`:

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

```swift
@main
struct AdapterDownloaderExtension: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        // Always allow non-FM-adapter packs
        if !assetPack.id.hasPrefix("fmadapter-") {
            return true
        }
        // For FM adapter packs, only download if compatible with current base model
        return SystemLanguageModel.Adapter.isCompatible(assetPack)
    }
}
```

`SystemLanguageModel.Adapter.isCompatible(_:)` is a static method on the FM type that takes an `AssetPack` and returns `true` if the pack's adapter variant matches the device's current base-model version.

---

## BADownloaderExtension (server-hosted)

### Overview

`BADownloaderExtension` is the legacy / server-hosted extension. Use it when:
- Hosting `.aar` archives on your own CDN
- Supporting OS versions below iOS 26
- Needing custom download decisions beyond pack-ID filtering

```swift
import BackgroundAssets
import ExtensionFoundation

@main
struct DownloaderExtension: BADownloaderExtension {
    func applicationDidInstall() async {
        // Schedule essential / prefetch downloads
    }

    func applicationDidUpdate() async {
        // Re-evaluate packs after app update
    }

    func extensionWillTerminate() async {
        // Persist any pending state
    }

    func backgroundDownload(
        _ failedDownload: BADownload,
        failedWithError: any Error
    ) async {
        // Retry policy, logging
    }

    func backgroundDownload(
        _ finishedDownload: BADownload,
        finishedWithFileURL: URL
    ) async {
        // Move the file to your shared container
    }
}
```

The extension runs in the system's `nsbackgroundassetsd` context, not your app process. Communication with the host app goes through the shared App Group declared in `BAAppGroupID`.

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
public init(
    identifier: String,
    request: URLRequest,
    essential: Bool,
    fileSize: Int,
    applicationGroupIdentifier: String,
    priority: BADownload.Priority = .default
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

```swift
public enum Priority {
    case `default`
    case max
    case min
}
```

### BAContentRequest

For periodic update checks, the framework distinguishes three request types:

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
| `fileSelectors` | Array | Yes | Files to include — each item has a `file` key (relative path) |
| `platforms` | Array | Yes | Empty array = all platforms; or list specific platforms |

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

- Apple-Hosted Background Assets supports **CPU and GPU executables only** — macOS executables are excluded
- Asset packs can contain any file type otherwise (images, audio, video, JSON, ML model files, `.fmadapter` packs)

---

## Errors

### ManagedBackgroundAssetsError

```swift
public enum ManagedBackgroundAssetsError: Error {
    case assetPackNotFound
    case fileNotFound
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

The `AssetError` cases each carry a `Context` value; check `errorDescription` for human-readable detail.

---

## Tooling

### xcrun ba-package

Authors and packages asset packs. Ships with Xcode 16+ on macOS; standalone Linux and Windows downloads are also available.

```bash
# Generate a manifest template
xcrun ba-package template -o Manifest.json

# Package the manifest + referenced files into a .aar archive
xcrun ba-package Manifest.json -o Tutorial.aar

# Inspect an existing archive
xcrun ba-package info Tutorial.aar

# Validate a manifest without packaging
xcrun ba-package validate Manifest.json
```

The resulting `.aar` archive is what you upload to App Store Connect (Apple-hosted) or place on your CDN (server-hosted).

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

### SystemLanguageModel.Adapter.isCompatible(_:)

```swift
static func isCompatible(_ assetPack: AssetPack) -> Bool
```

Returns `true` if the asset pack's adapter variant matches the device's current base-model version. Use in `StoreDownloaderExtension.shouldDownload(_:)` to gate adapter downloads to compatible variants:

```swift
@main
struct AdapterDownloader: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        if assetPack.id.hasPrefix("fmadapter-") {
            return SystemLanguageModel.Adapter.isCompatible(assetPack)
        }
        return true
    }
}
```

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
        {"file": "Textures/*"}
    ],
    "platforms": []
}
EOF

# 3. Package
xcrun ba-package Manifest.json -o HighQualityTextures.aar

# 4. Validate
xcrun ba-package info HighQualityTextures.aar
xcrun ba-package validate Manifest.json

# 5. Serve locally for device testing
xcrun ba-serve --host localhost HighQualityTextures.aar
```

### Pattern 5: Custom server-hosted extension

```swift
import BackgroundAssets
import ExtensionFoundation

@main
struct CustomDownloaderExtension: BADownloaderExtension {
    func applicationDidInstall() async {
        let download = BAURLDownload(
            identifier: "tutorial",
            request: URLRequest(url: URL(string: "https://cdn.example.com/Tutorial.aar")!),
            essential: true,
            fileSize: 50_000_000,
            applicationGroupIdentifier: "group.com.example.app",
            priority: .default
        )
        do {
            try BADownloadManager.shared.scheduleDownload(download)
        } catch {
            // Log; system will retry per its scheduling policy
        }
    }

    func backgroundDownload(
        _ finishedDownload: BADownload,
        finishedWithFileURL fileURL: URL
    ) async {
        // Move to shared container
        let sharedURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.app")!
            .appendingPathComponent("Tutorial.aar")
        try? FileManager.default.moveItem(at: fileURL, to: sharedURL)
    }

    func backgroundDownload(
        _ failedDownload: BADownload,
        failedWithError error: any Error
    ) async {
        // Inspect error; system retries with backoff
    }
}
```

---

## API Quick Reference

- **`AssetPackManager.shared`** — Actor. Methods: `assetPack(withID:)`, `allAssetPacks`, `ensureLocalAvailability(of:)`, `ensureLocalAvailability(of:requireLatestVersion:)`, `statusUpdates`, `statusUpdates(forAssetPackWithID:)`, `status(ofAssetPackWithID:)`, `localStatus(ofAssetPackWithID:)`, `status(relativeTo:)`, `assetPackIsAvailableLocally(withID:)`, `contents(at:searchingInAssetPackWithID:options:)`, `descriptor(for:searchingInAssetPackWithID:)`, `url(for:)`, `checkForUpdates()`, `remove(assetPackWithID:)`
- **`AssetPack.Status`** — `downloadAvailable`, `downloading`, `downloaded`, `upToDate`, `outOfDate`, `obsolete`, `updateAvailable`; stream-only: `began`, `paused`, `downloading(_:progress:)`, `finished`, `failed(_:error:)`
- **Extensions** — `StoreDownloaderExtension` (Apple-hosted), `BADownloaderExtension` (server-hosted), `ManagedDownloaderExtension` (parent)
- **Unmanaged types** — `BADownloadManager`, `BAURLDownload`, `BADownload`, `BADownload.State`, `BADownload.Priority`, `BAContentRequest`
- **Errors** — `ManagedBackgroundAssetsError.assetPackNotFound`, `.fileNotFound`; `BAErrorCode.downloadAlreadyScheduled`, `.downloadBackgroundActivityProhibited`, `.downloadWouldExceedAllowance`, `.sessionDownloadAllowanceExceeded`
- **Info.plist** — `BAHasManagedAssetPacks`, `BAUsesAppleHosting`, `BAAppGroupID`, `BAManifestURL`, `BAEssentialMaxInstallSize`, `BAMaxInstallSize`, `BAInitialDownloadRestrictions`
- **Tooling** — `xcrun ba-package template`, `xcrun ba-package <manifest> -o <archive>`, `xcrun ba-package info`, `xcrun ba-package validate`, `xcrun ba-serve --host <host> <archives...>`, `xcrun ba-serve url-override <url>`
- **FM bridge** — `SystemLanguageModel.Adapter.isCompatible(_:)`, `.compatibleAdapterIdentifiers(name:)`, `.removeObsoleteAdapters()`

---

## Resources

**WWDC**: 2025-325

**Docs**: /backgroundassets, /backgroundassets/creating-managed-asset-packs, /backgroundassets/testing-asset-packs-locally, /backgroundassets/downloading-apple-hosted-asset-packs, /help/app-store-connect/reference/app-uploads/apple-hosted-asset-pack-size-limits, /help/app-store-connect/manage-asset-packs/overview-of-apple-hosted-asset-packs

**Skills**: skills/background-assets.md, skills/background-processing.md, axiom-ai (skills/foundation-models-adapters-ref.md)

---

**Last Updated**: 2026-05-16
**Platforms**: iOS 26+, iPadOS 26+, macOS 26+, tvOS 26+, visionOS 26+ (managed); iOS 15+ (unmanaged legacy)
**Skill Type**: Reference
**Content**: All public APIs, Info.plist keys, manifest schema, tooling commands, Foundation Models adapter bridge
