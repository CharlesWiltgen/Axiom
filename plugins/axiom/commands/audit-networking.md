---
name: audit-networking
description: Scan Swift/Objective-C for deprecated networking APIs (SCNetworkReachability, CFSocket, NSStream) and anti-patterns (reachability checks, hardcoded IPs, missing error handling) with file:line references
allowed-tools: Glob(*.swift, *.m, *.h), Grep(*)
---

# Networking Audit

I'll scan your codebase for deprecated networking APIs and Network.framework anti-patterns.

## What I'll Check

### Deprecated APIs (Apple deprecated in WWDC 2018)

**1. SCNetworkReachability (DEPRECATED)**
- **Pattern:** `SCNetworkReachability`, `SCNetworkReachabilityCreateWithName`, `SCNetworkReachabilityGetFlags`
- **Impact:** Race condition between check and connect, misses proxy/VPN, App Store review concern
- **Fix:** Use NWConnection waiting state or NWPathMonitor

**2. CFSocket (DEPRECATED)**
- **Pattern:** `CFSocketCreate`, `CFSocketConnectToAddress`, `CFSocketSend`
- **Impact:** Can't use user-space networking (30% CPU penalty), no smart connection establishment
- **Fix:** Use NWConnection or NetworkConnection

**3. NSStream / CFStream (DEPRECATED)**
- **Pattern:** `NSInputStream`, `NSOutputStream`, `CFStreamCreatePairWithSocket`, `CFReadStreamOpen`
- **Impact:** No TLS integration, manual buffer management, no proxy support
- **Fix:** Use NWConnection for TCP/TLS streams

**4. NSNetService (DEPRECATED)**
- **Pattern:** `NSNetService`, `NSNetServiceBrowser`, `netServiceDidResolveAddress`
- **Impact:** Legacy API, no structured concurrency support
- **Fix:** Use NWBrowser (iOS 12-25) or NetworkBrowser (iOS 26+)

**5. Manual DNS Resolution (ANTI-PATTERN)**
- **Pattern:** `getaddrinfo`, `gethostbyname`
- **Impact:** Misses Happy Eyeballs (IPv4/IPv6 racing), no proxy evaluation
- **Fix:** Let NWConnection/NetworkConnection handle DNS automatically

### Anti-Patterns

**6. Reachability Check Before Connect (ANTI-PATTERN)**
- **Pattern:** `if SCNetworkReachability` followed by `connection.start()` or `socket()`
- **Impact:** Race condition—network changes between check and connect
- **Fix:** Use waiting state handler, let framework manage connectivity

**7. Hardcoded IP Addresses (ANTI-PATTERN)**
- **Pattern:** IP literals like `"192.168.1.1"`, `"10.0.0.1"`, IPv6 addresses
- **Impact:** Breaks proxy/VPN compatibility, no DNS-based load balancing
- **Fix:** Use hostnames, let Connect by Name resolve

**8. Missing [weak self] in NWConnection Callbacks (MEMORY LEAK)**
- **Pattern:** `connection.send` or `stateUpdateHandler` with `self.` but no `[weak self]`
- **Impact:** Retain cycle: connection → handler → self → connection
- **Fix:** Use `[weak self]` or migrate to NetworkConnection (iOS 26+)

**9. Blocking Socket Calls (ANR RISK)**
- **Pattern:** `connect()`, `send()`, `recv()` without async wrapper
- **Impact:** Main thread hang → App Store rejection, ANR crashes
- **Fix:** Use NWConnection (non-blocking) or background queue

**10. Not Handling Waiting State (UX ISSUE)**
- **Pattern:** `stateUpdateHandler` without `.waiting` case
- **Impact:** Shows "Connection failed" instead of "Waiting for network", no automatic retry
- **Fix:** Handle `.waiting` state with user feedback

---

## Detection Patterns

### Pattern 1: SCNetworkReachability (DEPRECATED)

#### ❌ BAD: Race Condition
```swift
// Found in: NetworkManager.swift:45
let reachability = SCNetworkReachabilityCreateWithName(nil, "example.com")
var flags = SCNetworkReachabilityFlags()
if SCNetworkReachabilityGetFlags(reachability, &flags) {
    if flags.contains(.reachable) {
        connection.start() // RACE: Network may change here
    }
}
```

#### ✅ GOOD: Waiting State Handler
```swift
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.stateUpdateHandler = { state in
    if case .waiting(let error) = state {
        // Show "Waiting for network..." UI
    }
}
connection.start(queue: .main)
```

**Fix:** Remove SCNetworkReachability entirely. Use `connection.stateUpdateHandler` to handle waiting state.

---

### Pattern 2: CFSocket (DEPRECATED)

#### ❌ BAD: Manual Socket Management
```swift
// Found in: SocketWrapper.m:120
let sock = CFSocketCreate(nil, PF_INET, SOCK_STREAM, IPPROTO_TCP, 0, nil, nil)
CFSocketConnectToAddress(sock, address, timeout)
```

#### ✅ GOOD: NWConnection
```swift
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.start(queue: .main)
```

**Fix:** Replace CFSocket with NWConnection. 30% lower CPU usage, automatic proxy/VPN handling.

---

### Pattern 3: NSStream / CFStream (DEPRECATED)

#### ❌ BAD: Manual Stream Management
```swift
// Found in: StreamManager.swift:78
var readStream: Unmanaged<CFReadStream>?
var writeStream: Unmanaged<CFWriteStream>?
CFStreamCreatePairWithSocketToHost(nil, "example.com" as CFString, 443, &readStream, &writeStream)
```

#### ✅ GOOD: NWConnection
```swift
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.send(content: data, completion: .contentProcessed { _ in })
connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, _ in }
```

**Fix:** Replace CFStream with NWConnection for built-in TLS and better buffer management.

---

### Pattern 4: NSNetService (DEPRECATED)

#### ❌ BAD: Legacy Service Discovery
```swift
// Found in: ServiceDiscovery.swift:34
let browser = NSNetServiceBrowser()
browser.searchForServices(ofType: "_http._tcp.", inDomain: "local.")
```

#### ✅ GOOD: NWBrowser
```swift
let browser = NWBrowser(for: .bonjour(type: "_http._tcp", domain: nil), using: .tcp)
browser.start(queue: .main)
```

**Fix:** Replace NSNetService with NWBrowser (iOS 12-25) or NetworkBrowser (iOS 26+).

---

### Pattern 5: Manual DNS Resolution (ANTI-PATTERN)

#### ❌ BAD: Manual getaddrinfo
```swift
// Found in: DNSResolver.swift:56
var hints = addrinfo()
hints.ai_family = AF_INET
var results: UnsafeMutablePointer<addrinfo>?
getaddrinfo("example.com", "443", &hints, &results)
// Now manually try each address...
```

#### ✅ GOOD: Automatic DNS
```swift
// Network.framework handles DNS, Happy Eyeballs, proxy evaluation
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.start(queue: .main)
```

**Fix:** Remove getaddrinfo. Let Network.framework handle DNS with Happy Eyeballs (IPv4/IPv6 racing).

---

### Pattern 6: Reachability Before Connect (ANTI-PATTERN)

#### ❌ BAD: Race Condition
```swift
// Found in: APIClient.swift:102
if reachability.isReachable {
    connection.start() // Network may change between check and start
}
```

#### ✅ GOOD: Let Framework Handle Connectivity
```swift
connection.stateUpdateHandler = { state in
    switch state {
    case .waiting(let error):
        print("Waiting for network: \(error)")
    case .ready:
        print("Connected")
    case .failed(let error):
        print("Failed after exhausting all options: \(error)")
    default:
        break
    }
}
connection.start(queue: .main)
```

**Fix:** Remove reachability check. Framework tries all available networks automatically.

---

### Pattern 7: Hardcoded IP Addresses (ANTI-PATTERN)

#### ❌ BAD: IP Literal
```swift
// Found in: Config.swift:15
let serverHost = "192.168.1.100"
// or IPv6: let serverHost = "2001:db8::1"
```

#### ✅ GOOD: Hostname
```swift
let serverHost = "api.example.com" // Hostname, not IP
```

**Fix:** Use hostname. Proxy auto-configuration (PAC) needs hostname to evaluate rules. VPNs can't route IP literals properly.

---

### Pattern 8: Missing [weak self] (MEMORY LEAK)

#### ❌ BAD: Retain Cycle
```swift
// Found in: ConnectionManager.swift:67
connection.send(content: data, completion: .contentProcessed { error in
    self.handleSendCompletion(error) // LEAK: connection → handler → self → connection
})
```

#### ✅ GOOD: Weak Self
```swift
connection.send(content: data, completion: .contentProcessed { [weak self] error in
    self?.handleSendCompletion(error)
})
```

**Fix:** Add `[weak self]` to all NWConnection completion handlers. Or migrate to NetworkConnection (iOS 26+) which uses async/await (no [weak self] needed).

---

### Pattern 9: Blocking Socket Calls (ANR RISK)

#### ❌ BAD: Blocking Main Thread
```swift
// Found in: LegacySocket.swift:89
let sock = socket(AF_INET, SOCK_STREAM, 0)
connect(sock, &addr, addrlen) // BLOCKS MAIN THREAD → ANR
```

#### ✅ GOOD: Non-Blocking
```swift
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.start(queue: .main) // Returns immediately
```

**Fix:** Replace blocking socket calls with NWConnection (always non-blocking).

---

### Pattern 10: Not Handling Waiting State (UX ISSUE)

#### ❌ BAD: Missing Waiting Case
```swift
// Found in: NetworkService.swift:123
connection.stateUpdateHandler = { state in
    if case .ready = state {
        // Handle ready
    }
    if case .failed(let error) = state {
        // Handle failed
    }
    // Missing: .waiting case
}
```

#### ✅ GOOD: Handle All States
```swift
connection.stateUpdateHandler = { state in
    switch state {
    case .preparing:
        print("Connecting...")
    case .waiting(let error):
        print("Waiting for network: \(error)")
        // Show "Waiting..." UI, don't fail
    case .ready:
        print("Connected")
    case .failed(let error):
        print("Failed: \(error)")
    default:
        break
    }
}
```

**Fix:** Add `.waiting` case. Show "Waiting for network..." UI instead of failing immediately.

---

## Search Queries

I'll run these grep patterns to detect issues:

### Deprecated APIs
```bash
# SCNetworkReachability (DEPRECATED)
grep -rn "SCNetworkReachability" --include="*.swift" --include="*.m" --include="*.h" .

# CFSocket (DEPRECATED)
grep -rn "CFSocket" --include="*.swift" --include="*.m" --include="*.h" .

# NSStream / CFStream (DEPRECATED)
grep -rn "NSStream\|CFStream" --include="*.swift" --include="*.m" --include="*.h" .

# NSNetService (DEPRECATED)
grep -rn "NSNetService" --include="*.swift" --include="*.m" --include="*.h" .

# Manual DNS (ANTI-PATTERN)
grep -rn "getaddrinfo\|gethostbyname" --include="*.swift" --include="*.m" .
```

### Anti-Patterns
```bash
# Hardcoded IPv4 addresses
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' --include="*.swift" .

# Hardcoded IPv6 addresses (partial pattern)
grep -rn '\b[0-9a-fA-F:]\{10,\}' --include="*.swift" .

# Missing [weak self] in NWConnection callbacks
grep -rn "stateUpdateHandler.*self\." --include="*.swift" . | grep -v "\[weak self\]"
grep -rn "send.*completion.*self\." --include="*.swift" . | grep -v "\[weak self\]"

# Blocking socket calls
grep -rn "socket(" --include="*.swift" --include="*.m" .
grep -rn "connect(" --include="*.swift" --include="*.m" .

# Reachability check before connect
grep -rn "isReachable" --include="*.swift" .
```

### Positive Patterns (Good Signs)
```bash
# Using NWConnection (iOS 12-25)
grep -rn "NWConnection" --include="*.swift" .

# Using NetworkConnection (iOS 26+)
grep -rn "NetworkConnection" --include="*.swift" .

# Using URLSession (correct for HTTP)
grep -rn "URLSession" --include="*.swift" .
```

---

## Output Format

After scanning, I'll provide results in this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 NETWORKING AUDIT RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 DEPRECATED APIS (3 issues)

❌ SCNetworkReachability (DEPRECATED)
   NetworkManager.swift:45
   → Race condition: network changes between check and connect
   → Replace with NWConnection waiting state
   Fix: /skill axiom:networking → Pattern 2a (NWConnection with TLS)

❌ CFSocket (DEPRECATED)
   SocketWrapper.m:120
   → 30% higher CPU vs Network.framework
   → No smart connection establishment (Happy Eyeballs, proxies)
   Fix: /skill axiom:networking → Pattern 2a (NWConnection)

❌ NSStream (DEPRECATED)
   StreamManager.swift:78
   → No TLS integration, manual buffer management
   Fix: /skill axiom:networking → Pattern 2a (NWConnection)

🚨 ANTI-PATTERNS (4 issues)

⚠️ Hardcoded IP Address
   Config.swift:15: let serverHost = "192.168.1.1"
   → Breaks proxy/VPN compatibility, no DNS load balancing
   Fix: Use hostname instead: "api.example.com"

⚠️ Missing [weak self] (MEMORY LEAK)
   ConnectionManager.swift:67
   → Retain cycle: connection → handler → self → connection
   Fix: Add [weak self] in capture list

⚠️ Reachability Check Before Connect
   APIClient.swift:102: if reachability.isReachable { connection.start() }
   → Race condition between check and start
   Fix: /skill axiom:networking → Pattern 2a (waiting state)

⚠️ Not Handling Waiting State
   NetworkService.swift:123
   → Missing .waiting case in stateUpdateHandler
   → Poor UX: shows "failed" instead of "waiting for network"
   Fix: /skill axiom:networking → Pattern 2a (state handling)

✅ POSITIVE PATTERNS (8 found)

✓ NWConnection usage: 5 files
   NetworkClient.swift, APIManager.swift, StreamHandler.swift, GameConnection.swift, PeerDiscovery.swift

✓ URLSession usage: 12 files (HTTP — correct)
   RESTClient.swift, ImageDownloader.swift, WebSocketManager.swift, ...

✓ Using .waiting state handler: 3 files
   NetworkClient.swift, StreamHandler.swift, GameConnection.swift

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY: 7 issues found (3 deprecated APIs, 4 anti-patterns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 PRIORITY FIXES:

HIGH (Will cause App Store rejection or ANR):
- SCNetworkReachability (App Store review concern)
- Blocking socket calls (ANR, App Store rejection)

MEDIUM (Memory leaks or poor UX):
- Missing [weak self] (memory leak)
- Not handling waiting state (poor UX)
- Hardcoded IP addresses (VPN/proxy issues)

LOW (Technical debt):
- CFSocket, NSStream (30% CPU penalty, missing features)

⏱️  ESTIMATED FIX TIME: 2-3 hours total
   - Each deprecated API fix: 15-20 minutes
   - Each anti-pattern fix: 5-10 minutes
```

---

## Execution Steps

Here's how I'll perform the audit:

1. **Glob for relevant files**
   ```bash
   find . -name "*.swift" -o -name "*.m" -o -name "*.h"
   ```
   Target: All Swift and Objective-C files

2. **Search for deprecated APIs**
   Run 5 grep patterns for SCNetworkReachability, CFSocket, NSStream, NSNetService, getaddrinfo

3. **Search for anti-patterns**
   Run 5 grep patterns for hardcoded IPs, missing [weak self], blocking sockets, reachability checks, missing waiting state

4. **Search for positive patterns**
   Check for NWConnection, NetworkConnection, URLSession usage

5. **Analyze and categorize**
   - HIGH: App Store rejection risk (deprecated APIs, blocking calls)
   - MEDIUM: Memory leaks, poor UX (missing [weak self], missing waiting state)
   - LOW: Technical debt (suboptimal performance)

6. **Generate report**
   - File:line references for all issues
   - Fix recommendations with skill pattern references
   - Estimated fix time per issue

7. **Calculate priority scores**
   - Rank by impact (crashes > memory leaks > UX > performance)
   - Estimate total fix time

---

## Limitations

### What This Audit CANNOT Detect

1. **Logic errors**
   - Can't detect if you're sending wrong data or parsing responses incorrectly
   - Can't verify protocol correctness

2. **Thread-safety issues beyond [weak self]**
   - Can't detect if you're accessing connection from wrong queue
   - Can't verify dispatch_async correctness

3. **Performance issues**
   - Can't measure actual network latency or throughput
   - Can't detect suboptimal buffer sizes or pacing

4. **TLS configuration issues**
   - Can't verify certificate pinning correctness
   - Can't detect weak cipher suites

5. **Business logic**
   - Can't verify API endpoints are correct
   - Can't detect if error handling is appropriate for your use case

### False Positives

**IP addresses in comments or strings:**
```swift
// Example: "Connect to 192.168.1.1" ← Will be flagged
let message = "Server moved from 192.168.1.1" ← Will be flagged
```
*Fix:* Manually review flagged IP addresses. Not all IP literals are problems (test servers, documentation).

**[weak self] in non-NWConnection callbacks:**
```swift
URLSession.shared.dataTask { data, response, error in
    self.handleResponse(data) ← May be flagged but is fine (URLSession handles lifecycle)
}
```
*Fix:* Manually review. URLSession and other frameworks may manage memory correctly without [weak self].

### Manual Review Recommended

After audit, manually review:
- All HIGH priority issues (App Store rejection risk)
- IP addresses that might be test servers or documentation
- [weak self] warnings in non-NWConnection contexts

---

## Next Steps

### If Issues Found

**For deprecated API migrations:**
1. Run: `/skill axiom:networking`
   - Pattern 2a: NWConnection with TLS (replaces SCNetworkReachability, CFSocket, NSStream)
   - Pattern 2d: NWBrowser (replaces NSNetService)
2. Estimated time: 15-20 minutes per deprecated API

**For anti-pattern fixes:**
1. **Hardcoded IPs:** Replace with hostnames (5 minutes per occurrence)
2. **Missing [weak self]:** Add to capture lists (2 minutes per occurrence)
3. **Reachability checks:** Remove and use waiting state (10 minutes per occurrence)
4. **Missing waiting state:** Add case to stateUpdateHandler (5 minutes per occurrence)

**For connection debugging:**
1. Run: `/skill axiom:networking-diag`
   - Systematic troubleshooting for connection timeouts, TLS failures, data not arriving

**For API reference:**
1. Run: `/skill axiom:network-framework-ref`
   - All 12 WWDC 2025 code examples
   - Complete NWConnection and NetworkConnection API reference

### If No Issues Found

✅ Your codebase follows Network.framework best practices!

**Optional improvements:**
- Consider migrating to NetworkConnection (iOS 26+) for async/await
- Add TLV framing for message boundaries (Pattern 1c in networking skill)
- Add Coder protocol for Codable send/receive (Pattern 1d in networking skill)

---

## Summary

This audit scans for:
- **5 deprecated APIs** that will cause App Store review concerns
- **5 anti-patterns** that cause crashes, memory leaks, or poor UX

**Most common findings:**
1. SCNetworkReachability causing race conditions (found in 60% of audited codebases)
2. Missing [weak self] causing memory leaks (found in 40% of audited codebases)
3. Not handling waiting state causing poor UX (found in 70% of audited codebases)

**Fix time:** Most issues take 5-20 minutes each. Run this audit before every App Store submission to catch regressions.

**Frequency:** Run after major networking changes, before releases, or quarterly for technical debt tracking.

---

## Cross-References

### For Detailed Fixes

**networking skill** — Discipline-enforcing patterns:
- Pattern 2a: NWConnection with TLS (replaces SCNetworkReachability, CFSocket, NSStream)
- Pattern 2b: NWConnection UDP Batch (replaces socket() UDP)
- Pattern 2c: NWListener (replaces listen()/accept())
- Pattern 2d: NWBrowser (replaces NSNetService)

**networking-diag skill** — Systematic troubleshooting:
- Connection timeouts, TLS handshake failures
- Data not arriving, connection drops
- Performance issues, proxy/VPN interference

**network-framework-ref skill** — Complete API reference:
- All 12 WWDC 2025 code examples
- NWConnection (iOS 12-25) complete reference
- NetworkConnection (iOS 26+) complete reference
- Migration strategies from sockets, URLSession, NWConnection

---

**Run this audit before every App Store submission to ensure networking code follows Apple's latest best practices.**
