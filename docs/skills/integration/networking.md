---
name: networking
description: Network.framework patterns for UDP/TCP with NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency
---

# Networking

Network.framework discipline-enforcing skill covering NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency patterns.

## Overview

Prevents deprecated API usage and anti-patterns when implementing UDP/TCP connections with Apple's Network.framework. Covers both legacy completion-based APIs and modern async/await patterns from WWDC 2018/715 and WWDC 2025/250.

## What This Skill Covers

### Anti-Patterns Prevented

#### Deprecated APIs
- SCNetworkReachability (race conditions)
- CFSocket (replaced by NWConnection)
- NSStream, CFStream (low-level issues)
- NSNetService (replaced by NWBrowser)
- Manual getaddrinfo() DNS resolution

#### Common Mistakes
- Reachability checks before connecting
- Hardcoded IP addresses
- Blocking socket operations on main thread
- Missing [weak self] in completion handlers
- Ignoring waiting state
- Not handling network transitions

### Patterns Provided

#### NetworkConnection (iOS 26+)
- TLS connections with declarative stacks
- UDP datagrams with batching
- TLV framing for message boundaries
- Coder protocol for Codable objects

#### NWConnection (iOS 12-25)
- TCP+TLS with stateUpdateHandler
- UDP batch sending (30% CPU reduction)
- NWListener for incoming connections
- NWBrowser for service discovery

## When to Use This Skill

Use this skill when:
- Implementing UDP/TCP connections
- Migrating from BSD sockets or URLSession streams
- Debugging connection timeouts or failures
- Choosing between NWConnection and NetworkConnection
- Sending game state updates over UDP
- Building peer-to-peer networking

## Red Flags

❌ **Using SCNetworkReachability before connecting**
- Race condition between check and connection
- Deprecated in iOS 12+
- Use NWConnection waiting state instead

❌ **Hardcoded IP addresses**
- Breaks proxy/VPN compatibility
- IPv4/IPv6 migration issues
- Use hostnames with automatic DNS

❌ **Blocking socket operations on main thread**
- Guaranteed ANR (Application Not Responding)
- Use async/await or completion handlers

❌ **Missing [weak self] in callbacks**
- Memory leaks from retain cycles
- Connection objects retained indefinitely

## Common Patterns

### Pattern 1: NetworkConnection with TLS (iOS 26+)
```swift
let connection = NetworkConnection(
  to: .hostPort(host: "www.example.com", port: 1029)
) {
  TLS()
}

try await connection.send(data)
let received = try await connection.receive(
  minimum: 1,
  maximum: 8192
)
```

**Time cost**: 10-15 minutes
**When to use**: iOS 26+, structured concurrency preferred

### Pattern 2: TLV Framing (iOS 26+)
```swift
let connection = NetworkConnection(
  to: .hostPort(host: "www.example.com", port: 1029)
) {
  TLV {
    TLS()
  }
}

try await connection.send(.gameState(state))
```

**Time cost**: 15-20 minutes
**When to use**: Message-based protocols, clear boundaries

### Pattern 3: NWConnection with TLS (iOS 12-25)
```swift
let connection = NWConnection(
  to: endpoint,
  using: .tls
)
connection.stateUpdateHandler = { [weak self] state in
  switch state {
  case .ready:
    self?.sendData()
  case .waiting(let error):
    print("Waiting: \(error)")
  case .failed(let error):
    print("Failed: \(error)")
  default:
    break
  }
}
connection.start(queue: .main)
```

**Time cost**: 15-20 minutes
**When to use**: iOS 12-25 deployment target

### Pattern 4: UDP Batching (iOS 12-25)
```swift
connection.batch {
  for packet in packets {
    connection.send(content: packet, completion: .idempotent)
  }
}
```

**Time cost**: 10-15 minutes
**When to use**: High-frequency UDP sends, 30% CPU savings

## Pressure Scenarios

### Scenario 1: Reachability Race Condition
**Context**: App Store deadline, PM suggests SCNetworkReachability for "quick fix"
**Pressure**: ⏰ Deadline, 👔 Authority, 💸 Sunk cost
**Rationalization**: "Quick fix now, refactor later"
**Why it fails**: Race condition, deprecated API, rejection risk

**Mandatory response**:
```swift
// ❌ WRONG - Race condition
if SCNetworkReachability.isReachable() {
  connect() // Network might be gone by now
}

// ✅ CORRECT - Handle waiting state
connection.stateUpdateHandler = { state in
  if case .waiting(let error) = state {
    // Show "No network" UI
  }
}
```

### Scenario 2: Design Review - "Use WebSockets for Everything"
**Context**: Architect pushes WebSocket for UDP gaming use case
**Pressure**: Professional hierarchy, design authority

**Professional push-back**:
"WebSockets run over TCP, which guarantees delivery and ordering. For real-time gaming, we need UDP to drop old packets and minimize latency. TCP's retransmission would cause stuttering when packets are lost. Network.framework with UDP gives us < 50ms latency vs 150-300ms with WebSockets under packet loss."

## Migration Guides

### From BSD Sockets
| Socket | Network.framework |
|--------|-------------------|
| socket() | NWConnection |
| connect() | connection.start() |
| send() | connection.send() |
| recv() | connection.receive() |

### From URLSession StreamTask
- HTTP/WebSocket → Stay with URLSession
- Custom protocols → Migrate to Network.framework
- Real-time gaming → Use NWConnection UDP

### NWConnection → NetworkConnection
- Completion handlers → async/await
- stateUpdateHandler → State property
- Manual message framing → TLV or Coder

## Checklist

Before shipping:
- [ ] Not using SCNetworkReachability
- [ ] Using hostname not IP address
- [ ] Handling waiting state
- [ ] [weak self] in all handlers
- [ ] Network transitions tested
- [ ] TLS for sensitive data
- [ ] Timeout handling implemented
- [ ] IPv6 tested on cellular

## Real-World Impact

#### User-Space Networking
- 30% CPU reduction for UDP workloads
- Reduced battery drain
- Better thermal performance

#### Smart Connection
- 50% faster connection establishment
- Happy Eyeballs (IPv4/IPv6 racing)
- Automatic proxy detection

#### Proper State Handling
- 10x reduction in crashes
- Better offline experience
- Seamless WiFi/cellular transitions

## Related Resources

- [networking-diag](/diagnostic/networking-diag) — Systematic troubleshooting
- [network-framework-ref](/reference/network-framework-ref) — Complete API reference
- [audit-networking](/commands/integration/audit-networking) — Deprecated API scanner
- [WWDC 2018/715](https://developer.apple.com/videos/play/wwdc2018/715/)
- [WWDC 2025/250](https://developer.apple.com/videos/play/wwdc2025/250/)

## Documentation Scope

This is a **discipline-enforcing skill** — TDD-tested workflows with pressure scenarios.

#### Skill includes
- 8 patterns covering iOS 12-26+
- 3 pressure scenarios with professional push-back
- Decision trees for API selection
- Anti-patterns with BAD/GOOD examples
- Migration guides from sockets
- Real-world time costs

**Not yet TDD-tested**: This skill awaits formal TDD validation using the Superpowers framework.

## Size

30 KB - Discipline-enforcing with pressure scenarios
