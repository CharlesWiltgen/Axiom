# Passkeys

Discipline skill for implementing passkey-based authentication on iOS. Covers the full passkey lifecycle from registration through assertion, AutoFill integration, automatic password-to-passkey upgrades, and migrating existing password-based accounts.

## When to Use

Use this skill when:
- Adding passkey sign-in to an iOS app
- Implementing the WebAuthn server-side ceremony (registration and assertion)
- Integrating passkeys with AutoFill credential suggestions
- Setting up automatic passkey upgrades from existing passwords
- Planning a migration strategy from password-only to passkey authentication
- Debugging ASAuthorization errors or credential creation failures
- Supporting cross-platform passkey flows (iOS to web, Android interop)

## Example Prompts

- "How do I add passkey sign-in to my app?"
- "How does the passkey registration flow work?"
- "How do I integrate passkeys with AutoFill?"
- "Can I automatically upgrade users from passwords to passkeys?"
- "How do I handle passkey assertion on the server?"
- "What's the migration strategy from passwords to passkeys?"
- "Why is ASAuthorizationController failing silently?"

## What This Skill Provides

- Complete passkey lifecycle: registration (attestation), assertion (authentication), and credential management
- Registration and assertion ceremony flows with client and server responsibilities
- AutoFill credential provider integration with `ASAuthorizationController`
- Automatic upgrade workflows that convert password sign-ins to passkeys transparently
- Migration strategy for apps with existing password-based accounts (phased rollout)
- Associated domains configuration for the webcredentials service
- Anti-patterns with user experience impact (forcing passkeys without fallback, skipping credential discovery)
- Pressure scenarios for common shortcuts (skipping server-side validation, ignoring cross-platform users)

## Documentation Scope

This page documents the `axiom-security` discipline skill. The discipline skill provides end-to-end workflows and decision guidance for passkey implementation, not API-level details.

## Related

- [Keychain](/skills/security/keychain) — Credentials stored in the keychain alongside passkeys; shared access group configuration applies to both
