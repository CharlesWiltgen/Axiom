---
name: audit-security
description: Scan for hardcoded API keys, insecure storage, missing Privacy Manifests, ATS violations
---

# audit-security

Scan the codebase for security and privacy issues that risk credential exposure or App Store rejection.

## What This Command Does

Launches the **security-privacy-scanner** agent to find credentials checked into source, sensitive data stored in the wrong place, missing Privacy Manifests required by iOS 17+, and ATS violations.

## What It Checks

1. **API keys in code** — credential-shaped strings (npm, AWS, Anthropic, OpenAI, Bearer tokens) anywhere in tracked files
2. **Insecure storage** — tokens or PII in `UserDefaults`/`@AppStorage` instead of the Keychain
3. **Missing Privacy Manifests** — `PrivacyInfo.xcprivacy` not present for SDKs that require declarations
4. **ATS violations** — `NSAllowsArbitraryLoads` or per-domain exceptions without justification
5. **Logging sensitive data** — `print`/`os_log` calls that emit tokens, emails, or other PII to the system log

## Related Agent

- [security-privacy-scanner](/agents/security-privacy-scanner) — The agent that powers this command
