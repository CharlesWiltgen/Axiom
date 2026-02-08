---
name: axiom-network-framework-ref
description: Reference — Comprehensive Network.framework guide covering NetworkConnection (iOS 26+), NWConnection (iOS 12-25), TLV framing, Coder protocol, NetworkListener, NetworkBrowser, Wi-Fi Aware discovery, and migration strategies
license: MIT
compatibility: iOS 12+ (NWConnection), iOS 26+ (NetworkConnection)
metadata:
  version: "1.0.0"
  last-updated: "2025-12-02"
---

# Network.framework API Reference

## Overview

Network.framework is Apple's modern networking API that replaces Berkeley sockets, providing smart connection establishment, user-space networking, built-in TLS support, and seamless mobility. Introduced in iOS 12 (2018) with NWConnection and evolved in iOS 26 (2025) with NetworkConnection for structured concurrency.

#### Evolution timeline
- **2018 (iOS 12)** NWConnection with completion handlers, deprecates CFSocket/NSStream/SCNetworkReachability
- **2019 (iOS 13)** User-space networking (30% CPU reduction), TLS 1.3 default
- **2025 (iOS 26)** NetworkConnection with async/await, TLV framing built-in, Coder protocol, Wi-Fi Aware discovery

#### Key capabilities
- **Smart connection establishment** Happy Eyeballs (IPv4/IPv6 racing), proxy evaluation (PAC), VPN detection, WiFi Assist fallback
- **User-space networking** ~30% lower CPU usage vs sockets, memory-mapped regions, reduced context switches
- **Built-in security** TLS 1.3 by default, DTLS for UDP, certificate pinning support
- **Mobility** Automatic network transition handling (WiFi ↔ cellular), viability notifications, Multipath TCP
- **Performance** ECN (Explicit Congestion Notification), service class marking, TCP Fast Open, UDP batching

#### When to use vs URLSession
- **URLSession** HTTP, HTTPS, WebSocket, simple TCP/TLS streams → Use URLSession (optimized for these)
- **Network.framework** UDP, custom protocols, low-level control, peer-to-peer, gaming, streaming → Use Network.framework

#### Related Skills
- Use `axiom-networking` for anti-patterns, common patterns, pressure scenarios
- Use `axiom-networking-diag` for systematic troubleshooting of connection failures

---

## When to Use This Skill

Use this skill when:
- **Planning migration** from BSD sockets, CFSocket, NSStream, or SCNetworkReachability
- **Understanding API differences** between NWConnection (iOS 12-25) and NetworkConnection (iOS 26+)
- **Implementing all 12 WWDC 2025 examples** (TLS connection, TLV framing, Coder protocol, NetworkListener, Wi-Fi Aware)
- **Choosing protocols** (TCP, UDP, TLS, QUIC) for your use case
- **Peer-to-peer discovery** setup with NetworkBrowser and Wi-Fi Aware
- **Optimizing performance** with user-space networking, batching, pacing
- **Migrating** from completion handlers to async/await (NWConnection → NetworkConnection)

---

## API Evolution

### Timeline

| Year | iOS Version | Key Features |
|------|-------------|--------------|
| 2018 | iOS 12 | NWConnection, NWListener, NWBrowser introduced |
| 2019 | iOS 13 | User-space networking (30% CPU reduction), TLS 1.3 default |
| 2021 | iOS 15 | WebSocket support in URLSession |
| 2025 | iOS 26 | NetworkConnection (async/await), TLV framing, Coder protocol, Wi-Fi Aware |

### NWConnection (iOS 12-25) vs NetworkConnection (iOS 26+)

| Feature | NWConnection (iOS 12-25) | NetworkConnection (iOS 26+) |
|---------|-------------------------|----------------------------|
| **Async model** | Completion handlers | async/await structured concurrency |
| **State updates** | `stateUpdateHandler` callback | `states` AsyncSequence |
| **Send** | `send(content:completion:)` callback | `try await send(content)` suspending |
| **Receive** | `receive(minimumIncompleteLength:maximumLength:completion:)` | `try await receive(exactly:)` suspending |
| **Framing** | Manual or custom NWFramer | TLV built-in (`TLV { TLS() }`) |
| **Codable** | Manual JSON encode/decode | Coder protocol (`Coder(MyType.self, using: .json)`) |
| **Memory** | Requires `[weak self]` in all closures | No `[weak self]` needed (Task cancellation automatic) |
| **Error handling** | Check error in completion | `throws` with natural propagation |
| **State machine** | Callbacks on state changes | `for await state in connection.states` |
| **Discovery** | NWBrowser (Bonjour only) | NetworkBrowser (Bonjour + Wi-Fi Aware) |

#### Recommendation
- New apps targeting iOS 26+: Use NetworkConnection (cleaner, safer)
- Apps supporting iOS 12-25: Use NWConnection (backward compatible)
- Migration: Both APIs coexist, migrate incrementally

---

## NetworkConnection (iOS 26+) Complete Reference

### 4.1 Creating Connections

NetworkConnection uses declarative protocol stack composition.

#### Example 1: Basic TLS Connection (WWDC 4:04)

```swift
import Network

// Basic connection with TLS (TCP and IP inferred)
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029)
) {
    TLS()
}

// Send and receive with async/await
public func sendAndReceiveWithTLS() async throws {
    let outgoingData = Data("Hello, world!".utf8)
    try await connection.send(outgoingData)

    let incomingData = try await connection.receive(exactly: 98).content
    print("Received data: \(incomingData)")
}
```

#### Key points
- `TLS()` infers `TCP()` and `IP()` automatically
- No explicit connection.start() needed (happens on first send/receive)
- Async/await eliminates callback nesting

#### Example 2: Custom IP Options (WWDC 4:41)

```swift
// Customize IP fragmentation
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029)
) {
    TLS {
        TCP {
            IP()
                .fragmentationEnabled(false) // Disable IP fragmentation
        }
    }
}
```

#### When to customize IP
- `.fragmentationEnabled(false)` — For protocols that handle fragmentation themselves (QUIC)
- `.ipVersion(.v6)` — Force IPv6 only (testing)

#### Example 3: Custom Parameters (WWDC 5:07)

```swift
// Constrained paths (low data mode) + custom IP
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029),
    using: .parameters {
        TLS {
            TCP {
                IP()
                    .fragmentationEnabled(false)
            }
        }
    }
    .constrainedPathsProhibited(true) // Don't use cellular in low data mode
)
```

#### Common parameters
- `.constrainedPathsProhibited(true)` — Respect low data mode
- `.expensivePathsProhibited(true)` — Don't use cellular/hotspot
- `.multipathServiceType(.handover)` — Enable Multipath TCP

#### Endpoint Types

```swift
// Host + Port
.hostPort(host: "example.com", port: 443)

// Service (Bonjour)
.service(name: "MyPrinter", type: "_ipp._tcp", domain: "local.", interface: nil)

// Unix domain socket
.unix(path: "/tmp/my.sock")
```

#### Protocol Stack Composition

```swift
// TLS over TCP (most common)
TLS()

// QUIC (TLS + UDP, multiplexed streams)
QUIC()

// UDP (datagrams)
UDP()

// TCP (stream, no encryption)
TCP()

// WebSocket over TLS
WebSocket {
    TLS()
}

// Custom framing
TLV {
    TLS()
}
```

---

### 4.2 State Machine

NetworkConnection transitions through these states:

```
setup
  ↓
preparing (DNS, TCP handshake, TLS handshake)
  ↓
┌─ waiting (no network, retrying)
│    ↓
└→ ready (can send/receive)
     ↓
  failed (error) or cancelled
```

#### Monitoring States

```swift
// Option 1: Async sequence (monitor in background)
Task {
    for await state in connection.states {
        switch state {
        case .preparing:
            print("Connecting...")
        case .waiting(let error):
            print("Waiting for network: \(error)")
        case .ready:
            print("Connected!")
        case .failed(let error):
            print("Failed: \(error)")
        case .cancelled:
            print("Cancelled")
        @unknown default:
            break
        }
    }
}
```

#### Key states
- **.preparing** DNS lookup, TCP SYN, TLS handshake
- **.waiting** No network available, framework retries automatically
- **.ready** Connection established, can send/receive
- **.failed** Unrecoverable error (server refused, TLS failed, timeout)
- **.cancelled** Task cancelled or connection.cancel() called

---

### 4.3 Send/Receive Patterns

#### Send: Basic

```swift
let data = Data("Hello".utf8)
try await connection.send(data)
```

#### Receive: Exact Byte Count (WWDC 7:30)

```swift
// Receive exactly 98 bytes
let incomingData = try await connection.receive(exactly: 98).content
print("Received \(incomingData.count) bytes")
```

#### Receive: Variable Length (WWDC 8:29)

```swift
// Read UInt32 length prefix, then read that many bytes
let remaining32 = try await connection.receive(as: UInt32.self).content
guard var remaining = Int(exactly: remaining32) else { throw MyError.invalidLength }

while remaining > 0 {
    let chunk = try await connection.receive(atLeast: 1, atMost: remaining).content
    remaining -= chunk.count
    // Process chunk...
}
```

#### receive() variants
- `receive(exactly: n)` — Wait for exactly n bytes
- `receive(atLeast: min, atMost: max)` — Get between min and max bytes
- `receive(as: UInt32.self)` — Read fixed-size type (network byte order)

---

### 4.4 TLV Framing (iOS 26+)

**TLV (Type-Length-Value)** solves message boundary problem on stream protocols (TCP/TLS).

#### Format
- Type: UInt32 (message identifier)
- Length: UInt32 (message size, automatic)
- Value: Message bytes

#### Example: GameMessage with TLV (WWDC 11:06, 11:24, 11:53)

```swift
import Network

// Define message types
enum GameMessage: Int {
    case selectedCharacter = 0
    case move = 1
}

struct GameCharacter: Codable {
    let character: String
}

struct GameMove: Codable {
    let row: Int
    let column: Int
}

// Connection with TLV framing
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029)
) {
    TLV {
        TLS()
    }
}

// Send typed message
public func sendWithTLV() async throws {
    let characterData = try JSONEncoder().encode(GameCharacter(character: "🐨"))
    try await connection.send(characterData, type: GameMessage.selectedCharacter.rawValue)
}

// Receive typed message
public func receiveWithTLV() async throws {
    let (incomingData, metadata) = try await connection.receive()

    switch GameMessage(rawValue: metadata.type) {
    case .selectedCharacter:
        let character = try JSONDecoder().decode(GameCharacter.self, from: incomingData)
        print("Character selected: \(character)")
    case .move:
        let move = try JSONDecoder().decode(GameMove.self, from: incomingData)
        print("Move: row=\(move.row), column=\(move.column)")
    case .none:
        print("Unknown message type: \(metadata.type)")
    }
}
```

#### Benefits
- Message boundaries preserved (send 3 messages → receive exactly 3)
- Type-safe message handling (enum-based routing)
- Minimal overhead (8 bytes per message: type + length)

#### When to use
- Mixed message types (chat + presence + typing)
- Existing protocols using TLV
- Need message boundaries without heavy framing

---

### 4.5 Coder Protocol (iOS 26+)

**Coder** eliminates manual JSON encoding/decoding boilerplate.

#### Example: GameMessage with Coder (WWDC 12:50, 13:13, 13:53)

```swift
import Network

// Define message types as Codable enum
enum GameMessage: Codable {
    case selectedCharacter(String)
    case move(row: Int, column: Int)
}

// Connection with Coder
let connection = NetworkConnection(
    to: .hostPort(host: "www.example.com", port: 1029)
) {
    Coder(GameMessage.self, using: .json) {
        TLS()
    }
}

// Send Codable directly (no encoding needed!)
public func sendWithCoder() async throws {
    let selectedCharacter: GameMessage = .selectedCharacter("🐨")
    try await connection.send(selectedCharacter)
}

// Receive Codable directly (no decoding needed!)
public func receiveWithCoder() async throws {
    let gameMessage = try await connection.receive().content // Returns GameMessage!

    switch gameMessage {
    case .selectedCharacter(let character):
        print("Character selected: \(character)")
    case .move(let row, let column):
        print("Move: (\(row), \(column))")
    }
}
```

#### Supported formats
- `.json` — JSON encoding (human-readable, widely compatible)
- `.propertyList` — Property list (faster, smaller)

#### Benefits
- No JSON boilerplate (~50 lines → ~10 lines)
- Type-safe (compiler catches message structure changes)
- Automatic framing (handles message boundaries)

#### When to use
- App-to-app communication (you control both ends)
- Prototyping (fastest time to working code)
- Type-safe protocols

#### When NOT to use
- Interoperating with non-Swift servers
- Need custom wire format
- Performance-critical (prefer manual encoding for control)

---

### 4.6 NetworkListener (iOS 26+)

Listen for incoming connections with automatic subtask management.

#### Example: Listening for Connections (WWDC 15:16)

```swift
import Network

// Listener with Coder protocol
public func listenForIncomingConnections() async throws {
    try await NetworkListener {
        Coder(GameMessage.self, using: .json) {
            TLS()
        }
    }.run { connection in
        // Each connection gets its own subtask
        for try await (gameMessage, _) in connection.messages {
            switch gameMessage {
            case .selectedCharacter(let character):
                print("Player chose: \(character)")
            case .move(let row, let column):
                print("Player moved: (\(row), \(column))")
            }
        }
    }
}
```

#### Key features
- Automatic subtask per connection (no manual Task management)
- Structured concurrency (all subtasks cancelled when listener exits)
- `connection.messages` async sequence for receiving

#### Listener configuration

```swift
// Specify port
NetworkListener(port: 1029) { TLS() }

// Let system choose port
NetworkListener { TLS() }

// Bonjour advertising
NetworkListener(service: .init(name: "MyApp", type: "_myapp._tcp")) { TLS() }
```

---

### 4.7 NetworkBrowser & Wi-Fi Aware (iOS 26+)

Discover endpoints on local network or nearby devices.

#### Example: Wi-Fi Aware Discovery (WWDC 17:39)

```swift
import Network
import WiFiAware

// Browse for nearby paired Wi-Fi Aware devices
public func findNearbyDevice() async throws {
    let endpoint = try await NetworkBrowser(
        for: .wifiAware(.connecting(to: .allPairedDevices, from: .ticTacToeService))
    ).run { endpoints in
        .finish(endpoints.first!) // Use first discovered device
    }

    // Make connection to the discovered endpoint
    let connection = NetworkConnection(to: endpoint) {
        Coder(GameMessage.self, using: .json) {
            TLS()
        }
    }
}
```

#### Wi-Fi Aware features
- Peer-to-peer without infrastructure (no WiFi router needed)
- Automatic discovery of paired devices
- Low latency, axiom-high throughput
- iOS 26+ only

#### Browse descriptors

```swift
// Bonjour
.bonjour(type: "_http._tcp", domain: "local")

// Wi-Fi Aware (all paired devices)
.wifiAware(.connecting(to: .allPairedDevices, from: .myService))

// Wi-Fi Aware (specific device)
.wifiAware(.connecting(to: .pairedDevice(identifier: deviceID), from: .myService))
```

---

## NWConnection (iOS 12-25) Complete Reference

### 5.1 Creating Connections

NWConnection uses completion handlers (pre-async/await).

#### Basic TLS Connection (WWDC 2018 lines 133-166)

```swift
import Network

// Create connection
let connection = NWConnection(
    host: NWEndpoint.Host("mail.example.com"),
    port: NWEndpoint.Port(integerLiteral: 993),
    using: .tls // TCP inferred
)

// Handle connection state changes
connection.stateUpdateHandler = { [weak self] state in
    switch state {
    case .ready:
        print("Connection established")
        self?.sendData()

    case .waiting(let error):
        print("Waiting for network: \(error)")
        // Show "Waiting..." UI, don't fail immediately

    case .failed(let error):
        print("Connection failed: \(error)")

    case .cancelled:
        print("Connection cancelled")

    default:
        break
    }
}

// Start connection
connection.start(queue: .main)
```

**Critical** Always use `[weak self]` in stateUpdateHandler to prevent retain cycles.

#### Custom Parameters

```swift
// Create custom parameters
let parameters = NWParameters.tls

// Prohibit expensive networks
parameters.prohibitExpensivePaths = true // Don't use cellular/hotspot

// Prohibit constrained networks
parameters.prohibitConstrainedPaths = true // Respect low data mode

// Require IPv6
parameters.requiredInterfaceType = .wifi
parameters.ipOptions.version = .v6

let connection = NWConnection(host: "example.com", port: 443, using: parameters)
```

---

### 5.2 State Handling

NWConnection state machine (same as NetworkConnection):

```
setup → preparing → waiting/ready → failed/cancelled
```

#### State handling best practices

```swift
connection.stateUpdateHandler = { [weak self] state in
    guard let self = self else { return }

    switch state {
    case .preparing:
        // DNS lookup, TCP SYN, TLS handshake in progress
        self.updateUI(.connecting)

    case .waiting(let error):
        // Network unavailable or blocked
        // DON'T fail immediately, framework retries automatically
        print("Waiting: \(error.localizedDescription)")
        self.updateUI(.waiting)

    case .ready:
        // Connection established, can send/receive
        self.updateUI(.connected)
        self.startSending()

    case .failed(let error):
        // Unrecoverable error after all retry attempts
        print("Failed: \(error.localizedDescription)")
        self.updateUI(.failed)

    case .cancelled:
        // connection.cancel() called
        self.updateUI(.disconnected)

    default:
        break
    }
}
```

---

### 5.3 Send/Receive with Callbacks

#### Send with Pacing (WWDC 2018 lines 320-341)

```swift
// Send with contentProcessed callback for pacing
func sendData() {
    let data = Data("Hello, world!".utf8)

    connection.send(content: data, completion: .contentProcessed { [weak self] error in
        if let error = error {
            print("Send error: \(error)")
            return
        }

        // contentProcessed = network stack consumed data
        // NOW send next chunk (pacing)
        self?.sendNextData()
    })
}
```

**contentProcessed callback** Invoked when network stack consumes your data (equivalent to when blocking socket call would return). Use this for pacing to avoid buffering excessive data.

#### Receive with Exact Byte Count

```swift
// Receive exactly 10 bytes
connection.receive(minimumIncompleteLength: 10, maximumLength: 10) { [weak self] (data, context, isComplete, error) in
    if let error = error {
        print("Receive error: \(error)")
        return
    }

    if let data = data {
        print("Received \(data.count) bytes")
        // Process data...

        // Continue receiving
        self?.receiveMore()
    }
}
```

#### Receive parameters
- `minimumIncompleteLength`: Minimum bytes before callback (1 = return any data)
- `maximumLength`: Maximum bytes per callback
- For "exactly n bytes": Set both to n

---

### 5.4 UDP Batching (WWDC 2018 lines 343-347)

#### Batch sending for 30% CPU reduction.

```swift
// UDP connection
let connection = NWConnection(
    host: NWEndpoint.Host("game-server.example.com"),
    port: NWEndpoint.Port(integerLiteral: 9000),
    using: .udp
)

connection.start(queue: .main)

// Batch multiple datagrams
func sendVideoFrames(_ frames: [Data]) {
    connection.batch {
        for frame in frames {
            connection.send(content: frame, completion: .contentProcessed { error in
                if let error = error {
                    print("Send error: \(error)")
                }
            })
        }
    }
    // All sends batched into ~1 syscall
    // Result: 30% lower CPU usage vs individual sends
}
```

**Without batch** 100 datagrams = 100 syscalls = high CPU
**With batch** 100 datagrams = ~1 syscall = 30% lower CPU (measured with Instruments)

---

### 5.5 NWListener (WWDC 2018 lines 233-293)

Accept incoming connections.

```swift
import Network

// Create listener on port 1029
let listener = try NWListener(using: .tcp, on: 1029)

// Advertise Bonjour service
listener.service = NWListener.Service(name: "MyApp", type: "_myapp._tcp")

// Handle service registration
listener.serviceRegistrationUpdateHandler = { update in
    switch update {
    case .add(let endpoint):
        if case .service(let name, let type, let domain, _) = endpoint {
            print("Advertising: \(name).\(type)\(domain)")
        }
    default:
        break
    }
}

// Handle new connections
listener.newConnectionHandler = { [weak self] newConnection in
    print("New connection from: \(newConnection.endpoint)")

    newConnection.stateUpdateHandler = { state in
        if case .ready = state {
            print("Client connected")
            self?.handleClient(newConnection)
        }
    }

    newConnection.start(queue: .main)
}

// Handle listener state
listener.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("Listener ready on port \(listener.port ?? 0)")
    case .failed(let error):
        print("Listener failed: \(error)")
    default:
        break
    }
}

// Start listening
listener.start(queue: .main)
```

---

### 5.6 NWBrowser (Bonjour Discovery)

Discover services on local network.

```swift
import Network

// Browse for Bonjour services
let browser = NWBrowser(
    for: .bonjour(type: "_http._tcp", domain: nil),
    using: .tcp
)

// Handle discovered services
browser.browseResultsChangedHandler = { results, changes in
    for result in results {
        switch result.endpoint {
        case .service(let name, let type, let domain, _):
            print("Found service: \(name).\(type)\(domain)")

            // Connect to this service
            let connection = NWConnection(to: result.endpoint, using: .tcp)
            connection.start(queue: .main)

        default:
            break
        }
    }
}

// Handle browser state
browser.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("Browser ready")
    case .failed(let error):
        print("Browser failed: \(error)")
    default:
        break
    }
}

// Start browsing
browser.start(queue: .main)
```

---

## Mobility & Network Transitions

### Connection Viability (WWDC 2018 lines 453-463)

Viability = connection can send/receive data (has valid route).

```swift
connection.viabilityUpdateHandler = { isViable in
    if isViable {
        print("✅ Connection viable (can send/receive)")
    } else {
        print("⚠️ Connection not viable (no route)")
        // Don't tear down immediately, may recover
        // Show UI: "Connection interrupted"
    }
}
```

#### When viability changes
- Walk into elevator (WiFi signal lost) → not viable
- Walk out of elevator (WiFi returns) → viable again
- Switch WiFi → cellular → not viable briefly → viable on cellular

**Best practice** Don't tear down connection on viability loss. Framework will recover when network returns.

### Better Path Available (WWDC 2018 lines 464-477)

Better path = alternative network with better characteristics.

```swift
connection.betterPathUpdateHandler = { betterPathAvailable in
    if betterPathAvailable {
        print("📶 Better path available (e.g., WiFi while on cellular)")
        // Consider migrating to new connection
        self.migrateToNewConnection()
    }
}
```

#### Scenarios
- Connected on cellular, walk into building with WiFi → better path available
- Connected on WiFi, WiFi quality degrades, cellular available → better path available

#### Migration pattern

```swift
func migrateToNewConnection() {
    // Create new connection
    let newConnection = NWConnection(host: host, port: port, using: parameters)

    newConnection.stateUpdateHandler = { [weak self] state in
        if case .ready = state {
            // New connection ready, switch over
            self?.currentConnection?.cancel()
            self?.currentConnection = newConnection
        }
    }

    newConnection.start(queue: .main)

    // Keep old connection until new one ready
}
```

### Multipath TCP (WWDC 2018 lines 480-487)

Automatically migrate between networks without application intervention.

```swift
let parameters = NWParameters.tcp
parameters.multipathServiceType = .handover // Seamless network transition

let connection = NWConnection(host: "example.com", port: 443, using: parameters)
```

#### Multipath TCP modes
- `.handover` — Seamless handoff between networks (WiFi ↔ cellular)
- `.interactive` — Use multiple paths simultaneously (lowest latency)
- `.aggregate` — Use multiple paths simultaneously (highest throughput)

#### Benefits
- Automatic network transition (no viability handlers needed)
- No connection interruption when switching networks
- Fallback to single-path if MPTCP unavailable

### NWPathMonitor (WWDC 2018 lines 489-496)

Monitor network state changes (replaces SCNetworkReachability).

```swift
import Network

let monitor = NWPathMonitor()

monitor.pathUpdateHandler = { path in
    if path.status == .satisfied {
        print("✅ Network available")

        // Check interface types
        if path.usesInterfaceType(.wifi) {
            print("Using WiFi")
        } else if path.usesInterfaceType(.cellular) {
            print("Using cellular")
        }

        // Check if expensive
        if path.isExpensive {
            print("⚠️ Expensive path (cellular/hotspot)")
        }

    } else {
        print("❌ No network")
    }
}

monitor.start(queue: .main)
```

#### Use cases
- Show "No network" UI when path.status == .unsatisfied
- Disable high-bandwidth features when path.isExpensive
- Adjust quality based on interface type

#### When to use
- Global network state monitoring
- When "waiting for connectivity" isn't enough
- Need to know available interfaces before connecting

#### When NOT to use
- Checking before connecting (use waiting state instead)
- Per-connection monitoring (use viability handlers instead)

---

## Security Configuration

### TLS Version

```swift
// iOS 13+ requires TLS 1.2+ by default
let tlsOptions = NWProtocolTLS.Options()

// Allow TLS 1.2 and 1.3
tlsOptions.minimumTLSProtocolVersion = .TLSv12

// Require TLS 1.3 only
tlsOptions.minimumTLSProtocolVersion = .TLSv13

let parameters = NWParameters(tls: tlsOptions)
let connection = NWConnection(host: "example.com", port: 443, using: parameters)
```

### Certificate Pinning

```swift
// Production-grade certificate pinning
let tlsOptions = NWProtocolTLS.Options()

sec_protocol_options_set_verify_block(
    tlsOptions.securityProtocolOptions,
    { (metadata, trust, complete) in
        // Get server certificate
        let serverCert = sec_protocol_metadata_copy_peer_public_key(metadata)

        // Compare with pinned certificate
        let pinnedCertData = Data(/* your pinned cert */)
        let serverCertData = SecCertificateCopyData(serverCert) as Data

        if serverCertData == pinnedCertData {
            complete(true) // Accept
        } else {
            complete(false) // Reject (prevents MITM attacks)
        }
    },
    .main
)

let parameters = NWParameters(tls: tlsOptions)
```

### Certificate Pinning + Corporate Proxies

Corporate networks often use TLS inspection proxies that present their own certificates. Strict pinning breaks these environments.

**Strategy**: Pin against the public key (SPKI) rather than the full certificate, and provide a configuration escape hatch:

```swift
sec_protocol_options_set_verify_block(
    tlsOptions.securityProtocolOptions,
    { (metadata, trust, complete) in
        // 1. Check if system trusts the certificate chain (handles corporate CAs)
        let secTrust = sec_trust_copy_ref(trust).takeRetainedValue()
        SecTrustEvaluateAsyncWithError(secTrust, .main) { _, result, _ in
            guard result else { complete(false); return }

            // 2. If pinning enabled, also verify public key
            if PinningConfig.isEnabled {
                let serverKey = SecTrustCopyKey(secTrust)
                let matches = pinnedKeys.contains { $0 == serverKey }
                complete(matches)
            } else {
                complete(true) // System trust only (enterprise mode)
            }
        }
    },
    .main
)
```

**Rules**:
- Always validate system trust first (`SecTrustEvaluateAsyncWithError`) — this respects enterprise-installed root CAs
- Use public key pinning over certificate pinning (survives cert rotation)
- Provide a managed configuration (MDM profile or app config) to disable pinning in enterprise environments
- Pin at least 2 keys (current + backup) to survive rotation

### Cipher Suites

```swift
let tlsOptions = NWProtocolTLS.Options()

// Specify allowed cipher suites
tlsOptions.tlsCipherSuites = [
    tls_ciphersuite_t(rawValue: 0x1301), // TLS_AES_128_GCM_SHA256
    tls_ciphersuite_t(rawValue: 0x1302), // TLS_AES_256_GCM_SHA384
]

// iOS defaults to secure modern ciphers, only customize if required
```

---

## Performance Optimization

### User-Space Networking (WWDC 2018 lines 409-441)

**Automatic on iOS/tvOS.** Network.framework moves TCP/UDP stack into your app process.

#### Benefits
- ~30% lower CPU usage (measured with Instruments)
- No kernel→userspace copy (memory-mapped regions)
- Reduced context switches

#### Legacy vs User-Space

| Traditional Sockets | User-Space Networking |
|---------------------|----------------------|
| Packet → driver → kernel → copy → userspace | Packet → driver → memory-mapped region → userspace (no copy) |
| 100 datagrams = 100 syscalls | 100 datagrams = ~1 syscall (with batching) |
| ~30% higher CPU | Baseline CPU |

**WWDC demo** Live UDP video streaming showed 30% CPU difference (sockets vs Network.framework).

### ECN for UDP (WWDC 2018 lines 365-378)

Explicit Congestion Notification for smooth UDP transmission.

```swift
// Create IP metadata with ECN
let ipMetadata = NWProtocolIP.Metadata()
ipMetadata.ecnFlag = .congestionEncountered // Or .ect0, .ect1

// Attach to send context
let context = NWConnection.ContentContext(
    identifier: "video_frame",
    metadata: [ipMetadata]
)

connection.send(content: data, contentContext: context, completion: .contentProcessed { _ in })
```

#### ECN flags
- `.ect0` / `.ect1` — ECN-capable transport
- `.congestionEncountered` — Congestion notification received

**Benefits** Network can signal congestion without dropping packets.

### Service Class (WWDC 2018 lines 379-388)

Mark traffic priority.

```swift
// Connection-wide service class
let parameters = NWParameters.tcp
parameters.serviceClass = .background // Low priority

let connection = NWConnection(host: "example.com", port: 443, using: parameters)

// Per-packet service class (UDP)
let ipMetadata = NWProtocolIP.Metadata()
ipMetadata.serviceClass = .realTimeInteractive // High priority (voice)

let context = NWConnection.ContentContext(identifier: "voip", metadata: [ipMetadata])
connection.send(content: audioData, contentContext: context, completion: .contentProcessed { _ in })
```

#### Service classes
- `.background` — Low priority (large downloads, sync)
- `.default` — Normal priority
- `.responsiveData` — Interactive data (API calls)
- `.realTimeInteractive` — Time-sensitive (voice, gaming)

### TCP Fast Open (WWDC 2018 lines 389-406)

Send initial data in TCP SYN packet (saves round trip).

```swift
let parameters = NWParameters.tcp
parameters.allowFastOpen = true

let connection = NWConnection(host: "example.com", port: 443, using: parameters)

// Send initial data BEFORE calling start()
let initialData = Data("GET / HTTP/1.1\r\n".utf8)
connection.send(
    content: initialData,
    contentContext: .defaultMessage,
    isComplete: false,
    completion: .idempotent // Data is safe to replay
)

// Now start connection (initial data sent in SYN)
connection.start(queue: .main)
```

**Benefits** Reduces connection establishment time by 1 RTT.
**Requirements** Data must be idempotent (safe to replay if SYN retransmitted).

---

## Migration Strategies

### From BSD Sockets to NWConnection

| BSD Sockets | NWConnection | Notes |
|-------------|--------------|-------|
| `socket() + connect()` | `NWConnection(host:port:using:) + start()` | Non-blocking by default |
| `send() / sendto()` | `connection.send(content:completion:)` | Async callback |
| `recv() / recvfrom()` | `connection.receive(min:max:completion:)` | Async callback |
| `bind() + listen()` | `NWListener(using:on:)` | Automatic port binding |
| `accept()` | `listener.newConnectionHandler` | Callback per connection |
| `getaddrinfo()` | Use `NWEndpoint.Host(hostname)` | DNS automatic |
| `SCNetworkReachability` | `connection.stateUpdateHandler` waiting state | No race conditions |
| `setsockopt()` | `NWParameters` | Type-safe options |

#### Migration example

#### Before (blocking sockets)
```c
int sock = socket(AF_INET, SOCK_STREAM, 0);
connect(sock, &addr, addrlen); // BLOCKS
send(sock, data, len, 0);
```

#### After (NWConnection)
```swift
let connection = NWConnection(host: "example.com", port: 443, using: .tls)
connection.stateUpdateHandler = { state in
    if case .ready = state {
        connection.send(content: data, completion: .contentProcessed { _ in })
    }
}
connection.start(queue: .main)
```

### From URLSession StreamTask to NetworkConnection

#### When to migrate
- Need UDP (StreamTask only supports TCP)
- Need custom protocols
- Need low-level control

#### When to STAY with URLSession
- HTTP/HTTPS (URLSession optimized for this)
- WebSocket support
- Built-in caching, cookies

#### Migration example

#### Before (URLSession StreamTask)
```swift
let task = URLSession.shared.streamTask(withHostName: "example.com", port: 443)
task.resume()
task.write(Data("Hello".utf8), timeout: 10) { _ in }
```

#### After (NetworkConnection iOS 26+)
```swift
let connection = NetworkConnection(to: .hostPort(host: "example.com", port: 443)) { TLS() }
try await connection.send(Data("Hello".utf8))
```

### From NWConnection to NetworkConnection

#### Benefits of migration
- Async/await (no callback nesting)
- No `[weak self]` needed
- TLV framing built-in
- Coder protocol for Codable types

#### Migration mapping

| NWConnection | NetworkConnection |
|--------------|-------------------|
| `connection.stateUpdateHandler = { }` | `for await state in connection.states { }` |
| `connection.send(content:completion:)` | `try await connection.send(content)` |
| `connection.receive(min:max:completion:)` | `try await connection.receive(exactly:)` |
| Manual JSON | `Coder(MyType.self, using: .json)` |
| Custom framer | `TLV { TLS() }` |
| `[weak self]` everywhere | No `[weak self]` needed |

#### Migration example

#### Before (NWConnection)
```swift
connection.stateUpdateHandler = { [weak self] state in
    if case .ready = state {
        self?.sendData()
    }
}

func sendData() {
    connection.send(content: data, completion: .contentProcessed { [weak self] error in
        self?.receiveData()
    })
}
```

#### After (NetworkConnection)
```swift
Task {
    for await state in connection.states {
        if case .ready = state {
            try await connection.send(data)
            let received = try await connection.receive(exactly: 10).content
        }
    }
}
```

---

## Testing Checklist

Before shipping networking code:

### Device Testing
- [ ] Tested on real device (not just simulator)
- [ ] Tested on multiple iOS versions (12, 15, 26)
- [ ] Tested on iPhone and iPad (different network characteristics)

### Network Conditions
- [ ] WiFi (home network)
- [ ] Cellular (disable WiFi)
- [ ] Airplane Mode → WiFi (test waiting state)
- [ ] WiFi → cellular transition (walk out of building)
- [ ] Cellular → WiFi transition (walk into building)
- [ ] Weak signal (basement, elevator)
- [ ] Network Link Conditioner (100ms latency, 3% packet loss)

### Network Types
- [ ] IPv4-only network
- [ ] IPv6-only network (some cellular carriers)
- [ ] Dual-stack (IPv4 + IPv6)
- [ ] Corporate VPN active
- [ ] Personal hotspot (expensive path)

### Performance
- [ ] Connection establishment < 500ms (check logs)
- [ ] Using batch for UDP (verify with Instruments)
- [ ] Using contentProcessed for pacing (check send timing)
- [ ] Profiled with Instruments Network template
- [ ] CPU usage acceptable (< 10% for networking)
- [ ] Memory stable (no leaks, check [weak self])

### Error Handling
- [ ] Handling .waiting state (show "Waiting..." UI)
- [ ] Handling .failed state (specific error messages)
- [ ] TLS handshake errors logged
- [ ] Timeout handling (don't wait forever)
- [ ] User-facing errors actionable ("Check network" not "POSIX 61")

### iOS 26+ Features (if using NetworkConnection)
- [ ] Using TLV framing if need message boundaries
- [ ] Using Coder protocol if sending Codable types
- [ ] Using NetworkListener instead of NWListener
- [ ] Using NetworkBrowser for Wi-Fi Aware if peer-to-peer

---

## API Quick Reference

### NetworkConnection (iOS 26+)

```swift
// Create connection
NetworkConnection(to: .hostPort(host: "example.com", port: 443)) { TLS() }

// Send
try await connection.send(data)

// Receive
try await connection.receive(exactly: n).content

// States
for await state in connection.states { }

// TLV framing
NetworkConnection(to: endpoint) { TLV { TLS() } }

// Coder protocol
NetworkConnection(to: endpoint) { Coder(MyType.self, using: .json) { TLS() } }

// Listener
NetworkListener { TLS() }.run { connection in }

// Browser
NetworkBrowser(for: .wifiAware(...)).run { endpoints in }
```

### NWConnection (iOS 12-25)

```swift
// Create connection
let connection = NWConnection(host: "example.com", port: 443, using: .tls)

// State handler
connection.stateUpdateHandler = { [weak self] state in }

// Start
connection.start(queue: .main)

// Send
connection.send(content: data, completion: .contentProcessed { [weak self] error in })

// Receive
connection.receive(minimumIncompleteLength: min, maximumLength: max) { [weak self] data, context, isComplete, error in }

// Viability
connection.viabilityUpdateHandler = { isViable in }

// Better path
connection.betterPathUpdateHandler = { betterPathAvailable in }

// Cancel
connection.cancel()
```

### NWListener (iOS 12-25)

```swift
let listener = try NWListener(using: .tcp, on: 1029)
listener.newConnectionHandler = { newConnection in }
listener.start(queue: .main)
```

### NWBrowser (iOS 12-25)

```swift
let browser = NWBrowser(for: .bonjour(type: "_http._tcp", domain: nil), using: .tcp)
browser.browseResultsChangedHandler = { results, changes in }
browser.start(queue: .main)
```

### NWPathMonitor

```swift
let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in }
monitor.start(queue: .main)
```

---

## Resources

**WWDC**: 2018-715, 2025-250

**Docs**: /network, /network/nwconnection, /network/networkconnection

**Skills**: axiom-networking, axiom-networking-diag

---

**Last Updated** 2025-12-02
**Status** Production-ready reference from WWDC 2018 and WWDC 2025
**Coverage** NWConnection (iOS 12-25), NetworkConnection (iOS 26+), all 12 WWDC 2025 code examples
