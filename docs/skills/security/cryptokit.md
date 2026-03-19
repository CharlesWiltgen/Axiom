# CryptoKit

Discipline skill for cryptographic operations on Apple platforms. Covers encryption, signing, hashing, key agreement, Secure Enclave key management, quantum-secure algorithms, and migrating from legacy CommonCrypto.

## When to Use

Use this skill when:
- Encrypting or decrypting data with AES-GCM or ChaChaPoly
- Signing data or verifying signatures with ECDSA
- Generating or managing keys in the Secure Enclave
- Choosing between CryptoKit algorithm families for a use case
- Migrating from CommonCrypto or Security.framework to CryptoKit
- Evaluating or adopting post-quantum algorithms (ML-KEM, ML-DSA)
- Implementing key agreement (ECDH) or hybrid encryption (HPKE)

## Example Prompts

- "How do I encrypt data with CryptoKit?"
- "Should I use AES-GCM or ChaChaPoly?"
- "How do I create and use a Secure Enclave key?"
- "How do I migrate from CommonCrypto to CryptoKit?"
- "What are the post-quantum options in CryptoKit?"
- "How do I sign data and verify the signature?"
- "What's the right way to do key agreement with ECDH?"

## What This Skill Provides

- Algorithm decision framework mapping use cases to the right CryptoKit type
- Secure Enclave key lifecycle: creation, usage constraints, and backup implications
- 6 end-to-end workflows (encrypt-then-store, sign-and-verify, key agreement, HPKE, SE-protected signing, quantum migration)
- CommonCrypto-to-CryptoKit migration patterns with before/after code
- Post-quantum algorithm guidance (ML-KEM for key encapsulation, ML-DSA for signatures)
- Anti-patterns with security impact (hardcoded keys, ECB mode, skipping authentication)
- Pressure scenarios for common shortcuts (using raw AES without authentication, storing keys in UserDefaults)

## Documentation Scope

This page documents the `axiom-cryptokit` discipline skill. The discipline skill provides decision frameworks, workflows, and anti-rationalization guidance for cryptographic operations.

- For API-level details on all CryptoKit types and algorithms, see [CryptoKit Reference](/reference/cryptokit-ref)

## Related

- [CryptoKit Reference](/reference/cryptokit-ref) — All algorithm families, type signatures, and API details
- [Keychain](/skills/security/keychain) — Secure storage for keys and credentials that CryptoKit generates
