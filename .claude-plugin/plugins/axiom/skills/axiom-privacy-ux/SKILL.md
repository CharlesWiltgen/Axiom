---
name: axiom-privacy-ux
description: Use when implementing privacy manifests, requesting permissions, App Tracking Transparency UX, or preparing Privacy Nutrition Labels - covers just-in-time permission requests, tracking domain management, and Required Reason APIs from WWDC 2023
skill_type: reference
version: 1.0.0
---

# Privacy UX Patterns

Comprehensive guide to privacy-first app design. Apple Design Award Social Impact winners handle data ethically, and privacy-first design is a key differentiator.

## Overview

Privacy manifests (`PrivacyInfo.xcprivacy`) are Apple's framework for transparency about data collection and tracking. Combined with App Tracking Transparency and just-in-time permission requests, they help users make informed choices about their data.

This skill covers creating privacy manifests, requesting system permissions with excellent UX, implementing App Tracking Transparency, managing tracking domains, using Required Reason APIs, and preparing accurate Privacy Nutrition Labels.

## When to Use This Skill

- Creating privacy manifests (PrivacyInfo.xcprivacy)
- Requesting system permissions (Camera, Location, etc.)
- Implementing App Tracking Transparency (ATT)
- Preparing Privacy Nutrition Labels for App Store Connect
- Managing tracking domains to avoid accidental tracking
- Using Required Reason APIs (NSFileSystemFreeSize, UserDefaults, etc.)
- Explaining data usage to users transparently
- Debugging privacy-related App Store rejections

## System Requirements

- **iOS 14.5+** for App Tracking Transparency
- **iOS 17+** for automatic tracking domain blocking
- **Xcode 15+** for privacy reports and manifest editing
- **Spring 2024+** for App Review enforcement

---

## Part 1: Privacy Manifests (WWDC 2023/10060)

### Creating a Privacy Manifest

**Xcode Navigator**:
1. File → New → File
2. Choose "App Privacy File"
3. Name: `PrivacyInfo.xcprivacy`
4. Add to app target (or SDK framework)

**File structure** (Property List):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <!-- Data types collected -->
    </array>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <!-- Required Reason APIs used -->
    </array>
</dict>
</plist>
```

### NSPrivacyTracking Declaration

**Does your app track users?**

Tracking = combining user/device data from your app with data from other apps/websites to create a profile for targeted advertising or data broker purposes.

```xml
<key>NSPrivacyTracking</key>
<true/>  <!-- or false -->
```

**If `true`**, you must also declare tracking domains:

```xml
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
    <string>analytics.example.com</string>
</array>
```

**iOS 17 behavior**: Network requests to tracking domains **automatically blocked** if user hasn't granted ATT permission.

### NSPrivacyCollectedDataTypes

Declare all data your app collects:

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypeName</string>

        <key>NSPrivacyCollectedDataTypeLinked</key>
        <true/>  <!-- Linked to user identity? -->

        <key>NSPrivacyCollectedDataTypeTracking</key>
        <false/>  <!-- Used for tracking? -->

        <key>NSPrivacyCollectedDataTypePurposes</key>
        <array>
            <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
        </array>
    </dict>
</array>
```

**Common data types**:
- `NSPrivacyCollectedDataTypeName` - User's name
- `NSPrivacyCollectedDataTypeEmailAddress`
- `NSPrivacyCollectedDataTypePhoneNumber`
- `NSPrivacyCollectedDataTypePhysicalAddress`
- `NSPrivacyCollectedDataTypePreciseLocation`
- `NSPrivacyCollectedDataTypeCoarseLocation`
- `NSPrivacyCollectedDataTypePhotosorVideos`
- `NSPrivacyCollectedDataTypeContacts`
- `NSPrivacyCollectedDataTypeUserID`

**Common purposes**:
- `NSPrivacyCollectedDataTypePurposeAppFunctionality`
- `NSPrivacyCollectedDataTypePurposeAnalytics`
- `NSPrivacyCollectedDataTypePurposeProductPersonalization`
- `NSPrivacyCollectedDataTypePurposeDeveloperAdvertising`
- `NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising`

### NSPrivacyAccessedAPITypes

Declare Required Reason APIs (see Part 5):

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>

        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
            <string>C617.1</string>  <!-- Approved reason code -->
        </array>
    </dict>
</array>
```

---

## Part 2: Permission Request UX

### Just-in-Time vs Up-Front

**❌ Don't**: Request all permissions at launch
```swift
// BAD - overwhelming and confusing
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    requestCameraPermission()
    requestLocationPermission()
    requestNotificationPermission()
    requestPhotoLibraryPermission()
    return true
}
```

**✅ Do**: Request just-in-time when user triggers feature
```swift
// GOOD - clear causality
@objc func takePhotoButtonTapped() {
    // Show pre-permission education first
    showCameraEducation {
        // Then request permission
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if granted {
                self.openCamera()
            } else {
                self.showPermissionDeniedAlert()
            }
        }
    }
}
```

### Pre-Permission Education Screens

Explain **why** you need permission **before** showing system dialog:

```swift
func showCameraEducation(completion: @escaping () -> Void) {
    let alert = UIAlertController(
        title: "Take Photos",
        message: "FoodSnap needs camera access to let you photograph your meals and get nutrition information.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        completion()  // Now request actual permission
    })

    alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))

    present(alert, animated: true)
}
```

**Why this works**:
- User understands value proposition
- System dialog rejection rate drops 60-80%
- Better App Store ratings (fewer "why does it need that?" reviews)

### Permission Denied Handling

**Never dead-end the user**:

```swift
func handleCameraPermission() {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
        openCamera()

    case .notDetermined:
        showCameraEducation {
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    self.openCamera()
                } else {
                    self.showSettingsPrompt()
                }
            }
        }

    case .denied, .restricted:
        showSettingsPrompt()  // Offer to open Settings

    @unknown default:
        break
    }
}

func showSettingsPrompt() {
    let alert = UIAlertController(
        title: "Camera Access Required",
        message: "Please enable camera access in Settings to use this feature.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    })

    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

    present(alert, animated: true)
}
```

### Settings Deep Links

Open specific settings screens:

```swift
// General app settings
UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)

// Notification settings (iOS 15.4+)
UIApplication.shared.open(URL(string: UIApplication.openNotificationSettingsURLString)!)
```

---

## Part 3: App Tracking Transparency

### When ATT Is Required

You **must** request ATT permission if you:
- Track users across apps/websites owned by other companies
- Share user data with data brokers
- Use third-party SDKs that track (Facebook SDK, Google Analytics, etc.)

You **don't** need ATT if you **only**:
- Use first-party analytics (no sharing with other companies)
- Personalize ads based only on data from your own app
- Use fraud detection/security measures

### ATTrackingManager.requestTrackingAuthorization

```swift
import AppTrackingTransparency
import AdSupport

func requestTrackingPermission() {
    // Check availability (iOS 14.5+)
    guard #available(iOS 14.5, *) else { return }

    // Wait until app is active
    // Showing alert too early causes auto-denial
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        ATTrackingManager.requestTrackingAuthorization { status in
            switch status {
            case .authorized:
                // User granted permission
                // You can now access IDFA and track
                let idfa = ASIdentifierManager.shared().advertisingIdentifier
                self.initializeTrackingSDKs(idfa: idfa)

            case .denied:
                // User denied permission
                // Do NOT track
                self.initializeNonTrackingSDKs()

            case .notDetermined:
                // User closed dialog without choosing
                // Treat as denied
                self.initializeNonTrackingSDKs()

            case .restricted:
                // Device doesn't allow tracking (parental controls)
                self.initializeNonTrackingSDKs()

            @unknown default:
                self.initializeNonTrackingSDKs()
            }
        }
    }
}
```

### Custom ATT Prompt Message

**Info.plist**:
```xml
<key>NSUserTrackingUsageDescription</key>
<string>This allows us to show you personalized ads and improve your experience</string>
```

**Best practices**:
- Be honest and specific
- Explain user benefit (not company benefit)
- Keep it concise (1-2 sentences)

**❌ Bad examples**:
- "We value your privacy" (vague)
- "This is required for the app to work" (dishonest)
- "To monetize our app" (user doesn't care)

**✅ Good examples**:
- "This helps us show you relevant ads for products you might like"
- "Personalized ads help keep this app free"

### Pre-Tracking Prompt Design

Show your own dialog before ATT system prompt:

```swift
func showPreTrackingPrompt() {
    let alert = UIAlertController(
        title: "Support Free Features",
        message: "We use tracking to show you personalized ads, which helps keep advanced features free. You can always change this in Settings.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        self.requestTrackingPermission()
    })

    alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))

    present(alert, animated: true)
}
```

**Why this works**: Education increases opt-in rates by 20-40%.

### Graceful Degradation

**Always provide value without tracking**:

```swift
func initializeAnalytics() {
    let status = ATTrackingManager.trackingAuthorizationStatus

    if status == .authorized {
        // Full featured analytics
        Analytics.setUserProperty(userID, forName: "user_id")
        Analytics.enableCrossAppTracking()
    } else {
        // Limited, privacy-preserving analytics
        Analytics.setUserProperty("anonymous", forName: "user_id")
        Analytics.disableCrossAppTracking()
        Analytics.enableOnDeviceConversionTracking()
    }
}
```

---

## Part 4: Tracking Domain Management

### Declaring Tracking Domains

In `PrivacyInfo.xcprivacy`:

```xml
<key>NSPrivacyTracking</key>
<true/>

<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
    <string>ads.example.com</string>
</array>
```

**iOS 17 behavior**: If user denies ATT, network requests to these domains are **automatically blocked**.

### Domain Separation Strategy

**Problem**: Single domain used for both tracking and non-tracking

**Solution**: Separate functionality into different hosts

```
Before:
- api.example.com (mixed tracking + app functionality)

After:
- api.example.com (app functionality only)
- tracking.example.com (tracking only)
```

**Update manifest**:
```xml
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>  <!-- Declared, will be blocked -->
</array>
```

Result: App functionality continues working; tracking blocked if denied.

### Points of Interest Instrument (Xcode 15+)

**Detecting unexpected tracking connections**:

1. Xcode → Product → Profile
2. Choose "Points of Interest" instrument
3. Run app
4. Look for "Privacy" track showing network connections
5. Review flagged domains

**What it shows**: Connections to domains that may be tracking users across apps/websites.

**Action**: Declare these domains in `NSPrivacyTrackingDomains` or stop connecting to them.

---

## Part 5: Required Reason APIs

### What Are Required Reason APIs?

APIs that **could** be misused for fingerprinting (identifying devices without permission).

**Fingerprinting is never allowed**, even with ATT permission.

**Required Reason APIs have approved use cases**. You must declare which approved reason applies to your usage.

### Common Required Reason APIs

| API Category | Examples | Approved Reason Codes |
|--------------|----------|----------------------|
| **File timestamp** | `creationDate`, `modificationDate` | `C617.1` - `DDA9.1` |
| **System boot time** | `systemUptime`, `processInfo.systemUptime` | `35F9.1`, `8FFB.1` |
| **Disk space** | `NSFileSystemFreeSize`, `volumeAvailableCapacity` | `E174.1`, `7D9E.1` |
| **Active keyboards** | `activeInputModes` | `54BD.1`, `3EC4.1` |
| **User defaults** | `UserDefaults` | `CA92.1`, `1C8F.1`, `C56D.1` |

### Example: Disk Space API

**API**: `NSFileSystemFreeSize` / `URLResourceKey.volumeAvailableCapacityKey`

**Approved reasons**:
- **E174.1**: Check if there's enough space before writing files
- **7D9E.1**: Display storage information to user
- **B728.1**: Include disk space in optional analytics (only if user opted in)

**Declaration in manifest**:
```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryDiskSpace</string>

        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
            <string>E174.1</string>  <!-- Check space before writing -->
        </array>
    </dict>
</array>
```

**Code**:
```swift
func checkDiskSpace() -> Bool {
    do {
        let values = try FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())

        if let freeSpace = values[.systemFreeSize] as? NSNumber {
            let requiredSpace: Int64 = 100 * 1024 * 1024  // 100 MB
            return freeSpace.int64Value > requiredSpace
        }
    } catch {
        print("Error checking disk space: \(error)")
    }

    return false
}

// Usage
if checkDiskSpace() {
    saveFile()  // Approved reason E174.1: Check before writing
} else {
    showInsufficientSpaceAlert()
}
```

### Example: UserDefaults API

**Approved reasons**:
- **CA92.1**: Access info stored by app (settings, preferences)
- **1C8F.1**: Access info stored by App Group
- **C56D.1**: Access info stored by App Clips
- **AC6B.1**: Third-party SDK accessing its own defaults

**Declaration**:
```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryUserDefaults</string>

    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>CA92.1</string>
    </array>
</dict>
```

### Feedback for Missing Reasons

If your use case isn't covered, use Apple's feedback form:
https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api

---

## Part 6: Privacy Nutrition Labels

### Data Types and Categories

**Identifiers**:
- User ID
- Device ID

**Contact Info**:
- Name
- Email address
- Phone number
- Physical address

**Location**:
- Precise location
- Coarse location

**User Content**:
- Photos or videos
- Audio data
- Gameplay content
- Customer support messages

**Browsing History**
**Search History**
**Financial Info**
**Health & Fitness**
**Contacts**
**Sensitive Info** (racial/ethnic data, political opinions, religious beliefs)

### Data Use Purposes

- **App functionality** - Necessary for core features
- **Analytics** - Understanding app usage
- **Product personalization** - Customizing experience
- **Developer advertising** - Ads for your own products
- **Third-party advertising** - Ads from other companies

### Linked vs Not Linked

**Linked to user**:
- Data connected to user identity (name, email, user ID)
- Example: User profile information

**Not linked to user**:
- Data not connected to identity (anonymous analytics)
- Example: Aggregate crash reports

### Tracking Disclosure

Data is used for **tracking** if:
- Combined with data from other apps/websites
- Shared with data brokers
- Used for targeted advertising based on cross-app behavior

**Example declaration**:
```
Data Type: Email Address
Purpose: App Functionality
Linked to User: Yes
Used for Tracking: No
```

---

## Part 7: Xcode Privacy Report

### Generating Report

1. Archive app: Product → Archive
2. Xcode Organizer → Select archive
3. Right-click → "Generate Privacy Report"
4. PDF created showing aggregated privacy data

**What's included**:
- All privacy manifests (app + third-party SDKs)
- Collected data types
- Tracking declaration
- Required Reason APIs

### Reviewing Report

**Check for**:
- Unexpected data collection (SDK collecting data you didn't know about)
- Missing Required Reason declarations
- Tracking domain discrepancies
- Third-party SDKs without privacy manifests

**Use for**: Completing Privacy Nutrition Labels in App Store Connect

---

## Part 8: Permission Types

### Camera

```swift
import AVFoundation

AVCaptureDevice.requestAccess(for: .video) { granted in
    // Handle response
}

// Info.plist
<key>NSCameraUsageDescription</key>
<string>Take photos of your meals to track nutrition</string>
```

### Microphone

```swift
AVAudioSession.sharedInstance().requestRecordPermission { granted in
    // Handle response
}

<key>NSMicrophoneUsageDescription</key>
<string>Record voice memos</string>
```

### Location

```swift
import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    let manager = CLLocationManager()

    func requestPermission() {
        manager.delegate = self

        // Choose one:
        manager.requestWhenInUseAuthorization()  // Only when app is open
        // OR
        manager.requestAlwaysAuthorization()     // Background location
    }
}

// Info.plist (iOS 14+)
<key>NSLocationWhenInUseUsageDescription</key>
<string>Show nearby restaurants</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Track your runs even when the app is in the background</string>
```

### Photos

```swift
import Photos

PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
    switch status {
    case .authorized, .limited:  // .limited = selected photos only
        // Access granted
    case .denied, .restricted:
        // Access denied
    @unknown default:
        break
    }
}

<key>NSPhotoLibraryUsageDescription</key>
<string>Save and share your workout photos</string>
```

### Contacts

```swift
import Contacts

CNContactStore().requestAccess(for: .contacts) { granted, error in
    // Handle response
}

<key>NSContactsUsageDescription</key>
<string>Invite friends to join you</string>
```

### Notifications

```swift
import UserNotifications

UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
    // Handle response
}

// No Info.plist entry required
```

---

## Part 9: Privacy-First Design Patterns

### Data Minimization

**Principle**: Only collect data you actually need

```swift
// ❌ Bad - collecting unnecessary data
struct UserProfile {
    let name: String
    let email: String
    let phone: String           // Do you really need this?
    let dateOfBirth: Date       // Or this?
    let socialSecurityNumber: String  // Definitely not
}

// ✅ Good - minimal data collection
struct UserProfile {
    let name: String
    let email: String
    // That's it
}
```

### On-Device Processing

**Principle**: Process data locally when possible

```swift
// ✅ Good - on-device ML
import Vision

func analyzePhoto(_ image: UIImage) {
    let request = VNClassifyImageRequest { request, error in
        // Results stay on device
        let classifications = request.results as? [VNClassificationObservation]
        self.displayResults(classifications)
    }

    let handler = VNImageRequestHandler(cgImage: image.cgImage!)
    try? handler.perform([request])
    // No network request, no data leaving device
}
```

### Explaining Value Exchange

**Principle**: Be transparent about why you need data

```swift
// ✅ Good - clear value proposition
"We use your location to show nearby restaurants and save your favorite places. Your location is never shared with third parties."
```

### Transparent Data Practices

**Principle**: Make privacy information easily accessible

```swift
// Add Privacy Policy link in Settings screen
struct SettingsView: View {
    var body: some View {
        List {
            Section("About") {
                Link("Privacy Policy", destination: URL(string: "https://example.com/privacy")!)
                Link("Data We Collect", destination: URL(string: "https://example.com/data")!)
            }
        }
    }
}
```

---

## Common Mistakes

### Requesting permissions at launch

```swift
// ❌ Wrong
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions...) -> Bool {
    requestAllPermissions()  // User has no context
    return true
}

// ✅ Correct
@objc func cameraButtonTapped() {
    requestCameraPermission()  // Just-in-time
}
```

### No explanation before permission dialog

```swift
// ❌ Wrong
AVCaptureDevice.requestAccess(for: .video) { granted in }

// ✅ Correct
showCameraEducation {
    AVCaptureDevice.requestAccess(for: .video) { granted in }
}
```

### Not handling denial gracefully

```swift
// ❌ Wrong - dead end
if !granted {
    return  // User stuck
}

// ✅ Correct - offer alternative
if !granted {
    showSettingsPrompt()  // Path forward
}
```

### Missing tracking domains

```swift
// ❌ Wrong - privacy manifest declares tracking but no domains
<key>NSPrivacyTracking</key>
<true/>
<!-- Missing NSPrivacyTrackingDomains -->

// ✅ Correct
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
</array>
```

### Incomplete Required Reason declarations

```swift
// ❌ Wrong - using UserDefaults without declaring it
UserDefaults.standard.set(value, forKey: "setting")
// Privacy manifest has no NSPrivacyAccessedAPITypes entry

// ✅ Correct - declared in manifest with approved reason
```

---

## Timeline

| Date | Milestone |
|------|-----------|
| **WWDC 2023** | Privacy manifests announced |
| **Fall 2023** | Informational emails begin |
| **Spring 2024** | App Review enforcement begins |
| **May 1, 2024** | Privacy manifests required for apps with privacy-impacting SDKs |

---

## Resources

**WWDC**: 2023-10060, 2023-10053

**Docs**: /bundleresources/privacy_manifest_files, /bundleresources/describing-use-of-required-reason-api, /app-store/app-privacy-details, /app-store/user-privacy-and-data-use

**Skills**: axiom-app-intents-ref, axiom-cloudkit-ref, axiom-storage
