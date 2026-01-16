---
name: axiom-photo-library
description: PHPicker, PhotosPicker, photo selection, limited library access, presentLimitedLibraryPicker, save to camera roll, PHPhotoLibrary, PHAssetCreationRequest, Transferable, PhotosPickerItem, photo permissions
user-invocable: true
skill_type: discipline
version: 1.0.0
last_updated: 2026-01-03
apple_platforms: iOS 14+, iPadOS 14+, macOS 13+
---

# Photo Library Access with PhotoKit

Guides you through photo picking, limited library handling, and saving photos to the camera roll using privacy-forward patterns.

## When to Use This Skill

Use when you need to:
- ☑ Let users select photos from their library
- ☑ Handle limited photo library access
- ☑ Save photos/videos to the camera roll
- ☑ Choose between PHPicker and PhotosPicker
- ☑ Load images from PhotosPickerItem
- ☑ Observe photo library changes
- ☑ Request appropriate permission level

## Example Prompts

"How do I let users pick photos in SwiftUI?"
"User says they can't see their photos"
"How do I save a photo to the camera roll?"
"What's the difference between PHPicker and PhotosPicker?"
"How do I handle limited photo access?"
"User granted limited access but can't see photos"
"How do I load an image from PhotosPickerItem?"

## Red Flags

Signs you're making this harder than it needs to be:

- ❌ Using UIImagePickerController (deprecated for photo selection)
- ❌ Requesting full library access when picker suffices (privacy violation)
- ❌ Ignoring `.limited` authorization status (users can't expand selection)
- ❌ Not handling Transferable loading failures (crashes on large photos)
- ❌ Synchronously loading images from picker results (blocks UI)
- ❌ Using PhotoKit APIs when you only need to pick photos (over-engineering)
- ❌ Assuming `.authorized` after user grants access (could be `.limited`)

## Mandatory First Steps

Before implementing photo library features:

### 1. Choose Your Approach

```
What do you need?

┌─ User picks photos (no library browsing)?
│  ├─ SwiftUI app → PhotosPicker (iOS 16+)
│  └─ UIKit app → PHPickerViewController (iOS 14+)
│  └─ NO library permission needed! Picker handles it.
│
├─ Display user's full photo library (gallery UI)?
│  └─ Requires PHPhotoLibrary authorization
│     └─ Request .readWrite for browsing
│     └─ Handle .limited status with presentLimitedLibraryPicker
│
├─ Save photos to camera roll?
│  └─ Requires PHPhotoLibrary authorization
│     └─ Request .addOnly (minimal) or .readWrite
│
└─ Just capture with camera?
   └─ Don't use PhotoKit - see camera-capture skill
```

### 2. Understand Permission Levels

| Level | What It Allows | Request Method |
|-------|---------------|----------------|
| No permission | User picks via system picker | PHPicker/PhotosPicker (automatic) |
| `.addOnly` | Save to camera roll only | `requestAuthorization(for: .addOnly)` |
| `.limited` | User-selected subset only | User chooses in system UI |
| `.authorized` | Full library access | `requestAuthorization(for: .readWrite)` |

**Key insight**: PHPicker and PhotosPicker require NO permission. The system handles privacy.

### 3. Info.plist Keys

```xml
<!-- Required for any PhotoKit access -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Access your photos to share them</string>

<!-- Required if saving photos -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save photos to your library</string>
```

## Core Patterns

### Pattern 1: SwiftUI PhotosPicker (iOS 16+)

**Use case**: Let users select photos in a SwiftUI app.

```swift
import SwiftUI
import PhotosUI

struct ContentView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: Image?

    var body: some View {
        VStack {
            PhotosPicker(
                selection: $selectedItem,
                matching: .images  // Filter to images only
            ) {
                Label("Select Photo", systemImage: "photo")
            }

            if let image = selectedImage {
                image
                    .resizable()
                    .scaledToFit()
            }
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                await loadImage(from: newItem)
            }
        }
    }

    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item else {
            selectedImage = nil
            return
        }

        // Load as Data first (more reliable than Image)
        if let data = try? await item.loadTransferable(type: Data.self),
           let uiImage = UIImage(data: data) {
            selectedImage = Image(uiImage: uiImage)
        }
    }
}
```

**Multi-selection**:
```swift
@State private var selectedItems: [PhotosPickerItem] = []

PhotosPicker(
    selection: $selectedItems,
    maxSelectionCount: 5,
    matching: .images
) {
    Text("Select Photos")
}
```

#### Advanced Filters (iOS 15+/16+)

```swift
// Screenshots only
matching: .screenshots

// Screen recordings only
matching: .screenRecordings

// Slo-mo videos
matching: .sloMoVideos

// Cinematic videos (iOS 16+)
matching: .cinematicVideos

// Depth effect photos
matching: .depthEffectPhotos

// Bursts
matching: .bursts

// Compound filters with .any, .all, .not
// Videos AND Live Photos
matching: .any(of: [.videos, .livePhotos])

// All images EXCEPT screenshots
matching: .all(of: [.images, .not(.screenshots)])

// All images EXCEPT screenshots AND panoramas
matching: .all(of: [.images, .not(.any(of: [.screenshots, .panoramas]))])
```

**Cost**: 15 min implementation, no permissions required

### Pattern 1b: Embedded PhotosPicker (iOS 17+)

**Use case**: Embed picker inline in your UI instead of presenting as sheet.

```swift
import SwiftUI
import PhotosUI

struct EmbeddedPickerView: View {
    @State private var selectedItems: [PhotosPickerItem] = []

    var body: some View {
        VStack {
            // Your content above picker
            SelectedPhotosGrid(items: selectedItems)

            // Embedded picker fills available space
            PhotosPicker(
                selection: $selectedItems,
                maxSelectionCount: 10,
                selectionBehavior: .continuous,  // Live updates as user taps
                matching: .images
            ) {
                // Label is ignored for inline style
                Text("Select")
            }
            .photosPickerStyle(.inline)  // Embed instead of present
            .photosPickerDisabledCapabilities([.selectionActions])  // Hide Add/Cancel buttons
            .photosPickerAccessoryVisibility(.hidden, edges: .all)  // Hide nav/toolbar
            .frame(height: 300)  // Control picker height
            .ignoresSafeArea(.container, edges: .bottom)  // Extend to bottom edge
        }
    }
}
```

**Picker Styles**:

| Style | Description |
|-------|-------------|
| `.presentation` | Default modal sheet |
| `.inline` | Embedded in your view hierarchy |
| `.compact` | Single row, minimal vertical space |

**Customization modifiers**:

```swift
// Hide navigation/toolbar accessories
.photosPickerAccessoryVisibility(.hidden, edges: .all)
.photosPickerAccessoryVisibility(.hidden, edges: .top)  // Just navigation bar
.photosPickerAccessoryVisibility(.hidden, edges: .bottom)  // Just toolbar

// Disable capabilities (hides UI for them)
.photosPickerDisabledCapabilities([.search])  // Hide search
.photosPickerDisabledCapabilities([.collectionNavigation])  // Hide albums
.photosPickerDisabledCapabilities([.stagingArea])  // Hide selection review
.photosPickerDisabledCapabilities([.selectionActions])  // Hide Add/Cancel

// Continuous selection for live updates
selectionBehavior: .continuous
```

**Privacy note**: First time an embedded picker appears, iOS shows an onboarding UI explaining your app can only access selected photos. A privacy badge indicates the picker is out-of-process.

### Pattern 2: UIKit PHPickerViewController (iOS 14+)

**Use case**: Photo selection in UIKit apps.

```swift
import PhotosUI

class PhotoPickerViewController: UIViewController, PHPickerViewControllerDelegate {

    func showPicker() {
        var config = PHPickerConfiguration()
        config.selectionLimit = 1  // 0 = unlimited
        config.filter = .images    // or .videos, .any(of: [.images, .videos])

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard let result = results.first else { return }

        // Load image asynchronously
        result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] object, error in
            guard let image = object as? UIImage else { return }

            DispatchQueue.main.async {
                self?.displayImage(image)
            }
        }
    }
}
```

**Filter options**:
```swift
// Images only
config.filter = .images

// Videos only
config.filter = .videos

// Live Photos only
config.filter = .livePhotos

// Images and videos
config.filter = .any(of: [.images, .videos])

// Exclude screenshots (iOS 15+)
config.filter = .all(of: [.images, .not(.screenshots)])

// iOS 16+ filters
config.filter = .cinematicVideos
config.filter = .depthEffectPhotos
config.filter = .bursts
```

#### UIKit Embedded Picker (iOS 17+)

```swift
// Configure for embedded use
var config = PHPickerConfiguration()
config.selection = .continuous  // Live updates instead of waiting for Add button
config.mode = .compact  // Single row layout (optional)
config.selectionLimit = 10

// Hide accessories
config.edgesWithoutContentMargins = .all  // No margins around picker

// Disable capabilities
config.disabledCapabilities = [.search, .selectionActions]

let picker = PHPickerViewController(configuration: config)
picker.delegate = self

// Add as child view controller (required for embedded)
addChild(picker)
containerView.addSubview(picker.view)
picker.view.frame = containerView.bounds
picker.didMove(toParent: self)
```

**Updating picker while displayed (iOS 17+)**:
```swift
// Deselect assets by their identifiers
picker.deselectAssets(withIdentifiers: ["assetID1", "assetID2"])

// Reorder assets in selection
picker.moveAsset(withIdentifier: "assetID", afterAssetWithIdentifier: "otherID")
```

**Cost**: 20 min implementation, no permissions required

### Pattern 2b: Options Menu & HDR Support (iOS 17+)

The picker now shows an Options menu letting users choose to strip location metadata from photos. This works automatically with PhotosPicker and PHPicker.

**Preserving HDR content**:

By default, picker may transcode to JPEG, losing HDR data. To receive original format:

```swift
// SwiftUI - Use .current encoding to preserve HDR
PhotosPicker(
    selection: $selectedItems,
    matching: .images,
    preferredItemEncoding: .current  // Don't transcode
) { ... }

// Loading with original format preservation
struct HDRImage: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            HDRImage(data: data)
        }
    }
}

// Request .image content type (generic) not .jpeg (specific)
let result = try await item.loadTransferable(type: HDRImage.self)
```

**UIKit equivalent**:
```swift
var config = PHPickerConfiguration()
config.preferredAssetRepresentationMode = .current  // Don't transcode
```

**Cinematic mode videos**: Picker returns rendered version with depth effects baked in. To get original with decision points, use PhotoKit with library access instead.

### Pattern 3: Handling Limited Library Access

**Use case**: User granted limited access; let them add more photos.

**Suppressing automatic prompt** (iOS 14+):

By default, iOS shows "Select More Photos" prompt when `.limited` is detected. To handle it yourself:

```xml
<!-- Info.plist - Add this to handle limited access UI yourself -->
<key>PHPhotoLibraryPreventAutomaticLimitedAccessAlert</key>
<true/>
```

**Manual limited access handling**:

```swift
import Photos

class PhotoLibraryManager {

    func checkAndRequestAccess() async -> PHAuthorizationStatus {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

        switch status {
        case .notDetermined:
            return await PHPhotoLibrary.requestAuthorization(for: .readWrite)

        case .limited:
            // User granted limited access - show UI to expand
            await presentLimitedLibraryPicker()
            return .limited

        case .authorized:
            return .authorized

        case .denied, .restricted:
            return status

        @unknown default:
            return status
        }
    }

    @MainActor
    func presentLimitedLibraryPicker() {
        guard let windowScene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            return
        }

        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: rootVC)
    }
}
```

**Observe limited selection changes**:
```swift
// Register for changes
PHPhotoLibrary.shared().register(self)

// In delegate
func photoLibraryDidChange(_ changeInstance: PHChange) {
    // User may have modified their limited selection
    // Refresh your photo grid
}
```

**Cost**: 30 min implementation

### Pattern 4: Saving Photos to Camera Roll

**Use case**: Save captured or edited photos.

```swift
import Photos

func saveImageToLibrary(_ image: UIImage) async throws {
    // Request add-only permission (minimal access)
    let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)

    guard status == .authorized || status == .limited else {
        throw PhotoError.permissionDenied
    }

    try await PHPhotoLibrary.shared().performChanges {
        PHAssetCreationRequest.creationRequestForAsset(from: image)
    }
}

// With metadata preservation
func savePhotoData(_ data: Data, metadata: [String: Any]? = nil) async throws {
    try await PHPhotoLibrary.shared().performChanges {
        let request = PHAssetCreationRequest.forAsset()

        // Write data to temp file for addResource
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("jpg")
        try? data.write(to: tempURL)

        request.addResource(with: .photo, fileURL: tempURL, options: nil)
    }
}
```

**Cost**: 15 min implementation

### Pattern 5: Loading Images from PhotosPickerItem

**Use case**: Properly handle async image loading with error handling.

**The problem**: Default `Image` Transferable only supports PNG. Most photos are JPEG/HEIF.

```swift
// Custom Transferable for any image format
struct TransferableImage: Transferable {
    let image: UIImage

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            guard let image = UIImage(data: data) else {
                throw TransferError.importFailed
            }
            return TransferableImage(image: image)
        }
    }

    enum TransferError: Error {
        case importFailed
    }
}

// Usage
func loadImage(from item: PhotosPickerItem) async -> UIImage? {
    do {
        let result = try await item.loadTransferable(type: TransferableImage.self)
        return result?.image
    } catch {
        print("Failed to load image: \(error)")
        return nil
    }
}
```

**Loading with progress**:
```swift
func loadImageWithProgress(from item: PhotosPickerItem) async -> UIImage? {
    let progress = Progress()

    return await withCheckedContinuation { continuation in
        _ = item.loadTransferable(type: TransferableImage.self) { result in
            switch result {
            case .success(let transferable):
                continuation.resume(returning: transferable?.image)
            case .failure:
                continuation.resume(returning: nil)
            }
        }
    }
}
```

**Cost**: 20 min implementation

### Pattern 6: Observing Photo Library Changes

**Use case**: Keep your gallery UI in sync with Photos app.

```swift
import Photos

class PhotoGalleryViewModel: NSObject, ObservableObject, PHPhotoLibraryChangeObserver {
    @Published var photos: [PHAsset] = []

    private var fetchResult: PHFetchResult<PHAsset>?

    override init() {
        super.init()
        PHPhotoLibrary.shared().register(self)
        fetchPhotos()
    }

    deinit {
        PHPhotoLibrary.shared().unregisterChangeObserver(self)
    }

    func fetchPhotos() {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        fetchResult = PHAsset.fetchAssets(with: .image, options: options)

        photos = fetchResult?.objects(at: IndexSet(0..<(fetchResult?.count ?? 0))) ?? []
    }

    func photoLibraryDidChange(_ changeInstance: PHChange) {
        guard let fetchResult = fetchResult,
              let changes = changeInstance.changeDetails(for: fetchResult) else {
            return
        }

        DispatchQueue.main.async {
            self.fetchResult = changes.fetchResultAfterChanges
            self.photos = changes.fetchResultAfterChanges.objects(at:
                IndexSet(0..<changes.fetchResultAfterChanges.count)
            )
        }
    }
}
```

**Cost**: 30 min implementation

## Anti-Patterns

### Anti-Pattern 1: Requesting Full Access for Photo Picking

**Wrong**:
```swift
// Over-requesting - picker doesn't need this!
let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
if status == .authorized {
    showPhotoPicker()
}
```

**Right**:
```swift
// Just show the picker - no permission needed
PhotosPicker(selection: $item, matching: .images) {
    Text("Select Photo")
}
```

**Why it matters**: PHPicker and PhotosPicker handle privacy automatically. Requesting library access when you only need to pick photos is a privacy violation and may cause App Store rejection.

### Anti-Pattern 2: Ignoring Limited Status

**Wrong**:
```swift
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
if status == .authorized {
    showGallery()
} else {
    showPermissionDenied()  // Wrong! .limited is valid
}
```

**Right**:
```swift
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
switch status {
case .authorized:
    showGallery()
case .limited:
    showGallery()  // Works with limited selection
    showLimitedBanner()  // Explain to user
case .denied, .restricted:
    showPermissionDenied()
case .notDetermined:
    requestAccess()
@unknown default:
    break
}
```

**Why it matters**: iOS 14+ users can grant limited access. Treating it as denied frustrates users.

### Anti-Pattern 3: Synchronous Image Loading

**Wrong**:
```swift
// Blocks UI thread
let data = try! selectedItem.loadTransferable(type: Data.self)
```

**Right**:
```swift
Task {
    if let data = try? await selectedItem.loadTransferable(type: Data.self) {
        // Use data
    }
}
```

**Why it matters**: Large photos (RAW, panoramas) take seconds to load. Blocking UI causes ANR.

### Anti-Pattern 4: Using UIImagePickerController for Photo Selection

**Wrong**:
```swift
let picker = UIImagePickerController()
picker.sourceType = .photoLibrary
present(picker, animated: true)
```

**Right**:
```swift
var config = PHPickerConfiguration()
config.filter = .images
let picker = PHPickerViewController(configuration: config)
present(picker, animated: true)
```

**Why it matters**: UIImagePickerController is deprecated for photo selection. PHPicker is more reliable, handles large assets, and provides better privacy.

## Pressure Scenarios

### Scenario 1: "Just Get Photo Access Working"

**Context**: Product wants photo import feature. You're considering requesting full library access "to be safe."

**Pressure**: "Users will just tap Allow anyway."

**Reality**: Since iOS 14, users can grant limited access. Full access request triggers additional privacy prompt. App Store Review may reject unnecessary permission requests.

**Correct action**:
1. Use PhotosPicker or PHPicker (no permission needed)
2. Only request .readWrite if building a gallery browser
3. Only request .addOnly if just saving photos

**Push-back template**: "PHPicker works without any permission request - users can select photos directly. Requesting library access when we only need picking is a privacy violation that App Store Review may flag."

### Scenario 2: "Users Say They Can't See Their Photos"

**Context**: Support tickets about "no photos available" even though user granted access.

**Pressure**: "Just ask for full access again."

**Reality**: User likely granted `.limited` access and selected 0 photos initially.

**Correct action**:
1. Check for `.limited` status
2. Show `presentLimitedLibraryPicker()` to let user add photos
3. Explain in UI: "Tap here to add more photos"

**Push-back template**: "The user has limited access - they need to expand their selection. I'll add a button that opens the limited library picker so they can add more photos."

### Scenario 3: "Photo Loads Taking Forever"

**Context**: Users complain photo picker is slow to display selected images.

**Pressure**: "Can you cache or preload somehow?"

**Reality**: Large photos (RAW, panoramas, Live Photos) are slow to decode. Solution is UX, not caching.

**Correct action**:
1. Show loading placeholder immediately
2. Load thumbnail first, full image second
3. Show progress indicator for large files
4. Use async/await to avoid blocking

**Push-back template**: "Large photos take time to load - that's physics. I'll show a placeholder immediately and load progressively. For the picker UI, thumbnail loading is already optimized by the system."

## Checklist

Before shipping photo library features:

**Permission Strategy**:
- ☑ Using PHPicker/PhotosPicker for simple selection (no permission needed)
- ☑ Only requesting .readWrite if building gallery UI
- ☑ Only requesting .addOnly if only saving photos
- ☑ Info.plist usage descriptions present

**Limited Library**:
- ☑ Handling `.limited` status (not treating as denied)
- ☑ Offering `presentLimitedLibraryPicker()` for users to add photos
- ☑ UI explains limited access to users

**Image Loading**:
- ☑ All loading is async (no UI blocking)
- ☑ Custom Transferable handles JPEG/HEIF (not just PNG)
- ☑ Error handling for failed loads
- ☑ Loading indicator for large files

**Saving Photos**:
- ☑ Using .addOnly when full access not needed
- ☑ Using performChanges for atomic operations
- ☑ Handling save failures gracefully

**Photo Library Changes**:
- ☑ Registered as PHPhotoLibraryChangeObserver if displaying library
- ☑ Updating UI on main thread after changes
- ☑ Unregistering observer in deinit

## Resources

**WWDC**: 2020-10652, 2020-10641, 2022-10023, 2023-10107

**Docs**: /photosui/phpickerviewcontroller, /photosui/photospicker, /photos/phphotolibrary

**Skills**: axiom-photo-library-ref, axiom-camera-capture
