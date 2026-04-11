
# Code Signing Diagnostics

Systematic troubleshooting for code signing failures: missing certificates, provisioning profile mismatches, Keychain issues in CI, entitlement conflicts, and App Store upload rejections.

## Overview

**Core Principle**: When code signing fails, the problem is usually:
1. **Certificate issues** (expired, missing, wrong type, revoked) — 30%
2. **Provisioning profile issues** (expired, missing cert, wrong App ID, missing capability) — 25%
3. **Entitlement mismatches** (capability in Xcode but not in profile, or vice versa) — 15%
4. **Keychain issues** (locked in CI, errSecInternalComponent, partition list) — 15%
5. **Archive/export issues** (wrong export method, wrong cert type for distribution) — 10%
6. **Ambiguous identity** (multiple matching certificates, Xcode picks wrong one) — 5%

**Always verify certificate + profile + entitlements BEFORE rewriting build settings or regenerating everything.**

## Red Flags

Symptoms that indicate code signing–specific issues:

| Symptom | Likely Cause |
|---------|--------------|
| "No signing certificate found" | Certificate expired, revoked, or not in keychain |
| "Provisioning profile doesn't include signing certificate" | Profile generated with different cert than the one in keychain |
| ITMS-90035 Invalid Signature | Signed with Development cert instead of Distribution |
| ITMS-90161 Invalid Provisioning Profile | Profile expired or doesn't match binary |
| errSecInternalComponent in CI | Keychain locked or `set-key-partition-list` not called |
| "Ambiguous — matches multiple" | Multiple valid certs with same name (dev + expired) |
| "Entitlement not allowed by profile" | Capability added in Xcode but profile not regenerated |
| "codesign wants to access key" dialog | Keychain access not granted to codesign |
| Build works locally, fails in CI | Missing keychain setup steps (create, unlock, partition list) |
| "Profile doesn't match bundle ID" | Bundle identifier mismatch between Xcode target and profile |
| Export fails after successful archive | ExportOptions.plist specifies wrong method or profile |
| App extension signing fails | Extension needs its own profile with matching team and prefix |

## Anti-Rationalization

| Rationalization | Why It Fails | Time Cost |
|----------------|--------------|-----------|
| "Certificate was fine yesterday" | Certificates expire and get revoked. Profiles auto-regenerate in portal changes. Always re-verify. | 30-60 min debugging build settings when cert expired overnight |
| "Let me regenerate everything" | Regenerating certificates revokes the old ones, breaking other team members and CI. Diagnose first. | 2-4 hours + broken teammates + CI pipeline down |
| "I'll reset my keychain" | Destroys ALL stored credentials (SSH keys, saved passwords, other certs). Diagnose the specific cert. | 1-2 hours restoring all credentials |
| "Just disable code signing for now" | Code signing can't be disabled for device builds or distribution. You'll hit the same issue later with less time. | Wasted time plus the original problem remains |
| "It's an Xcode bug, let me reinstall" | Code signing is configuration, not an Xcode bug. Reinstalling doesn't change your certificates or profiles. | 2-4 hours reinstalling Xcode while the config stays broken |
| "I'll use the team provisioning profile" | Xcode's auto-managed wildcard profile lacks specific entitlements (push, App Groups). It won't work for apps needing capabilities. | 30+ min discovering missing capabilities |
| "CI worked before, nothing changed on our side" | Apple revokes certificates for security reasons. CI runner macOS updates change keychain behavior. Provisioning profiles expire after 1 year. | Hours of "but we didn't change anything" while the cert is expired |
| "Let me check the code first" | Code signing errors are NEVER code bugs. They are 100% configuration — certificates, profiles, entitlements, and keychains. | Hours debugging working code while the profile is expired |
| "Set build.keychain as default" | `security default-keychain -s build.keychain` replaces the login keychain as default, breaking access to SSH keys, saved passwords, and other credentials. Use `list-keychains -s` instead. | 30+ min restoring default keychain + mysterious SSH/credential failures |

## Mandatory First Steps

Before changing build settings or regenerating certificates, run these diagnostics:

### Step 1: Check Signing Identities

```bash
security find-identity -v -p codesigning
```

**Expected output**:
- At least one valid identity with "Apple Development" or "Apple Distribution"
- Each shows SHA-1 hash + name + Team ID

**Problems**:
- 0 valid identities → No certificates installed or all expired
- Only "Apple Development" but trying to archive → Need Distribution certificate
- Multiple entries with same name → Ambiguous identity (see Tree 5)

### Step 2: Decode Provisioning Profile

```bash
# Find the profile being used
find ~/Library/Developer/Xcode/DerivedData -name "embedded.mobileprovision" -newer . 2>/dev/null | head -3

# Decode it
security cms -D -i path/to/embedded.mobileprovision
```

**Check these fields**:
- `ExpirationDate` → Not expired?
- `DeveloperCertificates` → Contains your current certificate?
- `Entitlements` → Contains all capabilities your app uses?
- `ProvisionedDevices` → Contains your test device UDID? (Development/Ad Hoc only)
- `Name` → Matches what Xcode is configured to use?

### Step 3: Extract and Compare Entitlements

```bash
# What entitlements does the built app have?
codesign -d --entitlements - /path/to/MyApp.app

# What entitlements does the profile grant?
security cms -D -i embedded.mobileprovision | plutil -extract Entitlements xml1 -o - -

# What entitlements does Xcode's .entitlements file declare?
cat MyApp/MyApp.entitlements
```

**All three must agree.** Any mismatch → signing failure.

### Step 4: Verify Certificate in Profile

```bash
# Get certificate SHA-1 from keychain
security find-identity -v -p codesigning | grep "Apple Distribution"
# Output: 1) ABCDEF123... "Apple Distribution: Company (TEAMID)"

# Check if that certificate is embedded in the profile
security cms -D -i embedded.mobileprovision | plutil -extract DeveloperCertificates xml1 -o - -
# Decode one of the base64 certificates:
echo "<base64 data>" | base64 -d | openssl x509 -inform DER -noout -fingerprint -sha1
```

The SHA-1 from the profile must match the SHA-1 from `find-identity`.

## Decision Trees

### Tree 1: "No signing certificate found"

```dot
digraph tree1 {
    "No signing certificate?" [shape=diamond];
    "Run find-identity" [shape=box, label="security find-identity -v -p codesigning"];
    "0 identities?" [shape=diamond];
    "Has identities but wrong type?" [shape=diamond];
    "Certificate expired?" [shape=diamond];

    "Import certificate" [shape=box, label="Import .p12 into keychain\nsecurity import cert.p12 -k login.keychain-db -P pass -T /usr/bin/codesign"];
    "Download from portal" [shape=box, label="Download certificate from\nApple Developer Portal\nor use Xcode > Preferences > Accounts"];
    "Use correct cert type" [shape=box, label="Archive needs Apple Distribution\nDebug needs Apple Development\nCheck CODE_SIGN_IDENTITY"];
    "Renew certificate" [shape=box, label="Revoke expired cert in portal\nCreate new cert\nUpdate profiles to use new cert"];
    "CI keychain issue" [shape=box, label="In CI: create keychain, import cert,\nunlock, set-key-partition-list\n(see code-signing-ref CI section)"];

    "No signing certificate?" -> "Run find-identity";
    "Run find-identity" -> "0 identities?" [label="check output"];
    "0 identities?" -> "Import certificate" [label="yes, no certs at all"];
    "0 identities?" -> "Has identities but wrong type?" [label="no, has some"];
    "Has identities but wrong type?" -> "Use correct cert type" [label="yes, dev only but need dist"];
    "Has identities but wrong type?" -> "Certificate expired?" [label="no, correct type exists"];
    "Certificate expired?" -> "Renew certificate" [label="yes"];
    "Certificate expired?" -> "CI keychain issue" [label="no, cert valid but CI fails"];
    "Import certificate" -> "Download from portal" [label="don't have .p12"];
}
```

### Tree 2: "Provisioning profile doesn't include signing certificate"

```dot
digraph tree2 {
    "Profile cert mismatch?" [shape=diamond];
    "Automatic signing?" [shape=diamond];

    "Clean and retry" [shape=box, label="Xcode > Preferences > Accounts\n> Download Manual Profiles\nClean build folder (Cmd+Shift+K)"];
    "Regenerate profile" [shape=box, label="Apple Developer Portal:\n1. Edit profile\n2. Select current certificate\n3. Generate\n4. Download and install"];
    "Check cert match" [shape=box, label="Step 4: Verify certificate SHA-1\nin keychain matches SHA-1\nembedded in profile"];
    "Revoked cert" [shape=box, label="If someone regenerated the cert,\nall existing profiles are invalid.\nRegenerate profiles with new cert."];

    "Profile cert mismatch?" -> "Automatic signing?" [label="check Xcode"];
    "Automatic signing?" -> "Clean and retry" [label="yes"];
    "Automatic signing?" -> "Check cert match" [label="no, manual signing"];
    "Check cert match" -> "Regenerate profile" [label="SHA-1 mismatch"];
    "Check cert match" -> "Revoked cert" [label="cert not in profile at all"];
}
```

### Tree 3: ITMS-90035/90161 Invalid Signature/Profile

```dot
digraph tree3 {
    "Upload rejected?" [shape=diamond];
    "ITMS-90035?" [shape=diamond];
    "ITMS-90161?" [shape=diamond];
    "ITMS-90046?" [shape=diamond];

    "Wrong cert" [shape=box, label="Signed with Development cert.\nRe-archive with Apple Distribution.\nCODE_SIGN_IDENTITY = Apple Distribution"];
    "Cert expired" [shape=box, label="Certificate expired between\narchive and upload.\nRenew cert, re-archive."];
    "Profile expired" [shape=box, label="Provisioning profile expired.\nRegenerate in portal,\nre-archive."];
    "Profile mismatch" [shape=box, label="Profile doesn't match binary.\nCheck bundle ID alignment.\nVerify ExportOptions.plist."];
    "Check entitlements" [shape=box, label="Entitlement not in profile.\nAdd capability in portal,\nregenerate profile, re-archive."];

    "Upload rejected?" -> "ITMS-90035?" [label="check error code"];
    "Upload rejected?" -> "ITMS-90046?" [label="ITMS-90046"];
    "ITMS-90035?" -> "Wrong cert" [label="'Invalid Signature'"];
    "ITMS-90035?" -> "ITMS-90161?" [label="different error"];
    "ITMS-90046?" -> "Check entitlements" [label="'Invalid Entitlements'"];
    "ITMS-90161?" -> "Profile expired" [label="'Invalid Provisioning Profile'"];
    "ITMS-90161?" -> "Profile mismatch" [label="'profile doesn't match'"];
    "Wrong cert" -> "Cert expired" [label="cert IS Distribution but still fails"];
}
```

### Tree 4: errSecInternalComponent / Keychain Locked in CI

```dot
digraph tree4 {
    "errSecInternalComponent?" [shape=diamond];
    "Keychain created?" [shape=diamond];
    "Keychain unlocked?" [shape=diamond];
    "Partition list set?" [shape=diamond];
    "Search list correct?" [shape=diamond];

    "Create keychain" [shape=box, label="security create-keychain -p pass build.keychain"];
    "Unlock keychain" [shape=box, label="security unlock-keychain -p pass build.keychain"];
    "Set partition list" [shape=box, label="security set-key-partition-list\n-S apple-tool:,apple: -s\n-k pass build.keychain\n(MOST COMMON FIX)"];
    "Add to search list" [shape=box, label="security list-keychains -d user\n-s build.keychain login.keychain-db"];
    "Set timeout" [shape=box, label="security set-keychain-settings\n-t 3600 -l build.keychain\n(prevent lock during long builds)"];
    "Check runner image" [shape=box, label="Runner image may have changed.\nCheck GitHub Actions runner changelog.\nmacOS updates change keychain defaults."];

    "errSecInternalComponent?" -> "Keychain created?" [label="CI environment"];
    "Keychain created?" -> "Create keychain" [label="no"];
    "Keychain created?" -> "Keychain unlocked?" [label="yes"];
    "Keychain unlocked?" -> "Unlock keychain" [label="no"];
    "Keychain unlocked?" -> "Partition list set?" [label="yes"];
    "Partition list set?" -> "Set partition list" [label="no — this is the #1 fix"];
    "Partition list set?" -> "Search list correct?" [label="yes"];
    "Search list correct?" -> "Add to search list" [label="no — keychain not in search path"];
    "Search list correct?" -> "Set timeout" [label="yes — try extending timeout"];
    "Set timeout" -> "Check runner image" [label="still failing"];
}
```

### Tree 5: Ambiguous Identity / Multiple Certificates

```dot
digraph tree5 {
    "Ambiguous identity?" [shape=diamond];
    "Same name, different dates?" [shape=diamond];
    "Dev and Dist both present?" [shape=diamond];

    "List all" [shape=box, label="security find-identity -v -p codesigning\nNote SHA-1 hashes and expiry dates"];
    "Delete expired" [shape=box, label="Open Keychain Access\nDelete expired certificate\n(check expiry with openssl x509 -enddate)"];
    "Use SHA-1" [shape=box, label="Specify exact identity by SHA-1:\nCODE_SIGN_IDENTITY = 'SHA1HASH'\nor codesign -s 'SHA1HASH'"];
    "Specify full name" [shape=box, label="Use full identity name:\nCODE_SIGN_IDENTITY =\n'Apple Distribution: Company (TEAMID)'"];

    "Ambiguous identity?" -> "List all" [label="first"];
    "List all" -> "Same name, different dates?" [label="inspect"];
    "Same name, different dates?" -> "Delete expired" [label="yes, old + new cert"];
    "Same name, different dates?" -> "Dev and Dist both present?" [label="no"];
    "Dev and Dist both present?" -> "Specify full name" [label="yes, Xcode picks wrong one"];
    "Dev and Dist both present?" -> "Use SHA-1" [label="still ambiguous"];
}
```

### Tree 6: Entitlement Mismatch / Missing Capability

```dot
digraph tree6 {
    "Entitlement error?" [shape=diamond];
    "In Xcode but not profile?" [shape=diamond];
    "In profile but not Xcode?" [shape=diamond];

    "Run Step 3" [shape=box, label="Compare entitlements:\n1. codesign -d --entitlements - App\n2. Profile entitlements\n3. .entitlements file"];
    "Regenerate profile" [shape=box, label="Apple Developer Portal:\n1. App ID > Capabilities\n2. Enable missing capability\n3. Edit profile\n4. Generate and download"];
    "Add capability" [shape=box, label="Xcode > Target >\nSigning & Capabilities >\n+ Capability"];
    "Remove stale entitlement" [shape=box, label="Remove capability from\n.entitlements file that\nisn't supported by profile type"];

    "Entitlement error?" -> "Run Step 3" [label="diagnose"];
    "Run Step 3" -> "In Xcode but not profile?" [label="compare"];
    "In Xcode but not profile?" -> "Regenerate profile" [label="yes, capability missing from profile"];
    "In Xcode but not profile?" -> "In profile but not Xcode?" [label="no"];
    "In profile but not Xcode?" -> "Add capability" [label="yes"];
    "In profile but not Xcode?" -> "Remove stale entitlement" [label="entitlement not valid for profile type"];
}
```

## Quick Reference Table

| Symptom | Check | Fix |
|---------|-------|-----|
| No signing certificate found | `security find-identity -v -p codesigning` | Import cert or download from portal |
| Provisioning profile doesn't include cert | Step 4: SHA-1 comparison | Regenerate profile with current cert |
| ITMS-90035 Invalid Signature | `codesign -dv` on archived app | Re-archive with Apple Distribution cert |
| ITMS-90161 Invalid Provisioning Profile | `security cms -D -i` on profile | Regenerate non-expired profile |
| ITMS-90046 Invalid Entitlements | Step 3: three-way comparison | Add capability in portal, regenerate profile |
| errSecInternalComponent | CI keychain setup | `set-key-partition-list` (most common fix) |
| Ambiguous identity | `security find-identity -v` count | Delete expired cert or use SHA-1 hash |
| Entitlement mismatch | Three-way entitlement comparison | Align Xcode, profile, and .entitlements |
| Profile expired | `security cms -D` check ExpirationDate | Download fresh profile from portal |
| Profile missing push | `grep aps-environment` in profile | Enable Push in portal, regenerate profile |
| Extension signing fails | Extension target signing config | Each extension needs own profile with matching team |
| Works locally, fails CI | CI keychain script completeness | Full setup: create, unlock, import, partition list, search list |
| "codesign wants to access key" | Keychain access settings | `security set-key-partition-list` or Keychain Access > Get Info > Access Control |
| App Groups entitlement error | Three-way comparison | Add App Group in portal App ID, regenerate profile |
| Build works, export fails | ExportOptions.plist | Verify method, profile name, team ID in plist |

## Pressure Scenarios

### Scenario 1: "Just regenerate everything"

**Context**: Code signing fails. Team member suggests revoking all certificates and generating new ones to start fresh.

**Pressure**: "It'll only take 5 minutes to regenerate everything."

**Reality**: Revoking a distribution certificate invalidates ALL provisioning profiles that use it — across ALL team members and CI systems. Every developer needs new certificates. Every CI pipeline breaks. Every profile needs regeneration. The "5 minute fix" becomes a 2-4 hour team-wide outage.

**Correct action**: Diagnose the specific issue with Steps 1-4. Most signing failures are a single expired or mismatched component, not a systemic problem.

**Push-back template**: "Revoking certificates breaks signing for everyone on the team and all CI pipelines. Let me run the diagnostic steps first — 90% of signing issues are a single expired cert or mismatched profile, fixable in 5 minutes without affecting anyone else."

### Scenario 2: "Xcode updated, signing broke — rollback"

**Context**: After an Xcode update, code signing stopped working. Someone suggests rolling back Xcode.

**Pressure**: "The build worked before the update, so the update broke it."

**Reality**: Xcode updates sometimes invalidate managed signing caches or change how automatic signing selects profiles. But the certificates and profiles themselves don't change. Rolling back Xcode loses access to new SDK features and doesn't fix the underlying configuration.

**Correct action**: Run Steps 1-2 to verify certificates and profiles are still valid. Check if Xcode's automatic signing is selecting a different profile. Try: Xcode → Preferences → Accounts → Download Manual Profiles. Clean build folder.

**Push-back template**: "Xcode updates don't change our certificates or profiles. Let me check what Xcode's automatic signing is selecting now — it's likely picking a different profile than before. A 5-minute check will tell us exactly what changed."

### Scenario 3: "The archive failed, let me re-archive — it's probably corruption"

**Context**: Archive succeeded but export or upload failed. Developer wants to re-archive assuming the archive was corrupted.

**Pressure**: "Just do it again, it'll probably work this time."

**Reality**: Archive "corruption" is extremely rare. Export failures are almost always: wrong ExportOptions.plist method, wrong certificate type in the archive, or profile mismatch. Re-archiving with the same settings produces the same result.

**Correct action**: Inspect the archive before re-building:
1. `codesign -dv` on the .app inside the .xcarchive to see what signed it
2. Check ExportOptions.plist method matches intent (app-store, ad-hoc, etc.)
3. Verify the profile specified in ExportOptions exists and isn't expired

**Push-back template**: "Re-archiving with the same settings will produce the same result. Let me check what's actually in the archive — it takes 30 seconds with codesign -dv and will tell us exactly why export failed."

## Checklist

Before declaring a signing issue fixed:

- [ ] `security find-identity -v -p codesigning` shows the expected identity
- [ ] Profile decoded with `security cms -D` — not expired, contains correct cert
- [ ] Three-way entitlement comparison agrees (binary, profile, .entitlements file)
- [ ] Build/archive succeeds with correct `CODE_SIGN_IDENTITY`
- [ ] If CI: keychain created, unlocked, partition list set, cert imported
- [ ] If CI: cleanup step runs on success AND failure

## Resources

**WWDC**: 2021-10204, 2022-110353

**Docs**: /security, /bundleresources/entitlements, /xcode/distributing-your-app

**Skills**: axiom-code-signing, axiom-code-signing-ref
