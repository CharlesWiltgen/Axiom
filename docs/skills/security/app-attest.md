# App Attest

Discipline skill for verifying app integrity and preventing fraud on iOS. Covers Apple's App Attest service (DeviceCheck framework), server-side attestation validation, and assertion workflows for securing API calls against tampered or re-signed binaries.

## When to Use

Use this skill when:
- Protecting server APIs from requests by modified or re-signed app binaries
- Implementing app integrity verification with App Attest
- Setting up DeviceCheck to flag devices without identifying users
- Building server-side validation for attestation objects and assertions
- Planning a rollout strategy for App Attest (handling unsupported devices gracefully)
- Evaluating risk metrics for fraud detection alongside attestation

## Example Prompts

- "How do I add App Attest to my iOS app?"
- "How do I validate an attestation object on my server?"
- "What happens on devices that don't support App Attest?"
- "How do I use assertions to protect individual API calls?"
- "What's the difference between App Attest and DeviceCheck?"
- "How do I roll out App Attest without breaking existing users?"

## What This Skill Provides

- 3-step attestation lifecycle: key generation, attestation, and assertion
- Server-side validation workflow for attestation objects (certificate chain, receipt verification)
- Assertion flow for protecting individual API requests after initial attestation
- Rollout strategy for gradual adoption with fallback for unsupported devices
- Risk metrics and scoring approach for combining attestation with behavioral signals
- DeviceCheck integration for per-device flags without user identity
- Anti-patterns with fraud impact (client-only validation, skipping assertion after attest, hardcoded risk thresholds)
- Pressure scenarios for common shortcuts (shipping without server validation, ignoring attestation failures)

## Documentation Scope

This page documents the `axiom-security` discipline skill. The discipline skill provides lifecycle workflows, rollout planning, and anti-rationalization guidance for app integrity verification.

## Related

- [CryptoKit](/skills/security/cryptokit) — Cryptographic primitives used in attestation and assertion signature verification
