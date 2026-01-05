---
name: networking
description: Network.framework patterns for UDP/TCP with NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency
---

# Networking

Network.framework patterns for UDP/TCP connections. Covers NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency.

## When to Use This Skill

Use this skill when you're:
- Implementing UDP or TCP connections
- Migrating from deprecated APIs (SCNetworkReachability, CFSocket, NSStream)
- Adding TLS/SSL to connections
- Implementing service discovery with NWBrowser
- Creating server listeners with NWListener
- Adopting async/await patterns for networking (iOS 26+)

**Note:** For HTTP/REST APIs, use URLSession instead. This skill is for low-level socket connections.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I create a TCP connection with Network.framework?"
- "What's the modern replacement for SCNetworkReachability?"
- "How do I implement UDP with batching for better performance?"
- "I need to add TLS to my connection. How do I configure it?"
- "How do I use the new NetworkConnection API in iOS 26?"
- "My connection keeps failing on network transitions. How do I handle this?"
- "How do I implement a server listener for incoming connections?"

## What's Covered

### Anti-Patterns Prevented
- SCNetworkReachability (race conditions, deprecated)
- CFSocket, NSStream, CFStream (replaced by NWConnection)
- NSNetService (replaced by NWBrowser)
- Reachability checks before connecting
- Hardcoded IP addresses
- Blocking socket operations on main thread

### NWConnection (iOS 12-25)
- TCP and UDP connections
- TLS with stateUpdateHandler
- UDP batch sending (30% CPU reduction)
- Network transition handling

### NetworkConnection (iOS 26+)
- Async/await patterns
- Declarative TLS stacks
- UDP datagrams with batching
- TLV framing for message boundaries
- Coder protocol for Codable objects

### Listening & Discovery
- NWListener for incoming connections
- NWBrowser for service discovery
- Bonjour integration

## Key Pattern

### Modern TCP Connection (iOS 26+)

```swift
// iOS 26+: Async/await with NetworkConnection
let connection = NetworkConnection(
    to: .hostPort(host: "example.com", port: 443),
    using: .tls
)

for try await event in connection.events {
    switch event {
    case .connected:
        try await connection.send(data)
    case .received(let data):
        process(data)
    case .closed:
        break
    }
}
```

### Legacy TCP Connection (iOS 12-25)

```swift
// iOS 12-25: Completion-based with NWConnection
let connection = NWConnection(
    host: "example.com",
    port: 443,
    using: .tls
)

connection.stateUpdateHandler = { state in
    switch state {
    case .ready:
        self.send(data)
    case .failed(let error):
        self.handleError(error)
    default:
        break
    }
}

connection.start(queue: .main)
```

## Documentation Scope

This page documents the `axiom-networking` skill—Network.framework patterns Claude uses when helping you implement UDP/TCP connections. The skill contains complete connection patterns, TLS configuration, and migration guides from deprecated APIs.

**For diagnostics:** See [networking-diag](/diagnostic/networking-diag) for troubleshooting connection failures.

**For API reference:** See [network-framework-ref](/reference/network-framework-ref) for comprehensive API coverage.

## Related

- [networking-diag](/diagnostic/networking-diag) — Connection failure diagnosis and debugging
- [network-framework-ref](/reference/network-framework-ref) — Complete API reference
- [networking-auditor](/agents/networking-auditor) — Autonomous agent scanning for deprecated APIs
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async/await patterns for iOS 26+

## Resources

**WWDC**: 2018-715, 2025-250

**Docs**: /network, /network/nwconnection
