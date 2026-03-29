---
name: axiom-cryptokit-ref
description: Use when needing CryptoKit API details — hash functions (SHA2/SHA3), HMAC, AES-GCM/ChaChaPoly encryption, ECDSA/EdDSA signatures, ECDH key agreement, ML-KEM/ML-DSA post-quantum algorithms, HPKE encryption, Secure Enclave key types, key representations (raw/DER/PEM/x963), or Swift Crypto cross-platform parity. Covers complete CryptoKit API surface.
license: MIT
---

# CryptoKit API Reference

Complete API reference for Apple CryptoKit: hashing, HMAC, symmetric encryption, key agreement, digital signatures, post-quantum cryptography, HPKE, Secure Enclave, key derivation, and Swift Crypto cross-platform parity.

## Quick Reference

```swift
import CryptoKit

// Generate a symmetric key
let key = SymmetricKey(size: .bits256)

// AES-GCM encrypt
let sealed = try AES.GCM.seal(plaintext, using: key)
let combined = sealed.combined!  // nonce + ciphertext + tag

// AES-GCM decrypt
let sealedBox = try AES.GCM.SealedBox(combined: combined)
let decrypted = try AES.GCM.open(sealedBox, using: key)

// ECDSA sign (P256)
let signingKey = P256.Signing.PrivateKey()
let signature = try signingKey.signature(for: data)
let valid = signingKey.publicKey.isValidSignature(signature, for: data)

// Secure Enclave key
let seKey = try SecureEnclave.P256.Signing.PrivateKey()
let seSignature = try seKey.signature(for: data)
```

---

## Hashing

### Hash Functions

| Algorithm | Type | Output Size | Use |
|-----------|------|-------------|-----|
| SHA256 | SHA256 | 32 bytes | General purpose, most common |
| SHA384 | SHA384 | 48 bytes | TLS, certificate chains |
| SHA512 | SHA512 | 64 bytes | High-security contexts |
| SHA3_256 | SHA3_256 | 32 bytes | NIST post-quantum companion |
| SHA3_384 | SHA3_384 | 48 bytes | Post-quantum companion |
| SHA3_512 | SHA3_512 | 64 bytes | Post-quantum companion |
| Insecure.MD5 | Insecure.MD5 | 16 bytes | Legacy interop only |
| Insecure.SHA1 | Insecure.SHA1 | 20 bytes | Legacy interop only |

### Single-Call Hashing

```swift
let digest = SHA256.hash(data: data)
// digest conforms to Sequence of UInt8
let hex = digest.map { String(format: "%02x", $0) }.joined()
```

### Streaming (Incremental) Hashing

```swift
var hasher = SHA256()
hasher.update(data: chunk1)
hasher.update(data: chunk2)
hasher.update(bufferPointer: unsafePointer)
let digest = hasher.finalize()  // SHA256Digest
```

### HashFunction Protocol

All hash types conform to `HashFunction` with: `byteCount`, `blockByteCount`, `init()`, `update(data:)`, `update(bufferPointer:)`, `finalize()`, and `hash(data:)`.

Digest conforms to `Sequence` (of `UInt8`), supports constant-time `==`, and converts to `Data(digest)` or `Array(digest)`. `description` returns hex string.

---

## Message Authentication (HMAC)

### SymmetricKey

```swift
let key = SymmetricKey(size: .bits128)                          // .bits128, .bits192, .bits256
let key = SymmetricKey(size: SymmetricKeySize(bitCount: 512))   // Custom size
let key = SymmetricKey(data: existingKeyData)                   // From existing material

key.bitCount                                  // Key size in bits
key.withUnsafeBytes { bytes in /* ... */ }    // Only way to access raw bytes
```

### HMAC Generation and Verification

```swift
// HMAC is generic over HashFunction
let authCode = HMAC<SHA256>.authenticationCode(for: data, using: key)
// authCode: HMAC<SHA256>.MAC

let valid = HMAC<SHA256>.isValidAuthenticationCode(authCode, authenticating: data, using: key)

// Data representation
let macData = Data(authCode)
```

### Iterative HMAC

```swift
var hmac = HMAC<SHA256>(key: key)
hmac.update(data: chunk1)
hmac.update(data: chunk2)
let authCode = hmac.finalize()
```

---

## Symmetric Encryption

### AES-GCM

```swift
// Seal (encrypt + authenticate)
let sealed = try AES.GCM.seal(plaintext, using: key)
let sealed = try AES.GCM.seal(plaintext, using: key, nonce: customNonce)
let sealed = try AES.GCM.seal(
    plaintext,
    using: key,
    nonce: customNonce,
    authenticating: associatedData  // AAD — authenticated but not encrypted
)

// SealedBox properties
sealed.nonce        // AES.GCM.Nonce (12 bytes)
sealed.ciphertext   // Data
sealed.tag          // Data (16 bytes)
sealed.combined     // Data? (nonce + ciphertext + tag)

// Open (decrypt + verify)
let plaintext = try AES.GCM.open(sealedBox, using: key)
let plaintext = try AES.GCM.open(sealedBox, using: key, authenticating: associatedData)
```

### AES-GCM SealedBox Construction

```swift
// From combined representation (nonce + ciphertext + tag)
let box = try AES.GCM.SealedBox(combined: combinedData)

// From components
let box = try AES.GCM.SealedBox(
    nonce: AES.GCM.Nonce(data: nonceData),
    ciphertext: ciphertextData,
    tag: tagData
)
```

### AES-GCM Nonce

```swift
let nonce = AES.GCM.Nonce()                    // Random 12 bytes (recommended)
let nonce = try AES.GCM.Nonce(data: nonceData) // Custom (MUST be unique per key)
```

### ChaChaPoly

Identical interface to AES-GCM. Preferred for software-only environments without AES-NI.

```swift
let sealed = try ChaChaPoly.seal(plaintext, using: key)
let sealed = try ChaChaPoly.seal(plaintext, using: key, authenticating: aad)

let plaintext = try ChaChaPoly.open(sealed, using: key)
let plaintext = try ChaChaPoly.open(sealed, using: key, authenticating: aad)

// SealedBox, Nonce — same pattern as AES.GCM
let box = try ChaChaPoly.SealedBox(combined: combined)
let nonce = ChaChaPoly.Nonce()
```

### AES Key Wrapping

```swift
// Wrap a key with another key (RFC 3394)
let wrapped = try AES.KeyWrap.wrap(keyToWrap, using: wrappingKey)
// wrapped: Data

// Unwrap
let unwrapped = try AES.KeyWrap.unwrap(wrapped, using: wrappingKey)
// unwrapped: SymmetricKey
```

---

## Key Agreement (ECDH)

### Supported Curves

| Curve | Type Prefix | Key Size | Use |
|-------|-------------|----------|-----|
| Curve25519 | Curve25519.KeyAgreement | 32 bytes | Modern, fast, safe defaults |
| P-256 | P256.KeyAgreement | 32 bytes | NIST standard, Secure Enclave |
| P-384 | P384.KeyAgreement | 48 bytes | Higher security NIST |
| P-521 | P521.KeyAgreement | 66 bytes | Maximum NIST security |

### Private Key Creation

```swift
let privateKey = Curve25519.KeyAgreement.PrivateKey()   // Random
let privateKey = P256.KeyAgreement.PrivateKey()          // Random
let privateKey = P256.KeyAgreement.PrivateKey(compactRepresentable: true)

// From serialized representations
let privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: rawData)
let privateKey = try P256.KeyAgreement.PrivateKey(derRepresentation: derData)
let privateKey = try P256.KeyAgreement.PrivateKey(pemRepresentation: pemString)
let privateKey = try P256.KeyAgreement.PrivateKey(x963Representation: x963Data)  // NIST only
```

### Public Key Representations

```swift
let publicKey = privateKey.publicKey
publicKey.rawRepresentation              // Data (all curves)
publicKey.derRepresentation              // Data — SubjectPublicKeyInfo (all curves)
publicKey.pemRepresentation              // String (all curves)
publicKey.x963Representation             // Data — uncompressed point (NIST only)
publicKey.compactRepresentation          // Data? (NIST only)
publicKey.compressedRepresentation       // Data (NIST only)
```

### Shared Secret Derivation

```swift
let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: peerPublicKey)
// sharedSecret: SharedSecret — NOT directly usable as a key

// Derive symmetric key with HKDF
let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
    using: SHA256.self,
    salt: saltData,           // Can be empty Data()
    sharedInfo: infoData,     // Context/label data
    outputByteCount: 32       // Key size
)

// Derive with X9.63 KDF
let symmetricKey = sharedSecret.x963DerivedSymmetricKey(
    using: SHA256.self,
    sharedInfo: infoData,
    outputByteCount: 32
)
```

---

## Signatures (ECDSA/EdDSA)

### Supported Algorithms

| Curve | Algorithm | Type Prefix |
|-------|-----------|-------------|
| Curve25519 | Ed25519 (EdDSA) | Curve25519.Signing |
| P-256 | ECDSA | P256.Signing |
| P-384 | ECDSA | P384.Signing |
| P-521 | ECDSA | P521.Signing |

### Key Creation

```swift
let privateKey = P256.Signing.PrivateKey()
let privateKey = Curve25519.Signing.PrivateKey()

// Same representation constructors as KeyAgreement keys:
// init(rawRepresentation:), init(derRepresentation:),
// init(pemRepresentation:), init(x963Representation:) for NIST curves
```

### Sign and Verify

```swift
// Sign raw data
let signature = try privateKey.signature(for: data)

// Sign a digest (skip re-hashing already-hashed data)
let digest = SHA256.hash(data: data)
let signature = try privateKey.signature(for: digest)  // NIST curves only

// Verify
let valid = privateKey.publicKey.isValidSignature(signature, for: data)
let valid = privateKey.publicKey.isValidSignature(signature, for: digest)
```

### Signature Representations

```swift
// NIST curves (P256/P384/P521)
signature.derRepresentation  // Data — use for cross-platform interop
signature.rawRepresentation  // Data — r || s concatenated

// Reconstruct from DER
let sig = try P256.Signing.ECDSASignature(derRepresentation: derData)
let sig = try P256.Signing.ECDSASignature(rawRepresentation: rawData)

// Curve25519 — raw bytes only (64 bytes, no DER)
signature.rawRepresentation
```

### Cross-Platform Encoding

Use `derRepresentation` when exchanging signatures with non-CryptoKit systems (OpenSSL, Java, Go). Use `rawRepresentation` for CryptoKit-to-CryptoKit or when wire size matters (DER adds 6-8 bytes overhead).

---

## Post-Quantum Cryptography: ML-KEM

Key Encapsulation Mechanism based on Module-Lattice (FIPS 203). iOS 26+.

### Parameter Sets

| Type | Security Level | Public Key | Ciphertext | Shared Secret |
|------|---------------|------------|------------|---------------|
| MLKEM768 | 128-bit (AES-128 equivalent) | 1,184 bytes | 1,088 bytes | 32 bytes |
| MLKEM1024 | 256-bit (AES-256 equivalent) | 1,568 bytes | 1,568 bytes | 32 bytes |

### Key Generation

```swift
let privateKey = MLKEM768.PrivateKey()
let publicKey = privateKey.publicKey

let privateKey = MLKEM1024.PrivateKey()
```

### Encapsulation and Decapsulation

```swift
// Sender: encapsulate with recipient's public key
let result = try recipientPublicKey.encapsulate()
// result.sharedSecret: SymmetricKey (32 bytes)
// result.encapsulated: Data (ciphertext to send)

// Recipient: decapsulate with private key
let sharedSecret = try privateKey.decapsulate(result.encapsulated)
// sharedSecret: SymmetricKey — matches sender's sharedSecret
```

### Key Representations

```swift
// Public key
publicKey.rawRepresentation                // Data

// Private key
privateKey.seedRepresentation              // Data (compact seed)
privateKey.integrityCheckedRepresentation  // Data (seed + SHA3-256 hash)

// Reconstruct
let pk = try MLKEM768.PrivateKey(seedRepresentation: seedData, publicKey: publicKey)
let pk = try MLKEM768.PrivateKey(integrityCheckedRepresentation: data)
```

---

## Post-Quantum Cryptography: ML-DSA

Digital Signature Algorithm based on Module-Lattice (FIPS 204). iOS 26+.

### Parameter Sets

| Type | Security Level | Public Key | Signature |
|------|---------------|------------|-----------|
| MLDSA65 | 128-bit | 1,952 bytes | 3,309 bytes |
| MLDSA87 | 256-bit | 2,592 bytes | 4,627 bytes |

### Key Generation

```swift
let privateKey = MLDSA65.PrivateKey()
let publicKey = privateKey.publicKey

let privateKey = MLDSA87.PrivateKey()
```

### Sign and Verify

```swift
// Sign — returns Data (not a typed Signature struct)
let signatureData = try privateKey.signature(for: data)

// Sign with context (domain separation)
let signatureData = try privateKey.signature(for: data, context: contextData)

// Verify — takes DataProtocol for signature parameter
let valid = publicKey.isValidSignature(signatureData, for: data)
let valid = publicKey.isValidSignature(signatureData, for: data, context: contextData)
```

### Key and Signature Representations

```swift
// Public key
publicKey.rawRepresentation

// Private key
privateKey.seedRepresentation
privateKey.integrityCheckedRepresentation

// Reconstruct
let pk = try MLDSA65.PrivateKey(seedRepresentation: seedData, publicKey: publicKey)
let pk = try MLDSA65.PrivateKey(integrityCheckedRepresentation: data)

// Signature is raw Data — no typed Signature struct
// Store/transmit signatureData directly
```

---

## Hybrid Post-Quantum: X-Wing KEM

Combines ML-KEM768 + Curve25519 ECDH for hybrid post-quantum key exchange. If either algorithm holds, the combined scheme holds. iOS 26+.

```swift
let privateKey = XWingMLKEM768X25519.PrivateKey()
let publicKey = privateKey.publicKey

// Encapsulate
let result = try publicKey.encapsulate()
// result.sharedSecret, result.encapsulated

// Decapsulate
let sharedSecret = try privateKey.decapsulate(result.encapsulated)

// Representations
publicKey.rawRepresentation
privateKey.seedRepresentation
privateKey.integrityCheckedRepresentation
```

---

## HPKE (Hybrid Public Key Encryption)

Hybrid Public Key Encryption (RFC 9180). Combines KEM + KDF + AEAD into a single encryption scheme. iOS 17+ (classical ciphersuites). Post-quantum ciphersuites (XWing) require iOS 26+.

### Predefined Ciphersuites

| Ciphersuite | KEM | KDF | AEAD |
|-------------|-----|-----|------|
| `.XWingMLKEM768X25519_SHA256_AES_GCM_256` | X-Wing | HKDF-SHA256 | AES-256-GCM |
| `.Curve25519_SHA256_ChachaPoly` | Curve25519 | HKDF-SHA256 | ChaCha20Poly1305 |
| `.P256_SHA256_AES_GCM_256` | P-256 | HKDF-SHA256 | AES-256-GCM |
| `.P384_SHA384_AES_GCM_256` | P-384 | HKDF-SHA384 | AES-256-GCM |
| `.P521_SHA512_AES_GCM_256` | P-521 | HKDF-SHA512 | AES-256-GCM |

### Custom Ciphersuite Composition

```swift
let ciphersuite = HPKE.Ciphersuite(
    kem: .Curve25519_HKDF_SHA256,
    kdf: .HKDF_SHA256,
    aead: .AES_GCM_128
)
```

#### KEM Options

`.Curve25519_HKDF_SHA256`, `.P256_HKDF_SHA256`, `.P384_HKDF_SHA384`, `.P521_HKDF_SHA512`, `.XWingMLKEM768X25519` (iOS 26+)

#### KDF Options

`.HKDF_SHA256`, `.HKDF_SHA384`, `.HKDF_SHA512`

#### AEAD Options

`.AES_GCM_128`, `.AES_GCM_256`, `.chaChaPoly`, `.exportOnly`

### Sender (Encrypt)

```swift
var sender = try HPKE.Sender(
    recipientKey: recipientPublicKey,
    ciphersuite: .Curve25519_SHA256_ChachaPoly,
    info: infoData                    // Binding context (can be empty)
)

let ciphertext = try sender.seal(plaintext)
let ciphertext = try sender.seal(plaintext, authenticating: aad)

let encapsulatedKey = sender.encapsulatedKey  // Send alongside ciphertext

// Export secret (for key derivation without encryption)
let exported = try sender.exportSecret(context: ctx, outputByteCount: 32)
```

### Recipient (Decrypt)

```swift
var recipient = try HPKE.Recipient(
    privateKey: recipientPrivateKey,
    ciphersuite: .Curve25519_SHA256_ChachaPoly,
    info: infoData,
    encapsulatedKey: encapsulatedKey   // From sender
)

let plaintext = try recipient.open(ciphertext)
let plaintext = try recipient.open(ciphertext, authenticating: aad)

let exported = try recipient.exportSecret(context: ctx, outputByteCount: 32)
```

### Additional Modes

Both Sender and Recipient accept optional authentication and PSK parameters:

```swift
// Authenticated mode — proves sender identity
var sender = try HPKE.Sender(
    recipientKey: recipientPublicKey, ciphersuite: ciphersuite, info: infoData,
    authenticatedBy: senderPrivateKey
)
var recipient = try HPKE.Recipient(
    privateKey: recipientPrivateKey, ciphersuite: ciphersuite, info: infoData,
    encapsulatedKey: encapsulatedKey, authenticatedBy: senderPublicKey
)

// PSK mode — adds pre-shared key binding
// Add to either Sender or Recipient init:
//   presharedKey: psk,                 // SymmetricKey
//   presharedKeyIdentifier: pskID      // Data
```

### HPKE Error Types

```swift
HPKE.Errors.inconsistentParameters          // Ciphersuite/key mismatch
HPKE.Errors.inconsistentCiphersuiteAndKey   // Key type doesn't match KEM
HPKE.Errors.exportOnlyMode                  // Seal/open called in export-only mode
HPKE.Errors.inconsistentPSKInputs           // PSK and PSK ID must both be provided or neither
HPKE.Errors.expectedPSK                     // PSK mode requires PSK
HPKE.Errors.unexpectedPSK                   // Non-PSK mode given PSK
HPKE.Errors.outOfRangeSequenceNumber        // Sequence number overflow
HPKE.Errors.ciphertextTooShort              // Ciphertext shorter than tag size
```

---

## Secure Enclave

Hardware-backed key storage. Keys never leave the Secure Enclave chip. Device-bound and non-exportable.

### Availability Check

```swift
SecureEnclave.isAvailable  // false on Simulator, true on devices with SE
```

### Supported Key Types

| Type | Use |
|------|-----|
| `SecureEnclave.P256.Signing.PrivateKey` | ECDSA signatures |
| `SecureEnclave.P256.KeyAgreement.PrivateKey` | ECDH key agreement |
| `SecureEnclave.MLKEM768.PrivateKey` | Post-quantum KEM (iOS 26+) |
| `SecureEnclave.MLKEM1024.PrivateKey` | Post-quantum KEM (iOS 26+) |
| `SecureEnclave.MLDSA65.PrivateKey` | Post-quantum signatures (iOS 26+) |
| `SecureEnclave.MLDSA87.PrivateKey` | Post-quantum signatures (iOS 26+) |

### Key Creation

```swift
let key = try SecureEnclave.P256.Signing.PrivateKey()  // Default access control

// With biometric access control
let accessControl = SecAccessControlCreateWithFlags(
    nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    [.privateKeyUsage, .biometryCurrentSet], nil
)!
let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: accessControl)

// With pre-prompted biometric context
let context = LAContext()
context.localizedReason = "Sign transaction"
let key = try SecureEnclave.P256.Signing.PrivateKey(
    accessControl: accessControl, authenticationContext: context
)
```

### Persistence and Usage

```swift
// dataRepresentation is an opaque device-bound blob — store in Keychain
let wrapped = key.dataRepresentation
let restored = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: wrapped)
let restored = try SecureEnclave.P256.Signing.PrivateKey(
    dataRepresentation: wrapped, authenticationContext: context
)

// SE keys use the same sign/verify/agree API as software keys
let signature = try seKey.signature(for: data)
let valid = seKey.publicKey.isValidSignature(signature, for: data)
let publicKeyData = seKey.publicKey.derRepresentation  // Public key IS exportable
```

---

## Key Derivation (HKDF)

HMAC-based Key Derivation Function (RFC 5869).

### One-Step Derivation

```swift
let derivedKey = HKDF<SHA256>.deriveKey(
    inputKeyMaterial: SymmetricKey(data: ikm),
    salt: saltData,                  // Optional, can be empty
    info: infoData,                  // Context/label
    outputByteCount: 32
)
// derivedKey: SymmetricKey
```

### Two-Step (Extract + Expand)

Use two-step when deriving multiple keys from the same input: extract once, expand with different `info` values.

```swift
let prk = HKDF<SHA256>.extract(inputKeyMaterial: SymmetricKey(data: ikm), salt: saltData)
let encKey = HKDF<SHA256>.expand(pseudoRandomKey: prk, info: Data("enc".utf8), outputByteCount: 32)
let macKey = HKDF<SHA256>.expand(pseudoRandomKey: prk, info: Data("mac".utf8), outputByteCount: 32)
```

---

## Error Types

### CryptoKitError

```swift
CryptoKitError.incorrectKeySize          // Key size doesn't match algorithm
CryptoKitError.incorrectParameterSize    // Parameter size invalid
CryptoKitError.authenticationFailure     // GCM/ChaCha tag verification failed, HMAC mismatch
CryptoKitError.underlyingCoreCryptoError(error:)  // Low-level failure
CryptoKitError.wrapFailure              // AES key wrap failed
CryptoKitError.unwrapFailure            // AES key unwrap failed
```

### CryptoKitASN1Error

```swift
CryptoKitASN1Error.invalidASN1Object           // Malformed ASN.1 structure
CryptoKitASN1Error.invalidASN1IntegerEncoding   // Bad integer encoding
CryptoKitASN1Error.truncatedASN1Field           // Data ends prematurely
CryptoKitASN1Error.invalidFieldIdentifier       // Unknown ASN.1 tag
CryptoKitASN1Error.unexpectedFieldType          // Wrong ASN.1 type
CryptoKitASN1Error.invalidObjectIdentifier      // Bad OID
CryptoKitASN1Error.invalidPEMDocument           // PEM header/footer or Base64 invalid
```

### HPKE and KEM Errors

```swift
// HPKE.Errors — see HPKE section for full list of 8 cases
HPKE.Errors.inconsistentParameters
HPKE.Errors.ciphertextTooShort
// ... (6 more)

// KEM.Errors (iOS 26+)
KEM.Errors.publicKeyMismatchDuringInitialization
KEM.Errors.invalidSeed
```

---

## Swift Crypto Cross-Platform Parity

Apple's open-source [swift-crypto](https://github.com/apple/swift-crypto) provides CryptoKit APIs on Linux, Windows, and other platforms.

### Import Difference

```swift
#if canImport(CryptoKit)
import CryptoKit
#else
import Crypto  // swift-crypto package
#endif
```

### API Parity

Everything maps 1:1 except `SecureEnclave.*` (requires Apple hardware). Hashing, HMAC, AES-GCM, ChaChaPoly, ECDH, ECDSA/EdDSA, ML-KEM, ML-DSA, X-Wing, HPKE, HKDF, and AES Key Wrap are all available cross-platform.

```swift
// Package.swift
.package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0")
// Target: .product(name: "Crypto", package: "swift-crypto")
```

---

## Resources

**WWDC**: 2019-709, 2024-10120

**Docs**: /cryptokit, /cryptokit/performing-common-cryptographic-operations, /security/certificate-key-and-trust-services/keys/storing-keys-in-the-secure-enclave

**Skills**: axiom-cryptokit
