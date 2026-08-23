# macOS Direct Distribution

## When to Use This Skill

Use when:
- Distributing a macOS app outside the Mac App Store via Developer ID
- Setting up code signing for direct distribution (not App Store)
- Notarizing software with `notarytool`
- Troubleshooting Gatekeeper blocks, notarization failures, or code signing errors
- Adding auto-updates to a directly distributed app (Sparkle)
- Packaging apps as DMG, zip, or installer package
- Migrating from deprecated `altool` to `notarytool`

#### Related Skills
- Use `skills/sandbox-and-file-access.md` for App Sandbox entitlements, file access, container architecture
- Use `axiom-security` for Keychain, encryption, passkeys, certificate management
- Use `axiom-shipping` for App Store submission, rejections, privacy manifests

## Red Flags — Anti-Patterns to Prevent

If you are doing ANY of these, STOP and follow the guidance in this skill.

### Using altool for notarization

```bash
# ❌ REJECTED — altool is no longer accepted as of November 1, 2023
xcrun altool --notarize-app --file MyApp.zip ...
```
**Why this fails**: Apple's notary service no longer accepts submissions from `altool`. You must use `notarytool` (Xcode 13+) or the Notary REST API. See TN3147.

### Signing in the wrong order

```bash
# ❌ WRONG — signing the app before its embedded frameworks
codesign -s "Developer ID Application" MyApp.app
codesign -s "Developer ID Application" MyApp.app/Contents/Frameworks/Sparkle.framework
```
**Why this fails**: Signing the outer bundle first, then signing an inner framework, invalidates the outer signature. macOS validates nested signatures as part of the parent. Always sign inside-out.

### Using --deep for code signing

```bash
# ❌ WRONG — applies identical options to all nested code
codesign --deep -s "Developer ID Application" -o runtime MyApp.app
```
**Why this fails**: `--deep` applies the same entitlements, options, and identity to every nested component. Different components often need different entitlements (e.g., XPC services vs main app) or no entitlements at all (frameworks). Quinn "The Eskimo!" calls this "--deep Considered Harmful."

### Skipping Hardened Runtime

```bash
# ❌ WRONG — notarization will reject this
codesign -s "Developer ID Application" --timestamp MyApp.app
```
**Why this fails**: Hardened Runtime (`-o runtime`) is mandatory for notarization. Without it, Apple's notary service rejects the submission.

### Not stapling the notarization ticket

**Why this fails**: Without stapling, Gatekeeper must contact Apple's servers to verify notarization. If the user is offline, Gatekeeper blocks the app. Stapling embeds the ticket directly in the distribution file.

### Leaving get-task-allow in distribution builds

**Why this fails**: The `com.apple.security.get-task-allow` entitlement allows debugger attachment. Notarization rejects code with this entitlement because an attacker could inject code at runtime. Remove it from distribution entitlements.

---

## Distribution Checklist

This is the end-to-end workflow from signed code to delivered product. Complete every step in order.

### Phase 1: Prepare

- [ ] Verify Developer ID identity is available:
  ```bash
  security find-identity -p codesigning -v
  # Look for "Developer ID Application: <Name> (<TeamID>)"
  ```
- [ ] Create distribution entitlements file (remove `com.apple.security.get-task-allow`, set `com.apple.developer.aps` to "production" if using push)
- [ ] Verify entitlements file is ASCII XML with LF line endings, no BOM:
  ```bash
  plutil -convert xml1 MyApp.entitlements
  ```
- [ ] Enable Hardened Runtime in Xcode (Signing & Capabilities) or plan to pass `-o runtime` to `codesign`
- [ ] Add only the Hardened Runtime exceptions your app actually needs

### Phase 2: Sign (Inside-Out)

- [ ] Sign embedded frameworks first:
  ```bash
  codesign -f -s "Developer ID Application: <Name> (<TeamID>)" \
    --timestamp -o runtime \
    MyApp.app/Contents/Frameworks/SomeFramework.framework
  ```
- [ ] Sign helpers, XPC services, and extensions:
  ```bash
  codesign -f -s "Developer ID Application: <Name> (<TeamID>)" \
    --timestamp -o runtime \
    MyApp.app/Contents/XPCServices/Helper.xpc
  ```
- [ ] Sign the main app last, with entitlements:
  ```bash
  codesign -f -s "Developer ID Application: <Name> (<TeamID>)" \
    --timestamp -o runtime \
    --entitlements MyApp.entitlements \
    MyApp.app
  ```
- [ ] Verify the signature:
  ```bash
  codesign -v -vvv --strict --deep MyApp.app
  ```

### Phase 3: Package

- [ ] Choose a container format (see Packaging section below)
- [ ] For DMG: create, copy app, sign the DMG:
  ```bash
  hdiutil create -volname "MyApp" -srcfolder MyApp.app -ov -format UDZO MyApp.dmg
  codesign -s "Developer ID Application: <Name> (<TeamID>)" --timestamp MyApp.dmg
  ```
- [ ] For zip: use `ditto` (preserves symlinks and resource forks):
  ```bash
  ditto -c -k --sequesterRsrc --keepParent MyApp.app MyApp.zip
  ```
- [ ] For pkg: build and sign:
  ```bash
  productbuild --component MyApp.app /Applications MyApp-unsigned.pkg
  productsign --sign "Developer ID Installer: <Name> (<TeamID>)" \
    MyApp-unsigned.pkg MyApp.pkg
  ```

### Phase 4: Notarize

- [ ] Store credentials in Keychain (one-time setup):
  ```bash
  xcrun notarytool store-credentials "AC_PASSWORD" \
    --apple-id you@example.com \
    --team-id YOURTEAMID
  ```
- [ ] Submit and wait:
  ```bash
  xcrun notarytool submit MyApp.dmg \
    --keychain-profile "AC_PASSWORD" \
    --wait
  ```
- [ ] Check the log even on success (warnings matter):
  ```bash
  xcrun notarytool log <submission-id> \
    --keychain-profile "AC_PASSWORD"
  ```

### Phase 5: Staple and Deliver

- [ ] Staple the notarization ticket:
  ```bash
  xcrun stapler staple MyApp.dmg
  ```
- [ ] Verify stapling:
  ```bash
  xcrun stapler validate MyApp.dmg
  ```
- [ ] Test on a clean Mac or VM (see Troubleshooting section)
- [ ] Upload to your distribution server

---

## Code Signing

### Signing Order

Sign inside-out. The outer signature includes hashes of inner signatures, so signing inner components after the outer signature invalidates it.

| Order | Component | Example |
|-------|-----------|---------|
| 1 | Dylibs | `Contents/Frameworks/*.dylib` |
| 2 | Frameworks | `Contents/Frameworks/*.framework` |
| 3 | XPC services | `Contents/XPCServices/*.xpc` |
| 4 | Helpers/tools | `Contents/MacOS/helper-tool` |
| 5 | App extensions | `Contents/PlugIns/*.appex` |
| 6 | Main app | `MyApp.app` |

### Essential codesign Flags

| Flag | Purpose | When Required |
|------|---------|---------------|
| `-s "Developer ID Application: ..."` | Signing identity | Always |
| `-f` | Force re-sign | When re-signing previously signed code |
| `--timestamp` | Secure timestamp from Apple | Developer ID (notarization requires it) |
| `-o runtime` | Enable Hardened Runtime | Developer ID (notarization requires it) |
| `--entitlements path` | Apply entitlements | Main executable only, never libraries |
| `-i com.example.tool` | Set identifier | Non-bundled executables only |

### Never Use

- **`--deep`** — Applies identical options to all nested code. Different components need different entitlements.
- **`sudo codesign`** — codesign depends on user account information. Running as root breaks identity lookup.

### Verify a Signature

```bash
# Full verification with strict checks
codesign -v -vvv --strict --deep MyApp.app

# Display signing details
codesign -d -vvv MyApp.app

# Check designated requirement
codesign --display -r - MyApp.app
```

---

## Hardened Runtime

Hardened Runtime protects against code injection, DLL hijacking, and memory tampering. It works alongside System Integrity Protection. Required for notarization.

Most apps work without any exceptions. Add exceptions only when your app genuinely needs them.

### Runtime Exceptions

| Exception | Entitlement | Use Case |
|-----------|------------|----------|
| JIT compilation | `com.apple.security.cs.allow-jit` | JavaScript engines, regex engines |
| Unsigned executable memory | `com.apple.security.cs.allow-unsigned-executable-memory` | Legacy code, avoid if possible |
| DYLD environment variables | `com.apple.security.cs.allow-dyld-environment-variables` | Plugin hosts, debugging tools |
| Disable library validation | `com.apple.security.cs.disable-library-validation` | Loading third-party frameworks/plugins |
| Disable executable memory protection | `com.apple.security.cs.disable-executable-page-protection` | Extremely rare, removes core protections |
| Debugging tool | `com.apple.security.cs.debugger` | Instruments-like tools |

### Resource Access Entitlements

| Resource | Entitlement |
|----------|------------|
| Camera | `com.apple.security.device.camera` |
| Microphone | `com.apple.security.device.audio-input` |
| Location | `com.apple.security.personal-information.location` |
| Contacts | `com.apple.security.personal-information.addressbook` |
| Calendar | `com.apple.security.personal-information.calendars` |
| Photos | `com.apple.security.personal-information.photos-library` |
| Apple Events | `com.apple.security.automation.apple-events` |

Even with entitlements, the user still sees a permission prompt at runtime.

---

## Notarization

### notarytool Commands

Store credentials once, reference everywhere:

```bash
# Store with app-specific password
xcrun notarytool store-credentials "AC_PASSWORD" \
  --apple-id you@example.com \
  --team-id YOURTEAMID

# Store with App Store Connect API key
xcrun notarytool store-credentials "AC_APIKEY" \
  --issuer ISSUER_UUID \
  --key-id API_KEY_ID \
  --key /path/to/AuthKey_XXXX.p8
```

Submit, check, and retrieve logs:

```bash
# Submit and wait (blocks until complete)
xcrun notarytool submit MyApp.dmg --keychain-profile "AC_PASSWORD" --wait

# Submit without waiting (returns submission ID)
xcrun notarytool submit MyApp.dmg --keychain-profile "AC_PASSWORD"

# Check status of a submission
xcrun notarytool info <submission-id> --keychain-profile "AC_PASSWORD"

# Retrieve the notary log (always check, even on success)
xcrun notarytool log <submission-id> --keychain-profile "AC_PASSWORD"

# View submission history
xcrun notarytool history --keychain-profile "AC_PASSWORD"
```

### Accepted Upload Formats

| Format | Staple-able | Notes |
|--------|-------------|-------|
| `.dmg` (UDIF) | Yes | Must be signed DMG |
| `.pkg` (flat) | Yes | Must be signed installer package |
| `.zip` | No | Cannot staple; staple contents before zipping |

### Common Notarization Failures

| Error | Cause | Fix |
|-------|-------|-----|
| "The signature does not include a secure timestamp" | Missing `--timestamp` | Re-sign with `--timestamp` flag |
| "The executable does not have the hardened runtime enabled" | Missing `-o runtime` | Re-sign with `-o runtime` flag |
| "The signature of the binary is invalid" | Signed in wrong order or modified after signing | Re-sign inside-out, don't modify after |
| "The binary uses an SDK older than the 10.9 SDK" | Linked against ancient SDK | Rebuild with macOS 10.9+ SDK |
| "The executable requests the com.apple.security.get-task-allow entitlement" | Debug entitlement in distribution build | Remove from distribution entitlements file |

### Stapling

```bash
# Staple to DMG or pkg
xcrun stapler staple MyApp.dmg

# Staple to app bundle (before zipping)
xcrun stapler staple MyApp.app

# Validate stapling
xcrun stapler validate MyApp.dmg
```

For zip distribution: staple the `.app` first, then create the zip with `ditto`.

### Stapler Troubleshooting

If stapling fails with caching errors:

```bash
sudo killall -9 trustd
sudo rm /Library/Keychains/crls/valid.sqlite3
```

If stapling reports error 65, see Quinn's "Resolving Error 65 When Stapling" forum post.

---

## Packaging

### DMG (Recommended for User-Facing Distribution)

Best for: drag-to-install experience, can include `/Applications` symlink, supports custom backgrounds, staple-able.

```bash
# Create compressed DMG
hdiutil create -volname "MyApp" -srcfolder MyApp.app -ov -format UDZO MyApp.dmg

# Sign the DMG itself
codesign -s "Developer ID Application: <Name> (<TeamID>)" --timestamp MyApp.dmg
```

### Zip (Simplest, No Stapling)

Best for: Sparkle updates, automated distribution, CI artifacts.

```bash
# MUST use ditto to preserve symlinks and resource forks
ditto -c -k --sequesterRsrc --keepParent MyApp.app MyApp.zip
```

Zip files cannot be stapled. Staple the `.app` before creating the zip. Gatekeeper still verifies notarization online for non-stapled archives.

### Installer Package (System-Level Installation)

Best for: installing daemons, launch agents, privileged helpers, multi-component products.

```bash
# Build the package
productbuild --component MyApp.app /Applications MyApp-unsigned.pkg

# Sign with Developer ID Installer identity (not Application)
productsign --sign "Developer ID Installer: <Name> (<TeamID>)" \
  MyApp-unsigned.pkg MyApp.pkg
```

---

## Auto-Updates with Sparkle

Sparkle is the standard auto-update framework for directly distributed macOS apps. MIT-licensed, supports EdDSA signatures, sandboxing, and silent background updates.

### Setup

1. Add Sparkle via SPM:
   - File > Add Packages > `https://github.com/sparkle-project/Sparkle`

2. Generate EdDSA keys (once per project):
   ```bash
   # Tools location varies by install method
   # SPM: ../artifacts/sparkle/Sparkle/bin/
   ./bin/generate_keys
   ```
   Copy the public key to `Info.plist` as `SUPublicEDKey`. The private key is stored in your Keychain.

3. Add `SUFeedURL` to `Info.plist`:
   ```xml
   <key>SUFeedURL</key>
   <string>https://example.com/appcast.xml</string>
   ```

4. For sandboxed apps, add to `Info.plist`:
   ```xml
   <key>SUEnableInstallerLauncherService</key>
   <true/>
   ```
   And add the XPC temporary exception to your `.entitlements`:
   ```xml
   <key>com.apple.security.temporary-exception.mach-lookup.global-name</key>
   <array>
       <string>$(PRODUCT_BUNDLE_IDENTIFIER)-spks</string>
       <string>$(PRODUCT_BUNDLE_IDENTIFIER)-spki</string>
   </array>
   ```

### SwiftUI Integration

```swift
import Sparkle

final class CheckForUpdatesViewModel: ObservableObject {
    @Published var canCheckForUpdates = false

    let updater: SPUUpdater

    init() {
        let controller = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
        self.updater = controller.updater

        updater.publisher(for: \.canCheckForUpdates)
            .assign(to: &$canCheckForUpdates)
    }

    func checkForUpdates() {
        updater.checkForUpdates()
    }
}

struct CheckForUpdatesView: View {
    @ObservedObject var viewModel: CheckForUpdatesViewModel

    var body: some View {
        Button("Check for Updates...") {
            viewModel.checkForUpdates()
        }
        .disabled(!viewModel.canCheckForUpdates)
    }
}
```

Add to your `App`:

```swift
@main
struct MyApp: App {
    @StateObject private var updaterViewModel = CheckForUpdatesViewModel()

    var body: some Scene {
        WindowGroup { ContentView() }
            .commands {
                CommandGroup(after: .appInfo) {
                    CheckForUpdatesView(viewModel: updaterViewModel)
                }
            }
    }
}
```

### Publishing an Update

1. Archive and export with Developer ID distribution
2. Create the archive:
   ```bash
   ditto -c -k --sequesterRsrc --keepParent MyApp.app MyApp.zip
   ```
3. Generate the appcast:
   ```bash
   ./bin/generate_appcast /path/to/updates_folder/
   ```
4. Upload the archive, any delta files, and `appcast.xml` to your server

### Key Info.plist Settings

| Key | Default | Purpose |
|-----|---------|---------|
| `SUFeedURL` | (required) | Appcast URL |
| `SUPublicEDKey` | (required) | EdDSA public key for signature verification |
| `SUEnableAutomaticChecks` | Prompt user | Set `YES` to skip the permission prompt |
| `SUAutomaticallyUpdate` | `NO` | Silent background updates |
| `SUScheduledCheckInterval` | 86400 (1 day) | Minimum: 3600 (1 hour) |

### Signing Sparkle in Manual Builds

If you re-sign Sparkle manually (not using Xcode's Archive/Export), sign inside-out:

```bash
codesign -f -s "$IDENTITY" -o runtime \
  Sparkle.framework/Versions/B/XPCServices/Installer.xpc
codesign -f -s "$IDENTITY" -o runtime --preserve-metadata=entitlements \
  Sparkle.framework/Versions/B/XPCServices/Downloader.xpc
codesign -f -s "$IDENTITY" -o runtime \
  Sparkle.framework/Versions/B/Autoupdate
codesign -f -s "$IDENTITY" -o runtime \
  Sparkle.framework/Versions/B/Updater.app
codesign -f -s "$IDENTITY" -o runtime \
  Sparkle.framework
```

Do NOT use `--deep` on Sparkle. Its XPC services have different signing requirements.

---

## Troubleshooting

### Gatekeeper Blocks

Test on a fresh Mac or VM. To isolate Gatekeeper from other issues:

```bash
# Download without quarantine attribute
curl -O https://example.com/MyApp.dmg

# Or remove quarantine from existing file
xattr -d com.apple.quarantine MyApp.dmg
```

If the app still fails without quarantine, the problem is NOT Gatekeeper — it is a code signing or runtime issue.

On macOS 14+, use `syspolicy_check`:

```bash
syspolicy_check distribution MyApp.app
```

### Dangling Load Command Paths

BY FAR the most common Gatekeeper failure. A Mach-O binary references a library path that does not exist at runtime.

Diagnose with:

```bash
otool -L MyApp.app/Contents/MacOS/MyApp
# Look for absolute paths like /usr/local/lib/... or build-directory paths
```

Fix by using `install_name_tool` or `@rpath`-relative paths.

### Unicode Normalization in Zip Archives

The Finder's Archive Utility can convert precomposed Unicode filenames to decomposed form, breaking code signatures. Stick to ASCII when naming files in your bundle. Use `ditto` instead of Finder compression.

### cdhash Matching for Notarization Issues

When Gatekeeper logs show `ticket not available: 2/2/<cdhash>`:

1. Get your app's cdhash:
   ```bash
   codesign -d -vvv MyApp.app
   # Look for "CDHash=" line
   ```
2. Compare with the cdhash in the notary log
3. If they differ, you are testing a different binary than you notarized

### System Log Diagnostics

```bash
# Stream trusted execution logs
log stream --predicate "sender == 'AppleMobileFileIntegrity' or \
  sender == 'AppleSystemPolicy' or process == 'amfid' or \
  process == 'taskgated-helper' or process == 'syspolicyd'"
```

Search keywords: `gk`, `xprotect`, `syspolicy`, `amfi`, `cmd`

### Testing a Notarized Product

Always test from a clean download, not from your build directory. The build directory does not have the quarantine attribute that triggers Gatekeeper.

1. Upload to a web server or share via AirDrop
2. Download on a test Mac
3. Verify the quarantine attribute exists:
   ```bash
   xattr -l MyApp.dmg
   # Should show com.apple.quarantine
   ```
4. Open normally (double-click in Finder)

---

## Resources

**WWDC**: 2018-702, 2019-703, 2021-10261, 2022-10109, 2023-10266

**Docs**: /security/notarizing-macos-software-before-distribution, /xcode/creating-distribution-signed-code-for-the-mac, /xcode/packaging-mac-software-for-distribution, /security/hardened-runtime, /technotes/tn3147-migrating-to-the-latest-notarization-tool

**Forum Posts** (Quinn "The Eskimo!"): Resolving Trusted Execution Problems, Resolving Gatekeeper Problems, The Care and Feeding of Developer ID, --deep Considered Harmful, Testing a Notarised Product, The Pros and Cons of Stapling, Resolving Error 65 When Stapling

**Skills**: sandbox, axiom-security, axiom-shipping
