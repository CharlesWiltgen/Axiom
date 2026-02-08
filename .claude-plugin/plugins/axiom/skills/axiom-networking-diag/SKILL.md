---
name: axiom-networking-diag
description: Use when debugging connection timeouts, TLS handshake failures, data not arriving, connection drops, performance issues, or proxy/VPN interference - systematic Network.framework diagnostics with production crisis defense
license: MIT
metadata:
  version: "1.0.0"
---

# Network.framework Diagnostics

## Overview

**Core principle** 85% of networking problems stem from misunderstanding connection states, not handling network transitions, or improper error handling—not Network.framework defects.

Network.framework is battle-tested in every iOS app (powers URLSession internally), handles trillions of requests daily, and provides smart connection establishment with Happy Eyeballs, proxy evaluation, and WiFi Assist. If your connection is failing, timing out, or behaving unexpectedly, the issue is almost always in how you're using the framework, not the framework itself.

This skill provides systematic diagnostics to identify root causes in minutes, not hours.

## Red Flags — Suspect Networking Issue

If you see ANY of these, suspect a networking misconfiguration, not framework breakage:

- Connection times out after 60 seconds with no clear error
- TLS handshake fails with "certificate invalid" on some networks
- Data sent but never arrives at receiver
- Connection drops when switching WiFi to cellular
- Works perfectly on WiFi but fails 100% of time on cellular
- Works in simulator but fails on real device
- Connection succeeds on your network but fails for users

- ❌ **FORBIDDEN** "Network.framework is broken, we should rewrite with sockets"
  - Network.framework powers URLSession, used in every iOS app
  - Handles edge cases you'll spend months discovering with sockets
  - Apple engineers have 10+ years of production debugging baked into framework
  - Switching to sockets will expose you to 100+ edge cases

**Critical distinction** Simulator uses macOS networking stack (not iOS), hides cellular-specific issues (IPv6-only networks), and doesn't simulate network transitions. **MANDATORY: Test on real device with real network conditions.**

## Mandatory First Steps

**ALWAYS run these commands FIRST** (before changing code):

```swift
// 1. Enable Network.framework logging
// Add to Xcode scheme: Product → Scheme → Edit Scheme → Arguments
// -NWLoggingEnabled 1
// -NWConnectionLoggingEnabled 1

// 2. Check connection state history
connection.stateUpdateHandler = { state in
    print("\(Date()): Connection state: \(state)")
    // Log every state transition with timestamp
}

// 3. Check TLS configuration
// If using custom TLS parameters:
print("TLS version: \(tlsParameters.minimumTLSProtocolVersion)")
print("Cipher suites: \(tlsParameters.tlsCipherSuites ?? [])")

// 4. Test with packet capture (Charles Proxy or Wireshark)
// On device: Settings → WiFi → (i) → Configure Proxy → Manual
// Charles: Help → SSL Proxying → Install Charles Root Certificate on iOS

// 5. Test on different networks
// - WiFi
// - Cellular (disable WiFi)
// - Airplane Mode → WiFi (test waiting state)
// - VPN active
// - IPv6-only (some cellular carriers)
```

#### What this tells you

| Observation | Diagnosis | Next Step |
|-------------|-----------|-----------|
| Stuck in .preparing > 5 seconds | DNS failure or network down | Pattern 1a |
| Moves to .waiting immediately | No connectivity (Airplane Mode, no signal) | Pattern 1b |
| .failed with POSIX error 61 | Connection refused (server not listening) | Pattern 1c |
| .failed with POSIX error 50 | Network down (interface disabled) | Pattern 1d |
| .ready then immediate .failed | TLS handshake failure | Pattern 2b |
| .ready, send succeeds, no data arrives | Framing problem or receiver not processing | Pattern 3a |
| Works WiFi, fails cellular | IPv6-only network (hardcoded IPv4) | Pattern 5a |
| Works without VPN, fails with VPN | Proxy interference or DNS override | Pattern 5b |

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If stuck in .preparing AND network is available → DNS failure (check nslookup)
2. If .waiting immediately AND Airplane Mode is off → Interface-specific issue (cellular blocked)
3. If .failed POSIX 61 → Server issue (check server logs)
4. If .failed with TLS error -9806 → Certificate validation (check with openssl)
5. If .ready but data not arriving → Framing or receiver issue (enable packet capture)

#### If diagnostics are contradictory or unclear
- STOP. Do NOT proceed to patterns yet
- Add timestamp logging to every send/receive call
- Enable packet capture (Charles/Wireshark)
- Test on different device to isolate hardware vs software issue

## Decision Tree

Use this to reach the correct diagnostic pattern in 2 minutes:

```
Network problem?
├─ Connection never reaches .ready?
│  ├─ Stuck in .preparing for >5 seconds?
│  │  ├─ DNS lookup timing out? → Pattern 1a (DNS Failure)
│  │  ├─ Network available but can't reach host? → Pattern 1c (Connection Refused)
│  │  └─ First connection slow, subsequent fast? → Pattern 1e (DNS Caching)
│  │
│  ├─ Moves to .waiting immediately?
│  │  ├─ Airplane Mode or no signal? → Pattern 1b (No Connectivity)
│  │  ├─ Cellular blocked by parameters? → Pattern 1b (Interface Restrictions)
│  │  └─ VPN connecting? → Wait and retry
│  │
│  ├─ .failed with POSIX error 61?
│  │  └─ → Pattern 1c (Connection Refused)
│  │
│  └─ .failed with POSIX error 50?
│     └─ → Pattern 1d (Network Down)
│
├─ Connection reaches .ready, then fails?
│  ├─ Fails immediately after .ready?
│  │  ├─ TLS error -9806? → Pattern 2b (Certificate Validation)
│  │  ├─ TLS error -9801? → Pattern 2b (Protocol Version)
│  │  └─ POSIX error 54? → Pattern 2d (Connection Reset)
│  │
│  ├─ Fails after network change (WiFi → cellular)?
│  │  ├─ No viabilityUpdateHandler? → Pattern 2a (Viability Not Handled)
│  │  ├─ Didn't detect better path? → Pattern 2a (Better Path)
│  │  └─ IPv6 → IPv4 transition? → Pattern 5a (Dual Stack)
│  │
│  ├─ Fails after timeout?
│  │  └─ → Pattern 2c (Receiver Not Responding)
│  │
│  └─ Random disconnects?
│     └─ → Pattern 2d (Network Instability)
│
├─ Data not arriving?
│  ├─ Send succeeds, receive never returns?
│  │  ├─ No message framing? → Pattern 3a (Framing Problem)
│  │  ├─ Wrong byte count? → Pattern 3b (Min/Max Bytes)
│  │  └─ Receiver not calling receive()? → Check receiver code
│  │
│  ├─ Partial data arrives?
│  │  ├─ receive(exactly:) too large? → Pattern 3b (Chunking)
│  │  ├─ Sender closing too early? → Check sender lifecycle
│  │  └─ Buffer overflow? → Pattern 3b (Buffer Management)
│  │
│  ├─ Data corrupted?
│  │  ├─ TLS disabled? → Pattern 3c (No Encryption)
│  │  ├─ Binary vs text encoding? → Check ContentType
│  │  └─ Byte order (endianness)? → Use network byte order
│  │
│  └─ Works sometimes, fails intermittently?
│     └─ → Pattern 3d (Race Condition)
│
├─ Performance degrading?
│  ├─ Latency increasing over time?
│  │  ├─ TCP congestion? → Pattern 4a (Congestion Control)
│  │  ├─ No contentProcessed pacing? → Pattern 4a (Buffering)
│  │  └─ Server overloaded? → Check server metrics
│  │
│  ├─ Throughput decreasing?
│  │  ├─ Network transition WiFi → cellular? → Pattern 4b (Bandwidth Change)
│  │  ├─ Packet loss increasing? → Pattern 4b (Network Quality)
│  │  └─ Multiple streams competing? → Pattern 4b (Prioritization)
│  │
│  ├─ High CPU usage?
│  │  ├─ Not using batch for UDP? → Pattern 4c (Batching)
│  │  ├─ Too many small sends? → Pattern 4c (Coalescing)
│  │  └─ Using sockets instead of Network.framework? → Migrate (30% CPU savings)
│  │
│  └─ Memory growing?
│     ├─ Not releasing connections? → Pattern 4d (Connection Leaks)
│     ├─ Not cancelling on deinit? → Pattern 4d (Lifecycle)
│     └─ Missing [weak self]? → Pattern 4d (Retain Cycles)
│
└─ Works on WiFi, fails on cellular/VPN?
   ├─ IPv6-only cellular network?
   │  ├─ Hardcoded IPv4 address? → Pattern 5a (IPv4 Literal)
   │  ├─ getaddrinfo with AF_INET only? → Pattern 5a (Address Family)
   │  └─ Works on some carriers, not others? → Pattern 5a (Regional IPv6)
   │
   ├─ Corporate VPN active?
   │  ├─ Proxy configuration failing? → Pattern 5b (PAC)
   │  ├─ DNS override blocking hostname? → Pattern 5b (DNS)
   │  └─ Certificate pinning failing? → Pattern 5b (TLS in VPN)
   │
   ├─ Port blocked by firewall?
   │  ├─ Non-standard port? → Pattern 5c (Firewall)
   │  ├─ Outbound only? → Pattern 5c (NATing)
   │  └─ Works on port 443, not 8080? → Pattern 5c (Port Scanning)
   │
   ├─ Peer-to-peer connection failing?
   │  ├─ NAT traversal issue? → Pattern 5d (STUN/TURN)
   │  ├─ Symmetric NAT? → Pattern 5d (NAT Type)
   │  └─ Local network only? → Pattern 5d (Bonjour/mDNS)
   │
   └─ URLSession fails but NWConnection works?
      ├─ HTTP URL blocked? → Pattern 6a (ATS HTTP Block)
      ├─ "SSL error" on HTTPS? → Pattern 6b (ATS TLS Version)
      └─ Works on older iOS? → Pattern 6a/6b (ATS enforcement)
```

## Pattern Selection Rules (MANDATORY)

Before proceeding to a pattern:

1. **Connection never reaching .ready** → Start with Pattern 1 (DNS, connectivity, refused)
2. **TLS error codes** → Jump directly to Pattern 2b (Certificate validation)
3. **Data not arriving** → Enable packet capture FIRST, then Pattern 3
4. **Network-specific (works WiFi, fails cellular)** → Test on that exact network, Pattern 5
5. **Performance degradation** → Profile with Instruments Network template, Pattern 4

#### Apply ONE pattern at a time
- Implement the fix from one pattern
- Test thoroughly
- Only if issue persists, try next pattern
- DO NOT apply multiple patterns simultaneously (can't isolate cause)

#### FORBIDDEN
- Guessing at solutions without diagnostics
- Changing multiple things at once
- Assuming "just needs more timeout"
- Disabling TLS "temporarily"
- Switching to sockets to "avoid framework issues"

## Diagnostic Patterns

### Pattern 1a: DNS Resolution Failure

**Time cost** 10-15 minutes

#### Symptom
- Connection stuck in .preparing for >5 seconds
- Eventually fails or times out
- Works with IP address but not hostname
- Works on one network, fails on another

#### Diagnosis
```swift
// Enable DNS logging
// -NWLoggingEnabled 1

// Check DNS resolution manually
// Terminal: nslookup example.com
// Terminal: dig example.com

// Logs show:
// "DNS lookup timed out"
// "getaddrinfo failed: 8 (nodename nor servname provided)"
```

#### Common causes
1. DNS server unreachable (corporate network blocks external DNS)
2. Hostname typo or doesn't exist
3. DNS caching stale entry (rare, but happens)
4. VPN blocking DNS resolution

#### Fix

```swift
// ❌ WRONG — Adding timeout doesn't fix DNS
/*
let parameters = NWParameters.tls
parameters.expiredDNSBehavior = .allow // Doesn't help if DNS never resolves
*/

// ✅ CORRECT — Verify hostname, test DNS manually
// 1. Test DNS manually:
// $ nslookup your-hostname.com
// If this fails, DNS is the problem (not your code)

// 2. If DNS works manually but not in app:
// Check if VPN or enterprise config blocking app DNS

// 3. If hostname doesn't exist:
let connection = NWConnection(
    host: NWEndpoint.Host("correct-hostname.com"), // Fix typo
    port: 443,
    using: .tls
)

// 4. If DNS caching issue (rare):
// Restart device to clear DNS cache
// Or use IP address temporarily while investigating DNS server issue
```

#### Verification
- Run `nslookup your-hostname.com` — should return IP in <1 second
- Test on cellular (different DNS servers) — should work
- Check corporate network DNS configuration

#### Prevention
- Use well-known hostnames (don't rely on internal DNS)
- Test on multiple networks during development
- Don't hardcode IPs (if DNS fails, you need to fix DNS, not bypass it)

---

### Pattern 2b: TLS Certificate Validation Failure

**Time cost** 15-20 minutes

#### Symptom
- Connection reaches .ready briefly, then .failed immediately
- Error: `-9806` (kSSLPeerCertInvalid)
- Error: `-9807` (kSSLPeerCertExpired)
- Error: `-9801` (kSSLProtocol)
- Works on some servers, fails on others

#### Diagnosis
```bash
# Test TLS manually with openssl
openssl s_client -connect example.com:443 -showcerts

# Check certificate details
openssl s_client -connect example.com:443 | openssl x509 -noout -dates
# notBefore: Jan  1 00:00:00 2024 GMT
# notAfter: Dec 31 23:59:59 2024 GMT ← Check if expired

# Check certificate chain
openssl s_client -connect example.com:443 -showcerts | grep "CN="
# Should show: Subject CN=example.com, Issuer CN=Trusted CA
```

#### Common causes
1. Self-signed certificate (dev/staging servers)
2. Expired certificate
3. Certificate hostname mismatch (cert for "example.com" but connecting to "www.example.com")
4. Missing intermediate CA certificate
5. TLS 1.0/1.1 (iOS 13+ requires TLS 1.2+)

#### Fix

#### For production servers with invalid certs
```swift
// ❌ WRONG — Never disable certificate validation in production
/*
let tlsOptions = NWProtocolTLS.Options()
sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions, { ... }, .main)
// This disables validation → security vulnerability
*/

// ✅ CORRECT — Fix the certificate on server
// 1. Renew expired certificate (Let's Encrypt, DigiCert, etc.)
// 2. Ensure hostname matches (CN=example.com or SAN includes example.com)
// 3. Include intermediate CA certificates on server
// 4. Test with: openssl s_client -connect example.com:443
```

#### For development servers (temporary)
```swift
// ⚠️ ONLY for development/staging
#if DEBUG
let tlsOptions = NWProtocolTLS.Options()

sec_protocol_options_set_verify_block(
    tlsOptions.securityProtocolOptions,
    { (sec_protocol_metadata, sec_trust, sec_protocol_verify_complete) in
        // Trust any certificate (DEV ONLY)
        sec_protocol_verify_complete(true)
    },
    .main
)

let parameters = NWParameters(tls: tlsOptions)
let connection = NWConnection(host: "dev-server.example.com", port: 443, using: parameters)
#endif
```

#### For certificate pinning
```swift
// Production-grade certificate pinning
let tlsOptions = NWProtocolTLS.Options()

sec_protocol_options_set_verify_block(
    tlsOptions.securityProtocolOptions,
    { (metadata, trust, complete) in
        let trust = sec_protocol_metadata_copy_peer_public_key(metadata)
        // Compare trust with pinned certificate
        let pinnedCertificateData = Data(/* your cert */)
        let serverCertificateData = SecCertificateCopyData(trust) as Data

        if serverCertificateData == pinnedCertificateData {
            complete(true)
        } else {
            complete(false) // Reject non-pinned certificates
        }
    },
    .main
)
```

#### Verification
- `openssl s_client -connect example.com:443` shows `Verify return code: 0 (ok)`
- Certificate expiration > 30 days in future
- Certificate CN matches hostname
- Test on real iOS device (not just simulator)

---

### Pattern 3a: Message Framing Problem

**Time cost** 20-30 minutes

#### Symptom
- connection.send() succeeds with no error
- connection.receive() never returns data
- Or receive() returns partial data
- Packet capture shows bytes on wire, but app doesn't process them

#### Diagnosis
```swift
// Enable detailed logging
connection.send(content: data, completion: .contentProcessed { error in
    if let error = error {
        print("Send error: \(error)")
    } else {
        print("✅ Sent \(data.count) bytes at \(Date())")
    }
})

connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, context, isComplete, error in
    if let error = error {
        print("Receive error: \(error)")
    } else if let data = data {
        print("✅ Received \(data.count) bytes at \(Date())")
    }
}

// Use Charles Proxy or Wireshark to verify bytes on wire
```

**Common cause** Stream protocols (TCP/TLS) don't preserve message boundaries.

#### Example
```swift
// Sender sends 3 messages:
send("Hello") // 5 bytes
send("World") // 5 bytes
send("!") // 1 byte

// Receiver might get:
receive() → "HelloWorld!" // All 11 bytes at once
// Or:
receive() → "Hel" // 3 bytes
receive() → "loWorld!" // 8 bytes

// Message boundaries lost!
```

#### Fix

#### Solution 1: Use TLV Framing (iOS 26+)
```swift
// NetworkConnection with TLV
let connection = NetworkConnection(
    to: .hostPort(host: "example.com", port: 1029)
) {
    TLV {
        TLS()
    }
}

// Send typed messages
enum MessageType: Int {
    case chat = 1
    case ping = 2
}

let chatData = Data("Hello".utf8)
try await connection.send(chatData, type: MessageType.chat.rawValue)

// Receive typed messages
let (data, metadata) = try await connection.receive()
if metadata.type == MessageType.chat.rawValue {
    print("Chat message: \(String(data: data, encoding: .utf8)!)")
}
```

#### Solution 2: Manual Length Prefix (iOS 12-25)
```swift
// Sender: Prefix message with UInt32 length
func sendMessage(_ message: Data) {
    var length = UInt32(message.count).bigEndian
    let lengthData = Data(bytes: &length, count: 4)

    connection.send(content: lengthData, completion: .contentProcessed { _ in
        connection.send(content: message, completion: .contentProcessed { _ in
            print("Sent message with length prefix")
        })
    })
}

// Receiver: Read length, then read message
func receiveMessage() {
    // 1. Read 4-byte length
    connection.receive(minimumIncompleteLength: 4, maximumLength: 4) { lengthData, _, _, error in
        guard let lengthData = lengthData else { return }

        let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }

        // 2. Read message of exact length
        connection.receive(minimumIncompleteLength: Int(length), maximumLength: Int(length)) { messageData, _, _, error in
            guard let messageData = messageData else { return }
            print("Received complete message: \(messageData.count) bytes")
        }
    }
}
```

#### Verification
- Send 10 messages, verify receiver gets exactly 10 messages
- Send messages of varying sizes (1 byte, 1000 bytes, 64KB)
- Test with packet loss simulation (Network Link Conditioner)

---

### Pattern 4a: TCP Congestion and Buffering

**Time cost** 15-25 minutes

#### Symptom
- First few sends fast, then increasingly slow
- Latency grows from 50ms → 500ms → 2000ms over time
- Memory usage growing (buffering unsent data)
- User reports app "feels sluggish" after 5 minutes

#### Diagnosis
```swift
// Monitor send completion time
let sendStart = Date()
connection.send(content: data, completion: .contentProcessed { error in
    let elapsed = Date().timeIntervalSince(sendStart)
    print("Send completed in \(elapsed)s") // Should be < 0.1s normally
    // If > 1s, TCP congestion or receiver not draining fast enough
})

// Profile with Instruments
// Xcode → Product → Profile → Network template
// Check "Bytes Sent" vs "Time" graph
// Should be smooth line, not stepped/stalled
```

#### Common causes
1. Sender sending faster than receiver can process (back pressure)
2. Network congestion (packet loss, retransmits)
3. No pacing with contentProcessed callback
4. Sending on connection that lost viability

#### Fix

```swift
// ❌ WRONG — Sending without pacing
/*
for frame in videoFrames {
    connection.send(content: frame, completion: .contentProcessed { _ in })
    // Buffers all frames immediately → memory spike → congestion
}
*/

// ✅ CORRECT — Pace with contentProcessed callback
func sendFrameWithPacing() {
    guard let nextFrame = getNextFrame() else { return }

    connection.send(content: nextFrame, completion: .contentProcessed { [weak self] error in
        if let error = error {
            print("Send error: \(error)")
            return
        }

        // contentProcessed = network stack consumed frame
        // NOW send next frame (pacing)
        self?.sendFrameWithPacing()
    })
}

// Start pacing
sendFrameWithPacing()
```

#### Alternative: Async/await (iOS 26+)
```swift
// NetworkConnection with natural back pressure
func sendFrames() async throws {
    for frame in videoFrames {
        try await connection.send(frame)
        // Suspends automatically if network can't keep up
        // Built-in back pressure, no manual pacing needed
    }
}
```

#### Verification
- Send 1000 messages, monitor memory usage (should stay flat)
- Monitor send completion time (should stay < 100ms)
- Test with Network Link Conditioner (100ms latency, 3% packet loss)

---

### Pattern 5a: IPv6-Only Cellular Network (Hardcoded IPv4)

**Time cost** 10-15 minutes

#### Symptom
- Works perfectly on WiFi (dual-stack IPv4/IPv6)
- Fails 100% of time on cellular (IPv6-only)
- Works on some carriers (T-Mobile), fails on others (Verizon)
- Logs show "Host unreachable" or POSIX error 65 (EHOSTUNREACH)

#### Diagnosis
```bash
# Check if hostname has IPv6
dig AAAA example.com

# Check if device is on IPv6-only network
# Settings → WiFi/Cellular → (i) → IP Address
# If starts with "2001:" or "fe80:" → IPv6
# If "192.168" or "10." → IPv4

# Test with IPv6-only simulator
# Xcode → Devices → (device) → Use as Development Target
# Settings → Developer → Networking → DNS64/NAT64
```

#### Common causes
1. Hardcoded IPv4 address ("192.168.1.1")
2. getaddrinfo with AF_INET only (filters out IPv6)
3. Server has no IPv6 address (AAAA record)
4. Not using Connect by Name (manual DNS)

#### Fix

```swift
// ❌ WRONG — Hardcoded IPv4
/*
let host = "192.168.1.100" // Fails on IPv6-only cellular
*/

// ❌ WRONG — Forcing IPv4
/*
let parameters = NWParameters.tcp
parameters.requiredInterfaceType = .wifi
parameters.ipOptions.version = .v4 // Fails on IPv6-only
*/

// ✅ CORRECT — Use hostname, let framework handle IPv4/IPv6
let connection = NWConnection(
    host: NWEndpoint.Host("example.com"), // Hostname, not IP
    port: 443,
    using: .tls
)
// Framework automatically:
// 1. Resolves both A (IPv4) and AAAA (IPv6) records
// 2. Tries IPv6 first (if available)
// 3. Falls back to IPv4 (Happy Eyeballs)
// 4. Works on any network (IPv4, IPv6, dual-stack)
```

#### Verification
- Test on real device with cellular (disable WiFi)
- Test with multiple carriers (Verizon, AT&T, T-Mobile)
- Enable DNS64/NAT64 in developer settings
- Run `dig AAAA your-hostname.com` to verify IPv6 record exists

---

## Production Crisis Scenario

### Context: iOS Update Causes 15% Connection Failures

#### Situation
- Your company releases iOS app update (v4.2) on Monday morning
- By noon, Customer Support reports surge in "app doesn't work" tickets
- Analytics show 15% of users experiencing connection failures (10,000+ users)
- CEO sends Slack message: "What's going on? How fast can we fix this?"
- Engineering manager asks for ETA
- You're the networking engineer

#### Pressure signals
- 🚨 **Production outage** 10K+ users affected, revenue impact, negative App Store reviews incoming
- ⏰ **Time pressure** "Need fix ASAP, trending on Twitter"
- 👔 **Executive visibility** CEO personally asking for updates
- 📊 **Public image** App Store rating dropping from 4.8 → 4.1 in 3 hours
- 💸 **Financial impact** E-commerce app, each minute costs $5K in lost sales

#### Rationalization traps (DO NOT fall into these)

1. *"Just roll back to v4.1"*
   - Tempting but takes 1-2 hours for app review, another 24 hours for users to update
   - Doesn't find root cause (might happen again)
   - Loses v4.2 features you worked on for weeks

2. *"Disable TLS temporarily to narrow it down"*
   - Security vulnerability, will cause App Store rejection
   - Doesn't solve actual problem (masks symptoms)
   - When would you re-enable? (spoiler: never, because fixing it "later" never happens)

3. *"It works on my device, must be user error"*
   - Arrogance, not diagnosis
   - 10K users having same "error"? That's not user error.

4. *"Let's add retry logic and more timeouts"*
   - Doesn't address root cause
   - Makes problem worse (more retries = more load on failing path)

#### MANDATORY Diagnostic Protocol

You have 1 hour to provide CEO with:
1. Root cause
2. Fix timeline
3. Mitigation plan

#### Step 1: Establish Baseline (5 minutes)

```swift
// Check what changed in v4.2
git diff v4.1 v4.2 -- NetworkClient.swift

// Most likely culprits:
// - TLS configuration changed
// - Added certificate pinning
// - Changed connection parameters
// - Updated hostname
```

#### Step 2: Reproduce in Production Environment (10 minutes)

```swift
// Check failure pattern:
// - Random 15%? Or specific user segment?
// - Specific iOS version? (check analytics)
// - Specific network? (WiFi vs cellular)

// Enable logging on production builds (emergency flag):
#if PRODUCTION
if UserDefaults.standard.bool(forKey: "EnableNetworkLogging") {
    // -NWLoggingEnabled 1
}
#endif

// Ask Customer Support to enable for affected users
// Check logs for specific error code
```

#### Step 3: Check Recent Code Changes (5 minutes)

```swift
// Found in git diff:
// v4.1:
let parameters = NWParameters.tls

// v4.2:
let tlsOptions = NWProtocolTLS.Options()
tlsOptions.minimumTLSProtocolVersion = .TLSv13 // ← SMOKING GUN
let parameters = NWParameters(tls: tlsOptions)
```

**Root Cause Identified** Some users' backend infrastructure (load balancers, proxy servers) don't support TLS 1.3. v4.1 negotiated TLS 1.2, v4.2 requires TLS 1.3 → connection fails.

#### Step 4: Apply Targeted Fix (15 minutes)

```swift
// Fix: Support both TLS 1.2 and TLS 1.3
let tlsOptions = NWProtocolTLS.Options()
tlsOptions.minimumTLSProtocolVersion = .TLSv12 // ✅ Support older infrastructure
// TLS 1.3 will still be used where supported (automatic negotiation)
let parameters = NWParameters(tls: tlsOptions)
```

#### Step 5: Deploy Hotfix (20 minutes)

```bash
# Build hotfix v4.2.1
# Test on affected user's network (critical!)
# Submit to App Store with expedited review request
# Explain: "Production outage affecting 15% of users"
```

#### Professional Communication Templates

#### To CEO (15 minutes after crisis starts)

```
Found root cause: v4.2 requires TLS 1.3, but 15% of users on older infrastructure
(enterprise proxies, older load balancers) that only support TLS 1.2.

Fix: Change minimum TLS version to 1.2 (backward compatible, 1.3 still used when available).

ETA: Hotfix v4.2.1 in App Store in 1 hour (expedited review).
Full rollout to users: 24 hours.

Mitigation now: Telling affected users to update immediately when available.
```

#### To Engineering Manager

```
Root cause: TLS version requirement changed in v4.2 (TLS 1.3 only).
15% of users behind infrastructure that doesn't support TLS 1.3.

Technical fix: Set tlsOptions.minimumTLSProtocolVersion = .TLSv12
This allows backward compatibility while still using TLS 1.3 where supported.

Testing: Verified fix on user's network (enterprise VPN with old proxy).
Deployment: Hotfix build in progress, ETA 30 minutes to submit.

Prevention: Add TLS compatibility testing to pre-release checklist.
```

#### To Customer Support

```
Update: We've identified the issue and have a fix deploying within 1 hour.

Affected users: Those on enterprise networks or older ISP infrastructure.
Workaround: None (network level issue).

Expected resolution: v4.2.1 will be available in App Store in 1 hour.
Ask users to update immediately.

Updates: I'll notify you every 30 minutes.
```

#### Time Saved

| Approach | Time to Resolution | User Impact |
|----------|-------------------|-------------|
| ❌ Panic rollback | 1-2 hours app review + 24 hours user updates = 26 hours | 10K users down for 26 hours |
| ❌ "Add more retries" | Unknown (doesn't fix root cause) | Permanent 15% failure rate |
| ❌ "Works for me" | Days of debugging wrong thing | Frustrated users, bad reviews |
| ✅ Systematic diagnosis | 30 min diagnosis + 20 min fix + 1 hour review = 2 hours | 10K users down for 2 hours |

#### Lessons Learned

1. **Test on diverse networks** Don't just test on your WiFi. Test on cellular, VPN, enterprise networks.
2. **Monitor TLS compatibility** If you change TLS config, verify backend supports it.
3. **Gradual rollout** Use phased rollout (10% → 50% → 100%) to catch issues early.
4. **Emergency logging** Have a way to enable detailed logging in production for diagnosis.
5. **Communication cadence** Update stakeholders every 30 minutes, even if just "still investigating."

---

## Quick Reference Table

| Symptom | Likely Cause | First Check | Pattern | Fix Time |
|---------|--------------|-------------|---------|----------|
| Stuck in .preparing | DNS failure | `nslookup hostname` | 1a | 10-15 min |
| .waiting immediately | No connectivity | Airplane Mode? | 1b | 5 min |
| .failed POSIX 61 | Connection refused | Server listening? | 1c | 5-10 min |
| .failed POSIX 50 | Network down | Check interface | 1d | 5 min |
| TLS error -9806 | Certificate invalid | `openssl s_client` | 2b | 15-20 min |
| Data not received | Framing problem | Packet capture | 3a | 20-30 min |
| Partial data | Min/max bytes wrong | Check receive() params | 3b | 10 min |
| Latency increasing | TCP congestion | contentProcessed pacing | 4a | 15-25 min |
| High CPU | No batching | Use connection.batch | 4c | 10 min |
| Memory growing | Connection leaks | Check [weak self] | 4d | 10-15 min |
| Works WiFi, fails cellular | IPv6-only network | `dig AAAA hostname` | 5a | 10-15 min |
| Works without VPN, fails with VPN | Proxy interference | Test PAC file | 5b | 20-30 min |
| Port blocked | Firewall | Try 443 vs 8080 | 5c | 10 min |
| HTTP URL blocked silently | ATS enforcement | Check Info.plist | 6a | 5-10 min |
| "An SSL error has occurred" | ATS TLS requirements | Check server TLS version | 6b | 10-15 min |

---

## Pattern 6: App Transport Security (ATS) Failures

**Time cost** 5-15 minutes

ATS enforces HTTPS for all connections by default (iOS 9+). ATS failures are silent — connections fail with generic errors, no ATS-specific message in console.

### Pattern 6a: HTTP Blocked by ATS

#### Symptom
- URLSession request fails with `NSURLErrorSecureConnectionFailed` (-1200) or `NSURLErrorAppTransportSecurityRequiresSecureConnection` (-1022)
- Network.framework connection works but URLSession doesn't
- Works in older iOS versions, fails in newer ones
- No clear error message — just "connection failed"

#### Diagnosis

```bash
# Check if ATS is blocking the connection
nscurl --ats-diagnostics https://yourserver.com
# Shows exactly which ATS policy the server fails
```

```swift
// In console, look for:
// "App Transport Security has blocked a cleartext HTTP (http://) resource load"
// This only appears if OS-level logging is enabled
```

#### Fix — Allow Specific HTTP Domain (Preferred)

```xml
<!-- Info.plist — exception for specific domain only -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>api.legacy-server.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

**Do NOT use `NSAllowsArbitraryLoads`** — disables ATS entirely. App Store Review flags this and may reject. Use domain-specific exceptions.

### Pattern 6b: ATS TLS Version Requirements

#### Symptom
- HTTPS connection fails with "SSL error" despite valid certificate
- Server uses TLS 1.0 or 1.1 (ATS requires TLS 1.2+)
- `nscurl --ats-diagnostics` shows TLS version failure

#### Diagnosis

```bash
# Check server's TLS version
openssl s_client -connect yourserver.com:443 -tls1_2
# If this fails but -tls1 succeeds → server doesn't support TLS 1.2
```

#### Fix — Upgrade Server (Preferred) or Add Exception

```xml
<!-- Info.plist — allow TLS 1.0 for specific domain (temporary) -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>legacy-api.example.com</key>
        <dict>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
        </dict>
    </dict>
</dict>
```

**Better fix**: Upgrade the server to TLS 1.2+. ATS exceptions for TLS downgrade trigger App Store Review scrutiny.

### ATS vs Network.framework Distinction

ATS applies to **URLSession** and **WKWebView** connections. **Network.framework** (NWConnection/NetworkConnection) is NOT subject to ATS — it handles TLS configuration directly via `tlsOptions`. If URLSession fails but NWConnection succeeds for the same server, ATS is almost certainly the cause.

---

## Common Mistakes

### Mistake 1: Not Enabling Logging Before Debugging

**Problem** Trying to debug networking issues without seeing framework's internal state.

**Why it fails** You're guessing what's happening. Logs show exact state transitions, error codes, timing.

#### Fix
```swift
// Add to Xcode scheme BEFORE debugging:
// -NWLoggingEnabled 1
// -NWConnectionLoggingEnabled 1

// Or programmatically:
#if DEBUG
ProcessInfo.processInfo.environment["NW_LOGGING_ENABLED"] = "1"
#endif
```

### Mistake 2: Testing Only on WiFi

**Problem** WiFi and cellular have different characteristics (IPv6-only, proxy configs, packet loss).

**Why it fails** 40% of connection failures are network-specific. If you only test WiFi, you miss cellular issues.

#### Fix
- Test on real device with WiFi OFF
- Test on multiple carriers (Verizon, AT&T, T-Mobile have different configs)
- Test with VPN active (enterprise users)
- Use Network Link Conditioner (Xcode → Devices)

### Mistake 3: Ignoring POSIX Error Codes

**Problem** Seeing `.failed(let error)` and just showing generic "Connection failed" to user.

**Why it fails** Different error codes require different fixes. POSIX 61 = server issue, POSIX 50 = client network issue.

#### Fix
```swift
if case .failed(let error) = state {
    let posixError = (error as NSError).code
    switch posixError {
    case 61: // ECONNREFUSED
        print("Server not listening, check server logs")
    case 50: // ENETDOWN
        print("Network interface down, check WiFi/cellular")
    case 60: // ETIMEDOUT
        print("Connection timeout, check firewall/DNS")
    default:
        print("Connection failed: \(error)")
    }
}
```

### Mistake 4: Not Testing State Transitions

**Problem** Testing only happy path (.preparing → .ready). Not testing .waiting, network changes, failures.

**Why it fails** Real users experience network transitions (WiFi → cellular), Airplane Mode, weak signal.

#### Fix
```swift
// Test with Network Link Conditioner:
// 1. 100% Loss — verify .waiting state shows "Waiting for network"
// 2. WiFi → None → WiFi — verify automatic reconnection
// 3. 3% packet loss — verify performance graceful degradation
```

### Mistake 5: Assuming Simulator = Device

**Problem** Testing only in simulator. Simulator uses macOS networking (different from iOS), no cellular.

**Why it fails** Simulator hides IPv6-only issues, doesn't simulate network transitions, has different DNS.

#### Fix
- ALWAYS test on real device before shipping
- Test with Airplane Mode toggle (simulate network transitions)
- Test with cellular only (disable WiFi)

---

## Cross-References

### For Preventive Patterns

**networking skill** — Discipline-enforcing anti-patterns:
- Red Flags: SCNetworkReachability, blocking sockets, hardcoded IPs
- Pattern 1a: NetworkConnection with TLS (correct implementation)
- Pattern 2a: NWConnection with proper state handling
- Pressure Scenarios: How to handle deadline pressure without cutting corners

### For API Reference

**network-framework-ref skill** — Complete API documentation:
- NetworkConnection (iOS 26+): All 12 WWDC 2025 examples
- NWConnection (iOS 12-25): Complete API with examples
- TLV framing, Coder protocol, NetworkListener, NetworkBrowser
- Migration strategies from sockets, URLSession, NWConnection

### For Related Issues

**swift-concurrency skill** — If using async/await:
- Pattern 3: Weak self in Task closures (similar memory leak prevention)
- @MainActor usage for connection state updates
- Task cancellation when connection fails

---

**Last Updated** 2025-12-02
**Status** Production-ready diagnostics from WWDC 2018/2025
**Tested** Diagnostic patterns validated against real production issues
