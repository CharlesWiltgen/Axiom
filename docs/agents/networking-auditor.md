# networking-auditor

Automatically scans for deprecated networking APIs and anti-patterns that cause App Store rejections.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my networking code for deprecated APIs?"
- "Review my code for Network.framework best practices"
- "I'm getting App Store review warnings about networking"
- "Scan for networking anti-patterns before submission"

**Explicit command:**
```bash
/axiom:audit-networking
```

## What It Checks

### Deprecated APIs
1. **SCNetworkReachability** (HIGH) — Race conditions, App Store concern
2. **CFSocket** (MEDIUM) — 30% CPU penalty, no smart connection
3. **NSStream / CFStream** (MEDIUM) — No TLS integration
4. **NSNetService** (LOW) — Legacy API
5. **Manual DNS** (MEDIUM) — getaddrinfo, gethostbyname

### Anti-Patterns
6. **Reachability Before Connect** (HIGH) — Race condition
7. **Hardcoded IP Addresses** (MEDIUM) — Breaks VPN/proxy
8. **Missing [weak self]** (MEDIUM) — Memory leaks in callbacks
9. **Blocking Socket Calls** (HIGH) — ANR risk
10. **Not Handling Waiting State** (LOW) — Poor UX

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: blue

## Related Skills

- **networking** skill — Network.framework patterns (NWConnection, NetworkConnection)
- **networking-diag** skill — Systematic networking troubleshooting
- **network-framework-ref** skill — Complete API reference
