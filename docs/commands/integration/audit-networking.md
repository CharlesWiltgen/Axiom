---
name: audit-networking
description: Scan for deprecated networking APIs and anti-patterns with fix recommendations
---

# Networking Audit

Quick automated scan to identify deprecated networking APIs and anti-patterns in your Swift/Objective-C codebase.

## What It Scans

### Deprecated APIs
| Pattern | Risk | Replacement |
|---------|------|-------------|
| SCNetworkReachability | Race condition | NWConnection waiting state |
| CFSocket | Missing features | NWConnection |
| NSStream, CFStream | Complex, error-prone | NWConnection |
| NSNetService | Missing benefits | NWBrowser |
| getaddrinfo() | Blocking operation | NWConnection (automatic) |

### Anti-Patterns
| Pattern | Risk | Fix |
|---------|------|-----|
| Reachability check before connect | Race condition | Use waitsForConnectivity |
| Hardcoded IP addresses | Proxy/VPN issues | Use hostnames |
| Missing [weak self] in callbacks | Memory leaks | Add capture list |
| Blocking socket calls | ANR/crashes | Use async APIs |
| Not handling waiting state | Poor offline UX | Monitor state changes |

## Usage

```bash
# Scan entire project
/axiom:audit networking

# Scan specific directory
/axiom:audit networking Sources/Networking/
```

## Example Output

```
=== NETWORKING AUDIT RESULTS ===

DEPRECATED APIs (3 issues):
  NetworkManager.swift:45 — SCNetworkReachability
    → Replace with NWConnection waiting state

  LegacySocket.m:120 — CFSocket
    → Migrate to NWConnection

ANTI-PATTERNS (2 issues):
  Config.swift:15 — Hardcoded IP "192.168.1.1"
    → Use hostname for proxy/VPN compatibility

  ConnectionManager.swift:67 — Missing [weak self]
    → Add capture list to prevent retain cycle

POSITIVE PATTERNS (found):
  ✓ NWConnection: 5 files
  ✓ URLSession: 12 files
```

## Time Estimates

- Replace SCNetworkReachability: 5-10 min
- Add [weak self]: 1-2 min
- Replace hardcoded IP: 2-5 min
- Migrate from CFSocket: 30-60 min

## Related

- [networking](/skills/integration/networking) — Implementation patterns
- [networking-diag](/diagnostic/networking-diag) — Connection troubleshooting
- [network-framework-ref](/reference/network-framework-ref) — Complete API reference
