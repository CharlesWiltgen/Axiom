# Expert Review Checklist

Comprehensive 9-section submission checklist. For the discipline-focused pre-flight workflow, see `app-store-submission`.

## Build

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

## Privacy

- [ ] `PrivacyInfo.xcprivacy` present and complete
- [ ] Privacy policy URL set in App Store Connect
- [ ] Privacy policy accessible within the app
- [ ] All purpose strings (`NS*UsageDescription`) present for requested permissions
- [ ] ATT implemented if app tracks users
- [ ] Required Reason APIs declared with approved reasons
- [ ] Privacy Nutrition Labels match actual data collection
- [ ] Third-party SDK privacy manifests included
- [ ] Privacy report generated and reviewed (`Product > Archive > Generate Privacy Report`)

## Metadata

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

## Account

- [ ] Account deletion implemented and easy to find
- [ ] SIWA token revocation on account deletion
- [ ] Sign in with Apple offered if any third-party login exists
- [ ] SIWA given equal visual prominence to other login options
- [ ] Demo credentials provided in App Review Information (if login required)
- [ ] Demo credentials will not expire during review period

## Content

- [ ] No placeholder content ("Lorem ipsum", "Coming Soon", etc.)
- [ ] All links functional and leading to real content
- [ ] Final production assets (not development/staging URLs)
- [ ] No test data visible in screenshots or app
- [ ] No references to other mobile platforms in metadata

## Age Rating

- [ ] Age rating questionnaire completed
- [ ] New capability declarations answered (messaging, UGC, advertising, parental, age assurance)
- [ ] UGC moderation implemented if applicable
- [ ] Content filtering in place for web views (or accept 16+ minimum)
- [ ] Loot box odds disclosed if applicable

## Monetization

- [ ] All IAPs configured and in "Ready to Submit" status
- [ ] IAP screenshots uploaded
- [ ] Subscription terms clear (price, duration, auto-renewal, cancellation)
- [ ] Loot box odds displayed before purchase
- [ ] Restore Purchases functionality working
- [ ] No removing paid features to force new purchases
- [ ] Subscription grace period supported
- [ ] Offer codes configured if planned

## EU Compliance

- [ ] DSA trader status declared for all EU-distributed apps
- [ ] Trader email verified via 2FA
- [ ] Trader phone verified via 2FA
- [ ] Contact information accurate and current
- [ ] Labels and markings complete (if applicable for product category)

## App Review

- [ ] Contact information complete (name, email, phone)
- [ ] Demo account credentials provided (if login required)
- [ ] Notes for Review explain any non-obvious features
- [ ] Attachment uploaded for features requiring special hardware or setup
- [ ] Review contact email actively monitored
