---
name: audit-networking
description: Scan for deprecated networking APIs (launches networking-auditor agent)
---

# Networking API Audit

Launches the **networking-auditor** agent to scan for deprecated networking APIs and anti-patterns that cause App Store rejections.

## What It Checks

**Deprecated APIs:**
- SCNetworkReachability (race conditions, App Store concern)
- CFSocket (30% CPU penalty, no smart connection)
- NSStream / CFStream (no TLS integration)
- NSNetService (legacy API)
- Manual DNS (getaddrinfo, gethostbyname)

**Anti-Patterns:**
- Reachability checks before connect (race condition)
- Hardcoded IP addresses (breaks VPN/proxy)
- Missing [weak self] in callbacks (memory leaks)
- Blocking socket calls (ANR risk)
- Not handling waiting state (poor UX)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Scan for deprecated networking APIs"
- "Check my networking code for best practices"
- "Review my code for App Store networking warnings"
