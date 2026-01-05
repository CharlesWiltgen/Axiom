---
name: privacy-ux
description: Privacy manifests, permission requests, ATT implementation, and Required Reason APIs
skill_type: reference
version: 1.0
---

# Privacy UX Reference

Complete API reference for iOS privacy implementation. Covers privacy manifests, App Tracking Transparency, permission request UX patterns, tracking domains, and Required Reason APIs.

## When to Use This Reference

Use this reference when you need:
- PrivacyInfo.xcprivacy structure and required keys
- Just-in-time permission request patterns
- App Tracking Transparency implementation
- Tracking domain declarations (iOS 17+)
- Required Reason API declarations
- Privacy Nutrition Label requirements

**For quick patterns:** See [hig](/skills/ui-design/hig) for permission UX best practices.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I structure my PrivacyInfo.xcprivacy file?"
- "What's the pattern for just-in-time permission requests?"
- "How do I implement App Tracking Transparency correctly?"
- "Which APIs require Required Reason declarations?"
- "How do I declare tracking domains in my privacy manifest?"
- "What data types go in Privacy Nutrition Labels?"

## What's Covered

### Privacy Manifests
- PrivacyInfo.xcprivacy structure
- NSPrivacyTracking flag
- NSPrivacyTrackingDomains array
- NSPrivacyCollectedDataTypes declarations
- NSPrivacyAccessedAPITypes with reasons

### Permission Request UX
- Just-in-time vs up-front patterns
- Pre-permission education screens
- Permission denied handling
- Settings redirect patterns

### App Tracking Transparency
- ATTrackingManager.requestTrackingAuthorization
- Status checking and handling
- Pre-prompt education patterns
- IDFA access patterns

### Required Reason APIs
- UserDefaults declarations
- File timestamp declarations
- System boot time declarations
- Disk space declarations

### Privacy Nutrition Labels
- Data collection categories
- Data use purposes
- Linked vs not linked data
- App Store Connect declarations

## Key Pattern

### Just-in-Time Permission Request

```swift
@objc func takePhotoButtonTapped() {
    // 1. Show pre-permission education
    showCameraEducation {
        // 2. Request system permission
        AVCaptureDevice.requestAccess(for: .video) { granted in
            DispatchQueue.main.async {
                if granted {
                    self.openCamera()
                } else {
                    self.showPermissionDeniedAlert()
                }
            }
        }
    }
}
```

### Required Reason Declaration

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
            <string>CA92.1</string>
        </array>
    </dict>
</array>
```

## Documentation Scope

This page documents the `axiom-privacy-ux` reference skill—complete API coverage Claude uses when you need specific privacy manifest structures, permission patterns, or ATT implementation details.

**For UX patterns:** See [hig](/skills/ui-design/hig) for permission request best practices.

## Related

- [hig](/skills/ui-design/hig) — Permission UX best practices
- [hig-ref](/reference/hig-ref) — Complete HIG reference

## Resources

**WWDC**: 2023-10060 (Privacy manifests), 2023-10053 (Privacy features)

**Docs**: /bundleresources/privacy-manifest-files, /apptrackingtransparency
