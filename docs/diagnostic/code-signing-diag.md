# Code Signing Diagnostics

Systematic troubleshooting for code signing failures: missing certificates, provisioning profile mismatches, Keychain issues in CI, entitlement conflicts, and App Store upload rejections.

## Symptoms This Diagnoses

Use when you're experiencing:
- "No signing certificate found" during build or archive
- "Provisioning profile doesn't include signing certificate"
- ITMS-90035 Invalid Signature when uploading to App Store
- ITMS-90161 Invalid Provisioning Profile
- errSecInternalComponent in CI (GitHub Actions, Bitrise, etc.)
- Ambiguous identity — multiple certificates match
- Entitlement mismatch or missing capability errors
- Code signing works locally but fails in CI
- Archive succeeds but export or upload fails

## Example Prompts

- "My build fails with 'No signing certificate found'"
- "ITMS-90035 when I try to upload to App Store Connect"
- "errSecInternalComponent in my GitHub Actions workflow"
- "Code signing works on my machine but fails in CI"
- "Multiple certificates match — ambiguous identity"
- "Entitlement not allowed by provisioning profile"

## Diagnostic Workflow

The skill uses a 4-step mandatory diagnostic flow before any fix:

1. **Check signing identities** — `security find-identity -v -p codesigning`
2. **Decode provisioning profile** — `security cms -D -i embedded.mobileprovision`
3. **Extract and compare entitlements** — three-way comparison (binary, profile, .entitlements file)
4. **Verify certificate in profile** — SHA-1 hash match between keychain and profile

Six decision trees then map specific errors to root causes: certificate not found, profile mismatch, ITMS upload errors, Keychain issues in CI, ambiguous identity, and entitlement mismatch.

## Documentation Scope

This page documents the `axiom-security` diagnostic skill. The full decision trees and diagnostic steps are in the skill file — Claude accesses them automatically when you describe a signing error.

- For setup guidance and anti-patterns, see [Code Signing](/skills/debugging/code-signing)
- For CLI command reference, see [Code Signing Reference](/reference/code-signing-ref)

## Related

- [Code Signing](/skills/debugging/code-signing) — Workflows, anti-patterns, and setup guidance
- [Code Signing Reference](/reference/code-signing-ref) — CLI commands, error codes, fastlane match setup
- [Xcode Debugging](/skills/debugging/xcode-debugging) — Environment-first diagnostics for build failures
- [App Store Diagnostics](/diagnostic/app-store-diag) — Rejection troubleshooting (non-signing rejections)
