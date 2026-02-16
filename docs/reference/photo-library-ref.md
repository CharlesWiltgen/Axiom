---
name: photo-library-ref
description: PHPickerViewController, PhotosPicker, PhotosPickerItem, Transferable, PHPhotoLibrary, PHAsset, PHAssetCreationRequest, PHFetchResult, PHImageManager, PHAuthorizationStatus API reference
---

# Photo Library API Reference

Comprehensive API reference for PhotoKit and photo pickers covering PHPickerViewController, PhotosPicker, PHPhotoLibrary authorization, PHAsset fetching, PHImageManager image requests, and asset creation.

## When to Use This Reference

Use this reference when:
- Looking up PHPickerConfiguration options and filter syntax
- Checking PhotosPicker modifiers for embedded, inline, or compact styles
- Understanding PHAuthorizationStatus values and access levels
- Fetching assets with PHFetchOptions predicates and sort descriptors
- Requesting images from PHImageManager with delivery modes
- Creating assets with PHAssetCreationRequest including deferred photo proxies
- Implementing PHPhotoLibraryChangeObserver for library sync

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the PHPickerFilter options?"
- "How do I configure PhotosPicker for inline embedded style?"
- "What's the difference between .authorized and .limited?"
- "How do I fetch the most recent 100 photos?"
- "What are the PHImageRequestOptions delivery modes?"
- "How do I save a deferred photo proxy to the library?"
- "What properties does PHAsset have?"

## What's Covered

- PHPickerViewController configuration, filters, delegate, and embedded mode (iOS 17+)
- PhotosPicker styles (presentation, inline, compact), selection behaviors, disabled capabilities, and HDR preservation
- PhotosPickerItem loading with Transferable and custom transfer representations
- PHPhotoLibrary authorization statuses, access levels (.readWrite, .addOnly), and limited library picker
- PHAsset properties, media types, subtypes, and fetch options
- PHAssetCreationRequest from UIImage, file URL, and deferred photo proxy (iOS 17+)
- PHFetchResult access patterns and enumeration
- PHImageManager image/video requests, delivery modes, and secondary degraded images (iOS 17+)
- PHChange handling with incremental updates for collection views

## Documentation Scope

This page documents the `axiom-photo-library-ref` skill. It provides complete API documentation for PhotoKit classes and photo picker views. For guided implementation patterns, use the discipline skill.

- For implementation guidance, use [photo-library](/skills/integration/photo-library)
- For camera capture, see [camera-capture](/skills/integration/camera-capture)

## Key APIs

### PHAuthorizationStatus

| Status | Description |
|--------|-------------|
| `.notDetermined` | User hasn't been asked |
| `.restricted` | Parental controls limit access |
| `.denied` | User denied access |
| `.authorized` | Full access granted |
| `.limited` | Access to user-selected photos only (iOS 14+) |

### PhotosPicker Styles (iOS 17+)

| Style | Description |
|-------|-------------|
| `.presentation` | Modal sheet (default) |
| `.inline` | Embedded in view hierarchy |
| `.compact` | Single row, minimal vertical space |

### PHImageManager Delivery Modes

| Mode | Description |
|------|-------------|
| `.opportunistic` | Fast thumbnail, then high quality |
| `.highQualityFormat` | Only high quality |
| `.fastFormat` | Only fast/degraded |

### PHAsset Media Types

| Type | Description |
|------|-------------|
| `.image` | Photos, screenshots, Live Photos |
| `.video` | Videos, slo-mo, cinematic, timelapse |
| `.audio` | Audio recordings |

## Related

- [photo-library](/skills/integration/photo-library) -- Implementation patterns for photo picking and library access
- [camera-capture-ref](/reference/camera-capture-ref) -- AVFoundation camera API reference
- [camera-capture](/skills/integration/camera-capture) -- Custom camera UI patterns

## Resources

**Docs**: /photosui/phpickerviewcontroller, /photosui/photospicker, /photos/phphotolibrary, /photos/phasset, /photos/phimagemanager
