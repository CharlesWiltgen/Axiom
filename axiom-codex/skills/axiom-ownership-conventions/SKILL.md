---
name: axiom-ownership-conventions
description: Use when optimizing large value type performance, working with noncopyable types, reducing ARC traffic, or using InlineArray/Span for zero-copy memory access. Covers borrowing, consuming, inout modifiers, consume operator, ~Copyable types, InlineArray, Span, value generics.
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

## ~Copyable Limitations

**Know the constraints before adopting ~Copyable:**

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Can't store in `Array`, `Dictionary`, `Set` | Collections require `Copyable` | Use `Optional<T>` wrapper or manage manually |
| Can't use with most generics | `<T>` implicitly means `<T: Copyable>` | Use `<T: ~Copyable>` (requires library support) |
| Protocol conformance restricted | Most protocols require `Copyable` | Use `~Copyable` protocol definitions |
| Can't capture in closures by default | Closures copy captured values | Use `borrowing` closure parameters |
| No existential support | `any ~Copyable` doesn't work | Use generics instead |

**Common compiler errors when adopting ownership modifiers:**

```swift
// Error: "Cannot implicitly copy a borrowing parameter"
// Fix: Add explicit `copy` or change to consuming
func store(_ v: borrowing LargeValue) {
    self.cached = copy v  // ✅ Explicit copy
}

// Error: "Noncopyable type cannot be used with generic"
// Fix: Constrain generic to ~Copyable
func use<T: ~Copyable>(_ value: borrowing T) { }  // ✅

// Error: "Cannot consume a borrowing parameter"
// Fix: Change to consuming if you need ownership transfer
func takeOwnership(_ v: consuming FileHandle) { }  // ✅

// Error: "Missing 'consuming' or 'borrowing' modifier"
// Fix: ~Copyable types require explicit ownership on all methods
struct Token: ~Copyable {
    borrowing func peek() -> String { ... }   // ✅ Explicit
    consuming func redeem() { ... }           // ✅ Explicit
}
```

**When NOT to use ~Copyable:**
- If you need collection storage (arrays, dictionaries)
- If you need to work with existing generic APIs
- If the type needs broad protocol conformance
- Prefer `consuming func` on regular types as a lighter alternative for "use once" semantics

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

## InlineArray

Fixed-size, stack-allocated array using value generics. No heap allocation, no reference counting, no copy-on-write.

### Declaration

```swift
@frozen struct InlineArray<let count: Int, Element> where Element: ~Copyable
```

The `let count: Int` is a **value generic** — the size is part of the type, checked at compile time. `InlineArray<3, Int>` and `InlineArray<4, Int>` are different types.

### When to Use InlineArray

| Use InlineArray | Use Array |
|----------------|-----------|
| Size known at compile time | Size changes at runtime |
| Hot path needing zero heap allocation | Copy-on-write sharing is beneficial |
| Embedded in other value types | Frequently copied between variables |
| Performance-critical inner loops | General-purpose collection needs |

### Canonical Example

```swift
// Fixed-size, inline storage — no heap allocation
var matrix: InlineArray<9, Float> = [1, 0, 0, 0, 1, 0, 0, 0, 1]
matrix[4] = 2.0

// Type inference works for count, element, or both
let rgb: InlineArray = [0.2, 0.4, 0.8]  // InlineArray<3, Double>

// Eager copy on assignment (no COW)
var copy = matrix
copy[0] = 99  // matrix[0] still 1
```

### Memory Layout

Elements are stored contiguously with no overhead:

```swift
MemoryLayout<InlineArray<3, UInt16>>.size       // 6 (2 bytes × 3)
MemoryLayout<InlineArray<3, UInt16>>.alignment  // 2 (same as UInt16)
```

### ~Copyable Integration

InlineArray supports noncopyable elements — enables fixed-size collections of unique resources:

```swift
struct Sensor: ~Copyable { var id: Int }
var sensors: InlineArray<4, Sensor> = ...  // Valid: ~Copyable elements allowed
```

## Span — Safe Contiguous Memory Access

`Span` replaces unsafe pointers with compile-time-enforced safe memory views. Zero runtime overhead.

### The Span Family

| Type | Access | Use Case |
|------|--------|----------|
| `Span<Element>` | Read-only elements | Safe iteration, passing to algorithms |
| `MutableSpan<Element>` | Read-write elements | In-place mutation without copies |
| `RawSpan` | Read-only bytes | Binary parsing, protocol decoding |
| `MutableRawSpan` | Read-write bytes | Binary serialization |
| `OutputSpan` | Write-only | Initializing new collection storage |
| `UTF8Span` | Read-only UTF-8 | Safe Unicode processing |

### Accessing Spans

Containers with contiguous storage expose `.span` and `.mutableSpan`:

```swift
let array = [1, 2, 3, 4]
let span = array.span  // Span<Int>

var mutable = [10, 20, 30]
var ms = mutable.mutableSpan  // MutableSpan<Int>
ms[0] = 99
```

### Lifetime Safety — Compile-Time Enforcement

Spans are **non-escapable** — the compiler guarantees they cannot outlive the container they borrow from:

```swift
// ❌ Cannot return span that depends on local variable
func getSpan() -> Span<UInt8> {
    let array: [UInt8] = Array(repeating: 0, count: 128)
    return array.span  // Compile error
}

// ❌ Cannot capture span in closure
let span = array.span
let closure = { span.count }  // Compile error

// ❌ Cannot access span after mutating original
var array = [1, 2, 3]
let span = array.span
array.append(4)
// span[0]  // Compile error: container was modified
```

These constraints prevent use-after-free, dangling pointers, and overlapping mutation at **compile time** with zero runtime cost.

### Span vs Unsafe Pointers

| | Span | UnsafeBufferPointer |
|---|------|---------------------|
| Memory safety | Compile-time enforced | Manual, error-prone |
| Lifetime tracking | Automatic, non-escapable | None — dangling pointers possible |
| Runtime overhead | Zero | Zero |
| Use-after-free | Impossible | Common source of crashes |

### Canonical Example — Binary Parsing

```swift
func parseHeader(_ data: borrowing [UInt8]) -> Header {
    var raw = data.span.rawSpan  // RawSpan over the array's bytes
    let magic = raw.unsafeLoadUnaligned(as: UInt32.self)
    raw = raw.extracting(droppingFirst: 4)
    let version = raw.unsafeLoadUnaligned(as: UInt16.self)
    return Header(magic: magic, version: version)
}
```

### When to Use Span

- **Replace `UnsafeBufferPointer`** — same performance, compile-time safety
- **Performance-critical algorithms** — direct memory access without copying
- **Binary parsing/serialization** — `RawSpan` for byte-level access
- **Passing data between functions** — borrow the container, pass the span
- **UTF-8 processing** — `UTF8Span` for safe string byte access

## Value Generics

Value generics allow integer values as generic parameters, making sizes part of the type system:

```swift
// `let count: Int` is a value generic parameter
struct InlineArray<let count: Int, Element> { ... }

// Different counts = different types
let a: InlineArray<3, Int> = [1, 2, 3]
let b: InlineArray<4, Int> = [1, 2, 3, 4]
// a = b  // Compile error: different types
```

Currently limited to `Int` parameters. Enables stack-allocated, fixed-size abstractions where the compiler verifies size compatibility at compile time.

## Decision Tree

```
Need explicit ownership?
├─ Working with ~Copyable type?
│  └─ Yes → Required (borrowing/consuming)
├─ Fixed-size collection, no heap allocation?
│  └─ Yes → InlineArray<let count, Element>
├─ Need safe pointer-like access to contiguous memory?
│  ├─ Read-only? → Span<Element>
│  ├─ Mutable? → MutableSpan<Element>
│  └─ Raw bytes? → RawSpan / MutableRawSpan
├─ Large value type passed frequently?
│  ├─ Read-only? → borrowing
│  └─ Final use? → consuming
├─ ARC traffic visible in profiler?
│  ├─ Read-only? → borrowing
│  └─ Transferring ownership? → consuming
└─ Otherwise → Let compiler choose
```

## Resources

**Swift Evolution**: SE-0377, SE-0453 (Span), SE-0451 (InlineArray), SE-0452 (value generics)

**WWDC**: 2024-10170, 2025-245, 2025-312

**Docs**: /swift/inlinearray, /swift/span

**Skills**: axiom-swift-performance, axiom-swift-concurrency
