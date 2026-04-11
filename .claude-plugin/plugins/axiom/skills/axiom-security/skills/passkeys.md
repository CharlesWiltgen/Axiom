
# Passkeys

Passkey authentication for iOS apps — registration, assertion, AutoFill-assisted requests, automatic upgrades, combined credential flows, and migration from password-based auth.

## When to Use This Skill

Use when you need to:
- ☑ Add passkey sign-in to an iOS app
- ☑ Replace password-based authentication with passkeys
- ☑ Configure ASAuthorizationController for passkey registration or assertion
- ☑ Set up AutoFill-assisted passkey requests (QuickType bar)
- ☑ Add automatic passkey upgrades for existing password users (iOS 18+)
- ☑ Support combined credential requests (passkey + password + Sign in with Apple)
- ☑ Configure associated domains for webauthn/webcredentials
- ☑ Debug passkey assertion failures or missing QuickType suggestions

## Example Prompts

"How do I add passkey sign-in to my app?"
"My passkeys aren't showing in the QuickType bar"
"How do I migrate existing password users to passkeys?"
"ASAuthorizationError.canceled — what's going wrong?"
"How do I support both passkeys and passwords during migration?"
"How do I set up associated domains for passkeys?"
"What's the difference between performRequests and performAutoFillAssistedRequests?"
"How do I add automatic passkey upgrades on iOS 18?"

## Red Flags

Signs you're heading in the wrong direction:

- ❌ Still using passwords as primary auth when passkeys are available — Passkeys are not "extra security." They are the replacement. Every password-only sign-in is a phishing opportunity you're leaving open.
- ❌ Not annotating the username field with `.username` textContentType — Without this, the system can't associate the field with passkey credentials. AutoFill won't suggest passkeys for unlabeled fields.
- ❌ Using `performRequests()` for the primary sign-in flow — this shows a modal sheet instead of putting passkeys in the QuickType bar. Use `performAutoFillAssistedRequests()` for the primary path. Reserve `performRequests()` for registration and explicit "Sign In" button taps.
- ❌ Setting `userVerification` to `"required"` on the server — This prevents sign-in on devices without biometrics. The platform handles verification appropriately per device. Use `"preferred"` (the default).
- ❌ Creating passkeys in an extension or non-main-app context — Passkey creation requires the main app target. Extensions can perform assertions but not registrations.
- ❌ Not supporting combined credential requests — During migration, users may have a passkey, a password, or neither. A single ASAuthorizationController handles all three. Offering only passkeys locks out users who haven't upgraded.

## Why Passkeys

Passkeys are not an incremental improvement over passwords. They are a replacement architecture.

**Phishing-proof**: Each passkey is cryptographically bound to a specific domain. A fake login page on `secure-myapp.com` cannot trigger a passkey created for `myapp.com`. There is no credential to type into the wrong site.

**No credential database to leak**: The server stores only a public key. A breach exposes nothing usable — no password hashes to crack, no shared secrets to replay.

**Single-tap sign-in**: Face ID or Touch ID replaces typing. Registration and assertion are both one-tap flows.

**FIDO Alliance standard**: WebAuthn/CTAP2 protocol. Works across Apple, Google, and Microsoft platforms. Passkeys created on iPhone sync via iCloud Keychain and work on Mac, iPad, and the web.

**Adoption**: Apple ships passkeys as a first-class system feature. iCloud Keychain syncs them. The Passwords app manages them. Third-party credential managers (1Password, Dashlane) support them natively as of iOS 17.

## Associated Domains Setup

Passkeys require an associated domain linking your app to your server. Without this, the system won't offer passkeys for your app.

### 1. Add the Entitlement

In Xcode: Target > Signing & Capabilities > + Associated Domains.

Add:
```
webcredentials:example.com
```

### 2. Host the AASA File

Serve `/.well-known/apple-app-site-association` from your domain over HTTPS with `Content-Type: application/json`:

```json
{
  "webcredentials": {
    "apps": [
      "TEAMID.com.example.myapp"
    ]
  }
}
```

**Requirements**:
- HTTPS with a valid certificate (no self-signed)
- No redirects — the file must be served directly at the path
- `TEAMID` is your Apple Developer Team ID, not the bundle ID prefix
- The file must be at the root domain, not a subdirectory

### 3. Verify

```bash
curl -s "https://example.com/.well-known/apple-app-site-association" | python3 -m json.tool
```

Apple's CDN caches the AASA file. Changes can take up to 24 hours to propagate. During development, enable Associated Domains Development in Developer Settings on the device and use the `?mode=developer` query parameter.

## Registration Flow

Registration creates a new passkey and stores it in the user's credential manager.

```swift
import AuthenticationServices

func registerPasskey(challenge: Data, userName: String, userID: Data) {
    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        relyingPartyIdentifier: "example.com"
    )

    let request = provider.createCredentialRegistrationRequest(
        challenge: challenge,
        name: userName,
        userID: userID
    )

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
}
```

**Key parameters**:
- `relyingPartyIdentifier` — Must match your associated domain (no `https://` prefix)
- `challenge` — Server-generated cryptographic challenge (use at least 16 random bytes). Never reuse challenges.
- `name` — Display name shown to the user in the passkey prompt and Passwords app
- `userID` — Opaque identifier for the user account. Do not use email or username — use a random UUID or server-side user ID

### Handling the Registration Response

```swift
func authorizationController(controller: ASAuthorizationController,
                             didCompleteWithAuthorization authorization: ASAuthorization) {
    guard let credential = authorization.credential
        as? ASAuthorizationPlatformPublicKeyCredentialRegistration else { return }

    let attestationObject = credential.rawAttestationObject
    let clientDataJSON = credential.rawClientDataJSON
    let credentialID = credential.credentialID

    // Send attestationObject, clientDataJSON, credentialID to your server
    // Server validates and stores the public key
}
```

Registration uses `performRequests()` (modal) because the user explicitly chose to create a passkey. This is the one place where modal presentation is correct.

## Assertion Flow (Sign-In)

Two paths for sign-in, each for a different UX context.

### AutoFill-Assisted (Primary Path)

The preferred sign-in flow. Passkeys appear in the QuickType bar when the user taps a text field with `.username` content type. Single-tap sign-in with no modal interruption.

```swift
func signInWithAutoFill() {
    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        relyingPartyIdentifier: "example.com"
    )

    let request = provider.createCredentialAssertionRequest(
        challenge: serverChallenge
    )

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performAutoFillAssistedRequests()
}
```

**Critical details**:
- Call `performAutoFillAssistedRequests()` early — before the user focuses the username field. Call it in `viewDidAppear` or when the sign-in view appears.
- The username `UITextField` must have `.textContentType = .username` set. Without this, the QuickType bar won't show passkey suggestions.
- Do not set `allowedCredentials` on the request. AutoFill needs to show all available passkeys for the domain.
- The request stays active until the user selects a credential, navigates away, or you cancel it.

### Modal (Fallback Path)

Use when the user taps a "Sign In" button explicitly, or when you know the username and want to request a specific credential.

```swift
func signInWithModal(allowedCredentials: [ASAuthorizationPlatformPublicKeyCredentialDescriptor]? = nil) {
    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        relyingPartyIdentifier: "example.com"
    )

    let request = provider.createCredentialAssertionRequest(
        challenge: serverChallenge
    )

    if let allowedCredentials {
        request.allowedCredentials = allowedCredentials
    }

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
}
```

Use `allowedCredentials` when you know the user's credential IDs (e.g., the user typed their username and your server returned their registered credential IDs). This narrows the passkey selection to that account.

### Handling the Assertion Response

```swift
func authorizationController(controller: ASAuthorizationController,
                             didCompleteWithAuthorization authorization: ASAuthorization) {
    guard let credential = authorization.credential
        as? ASAuthorizationPlatformPublicKeyCredentialAssertion else { return }

    let signature = credential.signature
    let clientDataJSON = credential.rawClientDataJSON
    let authenticatorData = credential.rawAuthenticatorData
    let credentialID = credential.credentialID
    let userID = credential.userID

    // Send to server for verification
}
```

## Automatic Passkey Upgrades (iOS 18+)

Silently upgrade password users to passkeys without interrupting their flow. The system shows a brief notification confirming the upgrade — no modal, no extra taps.

### How It Works

When a user signs in with a password, the system can automatically create a passkey for the same account. This happens when:
1. The credential manager supports automatic upgrades
2. The user just successfully authenticated with a password for the same account
3. Your app requests a conditional registration

### Implementation

```swift
func requestAutomaticUpgrade(challenge: Data, userName: String, userID: Data) {
    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        relyingPartyIdentifier: "example.com"
    )

    let request = provider.createCredentialRegistrationRequest(
        challenge: challenge,
        name: userName,
        userID: userID
    )
    request.requestStyle = .conditional

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performAutoFillAssistedRequests()
}
```

**Key detail**: `.requestStyle = .conditional` makes the registration opportunistic. It will succeed silently when conditions are right and fail silently when they're not. Do not treat the failure callback as an error — it means conditions weren't met this time.

**When to call**: After the user successfully authenticates with a password. Check first whether the user already has a passkey for this account — don't request an upgrade if they do.

### Server Requirements

Your server must be prepared for an asynchronous registration that arrives shortly after a password sign-in. The `userID` and `challenge` must be valid and associated with the session.

## Combined Credential Requests

During migration, your users may have passkeys, passwords, or Sign in with Apple credentials. A single ASAuthorizationController handles all three.

```swift
func signInWithCombinedRequest() {
    var requests: [ASAuthorizationRequest] = []

    // Passkey assertion
    let passkeyProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        relyingPartyIdentifier: "example.com"
    )
    requests.append(
        passkeyProvider.createCredentialAssertionRequest(challenge: serverChallenge)
    )

    // Password
    let passwordProvider = ASAuthorizationPasswordProvider()
    requests.append(passwordProvider.createRequest())

    // Sign in with Apple
    let appleIDProvider = ASAuthorizationAppleIDProvider()
    requests.append(appleIDProvider.createRequest())

    let controller = ASAuthorizationController(authorizationRequests: requests)
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performAutoFillAssistedRequests()
}
```

### Handling Multiple Credential Types

```swift
func authorizationController(controller: ASAuthorizationController,
                             didCompleteWithAuthorization authorization: ASAuthorization) {
    switch authorization.credential {
    case let credential as ASAuthorizationPlatformPublicKeyCredentialAssertion:
        // Passkey sign-in — verify with server
        handlePasskeyAssertion(credential)

    case let credential as ASPasswordCredential:
        // Password sign-in — verify, then offer passkey upgrade
        handlePasswordSignIn(credential)

    case let credential as ASAuthorizationAppleIDCredential:
        // Apple ID sign-in
        handleAppleIDSignIn(credential)

    default:
        break
    }
}
```

After a successful password sign-in, call the automatic upgrade flow to progressively migrate users to passkeys.

## Cross-Device Sign-In

Users can sign in on a device that doesn't have their passkey by using their phone as an authenticator.

**How it works**:
1. Your app presents a passkey assertion request
2. The system shows a QR code on the device requesting sign-in
3. The user scans the QR code with their phone (which has the passkey)
4. Bluetooth proximity verification confirms the phone is physically nearby
5. The user authenticates with Face ID/Touch ID on their phone
6. The assertion completes on the original device

**No app changes required**. This is a system-level feature. Any device that supports passkeys can act as a cross-device authenticator. The communication is end-to-end encrypted through an Apple relay server.

**Bluetooth required**: Both devices must have Bluetooth enabled. This is the proximity check that prevents remote phishing — the authenticating device must be physically near the requesting device.

## Migration Strategy

### Phase 1 — Add Passkey Support Alongside Passwords

Keep existing password auth. Add passkey registration and assertion. Use combined credential requests so both paths work.

**Server changes**: Add WebAuthn endpoints for registration and assertion. Store public keys alongside password hashes. Both auth methods validate to the same user session.

**App changes**: Implement registration flow (offer after password sign-in), assertion flow (AutoFill-assisted), and combined requests.

### Phase 2 — Automatic Upgrades (iOS 18+)

Add conditional registration requests after password sign-ins. Users silently migrate to passkeys over time. Track upgrade metrics to measure adoption.

No user action required. The system handles the upgrade transparently.

### Phase 3 — Reduce Phishable Factors

For accounts with passkeys, consider:
- Removing password reset flows (passkeys don't need them)
- Dropping SMS 2FA (passkeys are inherently two-factor: device possession + biometric)
- Offering account recovery via passkey on another device instead of email/SMS

Do not force-remove passwords. Let users choose to go passwordless. Some users need password access from devices that don't support passkeys.

### Passwords App Integration (iOS 18+)

The Passwords app displays your app's name and icon using OpenGraph metadata from your associated domain. Add to your website's `<head>`:

```html
<meta property="og:title" content="MyApp" />
<meta property="og:image" content="https://example.com/icon.png" />
```

This is how your app appears in the user's credential manager. Without it, the Passwords app shows only the domain name.

## Anti-Rationalization

| Rationalization | Reality | Time Cost |
|----------------|---------|-----------|
| "Passwords are fine for now" | Every password sign-in is a phishing vector. Credential stuffing attacks cost real money — the average breach costs $4.5M. Passkeys eliminate the entire attack surface. | Ongoing risk vs 2-3 days to implement |
| "We'll add passkeys later" | AutoFill-assisted passkey requests are the same amount of integration work as a custom password text field with AutoFill. You're not saving time by deferring. | Same implementation effort either way |
| "Users won't understand passkeys" | Users don't need to understand public-key cryptography. They see "Sign in with Face ID" — one tap. Apple, Google, and Microsoft are shipping passkeys as the default across all platforms. | 0 extra user education needed |
| "Our server doesn't support WebAuthn" | Server-side WebAuthn libraries exist for every major backend (Python, Node, Go, Ruby, Java, .NET). Most are well-tested and actively maintained. | 1-2 days server-side integration |
| "What about users without biometrics?" | Device passcode is a valid user verification method. Every supported device has at least a passcode. Setting `userVerification` to `"preferred"` lets the platform handle this correctly. | 0 extra work — platform handles it |
| "We need password as fallback forever" | Combined credential requests support passwords and passkeys simultaneously. Use automatic upgrades to progressively migrate. You can keep passwords indefinitely while passkeys become primary. | No forced choice — run both |

## Pressure Scenarios

### Scenario 1: "Our users aren't ready for passkeys"

**Context**: Product manager pushes back on passkey adoption, citing user confusion risk.

**Pressure**: "Our users are not technical. They won't understand what a passkey is. Let's stick with passwords and add passkeys next year."

**Reality**: Apple ships passkeys as a built-in system feature across every platform — iPhone, iPad, Mac, Apple Watch, Windows via cross-device auth. Users see "Sign in with Face ID" in the QuickType bar. They do not see "WebAuthn CTAP2 public-key credential." The Passwords app manages passkeys alongside passwords transparently. Apple's own account system, Google accounts, and Microsoft accounts all use passkeys. Your users are already using them elsewhere.

**Correct action**: Implement combined credential requests. Existing password users keep signing in with passwords. Passkeys appear automatically for users whose credential managers support them. Add automatic upgrades (iOS 18+) to progressively migrate without user action.

**Push-back template**: "Users don't need to understand passkeys. They see 'Sign in with Face ID' — one tap, done. Apple, Google, and Amazon already use passkeys for their own sign-in. We add it alongside passwords, so nobody's flow changes. Users who get passkeys automatically get a better experience; everyone else continues as before."

### Scenario 2: "Just ship password auth now, add passkeys later"

**Context**: Deadline pressure on a new app. Developer wants to defer passkey support to a post-launch update.

**Pressure**: "We need to ship by Friday. Password auth works. We'll add passkeys in the next sprint."

**Reality**: Implementing AutoFill-assisted passkey requests is comparable in effort to building a polished password text field with AutoFill support, secure storage, and "forgot password" flows. You're building the ASAuthorizationController integration either way — the question is whether you wire up one provider (passwords) or three (passkeys + passwords + Apple ID). Combined requests add ~30 lines to the delegate.

**Correct action**: Implement combined credential requests from the start. The server needs WebAuthn endpoints, but client-side the work is nearly identical. Shipping with passkey support from day one means you never have to retrofit it, and you avoid the "next sprint" that turns into "next quarter."

**Push-back template**: "AutoFill-assisted passkeys use the same ASAuthorizationController we'd use for password AutoFill. Adding passkey support is ~30 lines in the delegate — not a sprint of work. Shipping without it means we build the password flow now and rebuild the auth flow later to add passkeys. Let's do it once."

## Checklist

Before shipping passkey authentication:

**Associated Domains**:
- [ ] `webcredentials:yourdomain.com` added to Associated Domains capability
- [ ] AASA file served at `/.well-known/apple-app-site-association` over HTTPS
- [ ] AASA file contains correct Team ID and bundle identifier
- [ ] No redirects on the AASA file path
- [ ] AASA changes propagated (or developer mode enabled for testing)

**Registration**:
- [ ] Server generates unique challenge per registration attempt
- [ ] `userID` is opaque (not email or username)
- [ ] `relyingPartyIdentifier` matches associated domain exactly
- [ ] Registration uses `performRequests()` (modal — correct for explicit creation)
- [ ] Server stores credentialID and public key after successful registration

**Assertion (Sign-In)**:
- [ ] Username text field has `.textContentType = .username`
- [ ] AutoFill-assisted request called early (before field focus)
- [ ] AutoFill path uses `performAutoFillAssistedRequests()`
- [ ] Modal fallback available via `performRequests()` for explicit sign-in button
- [ ] `allowedCredentials` not set on AutoFill-assisted requests
- [ ] Server validates signature, authenticatorData, and clientDataJSON

**Combined Requests** (if supporting multiple auth methods):
- [ ] Passkey, password, and Apple ID providers all included
- [ ] Delegate handles all credential types in switch statement
- [ ] Password sign-in triggers automatic passkey upgrade flow

**Automatic Upgrades** (iOS 18+):
- [ ] Registration request uses `.requestStyle = .conditional`
- [ ] Upgrade request uses `performAutoFillAssistedRequests()`
- [ ] Failure callback treated as "conditions not met" — not an error
- [ ] Existing passkey checked before requesting upgrade

**Error Handling**:
- [ ] `ASAuthorizationError.canceled` handled gracefully (user dismissed — not an error)
- [ ] `ASAuthorizationError.failed` logged with context for debugging
- [ ] Network failures during server verification don't leave auth in inconsistent state

## Resources

**WWDC**: 2022-10092, 2024-10125

**Docs**: /authenticationservices, /authenticationservices/public-private-key-authentication/supporting-passkeys

**Skills**: axiom-security (skills/keychain.md)
