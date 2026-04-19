# security-privacy-scanner

Automatically scans for security and privacy issues — both known anti-patterns and missing/incomplete patterns that cause App Store rejections, security vulnerabilities, and privacy violations.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my code for security issues?"
- "I need to prepare for App Store security review"
- "Are there any hardcoded credentials in my codebase?"
- "Do I need a Privacy Manifest?"
- "Check if I'm storing tokens securely"

**Explicit command:**
```bash
/axiom:audit security
# or
/axiom:audit privacy
```

## What It Does

Maps your security and privacy posture (Privacy Manifest presence, credential storage pattern, network transport, logging discipline, ATT usage, export compliance), then detects and reasons about:

### Critical (App Store Rejection or Credential Exposure)
- **Hardcoded API keys** — AWS keys, OpenAI keys, GitHub tokens extractable from binary
- **Missing Privacy Manifest** — Required Reason APIs used without declaration (App Store Connect blocks since May 2024)
- **ATT API without usage description** — Runtime crash + automatic rejection
- **Missing usage descriptions** for privacy-sensitive APIs that are actually called (runtime crash)

### High (Security Vulnerabilities)
- **Insecure token storage** — Auth tokens in `@AppStorage`/UserDefaults, backup-extractable
- **HTTP URLs / ATS violations** — Cleartext credential transit
- **Sensitive data in logs** — Credentials in sysdiagnose, crash reports, support tooling
- **Missing Keychain migration path** — Upgrade users still carry plaintext tokens
- **Third-party SDK manifests missing** — Bundled SDKs without their own PrivacyInfo.xcprivacy
- **Missing export compliance declaration** — Submission blocked when using CryptoKit/CommonCrypto

### Medium (Best Practices)
- **Missing SSL pinning** for sensitive endpoints (payments, health, enterprise)
- **Weak Keychain ACL** — Tokens with `.kSecAttrAccessibleAlways` or `.AfterFirstUnlock` instead of `.WhenUnlockedThisDeviceOnly`
- **Unused entitlements** — Expanded attack surface (Keychain sharing, App Groups, iCloud, HealthKit claimed but not used)
- **Missing snapshot protection** — Task switcher snapshot exposes sensitive screens
- **Raw user IDs in analytics** — PII sent to third-party services

### Privacy Manifest Coverage
Cross-references every Required Reason API detected in code against declarations in `PrivacyInfo.xcprivacy` — flags partial coverage that causes rejection.

### Compound Findings
Findings that intersect carry elevated severity — e.g., hardcoded API key + HTTP endpoint means the key transmits in cleartext; insecure token storage + no Keychain migration path means every upgrade user remains exposed.

### Security Posture
Overall security rating: **HARDENED / GAPS / VULNERABLE** based on credentials, manifest status, token storage, network transport, logging hygiene, ATT compliance, export compliance, and entitlement scope.

## Related

- [privacy-ux](/reference/privacy-ux) — Privacy-first UX patterns
- [storage](/reference/storage) — Secure storage patterns including Keychain
- **iap-auditor** agent — Adjacent receipt-validation security concerns
- **storage-auditor** agent — Compound with insecure token storage findings
- **networking-auditor** agent — Compound with HTTP endpoints carrying auth
