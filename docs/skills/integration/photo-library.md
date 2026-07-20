---
name: photo-library
description: PhotosPicker, PHPickerViewController, photo selection, limited library access, save to camera roll, PHPhotoLibrary permissions, Transferable image loading, PHPhotoLibraryChangeObserver, Swift 6 strict concurrency isolation
---

# Photo Library

Privacy-forward photo picking and library access patterns. Covers PhotosPicker (SwiftUI), PHPickerViewController (UIKit), limited library handling, saving to camera roll, and photo library change observation.

## When to Use

Use this skill when you're:
- Letting users select photos from their library
- Choosing between PHPicker and PhotosPicker
- Handling limited photo library access (iOS 14+)
- Saving photos or videos to the camera roll
- Loading images from PhotosPickerItem with Transferable
- Observing photo library changes for a gallery UI
- Requesting the appropriate permission level
- Using PhotoKit from a `@MainActor` type under Swift 6 strict concurrency

**Note:** If you need a custom camera UI, use [camera-capture](/skills/integration/camera-capture) instead. Photo pickers require no camera permission.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I let users pick photos in SwiftUI?"
- "What's the difference between PHPicker and PhotosPicker?"
- "User says they can't see their photos"
- "How do I save a photo to the camera roll?"
- "How do I handle limited photo access?"
- "How do I load an image from PhotosPickerItem?"
- "User granted limited access but can't see photos"
- "Why does my `photoLibraryDidChange` need to be `nonisolated`?"
- "My photo gallery crashes with `_dispatch_assert_queue_fail` after the Swift 6 migration"
- "Do I still need to re-fetch PHAssets by localIdentifier inside a change block?"
- "How do I stop picked photos carrying GPS coordinates to my backend?" (iOS 27)
- "How do I let users create or post to a shared album from my app?" (iOS 27)
- "How do I restrict which image formats get decoded from untrusted data?" (iOS 27)
- "My app closes when a user opens a 48MP photo"

## What This Skill Provides

### Photo Picker Patterns
- SwiftUI PhotosPicker with single and multi-selection (iOS 16+)
- Embedded inline PhotosPicker with continuous selection (iOS 17+)
- UIKit PHPickerViewController with filters and delegate
- Embedded UIKit picker with live updates (iOS 17+)
- Advanced filter combinations (.any, .all, .not)
- HDR content preservation with preferredItemEncoding

### Permission Strategy
- PHPicker and PhotosPicker require no permission (system handles privacy)
- .addOnly for saving photos without read access
- .readWrite only when building a gallery browser
- .limited status handling with presentLimitedLibraryPicker

### Image Loading
- Custom Transferable types for reliable JPEG/HEIF loading
- Async loading with error handling
- Progress tracking for large files

### Library Management
- Saving photos and videos with PHAssetCreationRequest
- Observing library changes with PHPhotoLibraryChangeObserver
- Limited library picker for expanding user selection

### Swift 6 Strict Concurrency
- `nonisolated` change observer with a `Task { @MainActor in }` hop, and why the compiler's `@preconcurrency` fix-it ships a crash
- `performChanges { @Sendable in }` when the call site is actor-isolated
- Which PhotoKit types are `Sendable`, and why re-fetching by `localIdentifier` is about staleness rather than isolation
- Ordering and fetch-result laziness caveats for gallery UIs

### Pressure Scenarios
- Over-requesting permissions when picker suffices
- Users reporting "no photos available" with limited access
- Slow photo loading with large files

## Key Pattern

### SwiftUI PhotosPicker (No Permission Needed)

```swift
import SwiftUI
import PhotosUI

@State private var selectedItem: PhotosPickerItem?
@State private var selectedImage: Image?

PhotosPicker(
    selection: $selectedItem,
    matching: .images
) {
    Label("Select Photo", systemImage: "photo")
}
.onChange(of: selectedItem) { _, newItem in
    Task {
        if let data = try? await newItem?.loadTransferable(type: Data.self),
           let uiImage = UIImage(data: data) {
            selectedImage = Image(uiImage: uiImage)
        }
    }
}
```

## Documentation Scope

This page documents the `axiom-media` skill — privacy-forward photo access patterns Claude uses when helping you implement photo selection and library features. The skill contains 6 core patterns, anti-patterns, a shipping checklist, and pressure scenarios.

- [photo-library-ref](/reference/photo-library-ref) – API reference: comprehensive PHPickerViewController, PhotosPicker, PHPhotoLibrary, PHAsset, and PHImageManager coverage
- [camera-capture](/skills/integration/camera-capture) – reach for this instead when you need to build a custom camera UI rather than pick existing photos

## Related

- [photo-library-ref](/reference/photo-library-ref) – Complete PhotoKit and picker API reference
- [camera-capture](/skills/integration/camera-capture) – Custom camera UI with AVCaptureSession
- [camera-capture-diag](/diagnostic/camera-capture-diag) – Troubleshooting camera issues
- [isolation-inheritance-diag](/diagnostic/isolation-inheritance-diag) – Diagnosing the `_dispatch_assert_queue_fail` crashes PhotoKit callbacks cause under Swift 6

## Resources

**WWDC**: 2020-10652, 2020-10641, 2022-10023, 2023-10107

**Docs**: /photosui/phpickerviewcontroller, /photosui/photospicker, /photos/phphotolibrary
