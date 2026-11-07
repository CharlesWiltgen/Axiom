# Passkeys

Guidance for passkey sign-in in iOS apps, from registration through assertion: AutoFill-assisted requests, automatic upgrades from passwords, combined credential requests, and migrating existing password accounts.

## When to Use

Use this skill when:
- Adding passkey sign-in to an iOS app
- Configuring `ASAuthorizationController` for passkey registration and assertion
- Putting passkeys in the QuickType bar with AutoFill-assisted requests
- Setting up automatic passkey upgrades for existing password users (iOS 18+)
- Offering passkeys, passwords, and Sign in with Apple in one combined request
- Configuring associated domains for the `webcredentials` service
- Planning a phased migration from passwords to passkeys
- Debugging passkey assertion failures or missing QuickType suggestions

## Example Prompts

- "How do I add passkey sign-in to my app?"
- "My passkeys aren't showing in the QuickType bar."
- "What's the difference between `performRequests` and `performAutoFillAssistedRequests`?"
- "Can I automatically upgrade users from passwords to passkeys?"
- "How do I support both passkeys and passwords during migration?"
- "How do I set up associated domains for passkeys?"
- "I keep getting `ASAuthorizationError.canceled`. What's going wrong?"
- "My password manager fills emailed codes. How do I prompt the user to add that email account to Mail first?" (iOS 27.3)

## What This Skill Provides

- Registration and assertion flows, including what your app sends to your server's WebAuthn endpoints
- AutoFill-assisted requests (`performAutoFillAssistedRequests`) as the primary sign-in path, with the modal sheet as the fallback
- Automatic upgrades (iOS 18+) that quietly add a passkey after a password sign-in
- Combined credential requests for passkeys, passwords, and Sign in with Apple
- Cross-device sign-in by QR code, with Bluetooth as the proximity check
- Associated domains setup, including the apple-app-site-association file
- A three-phase migration from password-only accounts, plus Passwords app integration
- Delivered verification codes for credential-provider apps (new in the 27 releases; not on watchOS or tvOS), which offer one-time codes delivered to the device for AutoFill, plus `presentAccountsToSetUp(_:reason:anchor:)` (iOS, macOS, and visionOS 27.3), which asks the user to add an email account to Mail before a sign-in or password change that will send codes to it
- Anti-patterns: `performRequests` for the primary sign-in, a username field without the `.username` content type, `userVerification` set to `"required"`, creating passkeys from an extension, and passkey-only requests that lock out password users
- Pressure scenarios for common shortcuts: "our users aren't ready for passkeys" and "ship passwords now, add passkeys later"

## Documentation Scope

This page documents the `passkeys` skill (in the `axiom-security` suite).

## Related

- [Keychain](/skills/security/keychain) – storing the session tokens your server issues after a passkey sign-in
