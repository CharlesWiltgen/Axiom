---
name: photo-library
description: PhotosPicker, PHPickerViewController, photo selection, limited library access, save to camera roll, PHPhotoLibrary permissions, Transferable image loading
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

This page documents the `axiom-photo-library` skill -- privacy-forward photo access patterns Claude uses when helping you implement photo selection and library features. The skill contains 6 core patterns, anti-patterns, a shipping checklist, and pressure scenarios.

**For API reference:** See [photo-library-ref](/reference/photo-library-ref) for comprehensive PHPickerViewController, PhotosPicker, PHPhotoLibrary, PHAsset, and PHImageManager API coverage.

**For camera capture:** See [camera-capture](/skills/integration/camera-capture) if you need to build a custom camera UI.

## Related

- [photo-library-ref](/reference/photo-library-ref) -- Complete PhotoKit and picker API reference
- [camera-capture](/skills/integration/camera-capture) -- Custom camera UI with AVCaptureSession
- [camera-capture-diag](/diagnostic/camera-capture-diag) -- Troubleshooting camera issues

## Resources

**WWDC**: 2020-10652, 2020-10641, 2022-10023, 2023-10107

**Docs**: /photosui/phpickerviewcontroller, /photosui/photospicker, /photos/phphotolibrary
