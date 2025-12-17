---
name: network-framework-ref
description: Comprehensive Network.framework guide — NWConnection (iOS 12-25), NetworkConnection (iOS 26+), TLV framing, Coder protocol, migration strategies
---

# Network.framework API Reference

Comprehensive API reference for Network.framework covering NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency patterns.

## Overview

Complete guide to Apple's Network.framework based on WWDC 2018/715 and WWDC 2025/250, covering smart connection establishment, user-space networking, TLV framing, Coder protocol, and migration strategies.

## What This Reference Covers

### NetworkConnection (iOS 26+)
- Declarative protocol stacks with async/await
- TLS() configuration with automatic TCP/IP inference
- Send/receive with structured concurrency
- TLV (Type-Length-Value) framing for message boundaries
- Coder protocol for direct Codable send/receive
- NetworkListener for incoming connections
- NetworkBrowser for service discovery
- Wi-Fi Aware peer-to-peer

### NWConnection (iOS 12-25)
- Connection creation with endpoints and parameters
- State machine and stateUpdateHandler
- Completion-based send/receive
- UDP batching for performance
- NWListener for incoming connections
- NWBrowser for Bonjour discovery
- Custom framing protocols

### Advanced Features
- Smart connection establishment (Happy Eyeballs)
- User-space networking (30% CPU reduction)
- Mobility and network transitions
- Multipath TCP
- ECN for UDP
- TCP Fast Open
- Performance optimization

## API Evolution

| Feature | NWConnection (12-25) | NetworkConnection (26+) |
|---------|---------------------|------------------------|
| Async | Completion handlers | async/await |
| State | stateUpdateHandler | State property |
| Send | Callback | Suspending function |
| Framing | Manual/custom | TLV built-in |
| Codable | Manual JSON | Coder protocol |

## When to Use This Reference

Use this reference when:
- Planning Network.framework implementation
- Understanding API differences between iOS versions
- Migrating from BSD sockets or URLSession
- Implementing WWDC 2025 examples
- Choosing between TCP, UDP, or TLS
- Setting up peer-to-peer discovery

## Key Patterns

### iOS 26+ NetworkConnection

#### Basic TLS Connection
```swift
let connection = NetworkConnection(
  to: .hostPort(host: "www.example.com", port: 1029)
) {
  TLS()
}
```

#### TLV Framing for Messages
```swift
let connection = NetworkConnection(
  to: .hostPort(host: "www.example.com", port: 1029)
) {
  TLV {
    TLS()
  }
}
```

#### Coder Protocol for Codable
```swift
let connection = NetworkConnection(
  to: .hostPort(host: "www.example.com", port: 1029)
) {
  Coder(GameMessage.self, using: .json) {
    TLS()
  }
}
```

#### NetworkListener for Incoming
```swift
try await NetworkListener {
  Coder(GameMessage.self, using: .json) {
    TLS()
  }
}.run { connection in
  for try await (gameMessage, _) in connection.messages {
    // Handle message
  }
}
```

### iOS 12-25 NWConnection

#### Basic Connection
```swift
let endpoint = NWEndpoint.hostPort(
  host: "www.example.com",
  port: 1029
)
let connection = NWConnection(
  to: endpoint,
  using: .tls
)
connection.stateUpdateHandler = { state in
  switch state {
  case .ready: // Connected
  case .waiting(let error): // Handle waiting
  case .failed(let error): // Handle failure
  default: break
  }
}
connection.start(queue: .main)
```

#### Send/Receive
```swift
connection.send(
  content: data,
  completion: .contentProcessed { error in
    // Pacing control
  }
)

connection.receive(
  minimumIncompleteLength: 1,
  maximumLength: 8192
) { data, context, isComplete, error in
  // Process data
}
```

## Complete API Coverage

This reference includes:
- All 12 WWDC 2025 code examples with annotations
- Complete NWConnection state machine documentation
- NetworkConnection protocol stack composition
- TLV framing implementation details
- Coder protocol with JSONCoder and PropertyListCoder
- NetworkListener patterns for servers
- NetworkBrowser for service discovery
- Mobility patterns (viability, better path, Multipath TCP)
- Security configuration (TLS 1.3, certificate pinning)
- Performance optimization (user-space networking, batching, ECN)

## Migration Strategies

### From BSD Sockets
- `socket()` → `NWConnection`
- `send()` → `connection.send()`
- `recv()` → `connection.receive()`
- Manual DNS → Automatic resolution

### From URLSession StreamTask
- When to stay with URLSession (HTTP/WebSocket)
- When to migrate to Network.framework (UDP, custom protocols)

### NWConnection → NetworkConnection
- Completion handlers → async/await
- stateUpdateHandler → State property
- Manual framing → TLV or Coder

## Testing Checklist

- [ ] Real device testing (not just simulator)
- [ ] WiFi → cellular transition
- [ ] Airplane Mode recovery
- [ ] IPv6-only network
- [ ] Corporate VPN
- [ ] Instruments profiling
- [ ] Low bandwidth conditions
- [ ] Packet loss simulation

## Performance Optimization

#### User-Space Networking
- 30% CPU reduction for UDP
- Batch operations with connection.batch
- ECN (Explicit Congestion Notification)
- Service class configuration

#### TCP Optimization
- TCP Fast Open for reduced latency
- Multipath TCP for redundancy
- Connection viability monitoring
- Better path available detection

## Common Use Cases

### When to Use Network.framework
- UDP gaming protocols
- Custom TCP protocols
- Peer-to-peer connections
- Service discovery (Bonjour)
- Low-level networking control
- Network mobility (WiFi ↔ cellular)

### When to Use URLSession Instead
- HTTP/HTTPS requests
- RESTful APIs
- WebSocket connections
- File downloads/uploads
- Standard web protocols

## Related Resources

- [networking](/skills/integration/networking) — Discipline-enforcing skill with anti-patterns
- [networking-diag](/diagnostic/networking-diag) — Systematic troubleshooting
- [audit-networking](/commands/integration/audit-networking) — Deprecated API scanner
- [WWDC 2018/715](https://developer.apple.com/videos/play/wwdc2018/715/) — NWConnection introduction
- [WWDC 2025/250](https://developer.apple.com/videos/play/wwdc2025/250/) — NetworkConnection with structured concurrency

## Documentation Scope

This is a **reference skill** — comprehensive API guide without mandatory workflows.

#### Reference includes
- Complete API documentation for iOS 12-26+
- All WWDC code examples
- Migration strategies
- Performance optimization techniques
- Testing checklists
- Decision trees for API selection

**Vs Diagnostic**: Reference skills provide information. Diagnostic skills enforce workflows and handle pressure scenarios.

## Size

38 KB - Comprehensive Network.framework reference
