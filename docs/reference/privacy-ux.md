---
name: privacy-ux
description: Use when implementing privacy manifests, requesting permissions, App Tracking Transparency UX, or preparing Privacy Nutrition Labels - covers just-in-time permission requests, tracking domain management, and Required Reason APIs
skill_type: reference
version: 1.0
---

# Privacy UX Patterns

Comprehensive guide to privacy-first app design covering privacy manifests, permission requests, App Tracking Transparency, and Required Reason APIs. Based on WWDC 2023 sessions 10060 (Get started with privacy manifests) and 10053 (What's new in privacy).

## Overview

This reference covers privacy implementation for iOS apps:

- **Privacy Manifests** — PrivacyInfo.xcprivacy structure and requirements
- **Permission Request UX** — Just-in-time vs up-front permission patterns
- **App Tracking Transparency** — ATTrackingManager implementation
- **Tracking Domains** — iOS 17+ automatic domain blocking
- **Required Reason APIs** — Declaring API usage with approved reasons
- **Privacy Nutrition Labels** — App Store privacy disclosure requirements

## System Requirements

- **iOS 14.5+** for App Tracking Transparency
- **iOS 17+** for automatic tracking domain blocking
- **Xcode 15+** for privacy reports and manifest templates

**Timeline**: Privacy manifests required for App Review starting Spring 2024.

---

## Privacy Manifest Structure

Create `PrivacyInfo.xcprivacy` in your app target:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <true/>

    <key>NSPrivacyTrackingDomains</key>
    <array>
        <string>tracking.example.com</string>
    </array>

    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeName</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
    </array>

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
</dict>
</plist>
```

---

## Permission Request UX

### Just-in-Time vs Up-Front

**Just-in-Time (Recommended)**: Request permission when user initiates the feature.

```swift
@objc func takePhotoButtonTapped() {
    showCameraEducation {
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

func showCameraEducation(completion: @escaping () -> Void) {
    let alert = UIAlertController(
        title: "Take Photos",
        message: "FoodSnap needs camera access to photograph meals and get nutrition info.",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        completion()
    })
    alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))
    present(alert, animated: true)
}
```

**Up-Front (Avoid)**: Requesting multiple permissions at launch overwhelms users and increases denial rates.

### Permission Denied Handling

Provide a path to Settings when permission is denied:

```swift
func showPermissionDeniedAlert() {
    let alert = UIAlertController(
        title: "Camera Access Required",
        message: "Enable camera access in Settings to take photos.",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    })
    alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))
    present(alert, animated: true)
}
```

---

## App Tracking Transparency

### Requesting Tracking Authorization

```swift
import AppTrackingTransparency
import AdSupport

func requestTrackingAuthorization() {
    // Show pre-prompt education first
    showTrackingEducation {
        ATTrackingManager.requestTrackingAuthorization { status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    // Tracking allowed - access IDFA
                    let idfa = ASIdentifierManager.shared().advertisingIdentifier
                    self.enablePersonalizedAds(idfa: idfa)
                case .denied, .restricted:
                    // Use contextual ads only
                    self.enableContextualAds()
                case .notDetermined:
                    // User hasn't responded yet
                    break
                @unknown default:
                    break
                }
            }
        }
    }
}

func showTrackingEducation(completion: @escaping () -> Void) {
    let alert = UIAlertController(
        title: "Support This App",
        message: "We use your data to show you personalized ads that keep this app free.",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        completion()
    })
    present(alert, animated: true)
}
```

### Checking Current Status

```swift
let status = ATTrackingManager.trackingAuthorizationStatus

switch status {
case .authorized:
    // Can access IDFA
case .denied, .restricted:
    // Cannot access IDFA
case .notDetermined:
    // Haven't requested yet
@unknown default:
    break
}
```

---

## Tracking Domains

### Declaring Tracking Domains

In `PrivacyInfo.xcprivacy`:

```xml
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>analytics.example.com</string>
    <string>ads.example.com</string>
    <string>tracking.thirdparty.com</string>
</array>
```

**iOS 17+ Behavior**: When user denies tracking permission, iOS automatically blocks connections to declared tracking domains.

---

## Required Reason APIs

Common APIs requiring declarations:

### UserDefaults

```xml
<key>NSPrivacyAccessedAPIType</key>
<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
<key>NSPrivacyAccessedAPITypeReasons</key>
<array>
    <string>CA92.1</string>  <!-- Accessing user defaults from app -->
</array>
```

### File Timestamp

```xml
<key>NSPrivacyAccessedAPIType</key>
<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
<key>NSPrivacyAccessedAPITypeReasons</key>
<array>
    <string>C617.1</string>  <!-- Displaying to user -->
</array>
```

### System Boot Time

```xml
<key>NSPrivacyAccessedAPIType</key>
<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
<key>NSPrivacyAccessedAPITypeReasons</key>
<array>
    <string>35F9.1</string>  <!-- Measuring time within app -->
</array>
```

### Disk Space

```xml
<key>NSPrivacyAccessedAPIType</key>
<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
<key>NSPrivacyAccessedAPITypeReasons</key>
<array>
    <string>85F4.1</string>  <!-- Display to user or app functionality -->
</array>
```

---

## Privacy Nutrition Labels

### Data Collection Categories

When submitting to App Store Connect, declare:

- **Contact Info**: Name, email, phone number, address
- **Health & Fitness**: Health data, fitness data
- **Financial Info**: Payment info, credit history, purchase history
- **Location**: Precise/Coarse location
- **Sensitive Info**: Racial/ethnic data, political opinions, religious beliefs
- **Contacts**: Contact list
- **User Content**: Photos, videos, audio, messages
- **Browsing History**: Browsing history
- **Search History**: Search history
- **Identifiers**: User ID, Device ID, IDFA
- **Usage Data**: Product interaction, advertising data, crash data
- **Diagnostics**: Crash logs, performance data
- **Other Data**: Any other data

### Data Use Purposes

For each data type, specify:

- **Third-Party Advertising**: Serving ads
- **Developer's Advertising**: First-party ads
- **Analytics**: App analytics
- **Product Personalization**: Customizing experience
- **App Functionality**: Core features

### Linked vs Not Linked

- **Linked**: Data tied to user's identity (can track across apps/websites)
- **Not Linked**: Anonymous data (cannot track user)

---

## Xcode Privacy Report

Generate privacy report from archive:

1. Product → Archive
2. Right-click archive → Generate Privacy Report
3. Review aggregated data collection across all frameworks
4. Use report to fill out App Store Connect privacy form

---

## Common Permission Types

### Camera
```swift
AVCaptureDevice.requestAccess(for: .video) { granted in }
```

### Microphone
```swift
AVCaptureDevice.requestAccess(for: .audio) { granted in }
```

### Photos (Limited)
```swift
PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in }
```

### Location
```swift
let manager = CLLocationManager()
manager.requestWhenInUseAuthorization()  // or requestAlwaysAuthorization()
```

### Contacts
```swift
CNContactStore().requestAccess(for: .contacts) { granted, error in }
```

### Calendar
```swift
EKEventStore().requestAccess(to: .event) { granted, error in }
```

---

## Privacy-First Design Patterns

### Data Minimization

Only collect data you actually need:

```swift
// ❌ Bad - collecting unnecessary data
struct UserProfile {
    let name: String
    let email: String
    let phoneNumber: String
    let address: String
    let birthdate: Date
}

// ✅ Good - only what's needed for feature
struct UserProfile {
    let displayName: String  // Just for showing in UI
}
```

### On-Device Processing

Process data locally when possible:

```swift
// ✅ Good - stays on device
import Vision

let request = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    // Process text locally
}
```

### Transparent Data Practices

Show users what data you collect and why:

```swift
// Privacy screen in onboarding
struct PrivacyView: View {
    var body: some View {
        VStack {
            Text("Your Privacy")
                .font(.title)

            Text("We only collect:")

            List {
                Label("Display name for your profile", systemImage: "person")
                Label("Email for account recovery", systemImage: "envelope")
            }

            Text("We NEVER collect:")

            List {
                Label("Browsing history", systemImage: "safari")
                Label("Location data", systemImage: "location")
            }
        }
    }
}
```

---

## WWDC Sessions

- [Get started with privacy manifests (2023/10060)](https://developer.apple.com/videos/play/wwdc2023/10060/) — PrivacyInfo.xcprivacy structure
- [What's new in privacy (2023/10053)](https://developer.apple.com/videos/play/wwdc2023/10053/) — iOS 17 privacy features

## Related Skills

- **privacy-ux** — Complete reference with all permission types, pre-permission education patterns, App Store timeline

## Related Documentation

- [Privacy manifest files](https://developer.apple.com/documentation/BundleResources/privacy-manifest-files)
- [App Tracking Transparency](https://developer.apple.com/documentation/apptrackingtransparency)
- [Describing data use in privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_data_use_in_privacy_manifests)
