---
name: network-framework-ref
description: NWConnection (iOS 12-25), NetworkConnection (iOS 26+), TLV framing, Coder protocol
---

# Network.framework Reference

Complete API reference for Network.framework. Covers NWConnection (iOS 12-25), NetworkConnection (iOS 26+) with structured concurrency, TLV framing, Coder protocol, and migration patterns.

## When to Use This Reference

Use this reference when you need:
- NWConnection state machine and patterns
- NetworkConnection async/await APIs (iOS 26+)
- TLV (Type-Length-Value) message framing
- Coder protocol for Codable send/receive
- NetworkListener and NetworkBrowser patterns
- Migration from BSD sockets or URLSession

**For troubleshooting:** See [networking-diag](/diagnostic/networking-diag) for connection issues.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I create a TLS connection with NWConnection?"
- "How do I use NetworkConnection with async/await in iOS 26?"
- "How do I implement TLV framing for message boundaries?"
- "How do I use Coder protocol to send Codable objects?"
- "When should I use Network.framework vs URLSession?"
- "How do I set up a NetworkListener for incoming connections?"

## What's Covered

### NWConnection (iOS 12-25)
- Connection creation with endpoints
- State machine and stateUpdateHandler
- Completion-based send/receive
- TLS configuration
- UDP batching

### NetworkConnection (iOS 26+)
- Declarative protocol stacks
- async/await send/receive
- TLV built-in framing
- Coder protocol for Codable
- State property observation

### Server Patterns
- NWListener (iOS 12-25)
- NetworkListener (iOS 26+)
- Service discovery with Browser
- Wi-Fi Aware peer-to-peer

### Advanced Features
- Smart connection establishment (Happy Eyeballs)
- Multipath TCP
- TCP Fast Open
- User-space networking

## Key Pattern

### iOS 26+ NetworkConnection

```swift
// TLS connection with Coder
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029)
) {
    Coder(GameMessage.self, using: .json) {
        TLS()
    }
}

// Send Codable directly
try await connection.send(GameMessage(type: .move, data: moveData))

// Receive Codable
for try await (message, _) in connection.messages {
    handleMessage(message)
}
```

### iOS 12-25 NWConnection

```swift
let connection = NWConnection(
    to: .hostPort(host: "www.example.com", port: 1029),
    using: .tls
)
connection.stateUpdateHandler = { state in
    switch state {
    case .ready: // Connected
    case .failed(let error): // Handle failure
    default: break
    }
}
connection.start(queue: .main)
```

## Documentation Scope

This page documents the `axiom-network-framework-ref` reference skill—complete API coverage Claude uses when you need specific Network.framework APIs or implementation patterns.

**For troubleshooting:** See [networking-diag](/diagnostic/networking-diag) for connection failures.

**For architecture:** See [networking](/skills/integration/networking) for when to use Network.framework vs URLSession.

## Related

- [networking](/skills/integration/networking) — Network architecture decisions
- [networking-diag](/diagnostic/networking-diag) — Connection troubleshooting
- [networking-auditor](/agents/networking-auditor) — Deprecated API scanning

## Resources

**WWDC**: 2018-715 (NWConnection), 2025-250 (NetworkConnection)

**Docs**: /network, /network/nwconnection
