---
name: ios-networking
description: Use when implementing or debugging ANY network connection, API call, or socket. Covers URLSession, Network.framework, NetworkConnection, deprecated APIs, connection diagnostics, structured concurrency networking.
---

# iOS Networking Router

**You MUST use this skill for ANY networking work including HTTP requests, WebSockets, TCP connections, or network debugging.**

## When to Use

Use this router when:
- Implementing network requests (URLSession)
- Using Network.framework or NetworkConnection
- Debugging connection failures
- Migrating from deprecated networking APIs
- Network performance issues

## Routing Logic

### Network Implementation

**Networking patterns** → `/skill networking`
- URLSession with structured concurrency
- Network.framework migration
- Modern networking patterns
- Deprecated API migration

**Network.framework reference** → `/skill network-framework-ref`
- NWConnection (iOS 12-25)
- NetworkConnection (iOS 26+)
- TCP connections
- TLV framing
- Wi-Fi Aware

### Network Debugging

**Connection issues** → `/skill networking-diag`
- Connection timeouts
- TLS handshake failures
- Data not arriving
- Connection drops
- VPN/proxy problems

## Decision Tree

```
User asks about networking
  ├─ Implementing?
  │  ├─ URLSession? → networking
  │  ├─ Network.framework? → network-framework-ref
  │  └─ iOS 26+ NetworkConnection? → network-framework-ref
  │
  └─ Debugging? → networking-diag
```

## Critical Patterns

**Networking** (networking):
- URLSession with structured concurrency
- Socket migration to Network.framework
- Deprecated API replacement

**Network Framework Reference** (network-framework-ref):
- NWConnection for iOS 12-25
- NetworkConnection for iOS 26+
- Connection lifecycle management

**Networking Diagnostics** (networking-diag):
- Connection timeout diagnosis
- TLS debugging
- Network stack inspection

## Example Invocations

User: "My API request is failing with a timeout"
→ Invoke: `/skill networking-diag`

User: "How do I use URLSession with async/await?"
→ Invoke: `/skill networking`

User: "I need to implement a TCP connection"
→ Invoke: `/skill network-framework-ref`

User: "Should I use NWConnection or NetworkConnection?"
→ Invoke: `/skill network-framework-ref`
