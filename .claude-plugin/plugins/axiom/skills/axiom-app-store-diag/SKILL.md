---
name: axiom-app-store-diag
description: Use when app is rejected by App Review, submission blocked, or appeal needed - systematic diagnosis from rejection message to fix with guideline-specific remediation patterns and appeal writing
license: MIT
metadata:
  version: "1.0.0"
---

# App Store Rejection Diagnostics

## Overview

Systematic App Store rejection diagnosis and remediation. 9 diagnostic patterns covering the most common rejection categories including technical, metadata, privacy, business, subjective, and safety violations.

**Core principle** Most App Store rejections fall into well-known categories. Reading the rejection message carefully and mapping to the correct guideline prevents the #1 mistake: fixing the wrong thing and getting rejected again for the same reason.

Most developers waste 1-2 weeks on rejection cycles because they skim the rejection message, assume the cause, and "fix" something that wasn't the problem. This skill provides systematic diagnosis from rejection message to targeted fix.

## Red Flags — Suspect Submission Issue

If you see ANY of these, suspect a submission issue and use this skill:

- Rejection message cites a specific guideline number
- "Binary Rejected" without clear guideline (technical gate failure)
- Same app rejected multiple times for different reasons
- "Metadata Rejected" (no code change needed)
- Rejection mentions "privacy" or "data collection"
- Rejection mentions "login" or "authentication"
- Reviewer asks for demo account or more information

- ❌ **FORBIDDEN** "The reviewer is wrong, let's just resubmit"
  - Re-read the rejection. App Review is right 95% of the time.
  - Resubmitting without changes wastes 3-7 days per cycle.
  - If you genuinely disagree, use the appeal process (Pattern 7).

## Mandatory First Steps

**ALWAYS do these BEFORE changing any code:**

1. **Read the FULL rejection message** — Don't skim. Copy the exact text. Note every guideline number cited.
2. **Identify rejection type**:
   - "App Rejected" → Guideline violation, code/content fix needed
   - "Metadata Rejected" → ASC metadata issue, no build needed
   - "Binary Rejected" → Technical gate (SDK, manifest, encryption)
   - "Removed from Sale" → Post-approval enforcement
3. **Check the specific guideline** — Look up the exact number in app-store-ref
4. **Screenshot the rejection** — Save for team communication and appeal reference
5. **Check App Review messages in ASC** — Sometimes they ask for information, not reject

#### What this tells you

| Rejection Type | What Changed | Next Step |
|---|---|---|
| "App Rejected" + Guideline 2.1 | App crashed or had placeholders | Pattern 1 |
| "Metadata Rejected" | Screenshots or description wrong | Pattern 2 |
| "App Rejected" + Guideline 5.1 | Privacy policy or manifest gaps | Pattern 3 |
| "App Rejected" + Guideline 4.8 | Missing Sign in with Apple | Pattern 4 |
| "App Rejected" + Guideline 3.x | Business/monetization violation | Pattern 5 |
| "Binary Rejected" / no guideline | SDK, signing, or encryption issue | Pattern 6 |
| Reviewer seems incorrect | Genuine misunderstanding | Pattern 7 |
| Guideline 1.x cited | Safety/content issue | Pattern 9 |
| Guideline 4.1-4.3 cited | Design/originality issue | Pattern 8 |

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If "App Rejected" with guideline number → Map to specific pattern (1-5)
2. If "Metadata Rejected" → Fix in ASC, no build required (Pattern 2)
3. If "Binary Rejected" → Technical gate failure (Pattern 6)
4. If multiple guidelines cited → Fix ALL cited issues, not just the first one. Both binary AND metadata can be rejected simultaneously — binary issues need a new build, metadata issues can be fixed in ASC. Fix both before resubmitting.
5. If reviewer asks for information → Reply in ASC before making code changes

#### If rejection reason is unclear or contradictory
- STOP. Do NOT start fixing code yet
- Reply to App Review in ASC asking for clarification
- Include screenshots or video showing the feature working
- Wait for response before making changes

## Decision Tree

```
App Store rejection?
│
├─ What does the rejection say?
│  │
│  ├─ Cites Guideline 2.1?
│  │  ├─ App crashed during review? → Pattern 1 (check crash logs)
│  │  ├─ Placeholder content found? → Pattern 1 (search project)
│  │  ├─ Broken links? → Pattern 1 (verify URLs)
│  │  └─ Missing demo credentials? → Pattern 1 (provide in review notes)
│  │
│  ├─ Cites Guideline 2.3?
│  │  ├─ Screenshots don't match app? → Pattern 2 (retake screenshots)
│  │  ├─ Description promises missing features? → Pattern 2 (update text)
│  │  └─ Keywords contain trademarks? → Pattern 2 (remove keywords)
│  │
│  ├─ Cites Guideline 5.1?
│  │  ├─ Privacy policy missing/inaccessible? → Pattern 3 (add/fix policy)
│  │  ├─ Purpose strings missing? → Pattern 3 (add to Info.plist)
│  │  ├─ Privacy manifest incomplete? → Pattern 3 (update PrivacyInfo)
│  │  └─ Tracking without ATT? → Pattern 3 (implement ATT)
│  │
│  ├─ Cites Guideline 4.8?
│  │  ├─ Third-party login without SIWA? → Pattern 4 (add SIWA)
│  │  ├─ SIWA button hidden or broken? → Pattern 4 (fix prominence)
│  │  └─ Exception applies? → Pattern 4 (verify exemption)
│  │
│  ├─ Cites Guideline 3.x?
│  │  ├─ Digital content without IAP? → Pattern 5 (implement StoreKit)
│  │  ├─ Subscription issues? → Pattern 5 (fix terms/value)
│  │  └─ Loot box odds not disclosed? → Pattern 5 (add disclosure)
│  │
│  ├─ "Binary Rejected" / no guideline?
│  │  ├─ Wrong SDK version? → Pattern 6 (update Xcode)
│  │  ├─ Privacy manifest missing? → Pattern 6 (add PrivacyInfo)
│  │  ├─ Encryption not declared? → Pattern 6 (add ITSAppUsesNonExemptEncryption)
│  │  └─ Invalid signing? → Pattern 6 (regenerate provisioning)
│  │
│  ├─ "I believe the reviewer is wrong"?
│  │  └─ → Pattern 7 (Appeal Process)
│  │
│  ├─ Cites Guideline 1.x?
│  │  └─ Safety/content issue → Pattern 9
│  │
│  └─ Cites Guideline 4.1-4.3?
│     └─ Design/originality issue → Pattern 8
```

## Pattern Selection Rules (MANDATORY)

Before proceeding to a pattern:

1. **Copy the exact rejection text** — Word for word, including guideline numbers
2. **Match guideline number to pattern** — Don't guess, map directly
3. **If multiple guidelines cited** — Fix ALL of them before resubmitting
4. **If no guideline number** — Likely Binary Rejected, start with Pattern 6
5. **If unsure** — Reply to reviewer for clarification first

#### Apply ONE pattern at a time
- Identify the correct pattern from the rejection message
- Implement the complete fix for that pattern
- If multiple guidelines cited, fix each one before resubmitting
- DO NOT resubmit after fixing only one of multiple cited issues

#### FORBIDDEN
- Resubmitting without changes hoping for a different reviewer
- Skimming the rejection and guessing the fix
- Fixing only the first cited guideline when multiple are cited
- Arguing emotionally in App Review messages
- Disabling privacy features to avoid Guideline 5.1

## Diagnostic Patterns

### Pattern 1: Guideline 2.1 — App Completeness

**Time cost** 3-7 days per rejection cycle

#### Symptom
- Rejection citing "App Completeness"
- Crashes during review
- Placeholder content found
- Broken links (support URL, privacy policy, in-app links)
- Missing demo credentials for login-required apps

#### Common causes
1. App crashes on reviewer's device (different OS version, different device class)
2. Placeholder text or images visible in any screen
3. Broken links (support URL, privacy policy, in-app links)
4. Missing demo credentials for login-required apps
5. Backend service was down during review window

#### Diagnosis
```bash
# 1. Check crash logs in App Store Connect
# Xcode Organizer > Crashes > Filter by version

# 2. Search for placeholder strings
grep -r "Lorem\|TODO\|FIXME\|placeholder\|sample\|test data" \
  --include="*.swift" --include="*.storyboard" --include="*.xib" .

# 3. Verify all URLs resolve
curl -sI "https://your-support-url.com" | head -1
curl -sI "https://your-privacy-policy-url.com" | head -1

# 4. Test on latest shipping iOS
# Check ASC for specific iOS version reviewer used (noted in rejection)
```

#### Fix
```swift
// ❌ WRONG — Demo credentials that expire
// Review Notes: "Login: test@test.com / password123"
// (If this account expires or gets locked, instant rejection)

// ✅ CORRECT — Permanent demo credentials
// Review Notes:
// "Demo Account: demo@yourapp.com / ReviewDemo2024!
//  This account has pre-populated sample data.
//  Account will not expire during review period."
```

```swift
// ❌ WRONG — Placeholder still in code
Text("Lorem ipsum dolor sit amet")

// ✅ CORRECT — Real content in every screen
Text("Welcome to YourApp. Get started by creating your first project.")
```

#### Verification
- Submit to TestFlight first, test every screen on multiple devices
- Verify ALL URLs load successfully (including privacy policy from within the app)
- Ensure demo credentials work and won't expire
- Test on the specific iOS version mentioned in rejection (check rejection message or ASC Activity → Build → review device info)
- Monitor backend uptime during review window (don't deploy during review)
- Check ASC crash logs (Xcode Organizer → Crashes) for the specific device and OS version the reviewer used

---

### Pattern 2: Guideline 2.3 — Metadata Issues

**Time cost** 1-3 days (metadata fix, no build needed)

#### Symptom
- "Metadata Rejected" — no code change required
- Screenshots don't match current app UI
- Description promises features not in the app
- Keywords contain trademarked or competitor names

#### Common causes
1. Screenshots show old UI or features that no longer exist
2. Description promises features not yet implemented
3. Keywords contain trademarked terms or competitor names
4. App name implies functionality that doesn't exist
5. Category selection doesn't match app's primary function

#### Diagnosis

Compare every screenshot to current app UI. Read description word by word — does each claim exist in the app? Check keywords against Apple's trademark list.

```
Checklist:
☐ Every screenshot matches current build
☐ Every feature mentioned in description exists and works
☐ No trademarked terms in keywords (e.g., "Instagram", "Uber")
☐ App icon appropriate for all audiences
☐ Age rating matches actual content
☐ Category selection accurate
☐ "What's New" text matches actual changes
```

#### Fix

Update metadata directly in App Store Connect. No new build needed for metadata-only rejections.

```
✅ Take fresh screenshots FROM THE SUBMITTED BUILD (not dev build)
✅ Remove any features from description that aren't fully functional
✅ Replace trademarked keywords with generic equivalents
   ("photo sharing" not "Instagram-like")
✅ Ensure "What's New" describes changes in this specific version
```

#### Verification
- Take screenshots on the exact build version submitted
- Have someone outside the team read the description and verify each claim
- Search keywords for any trademarked terms

---

### Pattern 3: Guideline 5.1 — Privacy Violations

**Time cost** 3-10 days (code + manifest + policy changes)

#### Symptom
- Rejection citing privacy policy, data collection, purpose strings, or tracking
- Privacy manifest missing required reason API declarations
- Third-party SDK collects data not disclosed

#### Common causes
1. Privacy policy missing or not accessible from within the app
2. Privacy policy doesn't match actual data collection
3. Missing purpose strings for permission requests
4. Privacy manifest (PrivacyInfo.xcprivacy) missing required reason API declarations
5. Third-party SDK collects data not disclosed in privacy nutrition labels
6. App tracks users without ATT (App Tracking Transparency) consent

#### Diagnosis
```swift
// 1. Check: Is privacy policy URL in ASC AND accessible from within the app?
// Both are required. In-app access is commonly missed.

// 2. Check purpose strings
// ❌ WRONG — Generic purpose string
"NSCameraUsageDescription" = "Camera access needed"

// ✅ CORRECT — Specific purpose string explaining why
"NSCameraUsageDescription" = "Take photos for your profile picture and upload to your account"

// 3. Generate privacy report
// Xcode: Product → Archive → Generate Privacy Report
// This shows aggregate data from all frameworks and your code

// 4. Check privacy manifest
// Verify PrivacyInfo.xcprivacy exists in your app target
// AND in every framework target that uses required reason APIs
```

#### Fix

##### Purpose strings (Info.plist)
```xml
<!-- Every permission MUST have a specific, honest purpose string -->
<key>NSCameraUsageDescription</key>
<string>Take photos for your profile picture and upload to your account</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Show nearby restaurants on the map and calculate delivery distance</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Select photos from your library to attach to messages</string>
```

##### Privacy manifest (PrivacyInfo.xcprivacy)
```xml
<!-- Required if you use any "required reason" APIs -->
<!-- UserDefaults, file timestamp, disk space, system boot time, etc. -->
<dict>
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
```

##### Privacy policy requirements
```
Your privacy policy MUST specifically list:
☐ What data is collected (every type)
☐ How data is collected (automatically, user-provided)
☐ All uses of collected data
☐ Third-party sharing (who, why)
☐ Data retention period
☐ How users can request deletion
☐ Contact information for privacy inquiries
```

##### App Tracking Transparency
```swift
// Required if app tracks users across other companies' apps/websites
import AppTrackingTransparency

func requestTrackingPermission() {
    ATTrackingManager.requestTrackingAuthorization { status in
        switch status {
        case .authorized:
            // Enable tracking (analytics, ad attribution)
            break
        case .denied, .restricted, .notDetermined:
            // Disable ALL tracking
            // Remove IDFA access, disable third-party analytics that track
            break
        @unknown default:
            break
        }
    }
}
```

#### Verification
- Generate Privacy Report (Product > Archive > Generate Privacy Report) and verify all APIs declared
- Test privacy policy link from within the app (not just browser)
- Verify every permission request has a specific, honest purpose string
- Audit all third-party SDKs for undisclosed data collection
- Test ATT flow: deny tracking, verify app works correctly without it

---

### Pattern 4: Guideline 4.8 — Missing Sign in with Apple

**Time cost** 3-7 days (implementation + resubmit)

#### Symptom
- Rejection citing Guideline 4.8
- App has third-party login but no Sign in with Apple (SIWA)

#### Common causes
1. App has Google/Facebook/Twitter login but no SIWA
2. SIWA button exists but doesn't work
3. SIWA not offered at equal prominence (hidden or secondary)
4. SIWA flow doesn't handle credential revocation

#### Diagnosis

The rule is simple: If your app uses ANY third-party or social login service, you MUST offer Sign in with Apple as an equivalent option.

**Exceptions** (SIWA not required):
- App exclusively uses your company's own accounts
- App is for education (managed Apple IDs)
- App requires government or institution ID
- App is a client for a third-party service (e.g., email client)

#### Fix
```swift
import AuthenticationServices

// ✅ CORRECT — SIWA at same prominence as other login options
struct LoginView: View {
    var body: some View {
        VStack(spacing: 16) {
            // Sign in with Apple — MUST be at same visual level
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                switch result {
                case .success(let authorization):
                    handleAuthorization(authorization)
                case .failure(let error):
                    handleError(error)
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)

            // Other login options at same size/prominence
            GoogleSignInButton()
                .frame(height: 50)
        }
    }

    func handleAuthorization(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential
            as? ASAuthorizationAppleIDCredential else { return }

        let userIdentifier = credential.user
        let fullName = credential.fullName
        let email = credential.email
        // Note: fullName and email only provided on FIRST sign-in
        // Store them immediately — they won't be provided again

        // Send to your backend for account creation/login
    }
}
```

```swift
// ✅ Handle credential revocation (required for account deletion support)
func checkCredentialState() {
    let provider = ASAuthorizationAppleIDProvider()
    provider.getCredentialState(forUserID: storedUserIdentifier) { state, error in
        switch state {
        case .authorized:
            break // User is still signed in
        case .revoked:
            // User revoked credentials — sign out immediately
            signOut()
        case .notFound:
            // Credential not found — show sign-in
            showLogin()
        @unknown default:
            break
        }
    }
}
```

#### Verification
- SIWA button is visually equal to other login buttons (same size, same screen)
- Full SIWA flow works: sign in, account creation, credential check
- Handle revocation: user can revoke in Settings > Apple ID > Sign-In & Security
- Test account deletion flow (required since June 2022)

---

### Pattern 5: Guideline 3.x — Business/Monetization

**Time cost** 3-14 days (may require architectural changes)

#### Symptom
- Rejection citing business guidelines
- IAP requirements not met
- Subscription doesn't provide ongoing value
- External payment for digital content

#### Common causes
1. Digital content unlocked without IAP (using external payment for in-app features)
2. Subscription doesn't provide ongoing value (one-time content sold as subscription)
3. Loot box or random item purchase odds not disclosed
4. Deceptive subscription flow (dark patterns, misleading free trial)
5. IAP metadata incomplete or not submitted for review

#### Diagnosis

The key question: Is any digital content or feature unlocked without Apple IAP?

```
Digital goods/features → MUST use Apple IAP
  Examples: premium features, virtual currency, ad removal, content
  packs, subscription access to digital content

Physical goods/services → MAY use external payment
  Examples: physical merchandise, ride-sharing, food delivery,
  person-to-person services

Certain categories → MAY use external payment (3.1.3 exceptions)
  Examples: "reader" apps (Kindle, Netflix, Spotify), one-to-one
  real-time services
```

#### Fix
```swift
// ❌ WRONG — Unlocking features via external payment
func unlockPremium(receiptFromServer: String) {
    // Bypass Apple IAP → rejection
    UserDefaults.standard.set(true, forKey: "isPremium")
}

// ✅ CORRECT — StoreKit 2 for all digital goods
import StoreKit

func purchasePremium() async throws {
    let product = try await Product.products(for: ["com.app.premium"]).first!
    let result = try await product.purchase()

    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        // Unlock feature
        await transaction.finish()
    case .pending:
        // Payment pending (Ask to Buy, etc.)
        break
    case .userCancelled:
        break
    @unknown default:
        break
    }
}
```

```swift
// ✅ Loot box disclosure (required if random items for purchase)
struct LootBoxView: View {
    var body: some View {
        VStack {
            Text("Mystery Box — $4.99")
            Text("Contents are random. Odds:")
                .font(.caption)

            // MUST disclose odds before purchase
            VStack(alignment: .leading) {
                Text("Common item: 60%")
                Text("Rare item: 30%")
                Text("Legendary item: 10%")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
    }
}
```

#### Verification
- ALL digital content/features use Apple IAP (StoreKit 2)
- IAP products submitted and approved in ASC before app submission
- Subscription terms clearly communicated before purchase screen
- Free trial duration and auto-renewal price clearly visible
- Loot box odds disclosed before any purchase
- No external payment links for digital goods (unless "reader" app exception applies)

---

### Pattern 6: Binary Rejected — Technical Gates

**Time cost** 1-3 days (build configuration fix)

#### Symptom
- "Binary Rejected" with no specific guideline
- Automated rejection during processing
- Build stuck in "Processing" state

#### Common causes
1. Built with outdated SDK version (must meet Apple's minimum)
2. Privacy manifest (PrivacyInfo.xcprivacy) missing or invalid
3. Encryption compliance not declared (ITSAppUsesNonExemptEncryption)
4. Invalid signing or provisioning profile
5. Missing required device capabilities in Info.plist
6. App uses private or deprecated APIs
7. App binary too large without on-demand resources

#### Diagnosis
```bash
# 1. Check Xcode and SDK version
xcodebuild -version
# Must be current or previous major Xcode version

# 2. Check processing logs in ASC
# App Store Connect → My Apps → [App] → Activity → Build → Processing Log

# 3. Verify encryption declaration
grep -c "ITSAppUsesNonExemptEncryption" Info.plist
# Must exist and be set to YES or NO

# 4. Check provisioning
security cms -D -i embedded.mobileprovision 2>/dev/null | head -20
# Verify not expired

# 5. Check for private API usage
# Xcode: Product → Archive → Distribute App → Validate App
# This catches most private API issues before submission
```

#### Fix
```xml
<!-- Encryption compliance (Info.plist) -->
<!-- If app uses ONLY standard HTTPS (URLSession, etc.) -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<!-- If app uses custom encryption beyond HTTPS -->
<key>ITSAppUsesNonExemptEncryption</key>
<true/>
<!-- Then upload export compliance documentation in ASC:
     App Store Connect → My Apps → [App] → App Information →
     Export Compliance Information → Upload documentation
     You may also need to file an annual self-classification
     report with the US Bureau of Industry and Security (BIS) -->
```

**Encryption decision flow**:
1. Does your app use ONLY standard OS-provided HTTPS (URLSession, Alamofire)? → Set `false`, done
2. Does your app call OpenSSL, libsodium, or custom crypto directly? → Set `true`, upload BIS docs
3. Does your app implement proprietary encryption protocols? → Set `true`, upload BIS docs
4. Unsure? → Run `strings YourApp | grep -i "openssl\|libcrypto\|CCCrypt"` to check

```bash
# Validate before submitting
# Xcode: Product → Archive → Distribute App → Validate App
# Catches ~80% of binary rejection causes

# Clean build if signing issues
rm -rf ~/Library/Developer/Xcode/DerivedData
# Re-download provisioning profiles in Xcode Preferences → Accounts
```

#### Verification
- Run "Validate App" in Xcode Organizer before submitting
- Verify Xcode version meets Apple's current requirements
- Check PrivacyInfo.xcprivacy exists and is included in the app bundle
- Verify ITSAppUsesNonExemptEncryption key is present
- Ensure provisioning profile is not expired
- Test app on physical device with release configuration

---

### Pattern 7: Appeal Process

**Time to resolve** 3-14 days

#### When to use
- You genuinely believe the reviewer misunderstood your app
- You believe the wrong guideline was applied
- Your app complies and you have evidence

#### When NOT to use
- You disagree with Apple's rules (they won't change for your app)
- You're hoping a different reviewer will approve without changes
- You want to skip implementing a required feature (like SIWA)

#### Step 1: Reply in App Store Connect first

Most issues resolve without a formal appeal. Reply to App Review messages in ASC with:
- Specific evidence of compliance
- Screenshots or video demonstrating the feature
- Clear reference to the guideline you believe you comply with

#### Step 2: If unresolved, submit formal appeal

URL: developer.apple.com/contact/app-store/?topic=appeal

#### Appeal writing

```
✅ GOOD appeal structure:

"Our app complies with Guideline [X.Y] because [specific evidence].

The reviewer noted: '[quote exact rejection text]'

However, our app [specific counter-evidence with details]:
1. [Feature X] works as shown in [attached screenshot/video]
2. [Policy Y] is accessible at [URL] and within the app at [screen]
3. [Requirement Z] is implemented as described in [technical detail]

Attached: [screenshots, screen recording, or documentation]

We respectfully request re-review of this decision."
```

```
❌ BAD appeal examples:

"This is unfair. Other apps do the same thing. Please approve."
→ Apple reviews each app independently

"We've been rejected 3 times and are losing money."
→ Financial pressure is not relevant to guideline compliance

"The reviewer didn't understand our app."
→ Vague. Show specifically what they missed.

"We need this approved by Friday for our launch."
→ Deadlines are not App Review's concern
```

#### Step 3: Escalate if needed

If appeal is denied:
1. Request a phone call with App Review (available through appeal process)
2. Contact Apple Developer Relations as last resort
3. Consider whether the app genuinely needs architectural changes

#### Verification
- Wait for response before making code changes (if appealing)
- Include ONE appeal per rejection (multiple appeals slow the process)
- Respond to any information requests before filing appeal

---

### Pattern 8: Guideline 4.2/4.3 — Minimum Functionality / Spam

> Patterns 8-9 address subjective rejections where the fix is demonstrating value or compliance, not changing code.

**Time to resolve** 1-4 weeks (requires app changes, not just metadata)

#### Rejection messages you'll see

- **4.2**: "Your app does not include sufficient content and features to be appropriate for the App Store"
- **4.3**: "Your app duplicates the content and functionality of other apps submitted by you or another developer"

#### What it really means

- **4.2** (#3 most common rejection): "Your app doesn't do enough to justify existing as a native app" — not enough value beyond what a website provides.
- **4.3** (#2 most common rejection): "Your app looks too similar to another app, or is template-generated." Apple actively fights template-mill spam.

#### Detection — is this really a 4.2/4.3?

Before assuming the rejection is valid, check for misclassification:

```bash
# Is the app a WKWebView wrapper?
grep -rn "WKWebView\|SFSafariViewController\|UIWebView" --include="*.swift" .

# Does the app use native features at all?
grep -rn "import CoreLocation\|import AVFoundation\|import UserNotifications\|import HealthKit\|import CoreML" --include="*.swift" .

# Is the codebase template-generated? (common template markers)
grep -rn "powered by\|generated by\|template\|starter kit" --include="*.swift" --include="*.plist" .
```

If `WKWebView` is the primary UI and native feature imports are absent, the rejection is likely valid.

#### Response decision tree

```
Is the rejection valid? (be honest)
│
├─ YES, app is thin / web wrapper
│  ├─ Can you add meaningful native features? → Add them (see Evidence Checklist)
│  └─ Core value IS the web content? → Consider reader app model or PWA instead
│
├─ PARTIALLY, app has value but reviewer missed it
│  ├─ Did you provide demo credentials? → If not, resubmit with access
│  ├─ Is the value hidden behind onboarding? → Add review notes explaining path to value
│  └─ Does the app need content/data to show value? → Pre-populate sample data for review
│
└─ NO, app is clearly feature-rich
   └─ Appeal with detailed functionality walkthrough (Pattern 7)
      Include: feature list, screenshots of each major screen, video demo
```

#### Evidence checklist — what satisfies reviewers

**For 4.2 (Minimum Functionality)** — demonstrate native value:

```
Features that prove native value:
☐ Offline functionality (data available without network)
☐ Push notifications with meaningful triggers
☐ Device API usage (camera, location, sensors, HealthKit)
☐ Custom UI beyond web content (native controls, animations, gestures)
☐ Local data persistence and sync
☐ Widget, Live Activity, or Watch companion
☐ Accessibility features (VoiceOver, Dynamic Type)
☐ System integration (Shortcuts, Share Extension, Spotlight)

Changes that DON'T help:
✗ Adding a splash screen or settings-only screen to a web wrapper
✗ Cosmetic changes (colors/fonts) without functional native features
```

**For 4.3 (Spam / Duplicate)** — demonstrate uniqueness:

```
How to differentiate:
☐ Unique UI that doesn't match other apps in your catalog
☐ Different target audience with distinct feature set
☐ Separate branding (icon, name, color scheme)
☐ Features that justify a separate app vs. being a mode in an existing app
☐ Distinct App Store description and screenshots
☐ Different primary use case (not just themed variants)

If you have multiple similar apps:
☐ Consolidate into one app with multiple modes/themes
☐ Remove duplicates before resubmitting
☐ Explain in review notes why apps need to be separate
```

#### Communication template

```
Resolution Center response (adapt for 4.2 or 4.3):

"Thank you for your feedback. [Choose one]:

For 4.2: We have added native features that provide value beyond our
web presence: [list features with device capabilities used].

For 4.3: Our app is distinct from [similar app] — different target
audience ([X] vs [Y]), unique features ([list]), separate branding.

[Attach: screenshots of each major screen, 30-60s video walkthrough]
Demo credentials: [username] / [password]"
```

#### Verification

- Test the app yourself: would YOU download this instead of using the website?
- Compare against your other apps: can you clearly articulate why they're separate?
- Pre-populate demo data so the reviewer sees value immediately
- Record a 30-60 second walkthrough video showing native features in action

---

### Pattern 9: Guideline 1.x — Safety: Content / UGC / Kids

**Time to resolve** 1-3 weeks (requires moderation infrastructure or content changes)

#### Rejection messages and what they mean

- **1.1**: "Your app includes content that many users would find objectionable" — Apple reviews content strictly, including content accessible through your app.
- **1.2**: "Your app enables the display of user-generated content but does not include sufficient mechanisms to report offensive content" — UGC without adequate moderation. Non-negotiable: if users can post anything, you need a complete moderation system.
- **1.3**: "Your Kids category app must comply with COPPA" / "includes third-party analytics not appropriate for Kids" — Kids category has the tightest rules. Any gap is a rejection.

#### Detection — which sub-guideline?

```
Does the app have UGC?
├─ YES → Likely 1.2 (moderation required)
│  ├─ Comments, posts, or forums? → Need reporting + moderation
│  ├─ Photo/video uploads visible to others? → Need content review
│  ├─ User profiles visible to others? → Need profile reporting
│  └─ Chat or messaging? → Need blocking + reporting + content filtering
│
├─ Is it in the Kids category?
│  └─ YES → Likely 1.3 (strict requirements)
│     ├─ Any third-party SDKs? → Must be certified for kids
│     ├─ Any external links? → Must be gated or removed
│     └─ Any purchases? → Must have parental gate
│
└─ Does it display third-party or app-provided content?
   └─ YES → Likely 1.1 (content standards)
      ├─ Web content via WKWebView? → Must filter or restrict
      ├─ AI-generated content? → Must moderate outputs
      └─ Content from third-party APIs? → Must filter before display
```

#### Response decision tree

**UGC rejection (1.2)**:
```
What moderation exists?
│
├─ No moderation at all
│  └─ Implement complete moderation system (see Implementation Checklist)
│
├─ Reporting exists but insufficient
│  ├─ Missing blocking? → Add user blocking (immediate effect)
│  ├─ No response workflow? → Add 24-hour review commitment
│  └─ No pre-publish review? → Add content queue or ML filtering
│
└─ Moderation exists but not visible to reviewer
   └─ Add review notes explaining moderation flow + demo how to trigger it
```

**Kids category rejection (1.3)**:
```
What triggered the rejection?
│
├─ Third-party SDKs
│  └─ Remove ALL analytics/ads SDKs not certified for Kids category
│     Common offenders: Firebase Analytics, Facebook SDK, AdMob
│     Allowed: Apple's own frameworks, COPPA-certified SDKs only
│
├─ External links
│  └─ Remove all links OR gate behind parental verification
│     Includes: "Visit our website", social media links, "More apps"
│
├─ In-app purchases
│  └─ Add parental gate before ANY purchase flow
│     Gate must require adult knowledge (e.g., "spell this word", math problem)
│     Simple "Are you 18?" button is NOT sufficient
│
└─ Data collection
   └─ Remove ALL data collection not essential to app function
      No device IDs, no location, no contact info, no tracking
```

#### Implementation checklist — minimum viable moderation (1.2)

```
Required for ANY app with UGC:
☐ Report button on every piece of user content (visible, not buried)
☐ Block user functionality (immediate, no delay)
☐ Visible Terms of Use / Community Guidelines (accessible from within app)
☐ Content review workflow (human review queue or ML pre-screening)
☐ 24-hour response commitment for reported content
☐ Ability to remove content and ban users
☐ In-app link to Terms of Use from content creation screens
```

#### Kids category requirements (1.3)

```
MANDATORY for Kids category:
☐ COPPA compliance (no data collection from children under 13)
☐ No third-party advertising (none, not even "child-safe" networks)
☐ No external links (or gated behind parental verification)
☐ No social features (no chat, no profiles, no friend lists)
☐ Parental gate before any purchase (not a simple age button)
☐ Remove ALL non-COPPA-certified SDKs (Firebase Analytics, Facebook, AdMob, Crashlytics)
☐ No user tracking of any kind
☐ Privacy policy specifically addresses children's data
```

#### Communication template

```
Resolution Center response (adapt for 1.2 or 1.3):

"Thank you for your feedback. [Choose one]:

For 1.2 (UGC): We have implemented moderation: report button on all
content [location], user blocking, [review workflow], Terms of Use at
[URL]. To test: create a post → [...] menu → Report.

For 1.3 (Kids): Removed [SDKs]. External links [removed/gated].
Added parental gate for purchases. No user data collected.
Privacy policy updated at [URL].

[Attach: screenshots showing moderation/parental gate flow]"
```

#### Verification

- Test the report flow end-to-end: report content, verify it reaches a review queue
- Test the block flow: block a user, verify their content is hidden immediately
- For Kids: remove the app from a test device, reinstall, verify no data persists
- For Kids: run `strings YourApp.app/YourApp | grep -i "firebase\|facebook\|google\|admob"` to catch embedded SDKs
- Have someone unfamiliar with the app try to find the report/block buttons — if they can't find them in 5 seconds, they're not prominent enough

---

## Quick Reference Table

| Rejection Type | Likely Cause | First Check | Pattern | Typical Fix Time |
|---|---|---|---|---|
| Guideline 2.1 | Crashes/placeholders | Test on device, search placeholders | 1 | 1-3 days |
| Guideline 2.3 | Metadata mismatch | Compare screenshots to app | 2 | 1 day (no build) |
| Guideline 5.1 | Privacy gaps | Check policy + manifest + purpose strings | 3 | 2-5 days |
| Guideline 4.8 | Missing SIWA | Check for third-party login | 4 | 3-5 days |
| Guideline 3.x | Payment method | Review IAP flows | 5 | 3-14 days |
| Binary Rejected | Technical gate | Check SDK, manifest, encryption | 6 | 1-2 days |
| Guideline 1.x | Safety/content/UGC | Check UGC moderation + Kids compliance | 9 | 1-3 weeks |
| Guideline 4.2/4.3 | Thin app/spam | Audit native features + app uniqueness | 8 | 1-4 weeks |

## Production Crisis Scenario

### Context: App rejected for 3rd time, different reason each time, launch is tomorrow

**Situation**: Marketing committed to a launch date. App was rejected for crashes (fixed), then metadata (fixed), now privacy policy "doesn't match actual data collection."

**Pressure signals**:
- Product team already sent press releases with launch date
- App Store rating will drop if launch delayed
- Manager asking "why wasn't this caught earlier?"
- Temptation to quick-fix only the cited privacy issue

**Why this happens**: Each review pass goes deeper. First pass catches obvious issues (crashes). Second pass checks metadata. Third pass audits privacy compliance. This is normal, not "the reviewer is picking on you."

#### Rationalization traps (DO NOT fall into these)

1. *"Just fix the privacy policy wording and resubmit"*
   - The reviewer said "doesn't match actual data collection"
   - That means your app collects data you didn't disclose
   - A wording change without auditing actual data collection = another rejection

2. *"The reviewer is being unreasonable, let's appeal"*
   - Three rejections for three different valid issues is not unreasonable
   - Appealing wastes 3-14 days when you could fix and resubmit in 1-3 days

3. *"Let's remove the privacy-sensitive features to ship faster"*
   - Removing features changes the app, requiring re-review of everything
   - May introduce new issues (broken UI, missing functionality)

4. *"Different reviewer next time might not notice"*
   - Reviewers see the rejection history — they check previously cited issues
   - Repeat rejections get escalated to senior reviewers

#### MANDATORY approach

1. Don't panic. Don't resubmit without a thorough fix.
2. Run the COMPLETE pre-flight checklist — not just the cited issue.
3. Audit all data collection: every SDK, every analytics call, every API request that sends user data.
4. Generate privacy report (Product > Archive > Generate Privacy Report) and cross-reference with privacy policy.
5. Fix privacy policy to specifically list every data type actually collected.
6. Verify all previous rejection issues still fixed (crashes, metadata).
7. Request expedited review at developer.apple.com/contact/app-store/?topic=expedite if genuinely time-critical.
8. Communicate to stakeholders: "Each review fixes more issues. This submission addresses privacy compliance comprehensively."

#### Time comparison

| Approach | Time to Approval |
|---|---|
| Quick fix + resubmit | 7-14 more days (likely rejected again) |
| Full audit + thorough fix | 3-5 days (high confidence) |
| Full audit + expedited review | 1-3 days (if granted) |

#### Professional communication template

```
To stakeholders:

"Root cause: Our third-party analytics SDK collects device identifiers
that weren't disclosed in our privacy policy or nutrition labels.

Fix: Updated privacy policy, privacy nutrition labels in ASC, and
PrivacyInfo.xcprivacy to accurately reflect all data collection.
Also audited all SDKs for undisclosed collection.

Timeline: Resubmitting today with expedited review request.
Expected approval: 1-3 business days.

Prevention: Adding privacy audit to our pre-submission checklist
so future submissions include accurate disclosure from the start."
```

---

## Common Mistakes

### 1. Skimming the Rejection Message

**Problem** Developer reads "Guideline 5.1" and assumes they know the issue without reading the full explanation.

**Why it fails** Guideline 5.1 covers privacy policy, purpose strings, privacy manifest, tracking, AND data collection disclosure. The rejection message tells you exactly which aspect failed. Guessing the wrong one wastes a full review cycle (3-7 days).

**Fix**: Copy the FULL rejection text. Highlight every specific requirement mentioned. Map each one to the fix before writing any code.

### 2. Fixing Only the Cited Issue

**Problem** Rejection cites Guideline 5.1 (privacy). Developer fixes privacy but doesn't check for other issues.

**Why it fails** Reviewers find new issues on each pass. First pass catches crashes, second catches metadata, third catches privacy. If you only fix privacy, the fourth pass might find a Guideline 4.8 (SIWA) issue.

**Fix**: Before every resubmission, run through ALL common rejection patterns (1-6). Fix everything proactively. One thorough submission beats three partial ones.

### 3. Resubmitting Without Changes

**Problem** "Maybe a different reviewer will approve it."

**Why it fails** Reviewers see the rejection history. Unchanged resubmissions get the same result or escalated to senior reviewers. Each wasted cycle costs 3-7 days.

**Fix**: Always make at least the changes the reviewer requested. If you believe the rejection is wrong, reply in ASC with evidence first.

### 4. Arguing Emotionally in App Review Messages

**Problem** "This is unfair! Other apps do this! You're blocking our business!"

**Why it fails** App Review is a technical compliance review, not a negotiation. Emotional arguments are ignored. Specific evidence of compliance works.

**Fix**: Be factual, specific, and professional. Quote the guideline. Show screenshots. Provide technical evidence.

### 5. Ignoring Third-Party SDK Issues

**Problem** "We don't collect that data — it must be the SDK."

**Why it fails** Your app is responsible for ALL SDK behavior. If Facebook SDK collects device identifiers, YOUR privacy policy and nutrition labels must disclose it.

**Fix**: Audit every third-party SDK. Generate Privacy Report to see aggregate data collection. Update privacy policy and nutrition labels to cover all SDK behavior.

### 6. Deploying Backend Changes During Review

**Problem** Pushing a backend update that changes API responses while the app is under review.

**Why it fails** Reviewers may test at any time during the review window. A backend change that breaks the reviewed build = crash during review = Guideline 2.1 rejection.

**Fix**: Freeze backend during review period. If changes are necessary, ensure backward compatibility with the submitted build.

### 7. Not Using Expedited Review When Available

**Problem** Developer doesn't know about or doesn't use expedited review for critical situations.

**Why it fails** Waiting 3-7 days for standard review when a 1-day expedited review is available for legitimate reasons.

**Fix**: Request expedited review at developer.apple.com/contact/app-store/?topic=expedite for: critical bug fixes, time-sensitive events, or security patches. Don't abuse it — Apple tracks usage and may deny future requests.

---

## Pre-Submission Checklist

Run through this BEFORE every App Store submission to prevent rejections:

```
App Completeness (2.1):
☐ Tested on latest shipping iOS version on physical device
☐ Tested on at least 2 device sizes (iPhone SE, iPhone Pro Max)
☐ No placeholder text (search: Lorem, TODO, FIXME, placeholder, sample)
☐ All URLs resolve (support URL, privacy policy, in-app links)
☐ Demo credentials provided if login required (non-expiring)
☐ Backend stable and not deploying during review window

Metadata (2.3):
☐ Screenshots taken from submitted build (not dev build)
☐ Every feature in description exists and works
☐ No trademarked terms in keywords
☐ Age rating matches content
☐ "What's New" text accurate

Privacy (5.1):
☐ Privacy policy accessible in-app AND via URL in ASC
☐ Privacy policy matches actual data collection
☐ Every permission has specific, honest purpose string
☐ PrivacyInfo.xcprivacy exists and lists all required reason APIs
☐ Privacy Report generated and cross-referenced
☐ ATT implemented if any cross-app tracking
☐ Privacy nutrition labels accurate (including third-party SDKs)

Sign in with Apple (4.8):
☐ If third-party login exists, SIWA offered at same prominence
☐ SIWA flow works: sign in, account creation, revocation handling
☐ Account deletion supported (required since June 2022)

Business (3.x):
☐ All digital goods/features use Apple IAP
☐ IAP products approved in ASC before app submission
☐ Subscription terms clear before purchase
☐ Loot box odds disclosed if applicable

Technical (Binary):
☐ Xcode version meets Apple's current requirements
☐ "Validate App" passes in Xcode Organizer
☐ ITSAppUsesNonExemptEncryption key present
☐ Provisioning profile not expired
☐ Tested with release configuration on device

Safety & Content (1.x):
☐ If UGC: report, block, and moderation workflow all functional
☐ If Kids category: no non-COPPA SDKs, no external links, parental gate on purchases
☐ AI-generated or third-party content has moderation/filtering

Design & Originality (4.2/4.3):
☐ App provides native value beyond a website (offline, push, device APIs)
☐ App is distinct from other apps in your catalog
☐ Demo data pre-populated for reviewer if app needs content to show value
```

---

## Cross-References

- **app-store-connect-ref** — ASC crash analysis, TestFlight feedback, metrics dashboards
- **privacy-ux** — Privacy manifest implementation details and required reason APIs
- **storekit-ref** — StoreKit 2 IAP/subscription implementation
- **accessibility-diag** — Accessibility compliance (Guideline 2.5.1)
- **ios-build** — Build and signing issues that cause Binary Rejected

## Resources

**WWDC**: 2025-328

**Docs**: /app-store/review/guidelines, /distribute/app-review, /support/offering-account-deletion-in-your-app, /contact/app-store/?topic=appeal

**Skills**: app-store-connect-ref, privacy-ux, storekit-ref, accessibility-diag
