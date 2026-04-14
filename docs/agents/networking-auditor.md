# networking-auditor

Scans for deprecated networking APIs, anti-patterns, and architectural gaps that cause App Store rejections and connection failures.

## How to Use

**Natural language (automatic triggering):**
- "Can you check my networking code for deprecated APIs?"
- "Review my code for Network.framework best practices"
- "I'm getting App Store review warnings about networking"
- "Scan for networking anti-patterns before submission"

**Explicit command:**
```bash
/axiom:audit networking
```

## What It Does

### Deprecated APIs
1. **SCNetworkReachability** (CRITICAL) — Race conditions, App Store concern
2. **CFSocket** (MEDIUM) — 30% CPU penalty, no smart connection
3. **NSStream / CFStream** (MEDIUM) — No TLS integration
4. **NSNetService** (LOW) — Legacy API
5. **Manual DNS** (MEDIUM) — getaddrinfo, gethostbyname

### Anti-Patterns
6. **Reachability Before Connect** (CRITICAL) — Race condition
7. **Hardcoded IP Addresses** (MEDIUM) — Breaks VPN/proxy
8. **Missing [weak self]** (MEDIUM) — Memory leaks in callbacks
9. **Blocking Socket Calls** (CRITICAL) — ANR risk
10. **Not Handling Waiting State** (LOW) — Poor UX

### Completeness Checks
11. **Missing network transition handling** — WiFi-to-cellular failures
12. **Missing TLS for sensitive data** — Security gaps
13. **Poor error messages** — Cryptic errors for users
14. **Missing connection cleanup** — Resource and battery leaks
15. **Wrong framework for protocol** — URLSession vs Network.framework mismatch
16. **Missing timeout handling** — Infinite spinners
17. **Mixed API paradigms** — NWConnection + NetworkConnection inconsistency
18. **Missing UDP batching** — Performance optimization gap

### Health Score
Reports overall networking health as **MODERN**, **NEEDS MIGRATION**, or **LEGACY** with specific metrics.

## Related

- **networking** skill — Network.framework patterns (NWConnection, NetworkConnection); use to fix issues this auditor finds
- **networking-diag** skill — Systematic networking troubleshooting
- **network-framework-ref** skill — Complete API reference
- **memory-auditor** agent — Investigates callback retain cycles this auditor finds
- **energy-auditor** agent — Investigates connection resource leaks this auditor finds
