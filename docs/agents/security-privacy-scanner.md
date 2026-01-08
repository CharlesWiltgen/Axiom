# security-privacy-scanner

Scans for security vulnerabilities and privacy compliance issues including hardcoded credentials, insecure storage, and missing Privacy Manifests.

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

## What It Checks

### Critical (App Store Rejection Risk)
- **Hardcoded API keys** — AWS keys, OpenAI keys, GitHub tokens in source
- **Missing Privacy Manifest** — Required since May 2024 for App Store

### High Priority (Security Vulnerabilities)
- **Insecure token storage** — Auth tokens in @AppStorage/UserDefaults
- **HTTP URLs (ATS violation)** — Cleartext transmission without HTTPS

### Medium Priority (Best Practices)
- **Sensitive data in logs** — Passwords, tokens in print/Logger statements
- **Missing SSL pinning** — No certificate pinning for sensitive APIs

## Example Output

```markdown
# Security & Privacy Scan Results

## Summary
- **CRITICAL Issues**: 2 (App Store rejection risk)
- **HIGH Issues**: 3 (Security vulnerabilities)
- **MEDIUM Issues**: 1 (Best practice violations)

## App Store Readiness: NOT READY

### CRITICAL: Missing Privacy Manifest
- **Status**: PrivacyInfo.xcprivacy NOT FOUND
- **Required Reason APIs detected**:
  - `UserDefaults` in `AppConfig.swift:23`
- **Impact**: Will be rejected by App Store Connect

### CRITICAL: Hardcoded API Key
- `NetworkManager.swift:23`
  ```swift
  let apiKey = "sk-1234..."  // EXPOSED
  ```
```

## Model & Tools

- **Model**: haiku (fast credential scanning)
- **Tools**: Glob, Grep, Read
- **Color**: red

## Related

- [privacy-ux](/skills/integration/privacy-ux) — Privacy-first UX patterns
- [storage](/skills/debugging/storage) — Secure storage patterns including Keychain
