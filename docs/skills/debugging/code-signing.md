# Code Signing

Workflows and discipline for iOS/macOS code signing: certificate management, provisioning profiles, entitlements, CI/CD signing setup, and distribution build preparation.

## When to Use

Use this skill when:
- Setting up code signing for a new project or CI/CD pipeline
- Debugging certificate, profile, or entitlement errors
- Configuring signing for App Store, TestFlight, or Ad Hoc distribution
- Managing certificates across a team with fastlane match
- Understanding automatic vs manual signing tradeoffs
- Adding capabilities that require entitlement changes

## Example Prompts

- "How do I set up code signing for my iOS app?"
- "Should I use automatic or manual signing?"
- "How do I set up fastlane match for my team?"
- "How do I configure code signing for GitHub Actions?"
- "My provisioning profile expired, what do I do?"
- "How do I add push notification entitlements to my profile?"

## What This Skill Provides

- Automatic vs manual signing decision tree
- Certificate types, lifecycle, and renewal workflow
- Provisioning profile patterns (Development, Ad Hoc, App Store, Enterprise)
- Entitlements configuration and capability-to-entitlement mapping
- CI/CD signing setup (raw scripts, fastlane match, Xcode Cloud)
- 4 anti-patterns with wrong/right code and time costs
- 3 pressure scenarios (disable signing, personal cert for team, commit .p12)
- Pre-archive signing validation checklist

## Documentation Scope

This page documents the `axiom-code-signing` discipline skill.

- For error troubleshooting with decision trees, see [Code Signing Diagnostics](/diagnostic/code-signing-diag)
- For CLI command reference and API details, see [Code Signing Reference](/reference/code-signing-ref)

## Related

- [Code Signing Diagnostics](/diagnostic/code-signing-diag) — Troubleshoot specific signing errors with 6 decision trees
- [Code Signing Reference](/reference/code-signing-ref) — CLI commands, Xcode build settings, error codes
- [Xcode Debugging](/skills/debugging/xcode-debugging) — Environment-first diagnostics when signing errors accompany build failures
- [App Store Submission](/skills/shipping/app-store-submission) — Pre-submission checklist including signing verification
