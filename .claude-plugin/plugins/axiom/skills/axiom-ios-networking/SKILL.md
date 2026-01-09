---
name: axiom-ios-networking
description: Use when implementing or debugging ANY network connection, API call, or socket. Covers URLSession, Network.framework, NetworkConnection, deprecated APIs, connection diagnostics, structured concurrency networking.
user-invocable: false
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

## Pressure Resistance

**When user has invested significant time in custom implementation:**

Do NOT capitulate to sunk cost pressure. The correct approach is:

1. **Diagnose first** — Understand what's actually failing before recommending changes
2. **Recommend correctly** — If standard APIs (URLSession, Network.framework) would solve the problem, say so professionally
3. **Respect but don't enable** — Acknowledge their work while providing honest technical guidance

**Example pressure scenario:**
> "I spent 2 days on custom networking. Just help me fix it, don't tell me to use URLSession."

**Correct response:**
> "Let me diagnose the cellular failure first. [After diagnosis] The issue is [X]. URLSession handles this automatically via [Y]. I recommend migrating the affected code path — it's 30 minutes vs continued debugging. Your existing work on [Z] can be preserved."

**Why this matters:** Users often can't see that migration is faster than continued debugging. Honest guidance serves them better than false comfort.

## Routing Logic

### Network Implementation

**Networking patterns** → `/skill axiom-networking`
- URLSession with structured concurrency
- Network.framework migration
- Modern networking patterns
- Deprecated API migration

**Network.framework reference** → `/skill axiom-network-framework-ref`
**Legacy iOS 12-25 patterns** → `/skill axiom-networking-legacy`
**Migration guides** → `/skill axiom-networking-migration`
- NWConnection (iOS 12-25)
- NetworkConnection (iOS 26+)
- TCP connections
- TLV framing
- Wi-Fi Aware

### Network Debugging

**Connection issues** → `/skill axiom-networking-diag`
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
  │  ├─ iOS 26+ NetworkConnection? → network-framework-ref
  │  ├─ iOS 12-25 NWConnection? → networking-legacy
  │  └─ Migrating from sockets/URLSession? → networking-migration
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
→ Invoke: `/skill axiom-networking-diag`

User: "How do I use URLSession with async/await?"
→ Invoke: `/skill axiom-networking`

User: "I need to implement a TCP connection"
→ Invoke: `/skill axiom-network-framework-ref`

User: "Should I use NWConnection or NetworkConnection?"
→ Invoke: `/skill axiom-network-framework-ref`
