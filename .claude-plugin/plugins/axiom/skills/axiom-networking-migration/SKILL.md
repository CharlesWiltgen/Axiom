---
name: axiom-networking-migration
description: Network framework migration guides. Use when migrating from BSD sockets to NWConnection, NWConnection to NetworkConnection (iOS 26+), or URLSession StreamTask to NetworkConnection.
license: MIT
---

# Network Framework Migration Guides

## Migration 1: From BSD Sockets to NWConnection

### Migration mapping

| BSD Sockets | NWConnection | Notes |
|-------------|--------------|-------|
| `socket() + connect()` | `NWConnection(host:port:using:) + start()` | Non-blocking by default |
| `send() / sendto()` | `connection.send(content:completion:)` | Async, returns immediately |
| `recv() / recvfrom()` | `connection.receive(minimumIncompleteLength:maximumLength:completion:)` | Async, returns immediately |
| `bind() + listen()` | `NWListener(using:on:)` | Automatic port binding |
| `accept()` | `listener.newConnectionHandler` | Callback for each connection |
| `getaddrinfo()` | Let NWConnection handle DNS | Smart resolution with racing |
| `SCNetworkReachability` | `connection.stateUpdateHandler` waiting state | No race conditions |
| `setsockopt()` | `NWParameters` configuration | Type-safe options |

### Example migration

#### Before (BSD Sockets)
```c
// BEFORE — Blocking, manual DNS, error-prone
var hints = addrinfo()
hints.ai_family = AF_INET
hints.ai_socktype = SOCK_STREAM

var results: UnsafeMutablePointer<addrinfo>?
getaddrinfo("example.com", "443", &hints, &results)

let sock = socket(results.pointee.ai_family, results.pointee.ai_socktype, 0)
connect(sock, results.pointee.ai_addr, results.pointee.ai_addrlen) // BLOCKS

let data = "Hello".data(using: .utf8)!
data.withUnsafeBytes { ptr in
    send(sock, ptr.baseAddress, data.count, 0)
}
```

#### After (NWConnection)
```swift
// AFTER — Non-blocking, automatic DNS, type-safe
let connection = NWConnection(
    host: NWEndpoint.Host("example.com"),
    port: NWEndpoint.Port(integerLiteral: 443),
    using: .tls
)

connection.stateUpdateHandler = { state in
    if case .ready = state {
        let data = Data("Hello".utf8)
        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                print("Send failed: \(error)")
            }
        })
    }
}

connection.start(queue: .main)
```

### Benefits
- 20 lines → 10 lines
- No manual DNS, no blocking, no unsafe pointers
- Automatic Happy Eyeballs, proxy support, WiFi Assist

---

## Migration 2: From NWConnection to NetworkConnection (iOS 26+)

### Why migrate
- Async/await eliminates callback hell
- TLV framing and Coder protocol built-in
- No [weak self] needed (async/await handles cancellation)
- State monitoring via async sequences

### Migration mapping

| NWConnection (iOS 12-25) | NetworkConnection (iOS 26+) | Notes |
|-------------------------|----------------------------|-------|
| `connection.stateUpdateHandler = { state in }` | `for await state in connection.states { }` | Async sequence |
| `connection.send(content:completion:)` | `try await connection.send(content)` | Suspending function |
| `connection.receive(minimumIncompleteLength:maximumLength:completion:)` | `try await connection.receive(exactly:)` | Suspending function |
| Manual JSON encode/decode | `Coder(MyType.self, using: .json)` | Built-in Codable support |
| Custom framer | `TLV { TLS() }` | Built-in Type-Length-Value |
| `[weak self]` everywhere | No `[weak self]` needed | Task cancellation automatic |

### Example migration

#### Before (NWConnection)
```swift
// BEFORE — Completion handlers, manual memory management
let connection = NWConnection(host: "example.com", port: 443, using: .tls)

connection.stateUpdateHandler = { [weak self] state in
    switch state {
    case .ready:
        self?.sendData()
    case .waiting(let error):
        print("Waiting: \(error)")
    case .failed(let error):
        print("Failed: \(error)")
    default:
        break
    }
}

connection.start(queue: .main)

func sendData() {
    let data = Data("Hello".utf8)
    connection.send(content: data, completion: .contentProcessed { [weak self] error in
        if let error = error {
            print("Send error: \(error)")
            return
        }
        self?.receiveData()
    })
}

func receiveData() {
    connection.receive(minimumIncompleteLength: 10, maximumLength: 10) { [weak self] (data, context, isComplete, error) in
        if let error = error {
            print("Receive error: \(error)")
            return
        }
        if let data = data {
            print("Received: \(data)")
        }
    }
}
```

#### After (NetworkConnection)
```swift
// AFTER — Async/await, automatic memory management
let connection = NetworkConnection(
    to: .hostPort(host: "example.com", port: 443)
) {
    TLS()
}

// Monitor states in background task
Task {
    for await state in connection.states {
        switch state {
        case .preparing:
            print("Connecting...")
        case .ready:
            print("Ready")
        case .waiting(let error):
            print("Waiting: \(error)")
        case .failed(let error):
            print("Failed: \(error)")
        default:
            break
        }
    }
}

// Send and receive with async/await
func sendAndReceive() async throws {
    let data = Data("Hello".utf8)
    try await connection.send(data)

    let received = try await connection.receive(exactly: 10).content
    print("Received: \(received)")
}
```

### Benefits
- 30 lines → 15 lines
- No callback nesting, no [weak self]
- Errors propagate naturally with throws
- Automatic cancellation on Task exit

---

## Migration 3: From URLSession StreamTask to NetworkConnection

### When to migrate
- Need UDP (StreamTask only supports TCP)
- Need custom protocols beyond TCP/TLS
- Need low-level control (packet pacing, ECN, service class)

### When to STAY with URLSession
- Doing HTTP/HTTPS (URLSession optimized for this)
- Need WebSocket support
- Need built-in caching, cookie handling

### Example migration

#### Before (URLSession StreamTask)
```swift
// BEFORE — URLSession for TCP/TLS stream
let task = URLSession.shared.streamTask(withHostName: "example.com", port: 443)

task.resume()

task.write(Data("Hello".utf8), timeout: 10) { error in
    if let error = error {
        print("Write error: \(error)")
    }
}

task.readData(ofMinLength: 10, maxLength: 10, timeout: 10) { data, atEOF, error in
    if let error = error {
        print("Read error: \(error)")
        return
    }
    if let data = data {
        print("Received: \(data)")
    }
}
```

#### After (NetworkConnection)
```swift
// AFTER — NetworkConnection for TCP/TLS
let connection = NetworkConnection(
    to: .hostPort(host: "example.com", port: 443)
) {
    TLS()
}

func sendAndReceive() async throws {
    try await connection.send(Data("Hello".utf8))
    let data = try await connection.receive(exactly: 10).content
    print("Received: \(data)")
}
```

## Resources

**Skills**: axiom-ios-networking, axiom-networking-legacy
