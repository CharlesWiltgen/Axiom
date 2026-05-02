---
name: axiom-security
description: Use when storing credentials securely, encrypting data, implementing passkeys, code signing, or managing certificates and provisioning profiles.
license: MIT
---

# Security & Credentials

**You MUST use this skill for ANY keychain, encryption, passkey, app integrity, file protection, or code signing work.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| Store tokens, passwords, API keys securely | See `skills/keychain.md` |
| Choose kSecAttrAccessible level, biometric protection | See `skills/keychain.md` |
| SecItem function signatures, attribute constants | See `skills/keychain-ref.md` |
| errSecDuplicateItem, errSecItemNotFound, errSecInteractionNotAllowed | See `skills/keychain-diag.md` |
| Encrypt data, sign payloads, key management | See `skills/cryptokit.md` |
| Hash functions, HMAC, AES-GCM, ChaChaPoly, ECDSA, EdDSA, key agreement | See `skills/cryptokit-ref.md` |
| Passkey sign-in, WebAuthn, ASAuthorizationController | See `skills/passkeys.md` |
| App integrity verification, DCAppAttestService | See `skills/app-attest.md` |
| NSFileProtection levels, data protection at rest | See `skills/file-protection-ref.md` |
| Certificate management, provisioning profiles, CI/CD signing | See `skills/code-signing.md` |
| Certificate not found, profile mismatch, entitlement errors | See `skills/code-signing-diag.md` |
| Certificate CLI, profile inspection, entitlement extraction | See `skills/code-signing-ref.md` |
| Apple Pay payment certs / pass type certs / Tap to Pay entitlement | See `axiom-payments` suite |

## Decision Tree

```dot
digraph security {
    start [label="Security task" shape=ellipse];
    what [label="What do you need?" shape=diamond];

    start -> what;
    what -> "skills/keychain.md" [label="store/retrieve\ncredentials, tokens,\nsecrets"];
    what -> "skills/keychain-ref.md" [label="SecItem API syntax,\nattribute constants,\naccess levels"];
    what -> "skills/keychain-diag.md" [label="keychain errors\n(errSec codes)"];
    what -> "skills/cryptokit.md" [label="encrypt data,\nsign payloads,\nSecure Enclave keys"];
    what -> "skills/cryptokit-ref.md" [label="CryptoKit API\n(AES, ECDSA, HPKE,\npost-quantum)"];
    what -> "skills/passkeys.md" [label="passkey sign-in,\nreplace passwords"];
    what -> "skills/app-attest.md" [label="app integrity,\nfraud prevention"];
    what -> "skills/file-protection-ref.md" [label="file encryption,\nNSFileProtection"];
    what -> "skills/code-signing.md" [label="set up signing,\nprofiles, CI/CD"];
    what -> "skills/code-signing-diag.md" [label="signing errors,\nupload rejections"];
    what -> "skills/code-signing-ref.md" [label="CLI commands,\nprofile inspection"];
}
```

1. Store tokens, passwords, API keys securely? → `skills/keychain.md`
1a. Need SecItem function signatures, attribute constants? → `skills/keychain-ref.md`
1b. Keychain errors (errSecDuplicateItem, errSecItemNotFound)? → `skills/keychain-diag.md`
2. Encrypt data, sign payloads, manage keys? → `skills/cryptokit.md`
2a. Need CryptoKit API details (AES-GCM, ECDSA, HPKE, post-quantum)? → `skills/cryptokit-ref.md`
3. Implement passkey sign-in, replace passwords? → `skills/passkeys.md`
4. Verify app integrity, prevent fraud? → `skills/app-attest.md`
5. File encryption at rest, NSFileProtection levels? → `skills/file-protection-ref.md`
6. Set up code signing, manage certificates, CI/CD? → `skills/code-signing.md`
6a. Code signing error troubleshooting? → `skills/code-signing-diag.md`
6b. Certificate CLI commands, profile inspection? → `skills/code-signing-ref.md`
7. Build/upload failures after signing? → See axiom-build
8. App Store submission prep? → `/skill axiom-shipping`
9. Privacy manifests, tracking transparency? → See axiom-integration
10. Data persistence (SwiftData, Core Data, storage strategy)? → `/skill axiom-data`
11. TLS configuration, certificate pinning for network requests? → `/skill axiom-networking`
12. Want automated security scan? → security-privacy-scanner (Agent)

## Conflict Resolution

**security vs axiom-build**: When build fails with signing errors:
- Code signing errors (certificate, profile, entitlement) → **use security**
- Environment issues (Xcode version, simulator, Derived Data) → **use axiom-build**
- If unsure, check the error message: `CODESIGN`, `ITMS-90xxx`, `errSec` → **security**

**security vs shipping**: When preparing for App Store:
- Privacy manifests, submission checklists, rejections → **use shipping**
- Code signing for distribution, certificate management → **use security**

**security vs axiom-data**: When storing sensitive data:
- Tokens, passwords, API keys → **use security** (keychain)
- User preferences, non-sensitive settings → **use axiom-data** (UserDefaults/SwiftData)
- File encryption levels for database files → **use security** (file-protection-ref)

**security vs axiom-networking**: When securing network communication:
- TLS configuration, certificate pinning → **use axiom-networking**
- Signing API requests, encrypting payloads → **use security** (CryptoKit)

## Critical Patterns

**Keychain** (`skills/keychain.md`):
- SecItem mental model: uniqueness constraints, data protection classes
- Biometric access control (Face ID / Touch ID)
- Keychain sharing between app and extensions
- Background access pitfalls, Mac keychain differences
- Migration from UserDefaults/@AppStorage for sensitive data

**Keychain API** (`skills/keychain-ref.md`):
- SecItemAdd/CopyMatching/Update/Delete signatures
- Item class attributes, uniqueness constraint rules
- kSecAttrAccessible levels and when each applies
- Access control flags, biometric integration
- Complete error code reference

**Keychain Diagnostics** (`skills/keychain-diag.md`):
- errSecDuplicateItem from unexpected uniqueness constraints
- errSecItemNotFound despite item existing (query mismatch)
- errSecInteractionNotAllowed in background contexts
- Access group and entitlement mismatches
- Items disappearing after app updates

**CryptoKit** (`skills/cryptokit.md`):
- AES-GCM and ChaChaPoly authenticated encryption
- ECDSA/EdDSA digital signatures
- Secure Enclave hardware-backed keys
- Key agreement (ECDH) for end-to-end encryption
- HPKE for modern asymmetric encryption
- Post-quantum algorithms (ML-KEM, ML-DSA)
- CommonCrypto migration path

**CryptoKit API** (`skills/cryptokit-ref.md`):
- Hash functions (SHA-256/384/512, SHA-3), HMAC
- Symmetric encryption (AES-GCM, ChaChaPoly)
- Asymmetric signing (P256, P384, P521, Curve25519, Ed25519)
- Key agreement, key derivation (HKDF)
- Secure Enclave key creation and usage
- Swift Crypto cross-platform parity

**Passkeys** (`skills/passkeys.md`):
- ASAuthorizationController registration and assertion flows
- AutoFill-assisted requests (QuickType bar integration)
- Automatic passkey upgrades for existing users (iOS 18+)
- Combined credential requests (passkey + password + Sign in with Apple)
- Associated domains configuration for WebAuthn

**App Attest** (`skills/app-attest.md`):
- DCAppAttestService attestation and assertion flows
- Server-side validation of attestation objects
- DeviceCheck 2-bit per-device state
- Gradual rollout strategies for large install bases
- Handling unsupported devices gracefully

**File Protection** (`skills/file-protection-ref.md`):
- NSFileProtection levels (complete, completeUnlessOpen, afterFirstUnlock, none)
- Hardware-accelerated encryption tied to device passcode
- Background file access requirements
- Keychain vs file protection comparison

**Code Signing** (`skills/code-signing.md`):
- Automatic vs manual signing tradeoffs
- Certificate and profile management across teams
- fastlane match for team-wide certificate sharing
- CI/CD signing setup (GitHub Actions, Xcode Cloud)
- Distribution build preparation (App Store, TestFlight, Ad Hoc)

**Code Signing Diagnostics** (`skills/code-signing-diag.md`):
- Certificate issues (expired, missing, wrong type, revoked)
- Provisioning profile issues (expired, missing cert, wrong App ID)
- Entitlement mismatches (capability in Xcode but not in profile)
- Keychain issues in CI (locked keychain, errSecInternalComponent)
- Archive/export failures (wrong export method, wrong cert type)

**Code Signing CLI** (`skills/code-signing-ref.md`):
- `security find-identity`, `security cms -D` for profile inspection
- `codesign -d --entitlements` for entitlement extraction
- Certificate types, validity periods, per-account limits
- fastlane match commands and Keychain management

## Automated Scanning

**Security audit** → Launch `security-privacy-scanner` agent (scans for hardcoded credentials, insecure token storage, Privacy Manifest coverage gaps, ATS violations, missing ATT descriptions, missing export compliance, weak Keychain ACLs, and compound rejection risks; scores posture HARDENED/GAPS/VULNERABLE)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll store the token in UserDefaults for now" | UserDefaults is a plist file readable by any process with file access. Keychain takes 10 lines. `skills/keychain.md` shows the pattern. |
| "My app doesn't need encryption" | If you store any user data at rest, iOS file protection is free. `skills/file-protection-ref.md` covers protection levels. |
| "CommonCrypto works fine, no need to migrate" | CommonCrypto is C API with manual memory management and no compile-time safety. CryptoKit prevents buffer overflows and key misuse. |
| "I'll just use automatic signing" | Automatic signing works until CI, team scaling, or capability changes break it. Understand manual signing before you need it. `skills/code-signing.md` covers both. |
| "Passkeys are too new, passwords are fine" | Passkeys are phishing-resistant and supported since iOS 16. The migration path supports both simultaneously. `skills/passkeys.md` shows combined flows. |
| "I'll regenerate all certificates to fix this" | Regenerating revokes existing certs and breaks every teammate's build. Diagnose first. `skills/code-signing-diag.md` has the diagnostic flow. |
| "App Attest is overkill for my app" | If your app has any server-verified purchase, promotion, or competitive feature, tampered clients will exploit it. `skills/app-attest.md` covers gradual rollout. |
| "I'll use @unchecked Sendable on my crypto wrapper" | Hiding thread-safety issues from the compiler in security code is how data corruption happens. See axiom-concurrency for safe patterns. |
| "kSecAttrAccessibleAlways is fine" | Deprecated since iOS 12. Items are accessible even when device is locked and unencrypted during backup. Use kSecAttrAccessibleAfterFirstUnlock at minimum. |

## Example Invocations

User: "How do I store an auth token securely?"
→ Read: `skills/keychain.md`

User: "errSecDuplicateItem when saving to keychain"
→ Read: `skills/keychain-diag.md`

User: "What are the SecItem attribute constants?"
→ Read: `skills/keychain-ref.md`

User: "How do I encrypt user data with AES?"
→ Read: `skills/cryptokit.md`

User: "What's the CryptoKit API for ECDSA signing?"
→ Read: `skills/cryptokit-ref.md`

User: "How do I add passkey sign-in to my app?"
→ Read: `skills/passkeys.md`

User: "How do I verify my app hasn't been tampered with?"
→ Read: `skills/app-attest.md`

User: "What NSFileProtection level should I use?"
→ Read: `skills/file-protection-ref.md`

User: "My build fails with 'No signing certificate found'"
→ Read: `skills/code-signing-diag.md`

User: "How do I set up fastlane match for CI?"
→ Read: `skills/code-signing.md`

User: "How do I inspect a provisioning profile?"
→ Read: `skills/code-signing-ref.md`

User: "Scan my code for security issues"
→ Invoke: `security-privacy-scanner` agent
