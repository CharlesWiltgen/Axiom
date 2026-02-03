---
name: axiom-ownership-conventions
description: Use when optimizing large value type performance, working with noncopyable types, or reducing ARC traffic. Covers borrowing, consuming, inout modifiers, consume operator, ~Copyable types.
license: MIT
metadata:
  version: "1.0.0"
---

# borrowing & consuming — Parameter Ownership

Explicit ownership modifiers for performance optimization and noncopyable type support.

## When to Use

✅ **Use when:**
- Large value types being passed read-only (avoid copies)
- Working with noncopyable types (`~Copyable`)
- Reducing ARC retain/release traffic
- Factory methods that consume builder objects
- Performance-critical code where copies show in profiling

❌ **Don't use when:**
- Simple types (Int, Bool, small structs)
- Compiler optimization is sufficient (most cases)
- Readability matters more than micro-optimization
- You're not certain about the performance impact

## Quick Reference

| Modifier | Ownership | Copies | Use Case |
|----------|-----------|--------|----------|
| (default) | Compiler chooses | Implicit | Most cases |
| `borrowing` | Caller keeps | Explicit `copy` only | Read-only, large types |
| `consuming` | Caller transfers | None needed | Final use, factories |
| `inout` | Caller keeps, mutable | None | Modify in place |

## Default Behavior by Context

| Context | Default | Reason |
|---------|---------|--------|
| Function parameters | `borrowing` | Most params are read-only |
| Initializer parameters | `consuming` | Usually stored in properties |
| Property setters | `consuming` | Value is stored |
| Method `self` | `borrowing` | Methods read self |

## Patterns

### Pattern 1: Read-Only Large Struct

```swift
struct LargeBuffer {
    var data: [UInt8]  // Could be megabytes
}

// ❌ Default may copy
func process(_ buffer: LargeBuffer) -> Int {
    buffer.data.count
}

// ✅ Explicit borrow — no copy
func process(_ buffer: borrowing LargeBuffer) -> Int {
    buffer.data.count
}
```

### Pattern 2: Consuming Factory

```swift
struct Builder {
    var config: Configuration

    // Consumes self — builder invalid after call
    consuming func build() -> Product {
        Product(config: config)
    }
}

let builder = Builder(config: .default)
let product = builder.build()
// builder is now invalid — compiler error if used
```

### Pattern 3: Explicit Copy in Borrowing

With `borrowing`, copies must be explicit:

```swift
func store(_ value: borrowing LargeValue) {
    // ❌ Error: Cannot implicitly copy borrowing parameter
    self.cached = value

    // ✅ Explicit copy
    self.cached = copy value
}
```

### Pattern 4: Consume Operator

Transfer ownership explicitly:

```swift
let data = loadLargeData()
process(consume data)
// data is now invalid — compiler prevents use
```

### Pattern 5: Noncopyable Type

For `~Copyable` types, ownership modifiers are **required**:

```swift
struct FileHandle: ~Copyable {
    private let fd: Int32

    init(path: String) throws {
        fd = open(path, O_RDONLY)
        guard fd >= 0 else { throw POSIXError.errno }
    }

    borrowing func read(count: Int) -> Data {
        // Read without consuming handle
        var buffer = [UInt8](repeating: 0, count: count)
        _ = Darwin.read(fd, &buffer, count)
        return Data(buffer)
    }

    consuming func close() {
        Darwin.close(fd)
        // Handle consumed — can't use after close()
    }

    deinit {
        Darwin.close(fd)
    }
}

// Usage
let file = try FileHandle(path: "/tmp/data.txt")
let data = file.read(count: 1024)  // borrowing
file.close()  // consuming — file invalidated
```

### Pattern 6: Reducing ARC Traffic

```swift
class ExpensiveObject { /* ... */ }

// ❌ Default: May retain/release
func inspect(_ obj: ExpensiveObject) -> String {
    obj.description
}

// ✅ Borrowing: No ARC traffic
func inspect(_ obj: borrowing ExpensiveObject) -> String {
    obj.description
}
```

### Pattern 7: Consuming Method on Self

```swift
struct Transaction {
    var amount: Decimal
    var recipient: String

    // After commit, transaction is consumed
    consuming func commit() async throws {
        try await sendToServer(self)
        // self consumed — can't modify or reuse
    }
}
```

## Common Mistakes

### Mistake 1: Over-Optimizing Small Types

```swift
// ❌ Unnecessary — Int is trivially copyable
func add(_ a: borrowing Int, _ b: borrowing Int) -> Int {
    a + b
}

// ✅ Let compiler optimize
func add(_ a: Int, _ b: Int) -> Int {
    a + b
}
```

### Mistake 2: Forgetting Explicit Copy

```swift
func cache(_ value: borrowing LargeValue) {
    // ❌ Compile error
    self.values.append(value)

    // ✅ Explicit copy required
    self.values.append(copy value)
}
```

### Mistake 3: Consuming When Borrowing Suffices

```swift
// ❌ Consumes unnecessarily — caller loses access
func validate(_ data: consuming Data) -> Bool {
    data.count > 0
}

// ✅ Borrow for read-only
func validate(_ data: borrowing Data) -> Bool {
    data.count > 0
}
```

## Performance Considerations

### When Ownership Modifiers Help

- Large structs (arrays, dictionaries, custom value types)
- High-frequency function calls in tight loops
- Reference types where ARC traffic is measurable
- Noncopyable types (required, not optional)

### When to Skip

- Default behavior is almost always optimal
- Small value types (primitives, small structs)
- Code where profiling shows no benefit
- API stability concerns (modifiers affect ABI)

## Decision Tree

```
Need explicit ownership?
├─ Working with ~Copyable type?
│  └─ Yes → Required (borrowing/consuming)
├─ Large value type passed frequently?
│  ├─ Read-only? → borrowing
│  └─ Final use? → consuming
├─ ARC traffic visible in profiler?
│  ├─ Read-only? → borrowing
│  └─ Transferring ownership? → consuming
└─ Otherwise → Let compiler choose
```

## Resources

**Swift Evolution**: SE-0377

**WWDC**: 2024-10170

**Skills**: axiom-swift-performance, axiom-swift-concurrency
