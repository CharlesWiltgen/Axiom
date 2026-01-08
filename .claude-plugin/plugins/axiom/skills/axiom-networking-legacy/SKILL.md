---
name: axiom-networking-legacy
description: This skill should be used when working with NWConnection patterns for iOS 12-25, supporting apps that can't use async/await yet, or maintaining backward compatibility with completion handler networking.
user-invocable: false
---

# Legacy iOS 12-25 NWConnection Patterns

These patterns use NWConnection with completion handlers for apps supporting iOS 12-25. If your app targets iOS 26+, use NetworkConnection with async/await instead (see axiom-network-framework-ref skill).

## Pattern 2a: NWConnection with TLS (iOS 12-25)

**Use when** Supporting iOS 12-25, need TLS encryption, can't use async/await yet

**Time cost** 10-15 minutes

### GOOD: NWConnection with Completion Handlers

```swift
import Network

// Create connection with TLS
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
        self?.sendInitialData()
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

// Send data with pacing
func sendData() {
    let data = Data("Hello, world!".utf8)
    connection.send(content: data, completion: .contentProcessed { [weak self] error in
        if let error = error {
            print("Send error: \(error)")
            return
        }
        // contentProcessed callback = network stack consumed data
        // This is when you should send next chunk (pacing)
        self?.sendNextChunk()
    })
}

// Receive exact byte count
func receiveData() {
    connection.receive(minimumIncompleteLength: 10, maximumLength: 10) { [weak self] (data, context, isComplete, error) in
        if let error = error {
            print("Receive error: \(error)")
            return
        }

        if let data = data {
            print("Received \(data.count) bytes")
            // Process data...
            self?.receiveData() // Continue receiving
        }
    }
}
```

### Key differences from NetworkConnection
- Must use `[weak self]` in all completion handlers to prevent retain cycles
- stateUpdateHandler receives state, not async sequence
- send/receive use completion callbacks, not async/await

### When to use
- Supporting iOS 12-15 (70% of devices as of 2024)
- Codebases not yet using async/await
- Libraries needing backward compatibility

### Migration to NetworkConnection (iOS 26+)
- stateUpdateHandler -> connection.states async sequence
- Completion handlers -> try await calls
- [weak self] -> No longer needed (async/await handles cancellation)

## Pattern 2b: NWConnection UDP Batch (iOS 12-25)

**Use when** Supporting iOS 12-25, sending multiple UDP datagrams efficiently, need ~30% CPU reduction

**Time cost** 10-15 minutes

**Background** Traditional UDP sockets send one datagram per syscall. If you're sending 100 small packets, that's 100 context switches. Batching reduces this to ~1 syscall.

### BAD: Individual UDP Sends (High CPU)
```swift
// WRONG — 100 context switches for 100 packets
for frame in videoFrames {
    sendto(socket, frame.bytes, frame.count, 0, &addr, addrlen)
    // Each send = context switch to kernel
}
```

### GOOD: Batched UDP Sends (30% Lower CPU)

```swift
import Network

// UDP connection
let connection = NWConnection(
    host: NWEndpoint.Host("stream-server.example.com"),
    port: NWEndpoint.Port(integerLiteral: 9000),
    using: .udp
)

connection.stateUpdateHandler = { state in
    if case .ready = state {
        print("Ready to send UDP")
    }
}

connection.start(queue: .main)

// Batch sending for efficiency
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
    // 30% lower CPU usage vs individual sends
}

// Receive UDP datagrams
func receiveFrames() {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] (data, context, isComplete, error) in
        if let error = error {
            print("Receive error: \(error)")
            return
        }

        if let data = data {
            // Process video frame
            self?.displayFrame(data)
            self?.receiveFrames() // Continue receiving
        }
    }
}
```

### Performance characteristics
- **Without batch** 100 datagrams = 100 syscalls = 100 context switches
- **With batch** 100 datagrams = ~1 syscall = 1 context switch
- **Result** ~30% lower CPU usage (measured with Instruments)

### When to use
- Real-time video/audio streaming
- Gaming with frequent updates (player position)
- High-frequency sensor data (IoT)

**WWDC 2018 demo** Live video streaming showed 30% lower CPU on receiver with user-space networking + batching

## Pattern 2c: NWListener (iOS 12-25)

**Use when** Need to accept incoming connections, building servers or peer-to-peer apps, supporting iOS 12-25

**Time cost** 20-25 minutes

### BAD: Manual Socket Listening
```swift
// WRONG — Manual socket management
let sock = socket(AF_INET, SOCK_STREAM, 0)
bind(sock, &addr, addrlen)
listen(sock, 5)
while true {
    let client = accept(sock, nil, nil) // Blocks thread
    // Handle client...
}
```

### GOOD: NWListener with Automatic Connection Handling

```swift
import Network

// Create listener with default parameters
let listener = try NWListener(using: .tcp, on: 1029)

// Advertise Bonjour service
listener.service = NWListener.Service(name: "MyApp", type: "_myservice._tcp")

// Handle service registration updates
listener.serviceRegistrationUpdateHandler = { update in
    switch update {
    case .add(let endpoint):
        if case .service(let name, let type, let domain, _) = endpoint {
            print("Advertising as: \(name).\(type)\(domain)")
        }
    default:
        break
    }
}

// Handle incoming connections
listener.newConnectionHandler = { [weak self] newConnection in
    print("New connection from: \(newConnection.endpoint)")

    // Configure connection
    newConnection.stateUpdateHandler = { state in
        switch state {
        case .ready:
            print("Client connected")
            self?.handleClient(newConnection)
        case .failed(let error):
            print("Client connection failed: \(error)")
        default:
            break
        }
    }

    // Start handling this connection
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

// Handle client data
func handleClient(_ connection: NWConnection) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] (data, context, isComplete, error) in
        if let error = error {
            print("Receive error: \(error)")
            return
        }

        if let data = data {
            print("Received \(data.count) bytes")

            // Echo back
            connection.send(content: data, completion: .contentProcessed { error in
                if let error = error {
                    print("Send error: \(error)")
                }
            })

            self?.handleClient(connection) // Continue receiving
        }
    }
}
```

### When to use
- Peer-to-peer apps (file sharing, messaging)
- Local network services
- Development/testing servers

### Bonjour advertising
- Automatic service discovery on local network
- No hardcoded IPs needed
- Works with NWBrowser for discovery

### Security considerations
- Use TLS parameters for encryption: `NWListener(using: .tls, on: port)`
- Validate client connections before processing data
- Set connection limits to prevent DoS

## Pattern 2d: Network Discovery (iOS 12-25)

**Use when** Discovering services on local network (Bonjour), building peer-to-peer apps, supporting iOS 12-25

**Time cost** 25-30 minutes

### BAD: Hardcoded IP Addresses
```swift
// WRONG — Brittle, requires manual configuration
let connection = NWConnection(host: "192.168.1.100", port: 9000, using: .tcp)
// What if IP changes? What if multiple devices?
```

### GOOD: NWBrowser for Service Discovery

```swift
import Network

// Browse for services on local network
let browser = NWBrowser(for: .bonjour(type: "_myservice._tcp", domain: nil), using: .tcp)

// Handle discovered services
browser.browseResultsChangedHandler = { results, changes in
    for result in results {
        switch result.endpoint {
        case .service(let name, let type, let domain, _):
            print("Found service: \(name).\(type)\(domain)")
            // Connect to this service
            self.connectToService(result.endpoint)
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

// Connect to discovered service
func connectToService(_ endpoint: NWEndpoint) {
    let connection = NWConnection(to: endpoint, using: .tcp)

    connection.stateUpdateHandler = { state in
        if case .ready = state {
            print("Connected to service")
        }
    }

    connection.start(queue: .main)
}
```

### When to use
- Peer-to-peer discovery (AirDrop-like features)
- Local network printers, media servers
- Development/testing (find test servers automatically)

### Performance characteristics
- mDNS-based (multicast DNS, no central server)
- Near-instant discovery on same subnet
- Automatic updates when services appear/disappear

### iOS 26+ alternative
- Use NetworkBrowser with Wi-Fi Aware for peer-to-peer without infrastructure
- See Pattern 1d in axiom-network-framework-ref skill

## Resources

**Skills**: axiom-networking, axiom-network-framework-ref, axiom-networking-migration
