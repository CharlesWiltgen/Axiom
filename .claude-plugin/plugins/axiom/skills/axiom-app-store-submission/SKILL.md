---
name: axiom-app-store-submission
description: Use when preparing ANY app for App Store submission - enforces pre-flight checklist, rejection prevention, privacy compliance, and metadata completeness to prevent common App Store rejections
license: MIT
metadata:
  version: "1.0.0"
---

# App Store Submission

## Overview

Systematic pre-flight checklist that catches 90% of App Store rejection causes before submission. **Core principle**: Ship once, ship right. Over 40% of App Store rejections cite Guideline 2.1 (App Completeness) — crashes, placeholders, broken links. Another 30% are metadata and privacy issues. A disciplined pre-flight process eliminates these preventable rejections.

**Key insight**: Apple rejected nearly 1.93 million submissions in 2024. Most rejections are not policy disagreements — they are checklist failures. A 30-minute pre-flight saves 3-7 days of rejection-fix-resubmit cycles.

## When to Use This Skill

✅ **Use this skill when**:
- Preparing to submit an app or update to the App Store
- Submitting your first app as a new developer
- Responding to an App Review rejection
- Running a pre-submission audit before TestFlight or production
- Updating an existing app after a long gap (new requirements may apply)
- Wondering "is my app ready to submit?"

❌ **Do NOT use this skill for**:
- Code signing and provisioning profiles (use build-debugging)
- CI/CD pipeline setup
- Performance optimization (use ios-performance)
- UI testing automation (use ui-testing)
- In-app purchase implementation (use storekit-ref)
- Privacy manifest details (use privacy-ux for deep implementation)

## Example Prompts

Real questions developers ask that this skill answers:

#### 1. "Is my app ready to submit to the App Store?"
> The skill provides a complete pre-flight checklist covering build, privacy, metadata, accounts, review info, content, and regional requirements

#### 2. "What do I need before submitting my first iOS app?"
> The skill walks through every requirement from scratch — privacy manifest, metadata fields, screenshots, demo credentials, age rating

#### 3. "I keep getting rejected, what am I missing?"
> The skill provides anti-patterns with specific rejection causes and the decision tree to identify gaps

#### 4. "What's the pre-submission checklist for App Store?"
> The skill provides a categorized mandatory checklist with every item that triggers rejection if missing

#### 5. "Do I need a privacy manifest?"
> Yes. Since May 2024, missing privacy manifests cause automatic rejection. The skill explains when and how.

#### 6. "My app update was rejected for metadata issues"
> The skill covers metadata completeness requirements and the common gaps that trigger Guideline 2.3 rejections

---

## Anti-Patterns

### 1. Submitting without device testing

**Time cost**: 3-7 days (rejection + fix + resubmit wait)

**Symptom**: Rejection for Guideline 2.1 — App Completeness. Crashes, broken flows, or missing functionality discovered by App Review.

❌ **BAD**: Test only in Simulator, submit when build succeeds
```
"It works in Simulator, ship it"
→ Rejection: App crashes on launch on iPhone 15 Pro (memory limit)
→ 3-7 day delay
```

✅ **GOOD**: Test on physical device with latest shipping OS, exercise all user flows
```bash
# Build for device
xcodebuild -scheme YourApp \
  -destination 'platform=iOS,name=Your iPhone'

# Test critical paths:
# - Launch → main screen loads
# - All tabs/screens accessible
# - Core user flows complete without crash
# - Edge cases: no network, low storage, interruptions
```

**Why it works**: Simulator hides real-device constraints — memory limits, cellular networking behavior, hardware-specific APIs, thermal throttling. App Review tests on physical devices.

---

### 2. Missing or inadequate privacy policy

**Time cost**: 2-5 days (rejection + policy creation + resubmit)

**Symptom**: Rejection for Guideline 5.1.1(i) — Data Collection and Storage. Privacy policy missing, inaccessible, or inconsistent with actual data practices.

❌ **BAD**: No privacy policy URL, or a generic template that doesn't match actual data collection
```
Privacy Policy URL: (empty)
— or —
Privacy Policy: "We respect your privacy" (generic, no specifics)
```

✅ **GOOD**: Privacy policy accessible in two places, specific to your app's data practices
```
1. App Store Connect → App Information → Privacy Policy URL
2. In-app → Settings/About screen → Privacy Policy link
3. Policy content lists:
   - All collected data types
   - How each type is used
   - Third-party sharing (who and why)
   - Data retention period
   - How to request deletion
```

**Why it works**: Guideline 5.1.1(i) requires privacy policy accessible BOTH in ASC metadata AND within the app. The policy must specifically describe your app's data practices, not a generic template.

---

### 3. Placeholder content left in build

**Time cost**: 3-5 days (rejection + content replacement + resubmit)

**Symptom**: Rejection for Guideline 2.1 — App Completeness. Reviewers find placeholder text, empty screens, or TODO artifacts.

❌ **BAD**: Ship with development artifacts visible to users
```
- "Lorem ipsum" text in onboarding
- Empty tab that shows "Coming Soon"
- Button that opens alert "Not implemented yet"
- Default app icon (white grid)
```

✅ **GOOD**: Every screen has final content and production assets
```
Pre-submission content audit:
- [ ] Every screen has real content (no lorem ipsum)
- [ ] All images are final production assets
- [ ] No "Coming Soon" or "Under Construction" screens
- [ ] All buttons perform their intended action
- [ ] Default/empty states have proper messaging
- [ ] App icon is final and meets spec (1024x1024, no alpha)
```

**Why it works**: App Review tests every screen and tab, including states you might consider edge cases. They open every menu, tap every button, and switch every tab.

---

### 4. Ignoring privacy manifest

**Time cost**: 1-3 days (automatic rejection + manifest creation + resubmit)

**Symptom**: Automatic rejection before human review. Missing `PrivacyInfo.xcprivacy` or undeclared Required Reason APIs.

❌ **BAD**: No privacy manifest, or missing Required Reason API declarations
```
No PrivacyInfo.xcprivacy in project
— or —
Using UserDefaults, file timestamps, disk space APIs
without declaring approved reasons
```

✅ **GOOD**: Privacy manifest present with all Required Reason APIs declared
```
Project must contain:
├── PrivacyInfo.xcprivacy
│   ├── NSPrivacyTracking (true/false)
│   ├── NSPrivacyTrackingDomains (if tracking)
│   ├── NSPrivacyCollectedDataTypes (all types)
│   └── NSPrivacyAccessedAPITypes (all Required Reason APIs)
│
└── Third-party SDK manifests (each SDK includes its own)
```

Common Required Reason APIs that need declaration:
- `UserDefaults` → Reason `CA92.1`
- File timestamp APIs → Reason `C617.1`
- Disk space APIs → Reason `E174.1`
- System boot time → Reason `35F9.1`

**Why it works**: Since May 2024, this is an automated gate. No human reviewer involved — the build processing system rejects submissions missing required privacy declarations.

---

### 5. Missing Sign in with Apple

**Time cost**: 3-7 days (SIWA implementation + resubmit)

**Symptom**: Rejection for Guideline 4.8. App offers third-party login (Google, Facebook, email) but no Sign in with Apple option.

❌ **BAD**: Third-party login without SIWA
```swift
// Login screen offers:
// - Sign in with Google
// - Sign in with Facebook
// - Email/password
// ← Missing: Sign in with Apple
```

✅ **GOOD**: SIWA offered as equivalent option alongside any third-party login
```swift
// Login screen offers:
// - Sign in with Apple ← Required if others exist
// - Sign in with Google
// - Sign in with Facebook
// - Email/password
```

**Exceptions** (SIWA not required):
- Company-internal or employee-only apps
- Education apps using existing school accounts
- Government/tax/banking apps requiring government ID
- Apps that are a client for a specific third-party service
- Apps using only the company's own authentication system

**Why it works**: Guideline 4.8 requires SIWA as an option whenever ANY third-party or social login is offered. Apple enforces this strictly.

---

### 6. No account deletion flow

**Time cost**: 5-10 days (implementation + testing + resubmit)

**Symptom**: Rejection for Guideline 5.1.1(v). App allows account creation but provides no way to delete the account.

❌ **BAD**: Account creation without deletion capability
```
- Sign up button exists
- No "Delete Account" anywhere in app
- "Contact support to delete" (not sufficient)
- "Deactivate account" (not the same as delete)
```

✅ **GOOD**: Full account deletion flow accessible in-app
```
Account deletion requirements:
1. Discoverable in Settings/Profile (not hidden)
2. Clearly labeled "Delete Account" (not "Deactivate")
3. Explains what deletion means (data removed, timeline)
4. Confirms completion to user
5. If Sign in with Apple used → revoke SIWA token
6. If active subscriptions → inform user to cancel first
7. Deletion completes within reasonable timeframe (days, not months)
```

```swift
// Revoking Sign in with Apple token (required)
let appleIDProvider = ASAuthorizationAppleIDProvider()
let request = appleIDProvider.createRequest()

// After user confirms deletion:
// POST to Apple's revoke endpoint with the user's token
// Then delete server-side account data
```

**Why it works**: Required since June 2022. Must be actual deletion (not deactivation), must be in-app (not just email/website), and must revoke SIWA tokens if used. Apple tests this flow specifically.

---

### 7. Wrong age rating

**Time cost**: 2-4 days (re-answer questionnaire + possible content changes + resubmit)

**Symptom**: Rejection for Guideline 2.3.6 — Inaccurate metadata. Age rating doesn't reflect actual app content or capabilities.

❌ **BAD**: Understate content to get lower rating
```
App has user-generated content (chat, posts)
but age rating questionnaire answered "No UGC"

App has cartoon violence in gameplay
but answered "No violence"
```

✅ **GOOD**: Answer age rating questionnaire accurately
```
Declare honestly:
- User-generated content (chat, forums, social features)
- Violence (even cartoon/fantasy)
- Mature themes
- Profanity / crude humor
- Gambling (simulated or real)
- Horror / fear themes
- Medical / treatment information
- Unrestricted web access (WebView with open URLs)
```

**New age ratings (January 31, 2026)**: Apple expanded from 4+/9+/12+/17+ to 5 tiers (4+/9+/13+/16+/18+) with new capability declarations for messaging, UGC, advertising, and parental controls. All developers must complete the updated questionnaire or app updates will be blocked.

**Why it works**: Mismatched ratings violate Guideline 2.3.6. Apple compares your questionnaire answers against observed app behavior. UGC and web access are the most commonly missed declarations.

---

### 8. Missing demo credentials

**Time cost**: 3-5 days (rejection + credential creation + resubmit wait)

**Symptom**: Rejection for Guideline 2.1. Reviewer unable to test app because login is required and no test account was provided.

❌ **BAD**: App requires login, but no demo account in review notes
```
App Review Information:
  Notes: (empty)
  Demo Account: (empty)
  Demo Password: (empty)
→ Reviewer sees login screen, can't proceed, rejects
```

✅ **GOOD**: Working demo credentials with clear instructions
```
App Review Information:
  Demo Account: demo@yourapp.com
  Demo Password: AppReview2025!
  Notes: "Log in with the demo account above.
         The account has sample data pre-loaded.
         To test [feature X], navigate to Tab 2 > Settings.
         If 2FA is required, use code: 123456"

Requirements:
- Account must not expire during review (1-2 weeks minimum)
- Account must have representative data
- Include any special setup steps
- If hardware required, explain workarounds
- If location-specific, provide test coordinates
```

**Why it works**: Reviewers cannot test what they cannot access. They will not create their own account. If your app requires any form of authentication, demo credentials are mandatory. This is one of the most common rejection reasons for apps with login flows.

---

## Decision Tree

```
Is my app ready to submit?
│
├─ Does it crash on a real device?
│  ├─ YES → STOP. Fix crashes first (Guideline 2.1)
│  └─ NO → Continue
│
├─ Privacy manifest (PrivacyInfo.xcprivacy) present?
│  ├─ NO → Add privacy manifest with Required Reason APIs
│  └─ YES → Continue
│
├─ Privacy policy URL set in App Store Connect?
│  ├─ NO → Add privacy policy URL in ASC
│  └─ YES → Is it also accessible in-app?
│     ├─ NO → Add in-app privacy policy link
│     └─ YES → Continue
│
├─ All screenshots final and matching current app?
│  ├─ NO → Update screenshots for all required device sizes
│  └─ YES → Continue
│
├─ Does app create user accounts?
│  ├─ YES → Account deletion implemented and discoverable?
│  │  ├─ NO → Implement account deletion flow
│  │  └─ YES → Continue
│  └─ NO → Continue
│
├─ Does app offer third-party login (Google, Facebook, etc.)?
│  ├─ YES → Sign in with Apple offered?
│  │  ├─ NO → Add SIWA (unless exemption applies)
│  │  └─ YES → Continue
│  └─ NO → Continue
│
├─ Does app have in-app purchases or subscriptions?
│  ├─ YES → IAP items submitted for review in ASC?
│  │  ├─ NO → Submit IAP for review (can be reviewed separately)
│  │  └─ YES → Restore Purchases button implemented?
│  │     ├─ NO → Add Restore Purchases functionality
│  │     └─ YES → Continue
│  └─ NO → Continue
│
├─ Does app use encryption beyond standard HTTPS?
│  ├─ YES → Export compliance documentation uploaded?
│  │  ├─ NO → Add ITSAppUsesNonExemptEncryption to Info.plist
│  │  │       and upload compliance documentation
│  │  └─ YES → Continue
│  └─ NO → Set ITSAppUsesNonExemptEncryption = NO in Info.plist
│
├─ Distributing in EU?
│  ├─ YES → DSA trader status verified in ASC?
│  │  ├─ NO → Complete trader verification in ASC
│  │  └─ YES → Continue
│  └─ NO → Continue
│
├─ Does app require login to function?
│  ├─ YES → Demo credentials in App Review notes?
│  │  ├─ NO → Add working demo account + password + instructions
│  │  └─ YES → Continue
│  └─ NO → Continue
│
├─ Age rating questionnaire completed honestly?
│  ├─ NO → Complete updated questionnaire (new 13+/16+/18+ ratings)
│  └─ YES → Continue
│
├─ Any placeholder content remaining?
│  ├─ YES → Replace all placeholders with final content
│  └─ NO → Continue
│
└─ All checks passed → READY TO SUBMIT
```

---

## Mandatory Pre-Flight Checklist

Run this entire checklist before every submission. Check every item, not just the ones you think apply.

### 1. Build Configuration

- [ ] Built with current required SDK (iOS 18 SDK / Xcode 16 as of 2025; iOS 26 SDK / Xcode 26 required starting April 28, 2026)
- [ ] `ITSAppUsesNonExemptEncryption` set in Info.plist (`NO` if only HTTPS)
- [ ] App tested on physical device with latest shipping iOS version
- [ ] App works over IPv6-only network (Apple review network is IPv6)
- [ ] No private/undocumented API usage
- [ ] No references to pre-release/beta OS features unless targeting that OS
- [ ] Minimum deployment target is reasonable (not unnecessarily high)
- [ ] Release build tested (not just Debug configuration)

### 2. Privacy

- [ ] `PrivacyInfo.xcprivacy` file present in app target
- [ ] All Required Reason APIs declared with approved reason codes
- [ ] Third-party SDKs each include their own privacy manifests
- [ ] Privacy policy URL set in App Store Connect
- [ ] Privacy policy accessible in-app (Settings/About screen)
- [ ] Privacy policy content matches actual data collection practices
- [ ] All `NS*UsageDescription` purpose strings present (Camera, Location, etc.)
- [ ] Purpose strings explain user benefit (not just "we need access")
- [ ] App Tracking Transparency implemented if tracking users (ATT)
- [ ] Privacy Nutrition Labels completed in ASC matching manifest

### 3. Metadata

- [ ] App name (30 character limit, no keyword stuffing)
- [ ] Subtitle (30 character limit)
- [ ] Description (accurate, no misleading claims)
- [ ] Keywords (100 character limit, comma-separated)
- [ ] Category and secondary category set
- [ ] Screenshots for all required device sizes (6.9", 6.7", 6.5", 5.5" for iPhone; 13" for iPad if universal)
- [ ] Screenshots reflect current app UI (not outdated)
- [ ] App Preview videos current (if using)
- [ ] Support URL valid and accessible
- [ ] Marketing URL valid (if set)
- [ ] Copyright string current year
- [ ] Version number and build number incremented
- [ ] "What's New" text written (for updates)

### 4. Account and Authentication

- [ ] Account deletion flow implemented (if account creation exists)
- [ ] Account deletion is actual deletion (not just deactivation)
- [ ] SIWA token revocation on account deletion (if SIWA used)
- [ ] Sign in with Apple offered (if any third-party login exists)
- [ ] Active subscriptions handled during account deletion
- [ ] Restore Purchases button works (if IAP exists)
- [ ] IAP items submitted for review in ASC (if new/changed)
- [ ] Subscription terms clearly communicated before purchase

### 5. App Review Information

- [ ] Contact information (name, phone, email) provided
- [ ] Demo account username provided (if login required)
- [ ] Demo account password provided (if login required)
- [ ] Demo account won't expire during review period (1-2 weeks)
- [ ] Demo account has representative sample data
- [ ] Special instructions for hardware-dependent features
- [ ] Notes explain any non-obvious features or flows
- [ ] If app uses location, provide test coordinates

### 6. Content Completeness

- [ ] No placeholder text (lorem ipsum, TODO, "Coming Soon")
- [ ] No broken links or dead-end screens
- [ ] All images are production assets (no stock watermarks)
- [ ] App icon meets spec (1024x1024, no alpha channel, no rounded corners)
- [ ] All tabs/screens have functional content
- [ ] Error states and empty states have proper messaging
- [ ] Onboarding/tutorial flows complete and accurate
- [ ] All deep links and universal links resolve correctly

### 7. Regional and Compliance

- [ ] EU DSA trader status verified (if distributing in EU)
- [ ] Age rating questionnaire completed with updated categories (13+/16+/18+)
- [ ] Age rating reflects actual content (UGC, violence, web access declared)
- [ ] Export compliance documentation uploaded (if non-exempt encryption)
- [ ] Content complies with local laws for each distribution territory
- [ ] GDPR compliance (if distributing in EU)

### 8. New for 2025-2026

- [ ] Updated age rating questionnaire completed (deadline: January 31, 2026)
- [ ] Accessibility Nutrition Labels declared (becoming required for new submissions)
- [ ] External AI service consent modal (if app sends personal data to external AI)
- [ ] SDK minimum version met (Xcode 16/iOS 18 SDK now; Xcode 26/iOS 26 SDK starting April 28, 2026)

---

## Pressure Scenarios

### Scenario 1: "Ship by end of day"

**Setup**: PM says the app must be submitted today for a marketing launch next week.

**Pressure**: Deadline + executive visibility

**Rationalization traps**:
- "We'll fix the privacy policy after approval"
- "The placeholder is only on one screen, they won't notice"
- "We'll add account deletion in the next update"
- "It passed internal testing, no need for device testing"

**MANDATORY**: Run the full pre-flight checklist. Every item. Missing items cause rejection, which costs 3-7 MORE days — far worse than the 30 minutes the checklist takes.

Skipping the checklist to save 30 minutes costs 3-7 days when it causes rejection.

**Communication template**: "The pre-flight check found [N] issues that will cause rejection. Fixing them takes [X hours]. Submitting without fixing guarantees rejection, which costs 3-7 days minimum. Let me fix these now — it's the fastest path to being live."

---

### Scenario 2: "Third rejection, just make it work"

**Setup**: App rejected 3 times for different issues each time. Developer is frustrated and tempted to cut corners or argue with Apple.

**Pressure**: Frustration + sunk cost + temptation to appeal instead of fix

**Rationalization traps**:
- "They keep finding new issues — they're being unfair"
- "I'll appeal this one, it's unreasonable"
- "I'll just hide that screen from reviewers"

**MANDATORY**: Read the FULL text of every rejection message. Run the complete pre-flight checklist from scratch. Reviewers often find new issues on subsequent reviews because they test deeper each pass — they explore screens they didn't reach before, test flows they skipped, and review with stricter attention.

Each rejection is a signal that the pre-submission process has gaps. Do not fight the feedback — absorb it and close the gaps systematically.

**Communication template**: "Multiple rejections mean we have systematic gaps, not bad luck. I'm running the complete pre-flight checklist — this takes 30 minutes but prevents the 3-7 day cycle of partial fixes followed by new rejections."

---

### Scenario 3: "It's just a bug fix update"

**Setup**: Simple one-line bug fix. Developer assumes the update will sail through because the app was already approved.

**Pressure**: Complacency + false confidence from prior approval

**Rationalization traps**:
- "It was approved last time with the same metadata"
- "I only changed one file, they don't need to re-review everything"
- "They won't re-check the privacy stuff, it hasn't changed"

**MANDATORY**: Updates are reviewed against CURRENT guidelines. Requirements change between releases. Privacy manifests became mandatory mid-cycle. Age rating questionnaire was overhauled. SDK minimums increase annually. A bug fix update can be rejected for issues that didn't exist when the previous version was approved.

Run the pre-flight checklist every time. Requirements that didn't exist when your app was last reviewed may now be enforced.

**Communication template**: "Even for a bug fix, App Review applies current guidelines — not the ones from when we were last approved. The privacy manifest requirement and age rating overhaul both came mid-cycle. Running the 30-minute pre-flight now prevents a surprise rejection."

---

## Screenshot Requirements

Screenshots are a top rejection cause under Guideline 2.3 (Accurate Metadata). Screenshots must match the current app UI.

### Required Device Sizes (iPhone)

| Display Size | Devices | Required? |
|-------------|---------|-----------|
| 6.9" | iPhone 16 Pro Max | Required for new apps |
| 6.7" | iPhone 16 Plus, 15 Plus, 14 Plus | Required |
| 6.5" | iPhone 11 Pro Max, XS Max | Optional (falls back to 6.7") |
| 5.5" | iPhone 8 Plus, 7 Plus | Required for apps supporting older devices |

### Required Device Sizes (iPad)

| Display Size | Devices | Required? |
|-------------|---------|-----------|
| 13" | iPad Pro (M4) | Required if universal app |
| 12.9" | iPad Pro (5th gen) | Optional (falls back to 13") |
| 11" | iPad Air, iPad Pro 11" | Optional |

### Screenshot Rules

```
DO:
- Show actual app UI (not mockups or renders)
- Include text that matches current app content
- Show the app running on the device (can include device frames)
- Update screenshots when UI changes significantly
- Use all available screenshot slots (up to 10) for better conversion

DON'T:
- Show UI from a different version of the app
- Include misleading features or content not in the app
- Use competitor names or logos
- Show pricing that doesn't match actual IAP prices
- Include iPhone status bar showing incorrect carrier/time
```

### App Preview Videos

- Maximum 30 seconds
- Must show actual app functionality (not pre-rendered marketing)
- Audio is muted by default on the App Store
- Required sizes mirror screenshot requirements

---

## Handling Rejections

### Reading the Rejection Message

Every rejection includes:
1. **Guideline number** — Specific section violated
2. **Description** — What the reviewer found
3. **Screenshots/recordings** — Visual evidence (if applicable)
4. **Suggestions** — Sometimes included with fixes

### Response Strategy

```
1. Read the FULL rejection message (every word)
2. Identify ALL guidelines cited (may be multiple)
3. Fix EVERY cited issue (not just the first one)
4. Run the complete pre-flight checklist
5. In your resubmission notes, explain what you fixed
6. Do NOT argue or explain why you think the rejection is wrong
```

### When to Appeal

Appeals are appropriate when:
- You believe the reviewer misunderstood your app's functionality
- Your app clearly complies with the cited guideline
- You have evidence supporting your position

Appeals are NOT appropriate when:
- You disagree with the guideline itself
- The rejection is technically correct but feels unfair
- You want to delay fixing the issue

### Appeal Process

```
App Store Connect → Resolution Center → Reply
- Explain clearly why you believe the rejection is incorrect
- Provide specific evidence (screenshots, documentation)
- Remain professional and factual
- Apple's App Review Board will re-review
```

### Metadata Rejected vs Binary Rejected

| Type | What it means | What to do |
|------|--------------|------------|
| Metadata Rejected | Screenshots, description, or ASC fields need fixing | Fix in ASC, resubmit (no new build needed) |
| Binary Rejected | Code/app issue needs fixing | Fix code, create new archive, upload new build |

---

## In-App Purchase Review

IAP items require separate review. Missing or broken IAP is a top rejection cause under Guideline 3.1.1.

### IAP Submission Checklist

- [ ] All IAP products created in ASC with screenshots
- [ ] IAP products submitted for review (can be submitted independently)
- [ ] Restore Purchases button visible and functional
- [ ] Subscription terms displayed before purchase confirmation
- [ ] Free trial terms clearly communicated
- [ ] Pricing displayed matches ASC configuration
- [ ] No external purchase links (Guideline 3.1.1) unless eligible for entitlement
- [ ] StoreKit testing completed in sandbox environment

### Common IAP Rejection Patterns

```
❌ "Buy Premium" button that does nothing → Guideline 3.1.1
❌ No Restore Purchases option → Guideline 3.1.1
❌ Subscription auto-renews without clear disclosure → Guideline 3.1.2
❌ Free trial duration not shown before purchase → Guideline 3.1.2
❌ External purchase link without entitlement → Guideline 3.1.1
```

---

## Common Rejection Reasons Quick Reference

| Guideline | Issue | Prevention |
|-----------|-------|------------|
| 2.1 | Crashes, broken features, incomplete | Device testing, content audit |
| 2.3 | Inaccurate metadata, wrong screenshots | Screenshot audit, metadata review |
| 2.3.6 | Incorrect age rating | Honest questionnaire, declare UGC |
| 3.1.1 | IAP issues, missing Restore Purchases | Test all IAP flows, add restore |
| 4.0 | Design: poor UI, non-standard patterns | Follow HIG, test on all sizes |
| 4.8 | Missing Sign in with Apple | Add SIWA with any third-party login |
| 5.1.1(i) | Privacy policy missing/inadequate | Both ASC and in-app, specific content |
| 5.1.1(v) | No account deletion | In-app deletion, not just deactivation |
| 5.1.2 | Missing Required Reason APIs | Complete privacy manifest |

---

## App Store Connect Submission Workflow

### Step-by-step for a clean submission

```
1. Create new version in ASC
2. Set version number and "What's New" text
3. Upload screenshots (all required sizes)
4. Complete App Review Information section
   - Contact info
   - Demo credentials (if login required)
   - Notes for reviewer
5. Verify Privacy Nutrition Labels
6. Verify age rating questionnaire
7. Upload build from Xcode (Product → Archive → Distribute)
8. Wait for build processing (5-30 minutes)
9. Select processed build in ASC
10. Submit for Review
```

### Build upload checklist

```bash
# Before archiving
xcodebuild -showBuildSettings -scheme YourApp | grep -E "PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION|CURRENT_PROJECT_VERSION"

# Verify signing
xcodebuild -scheme YourApp -showBuildSettings | grep "CODE_SIGN"

# Archive
xcodebuild archive -scheme YourApp \
  -archivePath ./build/YourApp.xcarchive

# Or use Xcode: Product → Archive → Distribute → App Store Connect
```

### After submission

- **Review time**: ~90% reviewed within 24 hours
- **Check status**: ASC → My Apps → your app → App Store tab
- **If rejected**: Read FULL rejection text, fix ALL cited issues, run pre-flight again
- **If "Metadata Rejected"**: Can fix metadata without new build upload
- **If "Binary Rejected"**: Need new build upload

---

## Encryption Export Compliance

### Quick determination

Most apps only use HTTPS (URLSession, Alamofire, etc.). This is standard encryption that's exempt from documentation requirements but still requires declaration.

```xml
<!-- Info.plist — Add this to skip the compliance question on every upload -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Set to `true` only if your app uses:
- Custom encryption algorithms
- Encryption beyond what the OS provides
- Proprietary cryptographic protocols
- Direct calls to OpenSSL or similar libraries

If `true`, you must upload export compliance documentation in ASC.

**Note**: Even with `ITSAppUsesNonExemptEncryption = false`, if you make HTTPS calls you must submit an annual self-classification report to the US Bureau of Industry and Security. Apple provides guidance on this in App Store Connect.

---

## Accessibility Nutrition Labels (New 2025)

Declared per-device in App Store Connect. Initially optional but becoming required for new submissions and updates.

### Available Labels

| Label | What it means | How to verify |
|-------|--------------|---------------|
| VoiceOver | All common tasks completable with VoiceOver | Test every screen with VoiceOver enabled |
| Voice Control | All common tasks completable with voice commands | Test navigation and input with Voice Control |
| Larger Text | UI adapts to Dynamic Type sizes up to AX5 | Test with largest Accessibility text size |
| Dark Interface | Full dark mode support | Test every screen in dark mode |
| Sufficient Contrast | Text and controls meet WCAG AA contrast ratios | Audit with Accessibility Inspector |
| Differentiation Without Color | Information not conveyed by color alone | Check all status indicators, errors, states |
| Reduced Motion | Animations respect Reduce Motion setting | Enable Reduce Motion, verify all transitions |

### Declaration Rules

- Declare per device (iPhone, iPad, Apple Watch separately)
- Each declaration means users can complete ALL common tasks using that feature
- Do not declare partial support — all-or-nothing per feature
- Labels are saved as drafts first, published when ready
- Can publish individual device declarations separately

### Before Declaring

Run an accessibility audit of your app:
```
1. Enable VoiceOver → Navigate every screen → Complete core flows
2. Enable Voice Control → Same test
3. Set text size to AX5 → Check all screens for truncation/overlap
4. Switch to Dark Mode → Check all screens for legibility
5. Run Accessibility Inspector → Check contrast ratios
6. Enable Reduce Motion → Verify animations are reduced/removed
```

See `axiom-accessibility-diag` for systematic auditing before declaring labels.

---

## First-Time Developer Checklist

For developers submitting their first app, these are additional items often missed.

### Apple Developer Program

- [ ] Enrolled in Apple Developer Program ($99/year)
- [ ] Accepted latest Apple Developer Program License Agreement
- [ ] Tax and banking information completed in ASC (for paid apps/IAP)
- [ ] Distribution certificate created
- [ ] App ID registered with correct bundle identifier
- [ ] Provisioning profile created for App Store distribution

### App Store Connect Setup

- [ ] New app record created in ASC
- [ ] Bundle ID matches Xcode project exactly
- [ ] Primary language set
- [ ] Content rights declared (original content or licensed)
- [ ] Pricing and availability configured
- [ ] Territory selection (worldwide or specific countries)

### Common First-Time Mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Bundle ID mismatch between Xcode and ASC | Upload rejected | Match exactly, including case |
| Distribution cert expired/missing | Archive fails to upload | Create new cert in Developer Portal |
| License agreement not accepted | Upload blocked | Accept in developer.apple.com |
| Tax forms incomplete | Paid app not distributed | Complete in ASC → Agreements, Tax, and Banking |
| Wrong team selected in Xcode | Signing errors | Select correct team in Signing & Capabilities |

---

## Real-World Impact

**Before**: Developer submits without checklist → rejected for missing privacy manifest (3 days) → fixes, resubmits → rejected for missing SIWA (5 days) → fixes, resubmits → rejected for placeholder content (3 days) → 11 days lost to preventable issues

**After**: Developer runs 30-minute pre-flight → catches all three issues → fixes in 4 hours → approved on first submission

**Key insight**: The checklist takes 30 minutes. Each rejection cycle takes 3-7 days. The math is simple.

---

## Related Skills

- `axiom-privacy-ux` — Deep implementation of privacy manifests, ATT, Required Reason APIs
- `axiom-storekit-ref` — IAP and subscription implementation
- `axiom-accessibility-diag` — Accessibility audit before declaring Nutrition Labels
- `axiom-testflight-triage` — TestFlight crash and feedback triage
- `axiom-app-store-connect-ref` — ASC navigation, crash data, metrics
- `axiom-xcode-debugging` — Build failures and environment issues

---

## Resources

**WWDC**: 2022-10166, 2025-328, 2025-224, 2025-241

**Docs**: /app-store/review/guidelines, /app-store/submitting, /app-store/app-privacy-details, /support/offering-account-deletion-in-your-app, /documentation/security/complying-with-encryption-export-regulations

**Skills**: axiom-privacy-ux, axiom-storekit-ref, axiom-accessibility-diag, axiom-testflight-triage

---

**Last Updated**: 2026-02-17
**Platforms**: iOS, iPadOS, tvOS, watchOS, visionOS
**Status**: Production-ready pre-flight checklist for App Store submissions
