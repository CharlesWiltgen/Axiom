
# Keychain Services API Reference

Comprehensive API reference for iOS/macOS Keychain Services: SecItem CRUD functions, item class attributes, uniqueness constraints, accessibility levels, access control flags, biometric integration, and error codes.

## Quick Reference

```swift
// Add a generic password
let addQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "user@example.com",
    kSecValueData as String: "secret".data(using: .utf8)!
]
let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

// Read a generic password
let readQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "user@example.com",
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne
]
var result: AnyObject?
let readStatus = SecItemCopyMatching(readQuery as CFDictionary, &result)
let data = result as? Data

// Update a generic password
let updateQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "user@example.com"
]
let updateAttributes: [String: Any] = [
    kSecValueData as String: "newSecret".data(using: .utf8)!
]
let updateStatus = SecItemUpdate(updateQuery as CFDictionary, updateAttributes as CFDictionary)

// Delete a generic password
let deleteQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "user@example.com"
]
let deleteStatus = SecItemDelete(deleteQuery as CFDictionary)
```

---

## SecItem Functions

### SecItemAdd

```swift
func SecItemAdd(_ attributes: CFDictionary, _ result: UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus
```

**`attributes` dictionary accepts**: Item class + item attributes + value properties + return type properties.

Does NOT accept search properties (`kSecMatch*`). Providing `kSecMatchLimit` in an add query is an error.

**`result`**: Pass `nil` if you don't need the added item back. Pass a pointer to receive the item in the format specified by `kSecReturn*` keys. Pass `nil` in most cases — requesting the result back forces an extra read.

### SecItemCopyMatching

```swift
func SecItemCopyMatching(_ query: CFDictionary, _ result: UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus
```

**`query` dictionary accepts**: Item class + item attributes + search properties + return type properties.

Does NOT accept value properties (`kSecValueData`) as search criteria.

**`result`**: The type depends on which `kSecReturn*` keys are set:
- `kSecReturnData` alone → `CFData`
- `kSecReturnAttributes` alone → `CFDictionary`
- `kSecReturnRef` alone → `SecKey` / `SecCertificate` / `SecIdentity`
- `kSecReturnPersistentRef` alone → `CFData` (persistent reference)
- Multiple `kSecReturn*` keys → `CFDictionary` containing requested types
- `kSecMatchLimit = kSecMatchLimitAll` → `CFArray` of the above

### SecItemUpdate

```swift
func SecItemUpdate(_ query: CFDictionary, _ attributesToUpdate: CFDictionary) -> OSStatus
```

**`query` dictionary accepts**: Item class + item attributes + search properties. Used to find items to update.

**`attributesToUpdate` dictionary accepts**: Item attributes + value properties. These are applied to matched items. Does NOT accept item class or search properties.

Updating `kSecValueData` replaces the stored secret. Updating attributes (e.g., `kSecAttrLabel`) changes metadata without touching the secret.

### SecItemDelete

```swift
func SecItemDelete(_ query: CFDictionary) -> OSStatus
```

**`query` dictionary accepts**: Item class + item attributes + search properties.

On macOS, deletes ALL matching items by default (implicit `kSecMatchLimitAll`). On iOS, also deletes all matches. There is no confirmation — deletion is immediate.

---

## Item Classes

### kSecClassGenericPassword

General-purpose secret storage. The most commonly used class.

| Attribute | Key | Type |
|-----------|-----|------|
| Service | `kSecAttrService` | `CFString` |
| Account | `kSecAttrAccount` | `CFString` |
| Access Group | `kSecAttrAccessGroup` | `CFString` |
| Accessible | `kSecAttrAccessible` | `CFString` (constant) |
| Synchronizable | `kSecAttrSynchronizable` | `CFBoolean` |
| Label | `kSecAttrLabel` | `CFString` |
| Description | `kSecAttrDescription` | `CFString` |
| Comment | `kSecAttrComment` | `CFString` |
| Generic | `kSecAttrGeneric` | `CFData` |
| Creator | `kSecAttrCreator` | `CFNumber` (FourCharCode) |
| Type | `kSecAttrType` | `CFNumber` (FourCharCode) |
| Creation Date | `kSecAttrCreationDate` | `CFDate` (read-only) |
| Modification Date | `kSecAttrModificationDate` | `CFDate` (read-only) |

### kSecClassInternetPassword

URL-associated credentials. Rarely needed — most apps use generic passwords.

| Attribute | Key | Type |
|-----------|-----|------|
| Server | `kSecAttrServer` | `CFString` |
| Protocol | `kSecAttrProtocol` | `CFString` (constant) |
| Port | `kSecAttrPort` | `CFNumber` |
| Path | `kSecAttrPath` | `CFString` |
| Account | `kSecAttrAccount` | `CFString` |
| Authentication Type | `kSecAttrAuthenticationType` | `CFString` (constant) |
| Security Domain | `kSecAttrSecurityDomain` | `CFString` |
| Accessible | `kSecAttrAccessible` | `CFString` (constant) |
| Access Group | `kSecAttrAccessGroup` | `CFString` |
| Synchronizable | `kSecAttrSynchronizable` | `CFBoolean` |
| Label | `kSecAttrLabel` | `CFString` |
| Comment | `kSecAttrComment` | `CFString` |
| Creator | `kSecAttrCreator` | `CFNumber` (FourCharCode) |
| Type | `kSecAttrType` | `CFNumber` (FourCharCode) |

### kSecClassCertificate

X.509 certificates. Typically managed by the system, not app code.

| Attribute | Key | Type |
|-----------|-----|------|
| Subject | `kSecAttrSubject` | `CFData` (read-only) |
| Issuer | `kSecAttrIssuer` | `CFData` (read-only) |
| Serial Number | `kSecAttrSerialNumber` | `CFData` (read-only) |
| Subject Key ID | `kSecAttrSubjectKeyID` | `CFData` (read-only) |
| Public Key Hash | `kSecAttrPublicKeyHash` | `CFData` (read-only) |
| Certificate Type | `kSecAttrCertificateType` | `CFNumber` |
| Certificate Encoding | `kSecAttrCertificateEncoding` | `CFNumber` |
| Label | `kSecAttrLabel` | `CFString` |
| Access Group | `kSecAttrAccessGroup` | `CFString` |
| Synchronizable | `kSecAttrSynchronizable` | `CFBoolean` |

### kSecClassKey

Cryptographic keys (RSA, EC, AES). Used for encryption, signing, key agreement.

| Attribute | Key | Type |
|-----------|-----|------|
| Key Class | `kSecAttrKeyClass` | `CFString` (constant) |
| Application Label | `kSecAttrApplicationLabel` | `CFData` |
| Application Tag | `kSecAttrApplicationTag` | `CFData` |
| Key Type | `kSecAttrKeyType` | `CFString` (constant) |
| Key Size in Bits | `kSecAttrKeySizeInBits` | `CFNumber` |
| Effective Key Size | `kSecAttrEffectiveKeySize` | `CFNumber` |
| Permanent | `kSecAttrIsPermanent` | `CFBoolean` |
| Sensitive | `kSecAttrIsSensitive` | `CFBoolean` |
| Extractable | `kSecAttrIsExtractable` | `CFBoolean` |
| Label | `kSecAttrLabel` | `CFString` |
| Access Group | `kSecAttrAccessGroup` | `CFString` |
| Synchronizable | `kSecAttrSynchronizable` | `CFBoolean` |
| Token ID | `kSecAttrTokenID` | `CFString` |

### kSecClassIdentity

A digital identity is a certificate paired with its private key. Not a distinct storage class — the system synthesizes it from a matching certificate and key. You cannot add a `kSecClassIdentity` item directly; add the certificate and key separately. Queries return an identity when both halves share the same `kSecAttrPublicKeyHash`.

See Quinn "The Eskimo!"'s technote: "SecItem: Pitfalls and Best Practices" (forums/thread/724013) — digital identities are a virtual join, not a stored item.

---

## Uniqueness Constraints Per Class

Each keychain item is uniquely identified by a subset of its attributes. Adding a second item with the same primary key returns `errSecDuplicateItem` (-25299). Use `SecItemUpdate` to modify existing items.

| Class | Primary Key Attributes |
|-------|----------------------|
| Generic Password | `kSecAttrService` + `kSecAttrAccount` + `kSecAttrAccessGroup` + `kSecAttrSynchronizable` |
| Internet Password | `kSecAttrServer` + `kSecAttrPort` + `kSecAttrProtocol` + `kSecAttrAuthenticationType` + `kSecAttrPath` + `kSecAttrAccount` + `kSecAttrAccessGroup` + `kSecAttrSynchronizable` |
| Certificate | `kSecAttrCertificateType` + `kSecAttrIssuer` + `kSecAttrSerialNumber` + `kSecAttrAccessGroup` + `kSecAttrSynchronizable` |
| Key | `kSecAttrApplicationLabel` + `kSecAttrApplicationTag` + `kSecAttrKeyType` + `kSecAttrKeySizeInBits` + `kSecAttrEffectiveKeySize` + `kSecAttrKeyClass` + `kSecAttrAccessGroup` + `kSecAttrSynchronizable` |
| Identity | N/A (virtual join of certificate + key) |

**Consequence**: If you store tokens for multiple users under the same `kSecAttrService` without unique `kSecAttrAccount` values, `SecItemAdd` returns `errSecDuplicateItem` for the second user.

---

## Attribute Constants Reference

### Identity Attributes

| Constant | Type | Used By |
|----------|------|---------|
| `kSecAttrService` | `CFString` | GenericPassword |
| `kSecAttrAccount` | `CFString` | GenericPassword, InternetPassword |
| `kSecAttrServer` | `CFString` | InternetPassword |
| `kSecAttrLabel` | `CFString` | All classes |
| `kSecAttrDescription` | `CFString` | GenericPassword, InternetPassword |
| `kSecAttrComment` | `CFString` | GenericPassword, InternetPassword |
| `kSecAttrGeneric` | `CFData` | GenericPassword |

### Security Attributes

| Constant | Type | Used By |
|----------|------|---------|
| `kSecAttrAccessible` | `CFString` (constant) | All classes |
| `kSecAttrAccessControl` | `SecAccessControl` | All classes |
| `kSecAttrAccessGroup` | `CFString` | All classes |
| `kSecAttrSynchronizable` | `CFBoolean` | All classes |

`kSecAttrAccessible` and `kSecAttrAccessControl` are mutually exclusive. Setting both is an error — `kSecAttrAccessControl` includes an accessibility level in its creation.

### Token Attributes

| Constant | Type | Purpose |
|----------|------|---------|
| `kSecAttrTokenID` | `CFString` | Bind key to hardware token |
| `kSecAttrTokenIDSecureEnclave` | `CFString` (value) | Secure Enclave — EC keys only (256-bit) |

### Key Metadata Attributes

| Constant | Type | Values |
|----------|------|--------|
| `kSecAttrKeyType` | `CFString` | `kSecAttrKeyTypeRSA`, `kSecAttrKeyTypeECSECPrimeRandom` |
| `kSecAttrKeySizeInBits` | `CFNumber` | 256 (EC), 2048/4096 (RSA) |
| `kSecAttrKeyClass` | `CFString` | `kSecAttrKeyClassPublic`, `kSecAttrKeyClassPrivate`, `kSecAttrKeyClassSymmetric` |
| `kSecAttrApplicationTag` | `CFData` | App-defined tag for key lookup |
| `kSecAttrApplicationLabel` | `CFData` | SHA-1 hash of public key (auto-generated) |

---

## Search Properties

Used in `SecItemCopyMatching`, `SecItemUpdate` (query parameter), and `SecItemDelete` queries.

| Constant | Type | Purpose |
|----------|------|---------|
| `kSecMatchLimit` | `CFString` or `CFNumber` | Max results — `kSecMatchLimitOne`, `kSecMatchLimitAll`, or `CFNumber` for explicit integer limits (e.g., limit to 5 results) |
| `kSecMatchCaseInsensitive` | `CFBoolean` | Case-insensitive string attribute matching |

### kSecMatchLimit Defaults

The default depends on context and is a common source of bugs:

| Function | Default | Behavior |
|----------|---------|----------|
| `SecItemCopyMatching` | `kSecMatchLimitOne` | Returns first match |
| `SecItemDelete` | All matches | Deletes every matching item |

Always set `kSecMatchLimit` explicitly in `SecItemCopyMatching` to make intent clear. For `SecItemDelete`, omitting `kSecMatchLimit` deletes all matches — this is by design, not a bug.

---

## Return Type Properties

Control what `SecItemCopyMatching` and `SecItemAdd` return. Set in the query dictionary.

| Constant | Returns | Result Type |
|----------|---------|-------------|
| `kSecReturnData` | The secret (password bytes, key data) | `CFData` |
| `kSecReturnAttributes` | Item metadata dictionary | `CFDictionary` |
| `kSecReturnRef` | Keychain object reference | `SecKey`, `SecCertificate`, or `SecIdentity` |
| `kSecReturnPersistentRef` | Persistent reference (survives app relaunch) | `CFData` |

### Return Type Behavior Per Class

| Class | `kSecReturnData` | `kSecReturnRef` |
|-------|-------------------|-----------------|
| Generic Password | Password bytes | N/A (no ref type) |
| Internet Password | Password bytes | N/A (no ref type) |
| Certificate | DER-encoded certificate data | `SecCertificate` |
| Key | Key data (if extractable) | `SecKey` |
| Identity | N/A | `SecIdentity` |

### Multiple Return Types

When multiple `kSecReturn*` keys are `true`, the result is a `CFDictionary` with keys:
- `kSecValueData` → the data
- `kSecValueRef` → the ref
- `kSecValuePersistentRef` → the persistent ref
- Plus all attribute keys if `kSecReturnAttributes` is `true`

When `kSecMatchLimitAll` is set, the result is a `CFArray` of the above.

---

## Value Type Properties

Used to provide or extract values in add, query, and update dictionaries.

| Constant | Type | Purpose |
|----------|------|---------|
| `kSecValueData` | `CFData` | The secret (password, key material) |
| `kSecValueRef` | `SecKey` / `SecCertificate` / `SecIdentity` | Keychain object reference |
| `kSecValuePersistentRef` | `CFData` | Persistent reference to an item |

### Behavior Per Operation

| Property | SecItemAdd | SecItemCopyMatching | SecItemUpdate |
|----------|------------|---------------------|---------------|
| `kSecValueData` | Sets the secret | Not valid as search criteria | Replaces the secret |
| `kSecValueRef` | Adds the referenced object | Finds by reference | Not valid |
| `kSecValuePersistentRef` | Not valid | Finds by persistent ref | Not valid |

---

## Accessibility Constants

Controls when keychain items are readable. Set via `kSecAttrAccessible`.

| Constant | Available When | Survives Backup | Syncs via iCloud |
|----------|---------------|-----------------|------------------|
| `kSecAttrAccessibleWhenUnlocked` | Device unlocked | Yes | Yes (default) |
| `kSecAttrAccessibleAfterFirstUnlock` | After first unlock until reboot | Yes | Yes |
| `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` | Device unlocked + passcode set | No | No |
| `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | Device unlocked | No | No |
| `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` | After first unlock until reboot | No | No |

**Default**: `kSecAttrAccessibleWhenUnlocked` for new items.

**`ThisDeviceOnly` variants**: Item is not included in encrypted backups and does not sync via iCloud Keychain. Use for device-bound secrets (biometric-gated tokens, Secure Enclave keys).

**`WhenPasscodeSetThisDeviceOnly`**: Item is deleted if the user removes their passcode. Use for secrets that must not survive passcode removal.

**`AfterFirstUnlock`**: Available in the background after the user unlocks once post-reboot. Required for background fetch, push notification handlers, and background URLSession completions.

**Deprecated** (do not use): `kSecAttrAccessibleAlways`, `kSecAttrAccessibleAlwaysThisDeviceOnly`.

---

## SecAccessControlCreateFlags

Fine-grained access control for keychain items. Created with `SecAccessControlCreateWithFlags` and set via `kSecAttrAccessControl`.

### All Flags

| Flag | Purpose |
|------|---------|
| `.userPresence` | Any biometric OR device passcode |
| `.biometryAny` | Any enrolled biometric (survives new enrollment) |
| `.biometryCurrentSet` | Current biometric set only (invalidated if biometrics change) |
| `.devicePasscode` | Device passcode required |
| `.privateKeyUsage` | Required for Secure Enclave key signing operations |
| `.applicationPassword` | App-provided password (in addition to other factors) |
| `.watch` | Paired Apple Watch can satisfy authentication |
| `.or` | Combine flags with logical OR (any one satisfies) |
| `.and` | Combine flags with logical AND (all must satisfy) |

### Creating Access Control

```swift
var error: Unmanaged<CFError>?
guard let accessControl = SecAccessControlCreateWithFlags(
    kCFAllocatorDefault,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    [.biometryCurrentSet, .or, .devicePasscode],
    &error
) else {
    let nsError = error!.takeRetainedValue() as Error
    fatalError("Failed to create access control: \(nsError)")
}

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "auth-token",
    kSecAttrAccessControl as String: accessControl,
    kSecValueData as String: tokenData
]
let status = SecItemAdd(query as CFDictionary, nil)
```

### Flag Combinations

| Combination | Meaning |
|-------------|---------|
| `[.biometryAny]` | Any enrolled fingerprint/face |
| `[.biometryCurrentSet]` | Current fingerprint/face set (re-enroll invalidates) |
| `[.biometryCurrentSet, .or, .devicePasscode]` | Biometric OR passcode fallback |
| `[.biometryCurrentSet, .and, .applicationPassword]` | Biometric AND app password |
| `[.privateKeyUsage]` | Secure Enclave key operations (sign, decrypt) |
| `[.biometryAny, .or, .watch]` | Biometric OR paired Watch |

**`.biometryAny` vs `.biometryCurrentSet`**: Use `.biometryCurrentSet` for high-security items (banking tokens). If the user enrolls a new fingerprint, the item becomes inaccessible — your app must re-authenticate and re-store. Use `.biometryAny` for convenience items where new enrollment should not invalidate access.

---

## LocalAuthentication Integration

### LAContext with Keychain

Pre-evaluate biometrics with `LAContext`, then pass the context to the keychain query to avoid a second biometric prompt.

```swift
import LocalAuthentication

let context = LAContext()
context.localizedReason = "Access your credentials"

var authError: NSError?
guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
    // Biometrics unavailable — handle error or fall back to passcode
    return
}

context.evaluatePolicy(
    .deviceOwnerAuthenticationWithBiometrics,
    localizedReason: "Authenticate to access credentials"
) { success, error in
    guard success else { return }

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.example.app",
        kSecAttrAccount as String: "auth-token",
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
        kSecUseAuthenticationContext as String: context
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
}
```

### LAContext Keychain Keys

| Key | Type | Purpose |
|-----|------|---------|
| `kSecUseAuthenticationContext` | `LAContext` | Reuse authenticated context (avoids double prompt) |
| `kSecUseAuthenticationUI` | `CFString` | Control UI behavior: `kSecUseAuthenticationUIAllow` (default), `kSecUseAuthenticationUIFail`, `kSecUseAuthenticationUISkip` |

**`kSecUseAuthenticationUIFail`**: Returns `errSecInteractionNotAllowed` instead of showing the biometric prompt. Use to check if an item exists without triggering UI.

### LAPolicy Types

| Policy | Requires |
|--------|----------|
| `.deviceOwnerAuthenticationWithBiometrics` | Face ID or Touch ID only |
| `.deviceOwnerAuthentication` | Biometrics or passcode fallback |

### BiometryType Detection

```swift
let context = LAContext()
var error: NSError?
context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

switch context.biometryType {
case .faceID:    // Face ID available
case .touchID:   // Touch ID available
case .opticID:   // Optic ID available (visionOS)
case .none:      // No biometric hardware
@unknown default: break
}
```

### LAError Codes

| Error | Code | Cause |
|-------|------|-------|
| `.authenticationFailed` | -1 | User failed authentication |
| `.userCancel` | -2 | User tapped Cancel |
| `.userFallback` | -3 | User tapped "Enter Password" |
| `.systemCancel` | -4 | System cancelled (app backgrounded) |
| `.passcodeNotSet` | -5 | No passcode configured |
| `.biometryNotAvailable` | -6 | Hardware unavailable or restricted |
| `.biometryNotEnrolled` | -7 | No biometrics enrolled |
| `.biometryLockout` | -8 | Too many failed attempts |

---

## OSStatus Error Codes

Common keychain `OSStatus` values and their root causes.

| Error | Code | Description | Common Cause |
|-------|------|-------------|--------------|
| `errSecSuccess` | 0 | Operation succeeded | — |
| `errSecDuplicateItem` | -25299 | Item already exists | Adding with same primary key — use `SecItemUpdate` instead |
| `errSecItemNotFound` | -25300 | No matching item | Wrong query attributes or item never stored |
| `errSecInteractionNotAllowed` | -25308 | UI prompt blocked | Item requires auth but device locked, or `kSecUseAuthenticationUIFail` set |
| `errSecAuthFailed` | -25293 | Authentication failed | Wrong password, failed biometric, or ACL denied |
| `errSecMissingEntitlement` | -34018 | Missing keychain entitlement | App lacks `keychain-access-groups` entitlement — common in unit test targets |
| `errSecNoSuchAttr` | -25303 | Attribute not found | Querying an attribute not valid for the item class |
| `errSecParam` | -50 | Invalid parameter | Malformed query dictionary — check for type mismatches (e.g., String where Data expected) |
| `errSecAllocate` | -108 | Memory allocation failed | System resource exhaustion |
| `errSecDecode` | -26275 | Unable to decode data | Corrupted item or encoding mismatch |
| `errSecNotAvailable` | -25291 | Keychain not available | No keychain database (rare — Simulator reset or corrupted install) |

### Interpreting OSStatus in Swift

```swift
let status = SecItemAdd(query as CFDictionary, nil)
if status != errSecSuccess {
    let message = SecCopyErrorMessageString(status, nil) as? String ?? "Unknown error"
    print("Keychain error \(status): \(message)")
}
```

### -34018 on Test Targets

Unit test runners (XCTest) often lack the `keychain-access-groups` entitlement. Workarounds:
1. Add a Host Application to the test target (Xcode → Test Target → General → Host Application)
2. Use an in-memory mock for unit tests, real keychain for integration tests only

---

## Keychain Sharing

### Access Groups

Items are isolated per app by default. To share between apps or extensions:

1. Enable "Keychain Sharing" capability in Xcode
2. Add shared access group identifiers
3. Set `kSecAttrAccessGroup` when adding items

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.shared",
    kSecAttrAccount as String: "shared-token",
    kSecAttrAccessGroup as String: "TEAMID.com.example.shared",
    kSecValueData as String: tokenData
]
```

The access group format is `$(TeamIdentifierPrefix)$(GroupIdentifier)`. Items without an explicit access group default to the app's first access group in its entitlements.

### iCloud Keychain Sync

Set `kSecAttrSynchronizable` to `true` to sync via iCloud Keychain:

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.app",
    kSecAttrAccount as String: "sync-token",
    kSecAttrSynchronizable as String: true,
    kSecValueData as String: tokenData
]
```

Synchronizable items cannot use `ThisDeviceOnly` accessibility levels or `SecAccessControl`. They must use `kSecAttrAccessibleWhenUnlocked` or `kSecAttrAccessibleAfterFirstUnlock`.

When querying, `kSecAttrSynchronizable` defaults to `kSecAttrSynchronizableAny` (returns both local and synced items). Set explicitly to `true` or `false` to filter.

---

## Resources

**WWDC**: 2013-709, 2014-711, 2020-10147

**Docs**: /security/keychain_services, /localauthentication, /security/secaccesscontrolcreateflags, /security/secitemadd(_:_:)

**Skills**: axiom-security (skills/code-signing-ref.md), axiom-security (skills/app-attest.md)
