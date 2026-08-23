
# Code Signing API Reference

Comprehensive CLI and API reference for iOS/macOS code signing: certificate management, provisioning profile inspection, entitlement extraction, Keychain operations, codesign verification, fastlane match, and Xcode build settings.

## Quick Reference

```bash
# Diagnostic flow — run these 3 commands first for any signing issue
security find-identity -v -p codesigning          # List valid signing identities
security cms -D -i path/to/embedded.mobileprovision  # Decode provisioning profile
codesign -d --entitlements - MyApp.app             # Extract entitlements from binary
```

---

## Certificate Reference

### Certificate Types

| Type | Purpose | Validity | Max Per Account |
|------|---------|----------|-----------------|
| Apple Development | Debug builds on registered devices | 1 year | Unlimited (per developer) |
| Apple Distribution | App Store + TestFlight submission | 1 year | 3 per account |
| iOS Distribution (legacy) | App Store submission (pre-Xcode 11) | 1 year | 3 per account |
| iOS Development (legacy) | Debug builds (pre-Xcode 11) | 1 year | Unlimited |
| Developer ID Application | macOS distribution outside App Store | 5 years | 5 per account |
| Developer ID Installer | macOS package signing | 5 years | 5 per account |
| Apple Push Services | APNs .p12 certificate auth (legacy) | 1 year | 1 per App ID |

### CSR Generation

```bash
# Generate Certificate Signing Request
openssl req -new -newkey rsa:2048 -nodes \
  -keyout CertificateSigningRequest.key \
  -out CertificateSigningRequest.certSigningRequest \
  -subj "/emailAddress=dev@example.com/CN=Developer Name/C=US"
```

Or use Keychain Access: Certificate Assistant → Request a Certificate From a Certificate Authority.

### Certificate Inspection

```bash
# View certificate details (from .cer file)
openssl x509 -in certificate.cer -inform DER -text -noout

# View certificate from .p12
openssl pkcs12 -in certificate.p12 -nokeys -clcerts | openssl x509 -text -noout

# List certificates in Keychain with SHA-1 hashes
security find-identity -v -p codesigning

# Example output:
#   1) ABC123... "Apple Development: dev@example.com (TEAMID)"
#   2) DEF456... "Apple Distribution: Company Name (TEAMID)"
#      2 valid identities found

# Find specific certificate by name
security find-certificate -c "Apple Distribution" login.keychain-db -p

# Check certificate expiration (pipe PEM output to openssl)
security find-certificate -c "Apple Distribution" login.keychain-db -p | openssl x509 -noout -enddate
```

### Certificate Installation

```bash
# Import .p12 into Keychain (interactive — prompts for password)
security import certificate.p12 -k ~/Library/Keychains/login.keychain-db -P "$P12_PASSWORD" -T /usr/bin/codesign

# Import .cer into Keychain
security import certificate.cer -k ~/Library/Keychains/login.keychain-db

# For CI: import into temporary keychain (see CI section below)
```

---

## Provisioning Profile Reference

### Profile Types

| Type | Contains | Use Case |
|------|----------|----------|
| Development | Dev cert + device UDIDs + App ID + entitlements | Debug builds on registered devices |
| Ad Hoc | Distribution cert + device UDIDs + App ID + entitlements | Testing on specific devices without TestFlight |
| App Store | Distribution cert + App ID + entitlements (no device list) | App Store + TestFlight submission |
| Enterprise | Enterprise cert + App ID + entitlements (no device list) | In-house distribution (Enterprise program only) |

### Profile Contents

A provisioning profile (.mobileprovision) is a signed plist containing:

```
├── AppIDName           — App ID name
├── ApplicationIdentifierPrefix  — Team ID
├── CreationDate        — When profile was created
├── DeveloperCertificates  — Embedded signing certificates (DER-encoded)
├── Entitlements        — Granted entitlements
│   ├── application-identifier
│   ├── aps-environment (development|production)
│   ├── com.apple.developer.associated-domains
│   ├── keychain-access-groups
│   └── ...
├── ExpirationDate      — When profile expires (1 year)
├── Name                — Profile name in Apple Developer Portal
├── ProvisionedDevices  — UDIDs (Development/Ad Hoc only)
├── TeamIdentifier      — Team ID array
├── TeamName            — Team display name
├── TimeToLive          — Days until expiration
├── UUID                — Unique profile identifier
└── Version             — Profile version (1)
```

### Decode Provisioning Profile

```bash
# Decode and display full contents
security cms -D -i path/to/embedded.mobileprovision

# Extract specific fields
security cms -D -i embedded.mobileprovision | plutil -extract Entitlements xml1 -o - -

# Check aps-environment (push notifications)
security cms -D -i embedded.mobileprovision | grep -A1 "aps-environment"

# Check expiration
security cms -D -i embedded.mobileprovision | grep -A1 "ExpirationDate"

# List provisioned devices (Development/Ad Hoc only)
security cms -D -i embedded.mobileprovision | grep -A100 "ProvisionedDevices"

# Check team ID
security cms -D -i embedded.mobileprovision | grep -A1 "TeamIdentifier"
```

### Profile Installation Paths

```bash
# Installed profiles (Xcode manages these)
~/Library/MobileDevice/Provisioning Profiles/

# List installed profiles
ls ~/Library/MobileDevice/Provisioning\ Profiles/

# Decode a specific installed profile
security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/<UUID>.mobileprovision

# Find profile embedded in app bundle
find ~/Library/Developer/Xcode/DerivedData -name "embedded.mobileprovision" -newer . 2>/dev/null | head -5

# Install a profile manually (copy to managed directory)
cp MyProfile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
```

---

## Entitlements Reference

### Common Entitlements

| Entitlement | Key | Values |
|-------------|-----|--------|
| App ID | `application-identifier` | `TEAMID.com.example.app` |
| Push Notifications | `aps-environment` | `development` / `production` |
| App Groups | `com.apple.security.application-groups` | `["group.com.example.shared"]` |
| Keychain Sharing | `keychain-access-groups` | `["TEAMID.com.example.keychain"]` |
| Associated Domains | `com.apple.developer.associated-domains` | `["applinks:example.com"]` |
| iCloud | `com.apple.developer.icloud-container-identifiers` | Container IDs |
| HealthKit | `com.apple.developer.healthkit` | `true` |
| Apple Pay | `com.apple.developer.in-app-payments` | Merchant IDs |
| Network Extensions | `com.apple.developer.networking.networkextension` | Array of types |
| Siri | `com.apple.developer.siri` | `true` |
| Sign in with Apple | `com.apple.developer.applesignin` | `["Default"]` |

### Entitlement .plist Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.example.shared</string>
    </array>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:example.com</string>
    </array>
</dict>
</plist>
```

### Extraction and Comparison

```bash
# Extract entitlements from signed app binary
codesign -d --entitlements - /path/to/MyApp.app

# Extract to file for comparison
codesign -d --entitlements entitlements.plist /path/to/MyApp.app

# Compare entitlements between app and provisioning profile
diff <(codesign -d --entitlements - MyApp.app 2>/dev/null) \
     <(security cms -D -i embedded.mobileprovision | plutil -extract Entitlements xml1 -o - -)

# Extract entitlements from .ipa
unzip -o MyApp.ipa -d /tmp/ipa_contents
codesign -d --entitlements - /tmp/ipa_contents/Payload/*.app

# Verify entitlements match between build and profile
codesign -d --entitlements - --xml MyApp.app  # XML format
```

---

## CLI Command Reference

### `security` Commands

```bash
# --- Identity & Certificate ---

# List valid code signing identities
security find-identity -v -p codesigning
# -v: valid only, -p codesigning: code signing policy

# Find certificate by common name
security find-certificate -c "Apple Distribution" login.keychain-db -p
# -c: common name substring, -p: output PEM, keychain is positional arg

# Find certificate by SHA-1 hash
security find-certificate -Z -a login.keychain-db | grep -B5 "ABC123"

# --- Import/Export ---

# Import .p12 (with password, allow codesign access)
security import certificate.p12 -k login.keychain-db -P "$PASSWORD" -T /usr/bin/codesign -T /usr/bin/security

# Import .cer
security import certificate.cer -k login.keychain-db

# Export certificate to .p12
security export -t identities -f pkcs12 -k login.keychain-db -P "$PASSWORD" -o exported.p12

# --- Provisioning Profile Decode ---

# Decode provisioning profile (CMS/PKCS7 signed plist)
security cms -D -i embedded.mobileprovision

# --- Keychain Management ---

# Create temporary keychain (for CI)
security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain

# Set as default keychain
security default-keychain -s build.keychain

# Add to search list (required for codesign to find certs)
security list-keychains -d user -s build.keychain login.keychain-db

# Unlock keychain (required in CI before signing)
security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain

# Set keychain lock timeout (0 = never lock during session)
security set-keychain-settings -t 3600 -l build.keychain
# -t: timeout in seconds, -l: lock on sleep

# Allow codesign to access keys without UI prompt (critical for CI)
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" build.keychain

# Delete keychain (CI cleanup)
security delete-keychain build.keychain
```

### `codesign` Commands

```bash
# --- Signing ---

# Sign with specific identity
codesign -s "Apple Distribution: Company Name (TEAMID)" MyApp.app
# -s: signing identity (name or SHA-1 hash)

# Sign with entitlements file
codesign -s "Apple Distribution" --entitlements entitlements.plist MyApp.app

# Force re-sign (overwrite existing signature)
codesign -f -s "Apple Distribution" MyApp.app

# Sign with timestamp (required for notarization)
codesign -s "Developer ID Application" --timestamp MyApp.app

# Deep sign (sign all nested code — frameworks, extensions)
codesign --deep -s "Apple Distribution" MyApp.app
# Warning: --deep is unreliable for complex apps. Sign each component individually.

# --- Verification ---

# Verify signature is valid
codesign --verify --verbose=4 MyApp.app

# Verify deep (check nested code)
codesign --verify --deep --strict MyApp.app

# Display signing information
codesign -dv MyApp.app
# Shows: Identifier, Format, TeamIdentifier, Signing Authority chain

# Display verbose signing info
codesign -dvvv MyApp.app

# Extract entitlements from signed binary
codesign -d --entitlements - MyApp.app
codesign -d --entitlements - --xml MyApp.app  # XML format
```

### `openssl` Commands

> **Note**: macOS ships with LibreSSL, not OpenSSL. Some `openssl pkcs12` commands may fail with "MAC verification failed" on stock macOS. Install OpenSSL via `brew install openssl` if needed, then use the full path (`/opt/homebrew/opt/openssl/bin/openssl`).

```bash
# --- Certificate Inspection ---

# View .cer details
openssl x509 -in certificate.cer -inform DER -text -noout

# View .pem details
openssl x509 -in certificate.pem -text -noout

# Check certificate expiration
openssl x509 -in certificate.cer -inform DER -noout -enddate

# Extract public key
openssl x509 -in certificate.cer -inform DER -pubkey -noout

# --- PKCS12 (.p12) ---

# Extract certificate from .p12
openssl pkcs12 -in certificate.p12 -nokeys -clcerts -out cert.pem

# Extract private key from .p12
openssl pkcs12 -in certificate.p12 -nocerts -nodes -out key.pem

# Create .p12 from cert + key
openssl pkcs12 -export -in cert.pem -inkey key.pem -out certificate.p12

# Verify .p12 contents
openssl pkcs12 -info -in certificate.p12 -nokeys
```

---

## Xcode Build Settings Reference

| Setting | Key | Values |
|---------|-----|--------|
| Code Signing Style | `CODE_SIGN_STYLE` | `Automatic` / `Manual` |
| Signing Identity | `CODE_SIGN_IDENTITY` | `Apple Development` / `Apple Distribution` / `iPhone Distribution` |
| Development Team | `DEVELOPMENT_TEAM` | Team ID (10-char alphanumeric) |
| Provisioning Profile | `PROVISIONING_PROFILE_SPECIFIER` | Profile name or UUID |
| Provisioning Profile (legacy) | `PROVISIONING_PROFILE` | Profile UUID (deprecated, use SPECIFIER) |
| Other Code Signing Flags | `OTHER_CODE_SIGN_FLAGS` | `--timestamp` / `--options runtime` |
| Code Sign Entitlements | `CODE_SIGN_ENTITLEMENTS` | Path to .entitlements file |
| Enable Hardened Runtime | `ENABLE_HARDENED_RUNTIME` | `YES` / `NO` (macOS) |

### xcodebuild Signing Overrides

```bash
# Automatic signing
xcodebuild -scheme MyApp -configuration Release \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=YOURTEAMID

# Manual signing
xcodebuild -scheme MyApp -configuration Release \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution: Company Name (TEAMID)" \
  PROVISIONING_PROFILE_SPECIFIER="MyApp App Store Profile"

# Archive for distribution
xcodebuild archive -scheme MyApp \
  -archivePath build/MyApp.xcarchive \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="MyApp App Store"

# Export .ipa from archive
xcodebuild -exportArchive \
  -archivePath build/MyApp.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/ipa
```

### ExportOptions.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOURTEAMID</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.example.myapp</key>
        <string>MyApp App Store Profile</string>
    </dict>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
```

Export method values: `app-store`, `ad-hoc`, `enterprise`, `development`, `developer-id`.

---

## fastlane match Reference

### Setup

```bash
# Initialize match (interactive — choose storage type)
fastlane match init
# Options: git, google_cloud, s3, azure_blob

# Generate certificates + profiles for all types
fastlane match development
fastlane match appstore
fastlane match adhoc
```

### Matchfile

```ruby
# fastlane/Matchfile
git_url("https://github.com/your-org/certificates.git")
storage_mode("git")

type("appstore")  # Default type

app_identifier(["com.example.app", "com.example.app.widget"])
username("dev@example.com")
team_id("YOURTEAMID")

# For multiple targets with different profiles
# for_lane(:beta) do
#   type("adhoc")
# end
```

### Usage

```bash
# Generate or fetch development certs + profiles
fastlane match development

# Generate or fetch App Store certs + profiles
fastlane match appstore

# CI: read-only mode (never create, only fetch)
fastlane match appstore --readonly

# Force regenerate (revokes existing)
fastlane match nuke distribution  # Revoke all distribution certs
fastlane match appstore           # Generate fresh
# Also: nuke development, nuke enterprise
```

### Environment Variables for CI

```bash
MATCH_GIT_URL="https://github.com/your-org/certificates.git"
MATCH_PASSWORD="encryption_password"       # Encrypts the repo
MATCH_KEYCHAIN_NAME="fastlane_tmp"
MATCH_KEYCHAIN_PASSWORD="keychain_password"
MATCH_READONLY="true"                      # CI should never create certs
FASTLANE_USER="dev@example.com"
FASTLANE_TEAM_ID="YOURTEAMID"
```

### CI Fastfile Example

```ruby
# fastlane/Fastfile
lane :release do
  setup_ci  # Creates temporary keychain

  match(
    type: "appstore",
    readonly: true,  # Critical: never create certs in CI
    keychain_name: "fastlane_tmp",
    keychain_password: ""
  )

  build_app(
    scheme: "MyApp",
    export_method: "app-store"
  )

  upload_to_app_store(skip_metadata: true, skip_screenshots: true)
end
```

---

## Keychain Management for CI

### Complete CI Keychain Setup Script

```bash
#!/bin/bash
set -euo pipefail

KEYCHAIN_NAME="ci-build.keychain-db"
KEYCHAIN_PASSWORD="ci-temporary-password"

# 1. Create temporary keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

# 2. Add to search list (MUST include login.keychain-db or it disappears)
security list-keychains -d user -s "$KEYCHAIN_NAME" login.keychain-db

# 3. Unlock keychain
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

# 4. Prevent keychain from locking during build
security set-keychain-settings -t 3600 -l "$KEYCHAIN_NAME"

# 5. Import signing certificate
security import "$P12_PATH" -k "$KEYCHAIN_NAME" -P "$P12_PASSWORD" \
  -T /usr/bin/codesign -T /usr/bin/security

# 6. Allow codesign access without UI prompt (CRITICAL)
# Without this, CI gets errSecInternalComponent
security set-key-partition-list -S apple-tool:,apple: -s \
  -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

echo "Keychain ready for code signing"
```

### CI Keychain Cleanup Script

```bash
#!/bin/bash
# Run in CI post-build (always, even on failure)

KEYCHAIN_NAME="ci-build.keychain-db"

# Delete temporary keychain
security delete-keychain "$KEYCHAIN_NAME" 2>/dev/null || true

# Restore default keychain search list
security list-keychains -d user -s login.keychain-db
```

### GitHub Actions Example

```yaml
- name: Install signing certificate
  env:
    P12_BASE64: ${{ secrets.P12_BASE64 }}
    P12_PASSWORD: ${{ secrets.P12_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
    PROVISION_PROFILE_BASE64: ${{ secrets.PROVISION_PROFILE_BASE64 }}
  run: |
    # Decode certificate
    echo "$P12_BASE64" | base64 --decode > certificate.p12

    # Decode provisioning profile
    echo "$PROVISION_PROFILE_BASE64" | base64 --decode > profile.mobileprovision

    # Create and configure keychain
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security list-keychains -d user -s build.keychain login.keychain-db
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -t 3600 -l build.keychain
    security import certificate.p12 -k build.keychain -P "$P12_PASSWORD" \
      -T /usr/bin/codesign -T /usr/bin/security
    security set-key-partition-list -S apple-tool:,apple: -s \
      -k "$KEYCHAIN_PASSWORD" build.keychain

    # Install provisioning profile
    mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
    cp profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/

- name: Cleanup keychain
  if: always()
  run: security delete-keychain build.keychain 2>/dev/null || true
```

### Xcode Cloud

Xcode Cloud manages signing automatically:
- Certificates are managed by Apple — no manual cert management needed
- Provisioning profiles are fetched from Developer Portal
- Configure signing in Xcode → cloud workflow settings
- Use `ci_post_clone.sh` for custom keychain operations if needed

---

## APNs Authentication: .p8 vs .p12

| Aspect | .p8 (Token-Based) | .p12 (Certificate-Based) |
|--------|-------|-------------|
| Validity | Never expires (revoke to invalidate) | 1 year (must renew annually) |
| Scope | All apps in team | Single App ID |
| Max per team | 2 keys | 1 cert per App ID |
| Setup complexity | Lower (one key for all apps) | Higher (per-app certificate) |
| Server implementation | JWT token generation required | TLS client certificate |
| Recommended | Yes (Apple's current recommendation) | Legacy (still supported) |

### .p8 Key Usage

```bash
# Generate JWT for APNs (simplified — use a library in production)
# Header: {"alg": "ES256", "kid": "KEY_ID"}
# Payload: {"iss": "TEAM_ID", "iat": TIMESTAMP}
# Sign with .p8 private key

# JWT is valid for 1 hour — cache and refresh before expiry
```

### .p12 Certificate Usage

```bash
# Send push with certificate authentication
curl -v \
  --cert-type P12 --cert apns-cert.p12:password \
  --header "apns-topic: com.example.app" \
  --header "apns-push-type: alert" \
  --data '{"aps":{"alert":"Hello"}}' \
  --http2 https://api.sandbox.push.apple.com/3/device/$TOKEN
# Production: https://api.push.apple.com/3/device/$TOKEN
```

---

## Error Codes Reference

### security Command Errors

| Error | Code | Cause |
|-------|------|-------|
| errSecInternalComponent | -2070 | Keychain locked or `set-key-partition-list` not called |
| errSecItemNotFound | -25300 | Certificate/key not in searched keychains |
| errSecDuplicateItem | -25299 | Certificate already exists in keychain |
| errSecAuthFailed | -25293 | Wrong keychain password |
| errSecInteractionNotAllowed | -25308 | Keychain locked, no UI available (CI without unlock) |
| errSecMissingEntitlement | -34018 | App missing required entitlement for keychain access |

### codesign Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `No signing certificate found` | No valid identity in keychain | Import cert or check expiration |
| `ambiguous (matches ...)` | Multiple matching identities | Specify full identity name or SHA-1 hash |
| `not valid for use in ...` | Cert type mismatch (dev vs dist) | Use correct certificate type |
| `a sealed resource is missing or invalid` | Modified resources after signing | Re-sign after all modifications |
| `invalid signature (code or signature have been modified)` | Binary tampered post-signing | Re-sign or rebuild |

### ITMS (App Store Upload) Errors

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| ITMS-90035 | Invalid Signature | Wrong certificate type or expired cert | Sign with valid Apple Distribution cert |
| ITMS-90161 | Invalid Provisioning Profile | Profile doesn't match app | Regenerate profile in Developer Portal |
| ITMS-90046 | Invalid Code Signing Entitlements | Entitlements not in profile | Add capability in portal, regenerate profile |
| ITMS-90056 | Missing Push Notification Entitlement | aps-environment not in profile | Enable Push Notifications capability |
| ITMS-90174 | Missing Provisioning Profile | No profile embedded | Archive with correct signing settings |
| ITMS-90283 | Invalid Provisioning Profile | Profile expired | Download fresh profile |
| ITMS-90426 | Invalid Swift Support | Swift libraries not signed correctly | Use Xcode's organizer to export (not manual) |
| ITMS-90474 | Missing Bundle Identifier | Bundle ID doesn't match profile | Align bundle ID across Xcode, portal, and profile |
| ITMS-90478 | Invalid Team ID | Team ID mismatch | Verify DEVELOPMENT_TEAM build setting |
| ITMS-90717 | Invalid App Store Distribution Certificate | Using Development cert for App Store | Switch to Apple Distribution certificate |

## Resources

**WWDC**: 2021-10204, 2022-110353

**Docs**: /security, /bundleresources/entitlements, /xcode/distributing-your-app

**Skills**: axiom-security (skills/code-signing.md), axiom-security (skills/code-signing-diag.md)
