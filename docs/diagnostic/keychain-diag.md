# Keychain Diagnostics

Troubleshooting skill for Keychain Services errors on iOS and macOS. Diagnoses SecItem failures, lost items, and platform-specific quirks that cause keychain operations to silently fail or return unexpected errors.

## Symptoms This Diagnoses

Use when you're experiencing:
- `errSecDuplicateItem` (-25299) when saving to the keychain
- `errSecItemNotFound` (-25300) when reading items you previously stored
- `errSecInteractionNotAllowed` (-25308) from background or locked-device access
- Keychain items disappearing after app reinstall, device migration, or backup restore
- Items working on device but failing in the Simulator
- Mac Catalyst or macOS shim behavior differences from iOS
- Biometric prompt not appearing or always failing
- Access group configuration not sharing items between targets

## Example Prompts

- "Why am I getting errSecDuplicateItem when I save a token?"
- "My keychain items disappear after reinstalling the app"
- "Keychain reads work on device but fail in the Simulator"
- "errSecInteractionNotAllowed in a background task"
- "Why can't my widget read keychain items the main app saved?"
- "Face ID prompt never appears for my keychain item"

## Diagnostic Workflow

The skill walks through a structured triage process:

1. **Identify the error code** — Maps OSStatus codes to human-readable causes
2. **Check the query dictionary** — Validates required attributes and catches missing keys that cause silent failures
3. **Verify environment** — Tests for Simulator limitations, background execution restrictions, and device-vs-Mac differences
4. **Inspect access configuration** — Confirms accessibility level, access groups, and access control flags match the execution context
5. **Test isolation** — Narrows root cause by simplifying the query to minimum required attributes

## Related

- [Keychain](/skills/security/keychain) — Discipline skill for building correct keychain workflows from the start
- [Keychain Reference](/reference/keychain-ref) — SecItem API details, attribute constants, and error code table
