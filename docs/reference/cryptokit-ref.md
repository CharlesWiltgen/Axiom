# CryptoKit Reference

Complete API reference for Apple's CryptoKit framework. Covers all algorithm families, type signatures, and usage patterns for developers who need precise API details for cryptographic operations.

## When to Use This Reference

Use this reference when:
- Looking up specific CryptoKit type signatures or method parameters
- Checking available algorithms in each cryptographic family
- Understanding the relationship between key types, sealed boxes, and signatures
- Finding the correct type for Secure Enclave operations
- Reviewing post-quantum algorithm APIs (ML-KEM, ML-DSA)

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What's the API for AES.GCM.seal?"
- "What Secure Enclave key types does CryptoKit support?"
- "How do I use HPKE for hybrid encryption?"
- "What's the difference between P256, P384, and P521 curves?"
- "What are the ML-KEM key encapsulation APIs?"

## What's Covered

- Hashing: SHA256, SHA384, SHA512, Insecure.MD5, Insecure.SHA1
- HMAC: message authentication with all hash functions
- Symmetric encryption: AES-GCM and ChaChaPoly sealed boxes
- Signing and verification: P256, P384, P521 ECDSA, Curve25519 (Ed25519)
- Key agreement: P256, P384, P521 ECDH, Curve25519 (X25519)
- Secure Enclave types: SecureEnclave.P256 for signing and key agreement
- Post-quantum: ML-KEM (key encapsulation), ML-DSA (digital signatures)
- HPKE: hybrid public key encryption with sender/recipient APIs
- Key representation: raw, x963, PEM, DER formats

## Documentation Scope

This page documents the `axiom-cryptokit-ref` reference skill. It provides API-level detail for developers who already understand which algorithm to use and need specific type signatures and parameters.

- For decision guidance on choosing algorithms and workflows, see [CryptoKit](/skills/security/cryptokit)

## Related

- [CryptoKit](/skills/security/cryptokit) — Discipline skill with algorithm decision trees, workflows, and migration guidance
