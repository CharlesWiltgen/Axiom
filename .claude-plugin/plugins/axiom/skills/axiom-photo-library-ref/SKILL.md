---
name: axiom-photo-library-ref
description: Reference — PHPickerViewController, PHPickerConfiguration, PhotosPicker, PhotosPickerItem, Transferable, PHPhotoLibrary, PHAsset, PHAssetCreationRequest, PHFetchResult, PHAuthorizationStatus, limited library APIs
user-invocable: true
skill_type: reference
version: 1.0.0
---

# Photo Library API Reference

## Quick Reference

```swift
// SWIFTUI PHOTO PICKER (iOS 16+)
import PhotosUI

@State private var item: PhotosPickerItem?

PhotosPicker(selection: $item, matching: .images) {
    Text("Select Photo")
}
.onChange(of: item) { _, newItem in
    Task {
        if let data = try? await newItem?.loadTransferable(type: Data.self) {
            // Use image data
        }
    }
}

// UIKIT PHOTO PICKER (iOS 14+)
var config = PHPickerConfiguration()
config.selectionLimit = 1
config.filter = .images
let picker = PHPickerViewController(configuration: config)
picker.delegate = self

// SAVE TO CAMERA ROLL
try await PHPhotoLibrary.shared().performChanges {
    PHAssetCreationRequest.creationRequestForAsset(from: image)
}

// CHECK PERMISSION
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
```

---

## PHPickerViewController (iOS 14+)

System photo picker for UIKit apps. No permission required.

### Configuration

```swift
import PhotosUI

var config = PHPickerConfiguration()

// Selection limit (0 = unlimited)
config.selectionLimit = 5

// Filter by asset type
config.filter = .images

// Use photo library (enables asset identifiers)
config = PHPickerConfiguration(photoLibrary: .shared())

// Preferred asset representation
config.preferredAssetRepresentationMode = .automatic  // default
// .current - original format
// .compatible - converted to compatible format
```

### Filter Options

```swift
// Basic filters
PHPickerFilter.images
PHPickerFilter.videos
PHPickerFilter.livePhotos

// Combined filters
PHPickerFilter.any(of: [.images, .videos])

// Exclusion filters (iOS 15+)
PHPickerFilter.all(of: [.images, .not(.screenshots)])
PHPickerFilter.not(.livePhotos)

// Playback style filters (iOS 17+)
PHPickerFilter.any(of: [.cinematicVideos, .slomoVideos])
```

### Presenting

```swift
let picker = PHPickerViewController(configuration: config)
picker.delegate = self
present(picker, animated: true)
```

### Delegate

```swift
extension ViewController: PHPickerViewControllerDelegate {

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        for result in results {
            // Get asset identifier (if using PHPickerConfiguration(photoLibrary:))
            let identifier = result.assetIdentifier

            // Load as UIImage
            result.itemProvider.loadObject(ofClass: UIImage.self) { object, error in
                guard let image = object as? UIImage else { return }
                DispatchQueue.main.async {
                    self.displayImage(image)
                }
            }

            // Load as Data
            result.itemProvider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, error in
                guard let data else { return }
                // Use data
            }

            // Load Live Photo
            result.itemProvider.loadObject(ofClass: PHLivePhoto.self) { object, error in
                guard let livePhoto = object as? PHLivePhoto else { return }
                // Use live photo
            }
        }
    }
}
```

### PHPickerResult Properties

| Property | Type | Description |
|----------|------|-------------|
| `itemProvider` | NSItemProvider | Provides selected asset data |
| `assetIdentifier` | String? | PHAsset identifier (if using photoLibrary config) |

---

## PhotosPicker (SwiftUI, iOS 16+)

SwiftUI view for photo selection. No permission required.

### Basic Usage

```swift
import SwiftUI
import PhotosUI

// Single selection
@State private var selectedItem: PhotosPickerItem?

PhotosPicker(selection: $selectedItem, matching: .images) {
    Label("Select Photo", systemImage: "photo")
}

// Multiple selection
@State private var selectedItems: [PhotosPickerItem] = []

PhotosPicker(
    selection: $selectedItems,
    maxSelectionCount: 5,
    matching: .images
) {
    Text("Select Photos")
}
```

### Filters

```swift
// Images only
matching: .images

// Videos only
matching: .videos

// Images and videos
matching: .any(of: [.images, .videos])

// Live Photos
matching: .livePhotos

// Exclude screenshots (iOS 15+)
matching: .all(of: [.images, .not(.screenshots)])
```

### Selection Behavior

```swift
PhotosPicker(
    selection: $items,
    maxSelectionCount: 10,
    selectionBehavior: .ordered,  // .default, .ordered, .continuous
    matching: .images
) { ... }
```

| Behavior | Description |
|----------|-------------|
| `.default` | Standard multi-select |
| `.ordered` | Selection order preserved |
| `.continuous` | Live updates as user selects (iOS 17+) |

### Embedded Picker (iOS 17+)

```swift
PhotosPicker(
    selection: $items,
    maxSelectionCount: 10,
    selectionBehavior: .continuous,
    matching: .images
) {
    Text("Select")
}
.photosPickerStyle(.inline)  // Embed in view hierarchy
.photosPickerDisabledCapabilities([.selectionActions])
.photosPickerAccessoryVisibility(.hidden, edges: .all)
```

| Style | Description |
|-------|-------------|
| `.presentation` | Modal sheet (default) |
| `.inline` | Embedded in view |
| `.compact` | Single row |

| Disabled Capability | Effect |
|---------------------|--------|
| `.search` | Hide search bar |
| `.collectionNavigation` | Hide albums |
| `.stagingArea` | Hide selection review |
| `.selectionActions` | Hide Add/Cancel |

| Accessory Visibility | Description |
|----------------------|-------------|
| `.hidden`, `.automatic`, `.visible` | Per edge |

### HDR Preservation (iOS 17+)

```swift
PhotosPicker(
    selection: $items,
    matching: .images,
    preferredItemEncoding: .current  // Don't transcode, preserve HDR
) { ... }
```

| Encoding | Description |
|----------|-------------|
| `.automatic` | System decides format |
| `.current` | Original format, preserves HDR |
| `.compatible` | Force compatible format |

### Loading Images from PhotosPickerItem

```swift
// Load as Data (most reliable)
if let data = try? await item.loadTransferable(type: Data.self),
   let image = UIImage(data: data) {
    // Use image
}

// Custom Transferable for direct UIImage
struct ImageTransferable: Transferable {
    let image: UIImage

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            guard let image = UIImage(data: data) else {
                throw TransferError.importFailed
            }
            return ImageTransferable(image: image)
        }
    }
}

// Usage
if let result = try? await item.loadTransferable(type: ImageTransferable.self) {
    let image = result.image
}
```

### PhotosPickerItem Properties

| Property | Type | Description |
|----------|------|-------------|
| `itemIdentifier` | String | Unique identifier |
| `supportedContentTypes` | [UTType] | Available representations |

### PhotosPickerItem Methods

```swift
// Load transferable
func loadTransferable<T: Transferable>(type: T.Type) async throws -> T?

// Load with progress
func loadTransferable<T: Transferable>(
    type: T.Type,
    completionHandler: @escaping (Result<T?, Error>) -> Void
) -> Progress
```

---

## PHPhotoLibrary

Access and modify the photo library.

### Authorization Status

```swift
// Check current status
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

// Request authorization
let newStatus = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
```

### PHAuthorizationStatus

| Status | Description |
|--------|-------------|
| `.notDetermined` | User hasn't been asked |
| `.restricted` | Parental controls limit access |
| `.denied` | User denied access |
| `.authorized` | Full access granted |
| `.limited` | Access to user-selected photos only (iOS 14+) |

### Access Levels

```swift
// Read and write
PHPhotoLibrary.requestAuthorization(for: .readWrite)

// Add only (save photos, no reading)
PHPhotoLibrary.requestAuthorization(for: .addOnly)
```

### Limited Library Picker

```swift
// Present picker to expand limited selection
@MainActor
func presentLimitedLibraryPicker() {
    guard let viewController = UIApplication.shared.keyWindow?.rootViewController else { return }
    PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController)
}

// With completion handler
PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController) { identifiers in
    // identifiers: asset IDs user added
}
```

### Performing Changes

```swift
// Async changes
try await PHPhotoLibrary.shared().performChanges {
    // Create, update, or delete assets
}

// With completion handler
PHPhotoLibrary.shared().performChanges({
    // Changes
}) { success, error in
    // Handle result
}
```

### Change Observer

```swift
class PhotoObserver: NSObject, PHPhotoLibraryChangeObserver {

    override init() {
        super.init()
        PHPhotoLibrary.shared().register(self)
    }

    deinit {
        PHPhotoLibrary.shared().unregisterChangeObserver(self)
    }

    func photoLibraryDidChange(_ changeInstance: PHChange) {
        // Handle changes
        guard let changes = changeInstance.changeDetails(for: fetchResult) else { return }

        DispatchQueue.main.async {
            // Update UI with new fetch result
            let newResult = changes.fetchResultAfterChanges
        }
    }
}
```

---

## PHAsset

Represents an asset in the photo library.

### Fetching Assets

```swift
// All photos
let allPhotos = PHAsset.fetchAssets(with: .image, options: nil)

// With options
let options = PHFetchOptions()
options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
options.fetchLimit = 100
options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)

let recentPhotos = PHAsset.fetchAssets(with: options)

// By identifier
let assets = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
```

### Asset Properties

| Property | Type | Description |
|----------|------|-------------|
| `localIdentifier` | String | Unique ID |
| `mediaType` | PHAssetMediaType | `.image`, `.video`, `.audio` |
| `mediaSubtypes` | PHAssetMediaSubtype | `.photoLive`, `.photoPanorama`, etc. |
| `pixelWidth` | Int | Width in pixels |
| `pixelHeight` | Int | Height in pixels |
| `creationDate` | Date? | When taken |
| `modificationDate` | Date? | Last modified |
| `location` | CLLocation? | GPS location |
| `duration` | TimeInterval | Video duration |
| `isFavorite` | Bool | Marked as favorite |
| `isHidden` | Bool | In hidden album |

### PHAssetMediaType

| Type | Value |
|------|-------|
| `.unknown` | 0 |
| `.image` | 1 |
| `.video` | 2 |
| `.audio` | 3 |

### PHAssetMediaSubtype

| Subtype | Description |
|---------|-------------|
| `.photoPanorama` | Panoramic photo |
| `.photoHDR` | HDR photo |
| `.photoScreenshot` | Screenshot |
| `.photoLive` | Live Photo |
| `.photoDepthEffect` | Portrait mode |
| `.videoStreamed` | Streamed video |
| `.videoHighFrameRate` | Slo-mo video |
| `.videoTimelapse` | Timelapse |
| `.videoCinematic` | Cinematic mode |

---

## PHAssetCreationRequest

Create new assets in the photo library.

### Creating from UIImage

```swift
try await PHPhotoLibrary.shared().performChanges {
    PHAssetCreationRequest.creationRequestForAsset(from: image)
}
```

### Creating from File URL

```swift
try await PHPhotoLibrary.shared().performChanges {
    PHAssetCreationRequest.creationRequestForAssetFromImage(atFileURL: imageURL)
}

// For video
try await PHPhotoLibrary.shared().performChanges {
    PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: videoURL)
}
```

### Creating with Resources

```swift
try await PHPhotoLibrary.shared().performChanges {
    let request = PHAssetCreationRequest.forAsset()

    // Add photo resource
    let options = PHAssetResourceCreationOptions()
    options.shouldMoveFile = true  // Move instead of copy

    request.addResource(with: .photo, fileURL: photoURL, options: options)

    // Set creation date
    request.creationDate = Date()

    // Set location
    request.location = CLLocation(latitude: 37.7749, longitude: -122.4194)
}
```

### Deferred Photo Proxy (iOS 17+)

Save camera proxy photos for background processing:

```swift
// From AVCaptureDeferredPhotoProxy callback
try await PHPhotoLibrary.shared().performChanges {
    let request = PHAssetCreationRequest.forAsset()

    // Use .photoProxy to trigger deferred processing
    request.addResource(with: .photoProxy, data: proxyData, options: nil)
}
```

| Resource Type | Description |
|---------------|-------------|
| `.photo` | Standard photo |
| `.video` | Video file |
| `.photoProxy` | Deferred processing proxy (iOS 17+) |
| `.adjustmentData` | Edit adjustments |

### Getting Created Asset

```swift
try await PHPhotoLibrary.shared().performChanges {
    let request = PHAssetCreationRequest.forAsset()
    request.addResource(with: .photo, fileURL: url, options: nil)

    // Get placeholder for later fetching
    let placeholder = request.placeholderForCreatedAsset
    // placeholder.localIdentifier available after changes complete
}
```

---

## PHFetchResult

Ordered list of assets from a fetch.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `count` | Int | Number of items |
| `firstObject` | T? | First item |
| `lastObject` | T? | Last item |

### Methods

```swift
// Access by index
let asset = fetchResult.object(at: 0)
let asset = fetchResult[0]

// Get multiple
let assets = fetchResult.objects(at: IndexSet(0..<10))

// Iteration
fetchResult.enumerateObjects { asset, index, stop in
    // Process asset
    if shouldStop {
        stop.pointee = true
    }
}

// Check contains
let contains = fetchResult.contains(asset)
let index = fetchResult.index(of: asset)
```

---

## PHImageManager

Request images from assets.

### Request Image

```swift
let manager = PHImageManager.default()

let options = PHImageRequestOptions()
options.deliveryMode = .highQualityFormat
options.resizeMode = .exact
options.isNetworkAccessAllowed = true  // For iCloud photos

let targetSize = CGSize(width: 300, height: 300)

manager.requestImage(
    for: asset,
    targetSize: targetSize,
    contentMode: .aspectFill,
    options: options
) { image, info in
    guard let image else { return }

    // Check if this is the final image
    let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
    if !isDegraded {
        // Final high-quality image
    }
}
```

### PHImageRequestOptions

| Property | Type | Description |
|----------|------|-------------|
| `deliveryMode` | PHImageRequestOptionsDeliveryMode | Quality preference |
| `resizeMode` | PHImageRequestOptionsResizeMode | Resize behavior |
| `isNetworkAccessAllowed` | Bool | Allow iCloud download |
| `isSynchronous` | Bool | Synchronous request |
| `progressHandler` | Block | Download progress |
| `allowSecondaryDegradedImage` | Bool | Extra callback during deferred processing (iOS 17+) |

### Secondary Degraded Image (iOS 17+)

For photos undergoing deferred processing, get an intermediate quality image:

```swift
let options = PHImageRequestOptions()
options.allowSecondaryDegradedImage = true

// Callback order:
// 1. Low quality (immediate, isDegraded = true)
// 2. Medium quality (new, isDegraded = true) -- while processing
// 3. Final quality (isDegraded = false)
```

### Delivery Modes

| Mode | Description |
|------|-------------|
| `.opportunistic` | Fast thumbnail, then high quality |
| `.highQualityFormat` | Only high quality |
| `.fastFormat` | Only fast/degraded |

### Request Video

```swift
manager.requestAVAsset(forVideo: asset, options: nil) { avAsset, audioMix, info in
    guard let avAsset else { return }
    // Use AVAsset for playback
}

// Or export to file
manager.requestExportSession(
    forVideo: asset,
    options: nil,
    exportPreset: AVAssetExportPresetHighestQuality
) { session, info in
    session?.outputURL = outputURL
    session?.outputFileType = .mp4
    session?.exportAsynchronously { ... }
}
```

---

## PHChange

Represents changes to the photo library.

### Getting Change Details

```swift
func photoLibraryDidChange(_ changeInstance: PHChange) {
    guard let changes = changeInstance.changeDetails(for: fetchResult) else { return }

    // Check what changed
    let hasIncrementalChanges = changes.hasIncrementalChanges
    let insertedIndexes = changes.insertedIndexes
    let removedIndexes = changes.removedIndexes
    let changedIndexes = changes.changedIndexes

    // Get new fetch result
    let newResult = changes.fetchResultAfterChanges

    // Update collection view
    DispatchQueue.main.async {
        if hasIncrementalChanges {
            collectionView.performBatchUpdates {
                if let removed = removedIndexes {
                    collectionView.deleteItems(at: removed.map { IndexPath(item: $0, section: 0) })
                }
                if let inserted = insertedIndexes {
                    collectionView.insertItems(at: inserted.map { IndexPath(item: $0, section: 0) })
                }
                if let changed = changedIndexes {
                    collectionView.reloadItems(at: changed.map { IndexPath(item: $0, section: 0) })
                }
            }
        } else {
            collectionView.reloadData()
        }
    }
}
```

---

## Common Code Patterns

### Complete Photo Gallery View

```swift
import SwiftUI
import Photos

@MainActor
class PhotoGalleryViewModel: ObservableObject {
    @Published var assets: [PHAsset] = []
    @Published var authorizationStatus: PHAuthorizationStatus = .notDetermined

    func requestAccess() async {
        authorizationStatus = await PHPhotoLibrary.requestAuthorization(for: .readWrite)

        if authorizationStatus == .authorized || authorizationStatus == .limited {
            fetchAssets()
        }
    }

    func fetchAssets() {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 100

        let result = PHAsset.fetchAssets(with: .image, options: options)
        assets = result.objects(at: IndexSet(0..<result.count))
    }

    func expandLimitedAccess(from viewController: UIViewController) {
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController)
    }
}

struct PhotoGalleryView: View {
    @StateObject private var viewModel = PhotoGalleryViewModel()

    var body: some View {
        Group {
            switch viewModel.authorizationStatus {
            case .authorized, .limited:
                PhotoGridView(assets: viewModel.assets)
            case .denied, .restricted:
                PermissionDeniedView()
            case .notDetermined:
                RequestAccessView {
                    Task { await viewModel.requestAccess() }
                }
            @unknown default:
                EmptyView()
            }
        }
        .task {
            await viewModel.requestAccess()
        }
    }
}
```

---

## Resources

**Docs**: /photosui/phpickerviewcontroller, /photosui/photospicker, /photos/phphotolibrary, /photos/phasset, /photos/phimagemanager

**Skills**: axiom-photo-library, axiom-camera-capture
