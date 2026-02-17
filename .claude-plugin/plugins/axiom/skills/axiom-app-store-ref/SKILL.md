---
name: axiom-app-store-ref
description: App Store submission reference — complete metadata field specs, App Review guideline index, privacy manifest schema, age rating system, export compliance, EU DSA requirements, IAP review pipeline, and WWDC25 submission changes
license: MIT
metadata:
  version: "1.0.0"
---

# App Store Submission Reference

## Overview

Complete reference for every App Store submission requirement:

- **Part 1** — Required metadata fields (descriptions, screenshots, keywords, App Review info)
- **Part 2** — Privacy requirements (manifest schema, nutrition labels, ATT, Required Reason APIs)
- **Part 3** — App Review Guidelines quick reference (all sections 1-5)
- **Part 4** — Age rating system (5-tier, capabilities, regional variations)
- **Part 5** — Export compliance (encryption decision tree)
- **Part 6** — Account and authentication requirements (deletion, SIWA)
- **Part 7** — Monetization and IAP submission pipeline
- **Part 8** — EU-specific compliance (DSA trader status)
- **Part 9** — Build upload and processing
- **Part 10** — WWDC25 changes (draft submissions, accessibility labels, tags)

## When to Use This Skill

**Use when:**
- Looking up specific metadata field requirements or character limits
- Checking App Review guideline numbers for a specific topic
- Verifying privacy manifest schema fields or Required Reason API categories
- Understanding age rating tiers and new capability declarations
- Checking EU compliance requirements for DSA trader status
- Understanding IAP submission pipeline and review flow
- Preparing builds for upload (SDK requirements, encryption, signing)

**Do NOT use when:**
- Deciding if your app is ready to submit (use **app-store-submission**)
- Troubleshooting a rejection (use **app-store-diag**)
- Implementing in-app purchases (use **storekit-ref**)
- Writing privacy manifest code (use **privacy-ux**)
- Auditing accessibility compliance (use **accessibility-diag**)

## Related Skills

- **app-store-submission** — Discipline skill with pre-flight checklist and workflow
- **app-store-diag** — Rejection troubleshooting and appeal guidance
- **privacy-ux** — Privacy manifest implementation, ATT UX, permission requests
- **storekit-ref** — StoreKit 2 API reference for IAP implementation
- **accessibility-diag** — Accessibility compliance scanning and VoiceOver testing

## Key Terminology

| Term | Definition |
|------|-----------|
| **App Store Connect** | Web portal and API for managing app metadata, builds, pricing, TestFlight, and analytics |
| **App Review** | Apple's human review process that evaluates every app update against the App Review Guidelines |
| **Privacy Manifest** | `PrivacyInfo.xcprivacy` file declaring data collection, tracking domains, and Required Reason API usage |
| **Required Reason API** | System APIs (file timestamps, disk space, user defaults, etc.) that require declared usage reasons |
| **Privacy Nutrition Label** | App Store privacy cards showing what data your app collects and how it uses it |
| **DSA Trader Status** | EU Digital Services Act classification determining if you are a "trader" selling to EU consumers |
| **Build String** | Unique identifier for each uploaded build (e.g., "1.2.3.4"), separate from version number |
| **Bundle ID** | Reverse-domain identifier (e.g., "com.company.app") uniquely identifying your app across Apple's ecosystem |

---

## Part 1: Required Metadata Fields

### App Information

| Field | Required | Localizable | Max Length | Notes |
|-------|----------|-------------|------------|-------|
| App Name | Yes | Yes | 30 chars | Must be unique on the App Store |
| Subtitle | No | Yes | 30 chars | Appears below app name in search results |
| Description | Yes | Yes | 4000 chars | Plain text, no HTML or rich formatting |
| Promotional Text | No | Yes | 170 chars | Editable without new submission |
| Keywords | Yes | Yes | 100 bytes | Comma-separated, each keyword >2 chars |
| What's New | Yes* | Yes | 4000 chars | *Required for all versions except first |
| Copyright | Yes | No | — | Format: "YYYY Company Name" |
| Support URL | Yes | Yes | — | Must link to actual contact information |
| Marketing URL | No | Yes | — | Optional promotional page |
| Privacy Policy URL | Yes | Yes | — | HTTPS, publicly accessible |

### Visual Assets

| Asset | Required | Localizable | Specification |
|-------|----------|-------------|---------------|
| App Icon | Yes | No | 1024x1024 PNG, no alpha, no rounded corners |
| Screenshots | Yes | Yes | Per device size, 2-10 per locale per device |
| App Preview | No | Yes | Up to 3 videos per device size per locale |

#### Screenshot Requirements

Screenshots must be provided for each device size you support:

| Device | Required Size (portrait) | Required Size (landscape) |
|--------|-------------------------|--------------------------|
| iPhone 6.9" | 1320 x 2868 | 2868 x 1320 |
| iPhone 6.7" | 1290 x 2796 | 2796 x 1290 |
| iPhone 6.5" | 1284 x 2778 | 2778 x 1284 |
| iPhone 5.5" | 1242 x 2208 | 2208 x 1242 |
| iPad Pro 13" | 2048 x 2732 | 2732 x 2048 |
| iPad Pro 12.9" | 2048 x 2732 | 2732 x 2048 |

Screenshots must show the app in actual use. Not permitted: title art alone, login screens, splash screens, or screens from other platforms.

#### App Preview Video Specifications

| Specification | Requirement |
|---------------|-------------|
| Duration | 15-30 seconds |
| Format | H.264, ProRes 422 |
| Audio | English or localized; no offensive content |
| Frame rate | 30 or 60 fps |
| Resolution | Must match screenshot dimensions for the device |
| Content | Must show actual app footage; no device frames allowed in video |
| Per locale | Up to 3 preview videos per device size per locale |

#### App Icon Requirements

| Specification | Requirement |
|---------------|-------------|
| Size | 1024 x 1024 pixels |
| Format | PNG |
| Color space | sRGB or P3 |
| Alpha channel | Not allowed |
| Rounded corners | Not allowed (system applies automatically) |
| Layers/transparency | Not allowed |
| Content | Must be appropriate for 4+ rating regardless of app's actual rating |

### App Review Information

| Field | Required | Notes |
|-------|----------|-------|
| Contact First Name | Yes | Reviewer contact |
| Contact Last Name | Yes | Reviewer contact |
| Contact Email | Yes | Must be monitored |
| Contact Phone | Yes | Include country code |
| Notes for Review | No | Up to 4000 bytes; explain non-obvious features |
| Sign-in Username | If login required | Must not expire during review |
| Sign-in Password | If login required | Must not expire during review |
| Attachment | No | Up to 10 files, max 512 MB total |

### Metadata Rules (Guideline 2.3)

- App names must be unique, max 30 characters
- Keywords must not include trademarked terms, popular app names, or pricing terms ("free", "sale")
- Screenshots must show the app in use, not just marketing art
- Icons, screenshots, and previews must be appropriate for a 4+ rating even if the app is rated higher
- "For Kids" and "For Children" are reserved for the Kids category
- No other mobile platform names or imagery in screenshots (no Android phones, Windows logos)
- Metadata must accurately reflect app functionality; misleading metadata is grounds for rejection

### Localization Requirements

| Aspect | Details |
|--------|---------|
| Minimum | Primary language required; all other localizations optional |
| Per-locale metadata | App name, subtitle, description, keywords, What's New, screenshots |
| Promotional Text | Localizable and editable without new submission |
| Screenshots | Can differ per locale (show localized UI) |
| App Previews | Can differ per locale (show localized audio/UI) |
| URL fields | Support URL and Marketing URL can differ per locale |

When localizing, provide screenshots that match the localized UI. Reviewers check that screenshots accurately represent the app in each locale.

### Category Selection

| Primary Category | Secondary Category | Rules |
|-----------------|-------------------|-------|
| Required | Optional | Choose the category that best describes your app |
| Must be accurate | Can complement primary | Inaccurate category is grounds for rejection (2.3.7) |
| Games have subcategories | — | Games must also select up to 2 game subcategories |

Available categories: Books, Business, Developer Tools, Education, Entertainment, Finance, Food & Drink, Games, Graphics & Design, Health & Fitness, Lifestyle, Magazines & Newspapers, Medical, Music, Navigation, News, Photo & Video, Productivity, Reference, Shopping, Social Networking, Sports, Travel, Utilities, Weather.

---

## Part 2: Privacy Requirements

### Privacy Policy (Guideline 5.1.1(i))

Required in BOTH locations:
1. **App Store Connect** metadata (Privacy Policy URL field)
2. **Within the app** itself (accessible from settings or equivalent)

The privacy policy must identify:
- What data is collected and by what means
- All uses of collected data
- Third-party sharing practices
- Data retention and deletion policies
- How users can revoke consent

### Privacy Manifest Schema (PrivacyInfo.xcprivacy)

```xml
<!-- Top-level keys -->
NSPrivacyTracking              <!-- Boolean: Does app track users? -->
NSPrivacyTrackingDomains       <!-- Array<String>: Domains used for tracking -->
NSPrivacyCollectedDataTypes    <!-- Array<Dictionary>: Data collected -->
NSPrivacyAccessedAPITypes      <!-- Array<Dictionary>: Required Reason APIs -->
```

#### NSPrivacyCollectedDataTypes Entry

Each dictionary in the array contains:

| Key | Type | Description |
|-----|------|-------------|
| `NSPrivacyCollectedDataType` | String | Category key (e.g., "NSPrivacyCollectedDataTypeName") |
| `NSPrivacyCollectedDataTypePurposes` | Array&lt;String&gt; | Purpose keys for this data type |
| `NSPrivacyCollectedDataTypeLinked` | Boolean | Is this data linked to user identity? |
| `NSPrivacyCollectedDataTypeTracking` | Boolean | Is this data used for tracking? |

#### NSPrivacyAccessedAPITypes Entry

Each dictionary in the array contains:

| Key | Type | Description |
|-----|------|-------------|
| `NSPrivacyAccessedAPIType` | String | API category identifier |
| `NSPrivacyAccessedAPITypeReasons` | Array&lt;String&gt; | Approved reason codes for usage |

#### Complete PrivacyInfo.xcprivacy Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeEmailAddress</string>
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

#### API Category Identifiers

| Category | Identifier String |
|----------|------------------|
| File timestamp | `NSPrivacyAccessedAPICategoryFileTimestamp` |
| System boot time | `NSPrivacyAccessedAPICategorySystemBootTime` |
| Disk space | `NSPrivacyAccessedAPICategoryDiskSpace` |
| Active keyboard | `NSPrivacyAccessedAPICategoryActiveKeyboards` |
| User defaults | `NSPrivacyAccessedAPICategoryUserDefaults` |

#### Generating Aggregate Privacy Report

```
Xcode > Product > Archive > Generate Privacy Report
```

This produces a PDF summarizing privacy manifests from your app and all embedded frameworks.

### Required Reason API Categories

| Category | APIs Covered | Common Reasons |
|----------|-------------|----------------|
| File timestamp | `NSFileCreationDate`, `NSFileModificationDate`, `NSURLContentModificationDateKey` | DDA9.1 (display to user), C617.1 (inside app container) |
| System boot time | `systemUptime`, `mach_absolute_time` | 35F9.1 (measure elapsed time) |
| Disk space | `NSFileSystemFreeSize`, `NSFileSystemSize`, `volumeAvailableCapacityKey` | E174.1 (check before writing), 85F4.1 (display to user) |
| Active keyboard | `activeInputModes` | 54BD.1 (customize UI for keyboard) |
| User defaults | `UserDefaults` (all access requires declaration) | CA92.1 (access within app group), 1C8F.1 (access within same app) |

### App Privacy Details (Nutrition Labels)

#### Data Type Categories

| Category | Examples |
|----------|---------|
| Contact Info | Name, email address, phone number, physical address |
| Health & Fitness | Health data, fitness data |
| Financial Info | Payment info, credit info |
| Location | Precise location, coarse location |
| Sensitive Info | Racial or ethnic data, sexual orientation, religion, biometrics |
| Contacts | Address book contacts |
| User Content | Photos, videos, audio, gameplay content, customer support messages |
| Browsing History | Web browsing history |
| Search History | In-app search history |
| Identifiers | User ID, device ID |
| Purchases | Purchase history |
| Usage Data | Product interaction, advertising data, app launches, taps, scrolls |
| Diagnostics | Crash data, performance data |
| Surroundings | Environment scanning (e.g., AR data) |
| Body | Hands, head (e.g., hand tracking in visionOS) |

#### Purpose Categories

| Purpose | Description |
|---------|-------------|
| Third-Party Advertising | Displaying third-party ads or sharing with ad networks |
| Developer's Advertising/Marketing | Your own marketing campaigns |
| Analytics | Understanding user behavior and measuring effectiveness |
| Product Personalization | Customizing features, content recommendations |
| App Functionality | Required for app to work (e.g., authentication, data sync) |
| Other | Any purpose not listed above |

### Tracking and Collection Definitions

**"Collected"** means data is transmitted off-device and accessible beyond what is needed to service the current request. On-device-only processing is NOT collection.

**"Tracking"** means:
- Linking user/device data from your app with third-party data for advertising or measurement, OR
- Sharing user/device data with a data broker

### App Tracking Transparency (ATT)

Required if your app "tracks" per Apple's definition above.

- Add `NSUserTrackingUsageDescription` to Info.plist (explains why tracking is needed)
- Call `ATTrackingManager.requestTrackingAuthorization()` before tracking
- Respect the result:
  - `.authorized` — User granted permission to track
  - `.denied` — User denied tracking; do not track
  - `.notDetermined` — User has not yet been asked
  - `.restricted` — Device-level restriction prevents tracking

Request at a contextually appropriate moment, not at first launch.

### Common Purpose Strings (NS*UsageDescription)

These Info.plist keys must be present for each system permission your app requests:

| Permission | Info.plist Key |
|------------|---------------|
| Camera | `NSCameraUsageDescription` |
| Microphone | `NSMicrophoneUsageDescription` |
| Photo Library (read) | `NSPhotoLibraryUsageDescription` |
| Photo Library (write) | `NSPhotoLibraryAddUsageDescription` |
| Location (when in use) | `NSLocationWhenInUseUsageDescription` |
| Location (always) | `NSLocationAlwaysAndWhenInUseUsageDescription` |
| Contacts | `NSContactsUsageDescription` |
| Calendars (full access) | `NSCalendarsFullAccessUsageDescription` |
| Reminders (full access) | `NSRemindersFullAccessUsageDescription` |
| Health | `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` |
| Motion | `NSMotionUsageDescription` |
| Bluetooth | `NSBluetoothAlwaysUsageDescription` |
| Face ID | `NSFaceIDUsageDescription` |
| Local Network | `NSLocalNetworkUsageDescription` |
| Tracking | `NSUserTrackingUsageDescription` |
| Speech Recognition | `NSSpeechRecognitionUsageDescription` |
| Apple Music | `NSAppleMusicUsageDescription` |

Missing purpose strings cause immediate rejection. Purpose string text must clearly explain why the permission is needed in the context of your app's functionality.

### Third-Party SDK Privacy Manifests

Apple maintains a list of commonly used SDKs that require privacy manifests. Starting spring 2024, if your app includes these SDKs without privacy manifests, it will be flagged during submission.

Third-party SDKs should include their own `PrivacyInfo.xcprivacy` in their framework bundle. The aggregate privacy report combines all manifests from your app and embedded frameworks.

If a third-party SDK does not include a privacy manifest, you must declare its data collection in your app's privacy manifest.

---

## Part 3: App Review Guidelines Quick Reference

### Section 1: Safety

| Guideline | Topic |
|-----------|-------|
| 1.1 | Objectionable Content |
| 1.1.1 | Defamatory, discriminatory, or mean-spirited content |
| 1.1.2 | Realistic portrayals of people or animals being harmed |
| 1.1.3 | Content depicting violence against children |
| 1.1.4 | Animal abuse, targeted group abuse |
| 1.1.5 | Religious, cultural, or ethnic group commentary risks |
| 1.1.6 | False info, harassment features |
| 1.1.7 | Virus/malware distribution |
| 1.2 | User-Generated Content |
| 1.2.1 | UGC apps must have content filtering, reporting, blocking, contact info, age verification |
| 1.3 | Kids Category |
| 1.3.1 | No third-party analytics, advertising, or links out of the app |
| 1.4 | Physical Harm |
| 1.4.1 | Medical apps must disclose limitations and link to real help |
| 1.4.2 | Drug dosage calculators must come from recognized institutions |
| 1.4.3 | Illegal drug use encouragement |
| 1.4.4 | Apps primarily for illegal file sharing |
| 1.4.5 | Body modification tools, eating disorder encouragement |
| 1.5 | Developer Information |
| 1.5.1 | Developer Program must be kept current |
| 1.6 | Data Security |
| 1.6.1 | App Transport Security; exceptions must be justified |
| 1.6.2 | Data collected must have a purpose |
| 1.6.3 | Local laws on data collection/storage |
| 1.6.4 | Apps using backgrounding must behave appropriately |

### Section 2: Performance

| Guideline | Topic |
|-----------|-------|
| 2.1 | App Completeness |
| 2.1.1 | No crashes, bugs, broken links, placeholder content |
| 2.2 | Beta, Demo, Trial Apps |
| 2.2.1 | No "beta", "demo", "trial" in bundle ID or name (use TestFlight) |
| 2.3 | Accurate Metadata |
| 2.3.1 | Don't include pricing, platform names, or misleading info |
| 2.3.2 | No concealed features |
| 2.3.3 | Screenshots must reflect actual app experience |
| 2.3.7 | Must use accurate App Store category |
| 2.3.8 | Must have unique app name |
| 2.3.10 | Don't include irrelevant search content |
| 2.3.11 | Keywords >2 chars, max 100, no trademarks |
| 2.3.12 | "For Kids"/"For Children" reserved for Kids category |
| 2.4 | Hardware Compatibility |
| 2.4.1 | Must work with current OS, not just prior version |
| 2.5 | Software Requirements |
| 2.5.1 | Only use public APIs |
| 2.5.2 | Must be self-contained, no installer other than App Store |
| 2.5.3 | Apps transmitting viruses, code injection |
| 2.5.4 | Multitasking must use proper background modes |
| 2.5.6 | No changing primary function after review |
| 2.5.9 | Request only necessary permissions |
| 2.5.11 | SiriKit, HealthKit must actually use the feature |
| 2.5.18 | No remote mirrors or proxies of other software |

### Section 3: Business

| Guideline | Topic |
|-----------|-------|
| 3.1 | Payments |
| 3.1.1 | In-App Purchase: digital goods/services must use IAP. Disclose loot box odds |
| 3.1.2 | Subscriptions: ongoing value, 7-day minimum, cross-device, transparent terms |
| 3.1.3 | Permitted External Payments |
| 3.1.3(a) | Reader apps (previously purchased content) |
| 3.1.3(b) | Multiplatform services (cross-platform subscriptions) |
| 3.1.3(c) | Enterprise services (organizations only) |
| 3.1.3(d) | Person-to-person services (real-time individual services) |
| 3.1.3(e) | Physical goods/services (consumed outside app) |
| 3.1.4 | No artificial barriers between IAP and web purchase options |
| 3.1.5(a) | Non-subscription apps can offer free → paid upgrade |
| 3.1.7 | No direct appeals to users about pricing within app |
| 3.2 | Other Business Model Issues |
| 3.2.1 | No apps that are essentially simple websites |
| 3.2.2 | No paid app that is also free elsewhere |

### Section 4: Design

| Guideline | Topic |
|-----------|-------|
| 4.0 | General design requirements and Apple design standards |
| 4.1 | Copycats: apps that look confusingly similar to existing Apple or third-party apps |
| 4.2 | Minimum Functionality |
| 4.2.1 | No apps that are essentially repackaged web content |
| 4.2.2 | No single-song, -movie, -book apps |
| 4.2.3 | Must have sufficient utility beyond a simple website |
| 4.2.6 | No app-as-marketing, app-as-ad |
| 4.3 | Spam |
| 4.3.0 | No duplicate apps from same developer |
| 4.4 | Extensions |
| 4.4.1 | Keyboard extensions must have a way to switch to next keyboard |
| 4.5 | Apple Sites and Services |
| 4.5.4 | Push notifications: no advertising, marketing, spam |
| 4.7 | HTML5 Games/Bots in WebView |
| 4.8 | Sign in with Apple: required when any third-party/social login offered |

### Section 5: Legal

| Guideline | Topic |
|-----------|-------|
| 5.1 | Privacy |
| 5.1.1 | Data Collection and Storage |
| 5.1.1(i) | Privacy policy required in app and in App Store Connect |
| 5.1.1(ii) | Permission requests must explain purpose |
| 5.1.1(iii) | Don't require unnecessary personal info for functionality |
| 5.1.1(v) | Account must be deletable |
| 5.1.2 | Data Use and Sharing |
| 5.1.2(i) | No sharing with third parties without consent |
| 5.1.3 | Health and Health Research |
| 5.1.4 | Kids Category requirements |
| 5.1.5 | Location Services must have clear purpose |
| 5.2 | Intellectual Property |
| 5.2.1 | No unauthorized use of copyrighted material |
| 5.2.2 | Third-party content requires permission |
| 5.2.3 | Audio/video must respect content rights |
| 5.3 | Gaming, Gambling, Lotteries |
| 5.3.1 | No real-money gambling without proper licensing |
| 5.3.2 | Lotteries, contests must comply with local law |
| 5.3.3 | Charitable fundraising must be registered nonprofit |
| 5.4 | VPN Apps |
| 5.4.1 | Must use NEVPNManager API |
| 5.5 | Developer Code of Conduct |
| 5.6 | Telecommunications |
| 5.6.1 | Voice over IP |
| 5.6.3 | Stickers/iMessage apps |

### Most Common Rejection Reasons

Based on Apple's published data, the most frequent rejection reasons:

| Rank | Guideline | Issue | Prevention |
|------|-----------|-------|------------|
| 1 | 2.1 | App Completeness — bugs, crashes, placeholder content | Thorough QA before submission |
| 2 | 4.3 | Spam — duplicate apps, cookie-cutter templates | Ensure genuine unique value |
| 3 | 2.3.3 | Inaccurate screenshots | Screenshots must match actual app |
| 4 | 5.1.1 | Privacy — missing policy or purpose strings | Complete all privacy requirements |
| 5 | 4.0 | Design — not meeting minimum quality bar | Follow HIG, test all flows |
| 6 | 2.5.1 | Private API usage | Only use public APIs |
| 7 | 3.1.1 | IAP required for digital goods | Use IAP for digital content |
| 8 | 4.2 | Minimum functionality — app too simple | Provide genuine utility |
| 9 | 5.1.1(v) | Missing account deletion | Implement full account deletion |
| 10 | 2.3.7 | Wrong app category | Choose accurate primary category |

### App Review Timeline

| Stage | Typical Duration |
|-------|-----------------|
| Waiting for Review | Minutes to hours |
| In Review | Minutes to 24 hours |
| Total (90th percentile) | Under 24 hours |
| Total (edge cases) | Up to 7 days |
| Expedited Review | Same day to 24 hours (if approved) |

Review times increase during holidays and major iOS release periods. Plan submissions accordingly.

---

## Part 4: Age Rating System

### Five-Tier Rating System (Updated January 31, 2026)

| Rating | Triggers |
|--------|----------|
| **4+** | No objectionable material |
| **9+** | Infrequent or mild: profanity, cartoon/fantasy violence, horror/fear themes. Loot boxes present |
| **13+** | Frequent or intense: profanity or crude humor. Infrequent: alcohol/tobacco/drugs references, sexual content/nudity, realistic violence |
| **16+** | Unrestricted web access, frequent medical/treatment info, mature/suggestive themes |
| **18+** | Frequent or intense: alcohol/tobacco/drugs use, sexual content/nudity, realistic violence. Simulated gambling with real-money elements |
| **Unrated** | App cannot be published without completing the questionnaire |

### Capability Declarations (New, WWDC25)

Apps must declare if they include these capabilities:

| Capability | When to Declare |
|------------|----------------|
| Messaging/chat | Any in-app messaging between users |
| User-generated content | Users can post, share, or upload content visible to others |
| Advertising | App displays ads from any ad network |
| Parental controls | App has parental restrictions or family features |
| Age assurance | App verifies user age for restricted content |

These declarations appear alongside the age rating on the App Store product page, giving parents and users additional transparency.

### Regional Variations

Age ratings map differently across regions:

| Apple Rating | Australia | Brazil | Korea | Germany (USK) |
|-------------|-----------|--------|-------|----------------|
| 4+ | 4+ | L (All ages) | All | 0 |
| 9+ | 9+ | A10 | 12+ | 6 |
| 13+ | 13+ | A12 | 15+ | 12 |
| 16+ | 15+ | A16 | 19+ | 16 |
| 18+ | R 18+ | A18 | 19+ | 18 |

The age rating questionnaire automatically generates the appropriate regional ratings based on your answers.

### Age Rating Best Practices

- Answer the questionnaire conservatively; under-rating leads to rejection
- If your app accesses unrestricted web content (WebView without content filter), it will be rated 16+ minimum
- UGC apps typically need 13+ minimum due to moderation requirements
- Simulated gambling (even without real money) requires at least 9+
- Realistic violence in gameplay requires at least 13+

### Age Rating Questionnaire Topics

The questionnaire covers these content categories:

| Category | Options |
|----------|---------|
| Cartoon or Fantasy Violence | None, Infrequent/Mild, Frequent/Intense |
| Realistic Violence | None, Infrequent/Mild, Frequent/Intense |
| Profanity or Crude Humor | None, Infrequent/Mild, Frequent/Intense |
| Mature/Suggestive Themes | None, Infrequent/Mild, Frequent/Intense |
| Alcohol, Tobacco, or Drug Use or References | None, Infrequent/Mild, Frequent/Intense |
| Sexual Content and Nudity | None, Infrequent/Mild, Frequent/Intense |
| Horror/Fear Themes | None, Infrequent/Mild, Frequent/Intense |
| Simulated Gambling | None, Infrequent/Mild, Frequent/Intense |
| Medical/Treatment Information | None, Infrequent/Mild, Frequent/Intense |
| Unrestricted Web Access | Yes/No |

The system automatically calculates your app's age rating across all regions based on your answers.

---

## Part 5: Export Compliance

### Encryption Decision Tree

```
Does your app use encryption?
├── No → Set ITSAppUsesNonExemptEncryption = NO in Info.plist → Done
├── Only HTTPS/TLS/URLSession?
│   ├── Yes → Exempt, set ITSAppUsesNonExemptEncryption = NO → Done
│   │         (May need annual self-classification report to BIS)
│   └── No (custom encryption) →
│       Set ITSAppUsesNonExemptEncryption = YES →
│       Upload compliance documentation to App Store Connect →
│       Receive encryption compliance code →
│       Set ITSEncryptionExportComplianceCode in Info.plist → Done
```

### Info.plist Keys

```xml
<!-- Most apps: HTTPS only -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<!-- Apps with custom encryption -->
<key>ITSAppUsesNonExemptEncryption</key>
<true/>
<key>ITSEncryptionExportComplianceCode</key>
<string>YOUR_COMPLIANCE_CODE</string>
```

### Exempt Encryption Uses

These are exempt from export documentation (but may still require annual self-classification):
- HTTPS/TLS (URLSession, Network.framework, WKWebView)
- Secure Enclave operations (biometric auth, Keychain)
- Apple's built-in encryption frameworks (CryptoKit, Security.framework) when used per Apple documentation
- Password hashing (bcrypt, scrypt, PBKDF2)

### Non-Exempt Encryption Uses

These require compliance documentation:
- Custom encryption algorithms
- Open-source encryption libraries (OpenSSL, libsodium) used for non-standard purposes
- End-to-end encrypted messaging
- VPN implementations
- Custom DRM systems

---

## Part 6: Account and Authentication

### Account Deletion (Required Since June 2022)

Apps that support account creation must offer account deletion. Requirements:

| Requirement | Details |
|-------------|---------|
| Full deletion | Must fully delete the account, not just deactivate |
| Easy to find | Must be accessible from app settings; not buried behind support tickets |
| Inform timeline | Tell user how long deletion takes |
| Confirm completion | Notify user when deletion is complete |
| Delete shared UGC | Must handle user-generated content shared with others |
| Revoke SIWA tokens | Call Apple's revoke token endpoint for Sign in with Apple accounts |
| Handle subscriptions | Warn about active subscriptions; direct to subscription management |

#### Sign in with Apple Token Revocation

```swift
// Server-side: revoke SIWA tokens when account deleted
// POST https://appleid.apple.com/auth/revoke
// Parameters: client_id, client_secret, token, token_type_hint
```

Failing to revoke SIWA tokens during account deletion is a common rejection reason.

### Sign in with Apple (Guideline 4.8)

**Required when:** Your app offers ANY third-party or social login option (Google, Facebook, Twitter, email/password via third-party provider).

**Exceptions — SIWA not required when:**
- App is for company employees only (internal enterprise app)
- App is for education or enterprise with existing institutional auth
- App uses government or industry-backed citizen ID systems
- App is a client for a specific third-party service (e.g., Gmail app, Slack)

When SIWA is required, it must be offered as an equally prominent option alongside other sign-in methods. It cannot be hidden or given less visual weight.

### Account Deletion Implementation Checklist

| Step | Details |
|------|---------|
| 1. Add UI entry point | Settings screen, clearly labeled "Delete Account" |
| 2. Explain consequences | Show what will be deleted (data, subscriptions, purchases) |
| 3. Require confirmation | User must explicitly confirm deletion |
| 4. Handle active subscriptions | Direct user to cancel active subscriptions before deletion |
| 5. Process deletion | Delete all user data from your servers |
| 6. Revoke SIWA tokens | Call Apple's revoke endpoint if SIWA was used |
| 7. Confirm to user | Send email or in-app confirmation when deletion is complete |
| 8. Define timeline | State how long deletion takes (immediately, 30 days, etc.) |

Apple specifically rejects apps that:
- Require users to call a phone number to delete their account
- Require users to send an email to request deletion
- Only offer account deactivation (hiding profile) instead of full deletion
- Don't handle SIWA token revocation

---

## Part 7: Monetization and IAP

### IAP Submission Pipeline

In-app purchases have a separate review process from app submissions:

| Scenario | Behavior |
|----------|----------|
| First IAP ever | Must be bundled with a new app version submission |
| Subsequent IAPs | Can be submitted independently of app updates |
| IAP metadata change | Submitted for review independently |
| IAP price change | Takes effect without review |

#### Required IAP Metadata

| Field | Required | Notes |
|-------|----------|-------|
| Reference Name | Yes | Internal name (not visible to users) |
| Product ID | Yes | Unique, cannot be reused after deletion |
| Type | Yes | Consumable, non-consumable, auto-renewable, non-renewing |
| Price | Yes | Select from Apple's price tiers |
| Display Name | Yes | Localizable, shown to users |
| Description | Yes | Localizable, shown to users |
| Screenshot | Yes | One screenshot showing the IAP in context |
| Review Notes | No | Explain what the IAP unlocks |

#### IAP Status Flow

```
Missing Metadata → Ready to Submit → Waiting for Review → In Review → Approved
                                                                    → Rejected
```

IAP must be in "Ready to Submit" status before it can be included in an app submission.

### Subscription Rules (Guideline 3.1.2)

| Rule | Details |
|------|---------|
| Ongoing value | Subscriptions must provide continuing value over time |
| Minimum duration | 7 days minimum subscription period |
| Cross-device | Must work across all user's devices where app is available |
| Transparent terms | Clearly state price, duration, auto-renewal, and cancellation |
| No removing features | Cannot remove previously paid functionality to force subscription |
| Grace period | Support billing grace period (user retains access during retry) |
| Upgrade/downgrade | Must support plan changes within subscription group |

### Loot Boxes (Guideline 3.1.1)

Apps offering loot boxes or random item mechanics must disclose the odds of receiving each type of item before purchase.

### External Payment Eligibility

| Category | Guideline | What's Allowed |
|----------|-----------|----------------|
| Reader apps | 3.1.3(a) | Link to website for previously purchased content (magazines, newspapers, books, audio, music, video) |
| Multiplatform services | 3.1.3(b) | Cross-platform subscriptions (e.g., Netflix, Spotify) |
| Enterprise services | 3.1.3(c) | B2B apps for organizations, not individual consumers |
| Person-to-person | 3.1.3(d) | Real-time one-to-one services (tutoring, consulting, ride-sharing) |
| Physical goods/services | 3.1.3(e) | Goods consumed outside the app (food delivery, clothing, physical subscriptions) |

Apps in these categories may accept payment outside the IAP system.

### Subscription Group Architecture

| Concept | Details |
|---------|---------|
| Subscription Group | Collection of related subscription tiers (e.g., Basic, Pro, Premium) |
| Service Level | Rank within a group; determines upgrade/downgrade behavior |
| Upgrade | Moving to higher service level (immediate, prorated) |
| Downgrade | Moving to lower service level (effective at next renewal) |
| Crossgrade | Same service level, different duration (monthly ↔ annual) |
| Family Sharing | Can be enabled per subscription group |

#### Subscription Pricing

| Feature | Details |
|---------|---------|
| Price tiers | Apple provides 900+ price points across 175+ storefronts |
| Price equalization | Apple auto-equalizes prices across currencies |
| Custom pricing | Set custom prices per storefront |
| Introductory offers | Free trial, pay-as-you-go, pay-up-front |
| Promotional offers | For existing/lapsed subscribers; requires server-signed JWS |
| Win-back offers | For lapsed subscribers; displayed by system automatically |
| Offer codes | Distributable codes for free/discounted access |

#### Subscription Restore Purchases

All subscription apps must implement Restore Purchases functionality. This is tested during App Review. Implement via:

```swift
try await AppStore.sync()
```

If Restore Purchases is missing or non-functional, the app will be rejected.

### Free Trial Best Practices

| Practice | Details |
|----------|---------|
| Duration display | Clearly show trial length before user commits |
| Post-trial pricing | Show what price will be charged after trial ends |
| Cancellation | Explain how to cancel before trial ends |
| No dark patterns | Don't make cancellation difficult or hard to find |
| Reminder | Consider sending a push notification before trial ends |

---

## Part 8: EU-Specific Compliance

### Digital Services Act (DSA) Trader Status

**Applies to:** ALL apps distributed in the EU (27 member states)

**Timeline:** Since February 17, 2025, apps without declared trader status are subject to removal from the EU App Store.

#### What is Trader Status?

A self-assessment: are you acting as a "trader" (selling goods/services to EU consumers) or a non-trader (hobby, open-source, non-commercial)? Apple cannot determine this for you.

#### Trader Requirements

If you declare as a trader, you must provide:

| Field | Required | Verification |
|-------|----------|-------------|
| Legal name | Yes | — |
| Address | Yes | — |
| Phone number | Yes | Verified via 2FA |
| Email address | Yes | Verified via 2FA |
| Company registration | Where applicable | — |
| VAT ID | Where applicable | — |

This contact information is displayed on your EU product page.

#### Declaring in App Store Connect

```
App Store Connect > Users and Access > Developer Profile > Trader Status
```

Select your trader status for each app. If you have both paid and free apps, each app may have a different trader classification.

### EU Alternative Distribution

Under the Digital Markets Act (DMA), Apple allows alternative app distribution in the EU:
- Alternative app marketplaces
- Web distribution (notarized apps)
- Alternative payment processing

These require separate business terms (Alternative Terms Addendum) and additional compliance steps. See Apple's EU developer documentation for details.

### EU 27 Member States

Apps distributed in any of these territories require DSA compliance:

Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden.

If your app is available in "All Territories" (the default), it is available in the EU and DSA compliance is required.

---

## Part 9: Build Upload and Processing

### Upload Methods

| Method | Best For |
|--------|---------|
| **Xcode** (recommended) | Most developers; integrated with Archive workflow |
| **Xcode Cloud** | CI/CD with automatic builds and distribution |
| **Transporter** | Standalone macOS app for batch uploads |
| **altool** (CLI) | Scripted CI/CD pipelines |
| **App Store Connect API** | Fully automated workflows |

### Build Identifiers

| Identifier | Purpose | Example | Rules |
|------------|---------|---------|-------|
| Bundle ID | Uniquely identifies your app | `com.company.app` | Set once, cannot change |
| Version Number | User-facing version | `2.1.0` | Must increment for each release |
| Build String | Distinguishes builds of same version | `2.1.0.42` | Must be unique per version per platform |

### Build Selection

- Only one build can be selected per version
- Build selection can be changed until the version is submitted for review
- "Missing Compliance" status blocks build selection until export compliance questions are answered

### SDK Requirements

| Effective Date | Requirement |
|----------------|-------------|
| April 2025 (current) | Xcode 16, iOS 18 SDK |
| April 28, 2026 (upcoming) | Xcode 26, iOS 26 SDK |

Apps built with outdated SDKs will be rejected after the effective date for new submissions. Existing apps on the store are not affected until they submit an update.

### Build Processing

After upload, Apple processes your build:

1. **Upload** — Binary transferred to Apple (5-30 minutes depending on size)
2. **Processing** — Apple validates binary, runs automated checks (15-60 minutes)
3. **Available** — Build appears in App Store Connect, ready for TestFlight or submission
4. **Email notification** — Sent when processing completes or fails

Common processing failures:
- Missing required architectures (arm64 required)
- Invalid provisioning profile or signing identity
- Missing privacy manifest for third-party SDKs on Apple's list
- Info.plist missing required keys
- Binary too large (OTA download limit: 200 MB over cellular)

### IPv6 Compatibility

All apps must work on IPv6-only networks. Apple's review environment uses IPv6. Common issues:
- Hard-coded IPv4 addresses
- Using low-level socket APIs instead of high-level networking
- Third-party SDKs with IPv4-only code

Use `URLSession` or `Network.framework` to ensure IPv6 compatibility automatically.

### App Thinning and Bitcode

| Topic | Status |
|-------|--------|
| Bitcode | Deprecated since Xcode 14; no longer accepted |
| App Thinning | Active; Apple generates device-specific variants |
| On-Demand Resources | Active; tag resources for download on demand |
| Asset catalogs | Used for app thinning of images (1x/2x/3x) |

### Entitlements and Capabilities

Certain features require entitlements configured in Xcode and provisioning profiles:

| Capability | Entitlement | Common Issues |
|------------|-------------|---------------|
| Push Notifications | `aps-environment` | Certificate expiry, missing provisioning |
| App Groups | `com.apple.security.application-groups` | Shared container ID mismatch |
| Associated Domains | `com.apple.developer.associated-domains` | AASA file not served correctly |
| HealthKit | `com.apple.developer.healthkit` | Missing required capabilities |
| Background Modes | `UIBackgroundModes` | Using modes without justification |
| Sign in with Apple | `com.apple.developer.applesignin` | Missing from provisioning profile |
| CloudKit | `com.apple.developer.icloud-services` | Container ID mismatch |
| In-App Purchase | — | Enabled by default; StoreKit config needed for testing |

### TestFlight Submission

TestFlight builds also go through a review process, though lighter than App Store:

| Aspect | Internal Testing | External Testing |
|--------|-----------------|-----------------|
| Testers | Up to 100 App Store Connect users | Up to 10,000 external testers |
| Review required | No | Yes (first build per version) |
| Review time | — | Usually under 24 hours |
| Duration | 90 days from upload | 90 days from upload |
| Groups | — | Organize testers into groups |
| Feedback | Crash reports only | Screenshots, feedback, crash reports |

---

## Part 10: WWDC25 Changes

### Draft Submissions (WWDC 2025-328)

Group multiple items into a single draft submission:
- App version + new IAPs + product page changes
- Review everything together instead of separate submissions
- Draft state: prepare items over time, submit when ready

### Reusable Build Numbers on Failure

When a build is rejected due to metadata issues (not binary issues), you can reuse the same build without re-uploading. Previously, rejected builds required a new build string.

### Builds Retained After Error Rejection

Builds are no longer removed from App Store Connect after certain rejection types. You can fix metadata issues and resubmit with the same build.

### Accessibility Nutrition Labels

New App Store metadata for accessibility features:
- Declare which accessibility features your app supports
- Displayed on your App Store product page
- Categories include VoiceOver support, Dynamic Type, Switch Control, etc.
- Helps users find apps that meet their accessibility needs

### App Store Tags (LLM-Generated, Editable)

Apple generates descriptive tags for your app using AI:
- Tags appear on your product page
- You can review and edit suggested tags
- Tags improve discoverability in search
- Based on app metadata, description, and functionality

### Custom Product Page Keywords

Product pages can now have unique keywords:
- Different keywords per custom product page
- Improves targeting for different audiences
- Each custom page can appear in different search results

### Offer Codes Expanded

Offer codes now support all IAP types:
- Consumables
- Non-consumables
- Non-renewing subscriptions
- Auto-renewable subscriptions (existing)

### Review Summaries (AI-Generated)

Apple generates AI summaries of user reviews:
- Summarizes common themes across reviews
- Displayed on the product page
- Updated as new reviews come in
- Helps users quickly understand app quality and common feedback

### Analytics Enhancements

100+ new analytics metrics including:
- Pre-order conversion funnels
- Custom product page performance comparison
- Subscription lifecycle metrics (trial to paid conversion, churn timing)
- Peer group benchmarking (compare performance against similar apps)
- Download source attribution refinements

### Age Rating Overhaul

Five-tier system with new capability declarations (see Part 4 for full details).

### Custom Product Pages (Existing, Enhanced in WWDC25)

Custom product pages allow different App Store presentations for different audiences:

| Feature | Details |
|---------|---------|
| Maximum | Up to 35 custom product pages per app |
| Customizable | Screenshots, app previews, promotional text |
| NOT customizable | App name, icon, description, What's New |
| URL | Unique URL per custom page for attribution |
| Keywords | New in WWDC25: unique keywords per custom product page |
| Analytics | Impressions, downloads, conversion rates per page |

### App Store Pricing Changes

| Feature | Details |
|---------|---------|
| 900+ price points | Expanded from original 87 tiers |
| Global equalization | Automatic currency conversion with regional pricing |
| Custom pricing | Override auto-equalization for specific storefronts |
| Price increases | Existing subscribers notified; must consent for >50% increase |
| Regional pricing | Set prices optimized for each market's purchasing power |

---

## Expert Review Checklist

### Build

- [ ] Built with required SDK version (currently Xcode 16, iOS 18 SDK)
- [ ] Export compliance answered (`ITSAppUsesNonExemptEncryption`)
- [ ] Encryption documentation uploaded (if custom encryption)
- [ ] IPv6-only network compatible
- [ ] Signed with distribution certificate and provisioning profile
- [ ] Correct bundle ID for target environment (production, not development)
- [ ] Build string unique for this version
- [ ] Binary under 200 MB OTA cellular limit (or warn users)
- [ ] All required architectures included (arm64)
- [ ] No private API usage

### Privacy

- [ ] `PrivacyInfo.xcprivacy` present and complete
- [ ] Privacy policy URL set in App Store Connect
- [ ] Privacy policy accessible within the app
- [ ] All purpose strings (`NS*UsageDescription`) present for requested permissions
- [ ] ATT implemented if app tracks users
- [ ] Required Reason APIs declared with approved reasons
- [ ] Privacy Nutrition Labels match actual data collection
- [ ] Third-party SDK privacy manifests included
- [ ] Privacy report generated and reviewed (`Product > Archive > Generate Privacy Report`)

### Metadata

- [ ] App name unique, max 30 characters
- [ ] Description complete, max 4000 characters, plain text
- [ ] Keywords set, max 100 bytes, no trademarked terms
- [ ] Screenshots provided for all supported device sizes
- [ ] Screenshots show app in actual use (not title art or splash screens)
- [ ] What's New text updated for this version
- [ ] Copyright field current year
- [ ] Support URL links to real contact information
- [ ] Privacy Policy URL is HTTPS and publicly accessible
- [ ] Promotional Text set (editable without submission)
- [ ] App category accurate
- [ ] All metadata localized for target markets

### Account

- [ ] Account deletion implemented and easy to find
- [ ] SIWA token revocation on account deletion
- [ ] Sign in with Apple offered if any third-party login exists
- [ ] SIWA given equal visual prominence to other login options
- [ ] Demo credentials provided in App Review Information (if login required)
- [ ] Demo credentials will not expire during review period

### Content

- [ ] No placeholder content ("Lorem ipsum", "Coming Soon", etc.)
- [ ] All links functional and leading to real content
- [ ] Final production assets (not development/staging URLs)
- [ ] No test data visible in screenshots or app
- [ ] No references to other mobile platforms in metadata

### Age Rating

- [ ] Age rating questionnaire completed
- [ ] New capability declarations answered (messaging, UGC, advertising, parental, age assurance)
- [ ] UGC moderation implemented if applicable
- [ ] Content filtering in place for web views (or accept 16+ minimum)
- [ ] Loot box odds disclosed if applicable

### Monetization

- [ ] All IAPs configured and in "Ready to Submit" status
- [ ] IAP screenshots uploaded
- [ ] Subscription terms clear (price, duration, auto-renewal, cancellation)
- [ ] Loot box odds displayed before purchase
- [ ] Restore Purchases functionality working
- [ ] No removing paid features to force new purchases
- [ ] Subscription grace period supported
- [ ] Offer codes configured if planned

### EU Compliance

- [ ] DSA trader status declared for all EU-distributed apps
- [ ] Trader email verified via 2FA
- [ ] Trader phone verified via 2FA
- [ ] Contact information accurate and current
- [ ] Labels and markings complete (if applicable for product category)

### App Review

- [ ] Contact information complete (name, email, phone)
- [ ] Demo account credentials provided (if login required)
- [ ] Notes for Review explain any non-obvious features
- [ ] Attachment uploaded for features requiring special hardware or setup
- [ ] Review contact email actively monitored

---

## Troubleshooting

### 10 Common Submission Issues

| # | Issue | Cause | Fix |
|---|-------|-------|-----|
| 1 | "Missing Compliance" on build | Export compliance questions not answered | App Store Connect > build > answer encryption questions |
| 2 | Build not appearing in ASC | Processing delay or failure | Wait 15-60 min; check email for processing errors |
| 3 | "Add for Review" button grayed | Missing required metadata | Check all required fields in App Information and Version Information |
| 4 | Screenshots wrong size | Device spec mismatch | Use exact pixel dimensions for each device size class |
| 5 | Privacy policy URL invalid | Not HTTPS or not publicly accessible | Must be `https://` URL accessible without login |
| 6 | IAP not available for review | IAP not in "Ready to Submit" status | Complete all IAP metadata including screenshot; set status |
| 7 | Age rating warnings | Questionnaire incomplete or capabilities not declared | Complete questionnaire; answer new capability questions |
| 8 | DSA trader status incomplete | Email or phone not verified | Complete 2FA verification for both email and phone |
| 9 | Build string conflict | Duplicate build string for same version | Each build upload must have a unique build string |
| 10 | "In Review" for extended period | Complex review or holiday backlog | 90% of apps reviewed in <24h; use expedited review for critical/urgent issues |

### Expedited Review

Request via App Store Connect when:
- Critical bug fix affecting many users
- Security vulnerability patch
- Time-sensitive event (holiday sale, product launch)
- Legal or government compliance deadline

Apple reviews expedited requests case-by-case. Not guaranteed. Provide clear justification.

### Rejection Response Options

| Option | When to Use | How |
|--------|-------------|-----|
| Fix and resubmit | Issue is clear and fixable | Fix the issue, upload new build or update metadata, resubmit |
| Reply in Resolution Center | Need clarification or want to explain | App Store Connect > Resolution Center |
| Appeal | Believe rejection is incorrect | App Review Board appeal via Resolution Center |
| Contact App Review | Need guidance on a specific guideline | Phone or online request |

#### Resolution Center Best Practices

- Respond within 14 days (submissions auto-expire after that)
- Be specific about what you changed to address the rejection
- Include screenshots if the fix is visual
- Reference specific guideline numbers when explaining compliance
- If appealing, provide factual evidence, not emotional arguments

### App Store Connect API for Submissions

For automated submission workflows:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/appStoreVersions` | Create new version |
| `PATCH /v1/appStoreVersions/{id}` | Update version metadata |
| `POST /v1/appStoreVersionSubmissions` | Submit version for review |
| `GET /v1/apps/{id}/appStoreVersions` | List all versions |
| `POST /v1/appScreenshots` | Upload screenshots |
| `POST /v1/appPreviews` | Upload app preview videos |
| `GET /v1/apps/{id}/builds` | List processed builds |

Authentication requires an API key from App Store Connect (Users and Access > Integrations > App Store Connect API).

### Pre-Submission Testing Checklist

| Test | What to Verify |
|------|---------------|
| Fresh install | App works on clean device with no prior data |
| Upgrade path | App works when upgrading from previous version |
| Network conditions | App handles offline, slow, and interrupted connections |
| Low storage | App handles low disk space gracefully |
| Background/foreground | App resumes correctly from background |
| Accessibility | VoiceOver navigation works for all key flows |
| All device sizes | UI adapts to smallest and largest supported devices |
| Dark mode | UI renders correctly in both light and dark appearance |
| All supported languages | No truncation or layout issues in localized versions |
| Permission denial | App handles denied permissions without crashing |
| IAP restore | Restore Purchases works on fresh device |
| Account deletion | Full account deletion flow works end to end |

---

## Resources

**WWDC**: 2022-10166, 2025-224, 2025-241, 2025-252, 2025-328

**Docs**: /app-store/review/guidelines, /app-store/submitting, /app-store/app-privacy-details, /help/app-store-connect

**Skills**: app-store-submission, app-store-diag, privacy-ux, storekit-ref, accessibility-diag
