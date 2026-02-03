---
name: axiom-swift-performance
description: Use when optimizing Swift code performance, reducing memory usage, improving runtime efficiency, dealing with COW, ARC overhead, generics specialization, or collection optimization
license: MIT
metadata:
  version: "1.2.0"
---

# Swift Performance Optimization

## Purpose

**Core Principle**: Optimize Swift code by understanding language-level performance characteristics—value semantics, ARC behavior, generic specialization, and memory layout—to write fast, efficient code without premature micro-optimization.

**Swift Version**: Swift 6.2+ (for InlineArray, Span, `@concurrent`)
**Xcode**: 16+
**Platforms**: iOS 18+, macOS 15+

**Related Skills**:
- `axiom-performance-profiling` — Use Instruments to measure (do this first!)
- `axiom-swiftui-performance` — SwiftUI-specific optimizations
- `axiom-build-performance` — Compilation speed
- `axiom-swift-concurrency` — Correctness-focused concurrency patterns

## When to Use This Skill

### ✅ Use this skill when

- App profiling shows Swift code as the bottleneck (Time Profiler hotspots)
- Excessive memory allocations or retain/release traffic
- Implementing performance-critical algorithms or data structures
- Writing framework or library code with performance requirements
- Optimizing tight loops or frequently called methods
- Dealing with large data structures or collections
- Code review identifying performance anti-patterns

### ❌ Do NOT use this skill for

- **First step optimization** — Use `axiom-performance-profiling` first to measure
- **SwiftUI performance** — Use `axiom-swiftui-performance` skill instead
- **Build time optimization** — Use `axiom-build-performance` skill instead
- **Premature optimization** — Profile first, optimize later
- **Readability trade-offs** — Don't sacrifice clarity for micro-optimizations

## Quick Decision Tree

```
Performance issue identified?
│
├─ Profiler shows excessive copying?
│  └─ → Part 1: Noncopyable Types
│  └─ → Part 2: Copy-on-Write
│
├─ Retain/release overhead in Time Profiler?
│  └─ → Part 4: ARC Optimization
│
├─ Generic code in hot path?
│  └─ → Part 5: Generics & Specialization
│
├─ Collection operations slow?
│  └─ → Part 7: Collection Performance
│
├─ Async/await overhead visible?
│  └─ → Part 8: Concurrency Performance
│
├─ Struct vs class decision?
│  └─ → Part 3: Value vs Reference
│
└─ Memory layout concerns?
   └─ → Part 9: Memory Layout
```

---

## Part 1: Noncopyable Types (~Copyable)

**Swift 6.0+** introduces noncopyable types for performance-critical scenarios where you want to avoid implicit copies.

### When to Use

- Large types that should never be copied (file handles, GPU buffers)
- Types with ownership semantics (must be explicitly consumed)
- Performance-critical code where copies are expensive

### Basic Pattern

```swift
// Noncopyable type
struct FileHandle: ~Copyable {
    private let fd: Int32

    init(path: String) throws {
        self.fd = open(path, O_RDONLY)
        guard fd != -1 else { throw FileError.openFailed }
    }

    deinit {
        close(fd)
    }

    // Must explicitly consume
    consuming func close() {
        _ = consume self
    }
}

// Usage
func processFile() throws {
    let handle = try FileHandle(path: "/data.txt")
    // handle is automatically consumed at end of scope
    // Cannot accidentally copy handle
}
```

### Ownership Annotations

```swift
// consuming - takes ownership, caller cannot use after
func process(consuming data: [UInt8]) {
    // data is consumed
}

// borrowing - temporary access without ownership
func validate(borrowing data: [UInt8]) -> Bool {
    // data can still be used by caller
    return data.count > 0
}

// inout - mutable access
func modify(inout data: [UInt8]) {
    data.append(0)
}
```

### Performance Impact

- **Eliminates implicit copies**: Compiler error instead of runtime copy
- **Zero-cost abstraction**: Same performance as manual memory management
- **Use when**: Type is expensive to copy (>64 bytes) and copies are rare

---

## Part 2: Copy-on-Write (COW)

Swift collections use COW for efficient memory sharing. Understanding when copies happen is critical for performance.

### How COW Works

```swift
var array1 = [1, 2, 3]  // Single allocation
var array2 = array1     // Share storage (no copy)
array2.append(4)        // Now copies (array1 modified array2)
```

### Custom COW Implementation

```swift
final class Storage<T> {
    var data: [T]
    init(_ data: [T]) { self.data = data }
}

struct COWArray<T> {
    private var storage: Storage<T>

    init(_ data: [T]) {
        self.storage = Storage(data)
    }

    // COW check before mutation
    private mutating func ensureUnique() {
        if !isKnownUniquelyReferenced(&storage) {
            storage = Storage(storage.data)
        }
    }

    mutating func append(_ element: T) {
        ensureUnique()  // Copy if shared
        storage.data.append(element)
    }

    subscript(index: Int) -> T {
        get { storage.data[index] }
        set {
            ensureUnique()  // Copy before mutation
            storage.data[index] = newValue
        }
    }
}
```

### Performance Tips

```swift
// ❌ Accidental copy in loop
for i in 0..<array.count {
    array[i] = transform(array[i])  // Copy on first mutation if shared!
}

// ✅ Reserve capacity first (ensures unique)
array.reserveCapacity(array.count)
for i in 0..<array.count {
    array[i] = transform(array[i])
}

// ❌ Multiple mutations trigger multiple uniqueness checks
array.append(1)
array.append(2)
array.append(3)

// ✅ Single reservation
array.reserveCapacity(array.count + 3)
array.append(contentsOf: [1, 2, 3])
```

---

## Part 3: Value vs Reference Semantics

Choosing between `struct` and `class` has significant performance implications.

### Decision Matrix

| Factor | Use Struct | Use Class |
|--------|-----------|-----------|
| **Size** | ≤ 64 bytes | > 64 bytes or contains large data |
| **Identity** | No identity needed | Needs identity (===) |
| **Inheritance** | Not needed | Inheritance required |
| **Mutation** | Infrequent | Frequent in-place updates |
| **Sharing** | No sharing needed | Must be shared across scope |

### Small Structs (Fast)

```swift
// ✅ Fast - fits in registers, no heap allocation
struct Point {
    var x: Double  // 8 bytes
    var y: Double  // 8 bytes
}  // Total: 16 bytes - excellent for struct

struct Color {
    var r, g, b, a: UInt8  // 4 bytes total - perfect for struct
}
```

### Large Structs (Slow)

```swift
// ❌ Slow - excessive copying
struct HugeData {
    var buffer: [UInt8]  // 1MB
    var metadata: String
}

func process(_ data: HugeData) {  // Copies 1MB!
    // ...
}

// ✅ Use reference semantics for large data
final class HugeData {
    var buffer: [UInt8]
    var metadata: String
}

func process(_ data: HugeData) {  // Only copies pointer (8 bytes)
    // ...
}
```

### Indirect Storage for Flexibility

```swift
// Best of both worlds
struct LargeDataWrapper {
    private final class Storage {
        var largeBuffer: [UInt8]
        init(_ buffer: [UInt8]) { self.largeBuffer = buffer }
    }

    private var storage: Storage

    init(buffer: [UInt8]) {
        self.storage = Storage(buffer)
    }

    // Value semantics externally, reference internally
    var buffer: [UInt8] {
        get { storage.largeBuffer }
        set {
            if !isKnownUniquelyReferenced(&storage) {
                storage = Storage(newValue)
            } else {
                storage.largeBuffer = newValue
            }
        }
    }
}
```

---

## Part 4: ARC Optimization

Automatic Reference Counting adds overhead. Minimize it where possible.

### Weak vs Unowned Performance

```swift
class Parent {
    var child: Child?
}

class Child {
    // ❌ Weak adds overhead (optional, thread-safe zeroing)
    weak var parent: Parent?
}

// ✅ Unowned when you know lifetime guarantees
class Child {
    unowned let parent: Parent  // No overhead, crashes if parent deallocated
}
```

**Performance**: `unowned` is ~2x faster than `weak` (no atomic operations).

**Use when**: Child lifetime < Parent lifetime (guaranteed).

### Closure Capture Optimization

```swift
class DataProcessor {
    var data: [Int]

    // ❌ Captures self strongly, then uses weak - unnecessary weak overhead
    func process(completion: @escaping () -> Void) {
        DispatchQueue.global().async { [weak self] in
            guard let self else { return }
            self.data.forEach { print($0) }
            completion()
        }
    }

    // ✅ Capture only what you need
    func process(completion: @escaping () -> Void) {
        let data = self.data  // Copy value type
        DispatchQueue.global().async {
            data.forEach { print($0) }  // No self captured
            completion()
        }
    }
}
```

### Reducing Retain/Release Traffic

```swift
// ❌ Multiple retain/release pairs
for object in objects {
    process(object)  // retain, release
}

// ✅ Single retain for entire loop
func processAll(_ objects: [MyClass]) {
    // Compiler optimizes to single retain/release
    for object in objects {
        process(object)
    }
}
```

### Observable Object Lifetimes

**From WWDC 2021-10216**: Object lifetimes end at **last use**, not at closing brace.

```swift
// ❌ Relying on observed lifetime is fragile
class Traveler {
    weak var account: Account?

    deinit {
        print("Deinitialized")  // May run BEFORE expected with ARC optimizations!
    }
}

func test() {
    let traveler = Traveler()
    let account = Account(traveler: traveler)
    // traveler's last use is above - may deallocate here!
    account.printSummary()  // weak reference may be nil!
}

// ✅ Explicitly extend lifetime when needed
func test() {
    let traveler = Traveler()
    let account = Account(traveler: traveler)

    withExtendedLifetime(traveler) {
        account.printSummary()  // traveler guaranteed to live
    }
}

// Alternative: defer at end of scope
func test() {
    let traveler = Traveler()
    defer { withExtendedLifetime(traveler) {} }

    let account = Account(traveler: traveler)
    account.printSummary()
}
```

**Why This Matters**: Observed object lifetimes are an emergent property of compiler optimizations and can change between:
- Xcode versions
- Build configurations (Debug vs Release)
- Unrelated code changes that enable new optimizations

**Build Setting**: Enable "Optimize Object Lifetimes" (Xcode 13+) during development to expose hidden lifetime bugs early.

---

## Part 5: Generics & Specialization

Generic code can be fast or slow depending on specialization.

### Specialization Basics

```swift
// Generic function
func process<T>(_ value: T) {
    print(value)
}

// Calling with concrete type
process(42)  // Compiler specializes: process_Int(42)
process("hello")  // Compiler specializes: process_String("hello")
```

### Existential Overhead

```swift
protocol Drawable {
    func draw()
}

// ❌ Existential container - expensive (heap allocation, indirection)
func drawAll(shapes: [any Drawable]) {
    for shape in shapes {
        shape.draw()  // Dynamic dispatch through witness table
    }
}

// ✅ Generic with constraint - can specialize
func drawAll<T: Drawable>(shapes: [T]) {
    for shape in shapes {
        shape.draw()  // Static dispatch after specialization
    }
}
```

**Performance**: Generic version ~10x faster (eliminates witness table overhead).

### Existential Container Internals

**From WWDC 2016-416**: `any Protocol` uses an existential container with specific performance characteristics.

```swift
// Existential Container Memory Layout (64-bit systems)
//
// Small Type (≤24 bytes):
// ┌──────────────────┬──────────────┬────────────────┐
// │ Value (inline)   │ Type         │ Protocol       │
// │ 3 words max      │ Metadata     │ Witness Table  │
// │ (24 bytes)       │ (8 bytes)    │ (8 bytes)      │
// └──────────────────┴──────────────┴────────────────┘
//   ↑ No heap allocation - value stored directly
//
// Large Type (>24 bytes):
// ┌──────────────────┬──────────────┬────────────────┐
// │ Heap Pointer →   │ Type         │ Protocol       │
// │ (8 bytes)        │ Metadata     │ Witness Table  │
// │                  │ (8 bytes)    │ (8 bytes)      │
// └──────────────────┴──────────────┴────────────────┘
//   ↑ Heap allocation required - pointer to actual value
//
// Total container size: 40 bytes (5 words on 64-bit)
// Threshold: 3 words (24 bytes) determines inline vs heap

// Small type example - stored inline (FAST)
struct Point: Drawable {
    var x, y, z: Double  // 24 bytes - fits inline!
}

let drawable: any Drawable = Point(x: 1, y: 2, z: 3)
// ✅ Point stored directly in container (no heap allocation)

// Large type example - heap allocated (SLOWER)
struct Rectangle: Drawable {
    var x, y, width, height: Double  // 32 bytes - exceeds inline buffer
}

let drawable: any Drawable = Rectangle(x: 0, y: 0, width: 10, height: 20)
// ❌ Rectangle allocated on heap, container stores pointer

// Performance comparison:
// - Small existential (≤24 bytes): ~5ns access time
// - Large existential (>24 bytes): ~15ns access time (heap indirection)
// - Generic `some Drawable`: ~2ns access time (no container)
```

**Design Tip**: Keep protocol-conforming types ≤24 bytes when used as `any Protocol` for best performance. Use `some Protocol` instead of `any Protocol` when possible to eliminate all container overhead.

### `@_specialize` Attribute

```swift
// Force specialization for common types
@_specialize(where T == Int)
@_specialize(where T == String)
func process<T: Comparable>(_ value: T) -> T {
    // Expensive generic operation
    return value
}

// Compiler generates:
// - func process_Int(_ value: Int) -> Int
// - func process_String(_ value: String) -> String
// - Generic fallback for other types
```

### `any` vs `some`

```swift
// ❌ any - existential, runtime overhead
func makeDrawable() -> any Drawable {
    return Circle()  // Heap allocation
}

// ✅ some - opaque type, compile-time type
func makeDrawable() -> some Drawable {
    return Circle()  // No overhead, type known at compile time
}
```

---

## Part 6: Inlining

Inlining eliminates function call overhead but increases code size.

### When to Inline

```swift
// ✅ Small, frequently called functions
@inlinable
public func fastAdd(_ a: Int, _ b: Int) -> Int {
    return a + b
}

// ❌ Large functions - code bloat
@inlinable  // Don't do this!
public func complexAlgorithm() {
    // 100 lines of code...
}
```

### Cross-Module Optimization

```swift
// Framework code
public struct Point {
    public var x: Double
    public var y: Double

    // ✅ Inlinable for cross-module optimization
    @inlinable
    public func distance(to other: Point) -> Double {
        let dx = x - other.x
        let dy = y - other.y
        return sqrt(dx*dx + dy*dy)
    }
}

// Client code
let p1 = Point(x: 0, y: 0)
let p2 = Point(x: 3, y: 4)
let d = p1.distance(to: p2)  // Inlined across module boundary
```

### `@usableFromInline`

```swift
// Internal helper that can be inlined
@usableFromInline
internal func helperFunction() { }

// Public API that uses it
@inlinable
public func publicAPI() {
    helperFunction()  // Can inline internal function
}
```

**Trade-off**: `@inlinable` exposes implementation, prevents future optimization.

---

## Part 7: Collection Performance

Choosing the right collection and using it correctly matters.

### Array vs ContiguousArray

```swift
// ❌ Array<T> - may use NSArray bridging (Swift/ObjC interop)
let array: Array<Int> = [1, 2, 3]

// ✅ ContiguousArray<T> - guaranteed contiguous memory (no bridging)
let array: ContiguousArray<Int> = [1, 2, 3]
```

**Use `ContiguousArray` when**: No ObjC bridging needed (pure Swift), ~15% faster.

### Reserve Capacity

```swift
// ❌ Multiple reallocations
var array: [Int] = []
for i in 0..<10000 {
    array.append(i)  // Reallocates ~14 times
}

// ✅ Single allocation
var array: [Int] = []
array.reserveCapacity(10000)
for i in 0..<10000 {
    array.append(i)  // No reallocations
}
```

### Dictionary Hashing

```swift
struct BadKey: Hashable {
    var data: [Int]

    // ❌ Expensive hash (iterates entire array)
    func hash(into hasher: inout Hasher) {
        for element in data {
            hasher.combine(element)
        }
    }
}

struct GoodKey: Hashable {
    var id: UUID  // Fast hash
    var data: [Int]  // Not hashed

    // ✅ Hash only the unique identifier
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
```

### InlineArray (Swift 6.2)

Fixed-size arrays stored directly on the stack—no heap allocation, no COW overhead.

```swift
// Traditional Array - heap allocated, COW overhead
var sprites: [Sprite] = Array(repeating: .default, count: 40)

// InlineArray - stack allocated, no COW
var sprites = InlineArray<40, Sprite>(repeating: .default)
// Alternative syntax (if available)
var sprites: [40 of Sprite] = ...
```

**When to Use InlineArray**:
- Fixed size known at compile time
- Performance-critical paths (tight loops, hot paths)
- Want to avoid heap allocation entirely
- Small to medium sizes (practical limit ~1KB stack usage)

**Key Characteristics**:
```swift
let inline = InlineArray<10, Int>(repeating: 0)

// ✅ Stack allocated - no heap
print(MemoryLayout.size(ofValue: inline))  // 80 bytes (10 × 8)

// ✅ Value semantics - but eagerly copied (not COW!)
var copy = inline  // Copies all 10 elements immediately
copy[0] = 100     // No COW check needed

// ✅ Provides Span access for zero-copy operations
let span = inline.span  // Read-only view
let mutableSpan = inline.mutableSpan  // Mutable view
```

**Performance Comparison**:
```swift
// Array: Heap allocation + COW overhead
var array = Array(repeating: 0, count: 100)
// - Allocation: ~1μs (heap)
// - Copy: ~50ns (COW reference bump)
// - Mutation: ~50ns (uniqueness check)

// InlineArray: Stack allocation, no COW
var inline = InlineArray<100, Int>(repeating: 0)
// - Allocation: 0ns (stack frame)
// - Copy: ~400ns (eager copy all 100 elements)
// - Mutation: 0ns (no uniqueness check)
```

**24-Byte Threshold Connection**:

InlineArray relates to the existential container threshold from Part 5:

```swift
// Existential containers store ≤24 bytes inline
struct Small: Protocol {
    var a, b, c: Int64  // 24 bytes - fits inline
}

// InlineArray of 3 Int64s also ≤24 bytes
let inline = InlineArray<3, Int64>(repeating: 0)
// Size: 24 bytes - same threshold, different purpose

// Both avoid heap allocation at this size
let existential: any Protocol = Small(...)  // Inline storage
let array = inline  // Stack storage
```

**Copy Semantics Warning**:
```swift
// ❌ Unexpected: InlineArray copies eagerly
func processLarge(_ data: InlineArray<1000, UInt8>) {
    // Copies all 1000 bytes on call!
}

// ✅ Use Span to avoid copy
func processLarge(_ data: Span<UInt8>) {
    // Zero-copy view, no matter the size
}

// Best practice: Store InlineArray, pass Span
struct Buffer {
    var storage = InlineArray<1000, UInt8>(repeating: 0)

    func process() {
        helper(storage.span)  // Pass view, not copy
    }
}
```

**When NOT to Use InlineArray**:
- Dynamic sizes (use Array)
- Large data (>1KB stack usage risky)
- Frequently passed by value (use Span instead)
- Need COW semantics (use Array)

### Lazy Sequences

```swift
// ❌ Eager evaluation - processes entire array
let result = array
    .map { expensive($0) }
    .filter { $0 > 0 }
    .first  // Only need first element!

// ✅ Lazy evaluation - stops at first match
let result = array
    .lazy
    .map { expensive($0) }
    .filter { $0 > 0 }
    .first  // Only evaluates until first match
```

---

## Part 8: Concurrency Performance

Async/await and actors add overhead. Use appropriately.

### Actor Isolation Overhead

```swift
actor Counter {
    private var value = 0

    // ❌ Actor call overhead for simple operation
    func increment() {
        value += 1
    }
}

// Calling from different isolation domain
for _ in 0..<10000 {
    await counter.increment()  // 10,000 actor hops!
}

// ✅ Batch operations to reduce actor overhead
actor Counter {
    private var value = 0

    func incrementBatch(_ count: Int) {
        value += count
    }
}

await counter.incrementBatch(10000)  // Single actor hop
```

### async/await vs Completion Handlers

```swift
// async/await overhead: ~20-30μs per suspension point

// ❌ Unnecessary async for fast synchronous operation
func compute() async -> Int {
    return 42  // Instant, but pays async overhead
}

// ✅ Keep synchronous operations synchronous
func compute() -> Int {
    return 42  // No overhead
}
```

### Task Creation Cost

```swift
// ❌ Creating task per item (~100μs overhead each)
for item in items {
    Task {
        await process(item)
    }
}

// ✅ Single task for batch
Task {
    for item in items {
        await process(item)
    }
}

// ✅ Or use TaskGroup for parallelism
await withTaskGroup(of: Void.self) { group in
    for item in items {
        group.addTask {
            await process(item)
        }
    }
}
```

### `@concurrent` Attribute (Swift 6.2)

```swift
// Force background execution
@concurrent
func expensiveComputation() -> Int {
    // Always runs on background thread, even if called from MainActor
    return complexCalculation()
}

// Safe to call from main actor without blocking
@MainActor
func updateUI() async {
    let result = await expensiveComputation()  // Guaranteed off main thread
    label.text = "\(result)"
}
```

### nonisolated Performance

```swift
actor DataStore {
    private var data: [Int] = []

    // ❌ Isolated - actor overhead even for read-only
    func getCount() -> Int {
        data.count
    }

    // ✅ nonisolated for immutable state
    nonisolated var storedCount: Int {
        // Must be immutable
        return data.count  // Error: cannot access isolated property
    }
}
```

---

## Part 9: Memory Layout

Understanding memory layout helps optimize cache performance and reduce allocations.

### Struct Padding

```swift
// ❌ Poor layout (24 bytes due to padding)
struct BadLayout {
    var a: Bool    // 1 byte + 7 padding
    var b: Int64   // 8 bytes
    var c: Bool    // 1 byte + 7 padding
}
print(MemoryLayout<BadLayout>.size)  // 24 bytes

// ✅ Optimized layout (16 bytes)
struct GoodLayout {
    var b: Int64   // 8 bytes
    var a: Bool    // 1 byte
    var c: Bool    // 1 byte + 6 padding
}
print(MemoryLayout<GoodLayout>.size)  // 16 bytes
```

### Alignment

```swift
// Query alignment
print(MemoryLayout<Double>.alignment)  // 8
print(MemoryLayout<Int32>.alignment)   // 4

// Structs align to largest member
struct Mixed {
    var int32: Int32   // 4 bytes, 4-byte aligned
    var double: Double // 8 bytes, 8-byte aligned
}
print(MemoryLayout<Mixed>.alignment)  // 8 (largest member)
```

### Cache-Friendly Data Structures

```swift
// ❌ Poor cache locality
struct PointerBased {
    var next: UnsafeMutablePointer<Node>?  // Pointer chasing
}

// ✅ Array-based for cache locality
struct ArrayBased {
    var data: ContiguousArray<Int>  // Contiguous memory
}

// Array iteration ~10x faster due to cache prefetching
```

---

## Part 10: Typed Throws (Swift 6)

Typed throws can be faster than untyped by avoiding existential overhead.

### Untyped vs Typed

```swift
// Untyped - existential container for error
func fetchData() throws -> Data {
    // Can throw any Error
    throw NetworkError.timeout
}

// Typed - concrete error type
func fetchData() throws(NetworkError) -> Data {
    // Can only throw NetworkError
    throw NetworkError.timeout
}
```

### Performance Impact

```swift
// Measure with tight loop
func untypedThrows() throws -> Int {
    throw GenericError.failed
}

func typedThrows() throws(GenericError) -> Int {
    throw GenericError.failed
}

// Benchmark: typed ~5-10% faster (no existential overhead)
```

### When to Use

- **Typed**: Library code with well-defined error types, hot paths
- **Untyped**: Application code, error types unknown at compile time

---

## Part 11: Span Types

**Swift 6.2+** introduces Span—a non-escapable, non-owning view into memory that provides safe, efficient access to contiguous data.

### What is Span?

Span is a modern replacement for `UnsafeBufferPointer` that provides:
- **Spatial safety**: Bounds-checked operations prevent out-of-bounds access
- **Temporal safety**: Lifetime inherited from source, preventing use-after-free
- **Zero overhead**: No heap allocation, no reference counting
- **Non-escapable**: Cannot outlive the data it references

```swift
// Traditional unsafe approach
func processUnsafe(_ data: UnsafeMutableBufferPointer<UInt8>) {
    data[100] = 0  // Crashes if out of bounds!
}

// Safe Span approach
func processSafe(_ data: MutableSpan<UInt8>) {
    data[100] = 0  // Traps with clear error if out of bounds
}
```

### When to Use Span vs Array vs UnsafeBufferPointer

| Use Case | Recommendation |
|----------|---------------|
| **Own the data** | Array (full ownership, COW) |
| **Temporary view for reading** | Span (safe, fast) |
| **Temporary view for writing** | MutableSpan (safe, fast) |
| **C interop, performance-critical** | RawSpan (untyped bytes) |
| **Unsafe performance** | UnsafeBufferPointer (legacy, avoid) |

### Basic Span Usage

```swift
let array = [1, 2, 3, 4, 5]

// Get read-only span
let span = array.span
print(span[0])  // 1
print(span.count)  // 5

// Iterate safely
for element in span {
    print(element)
}

// Slicing (creates new span, no copy)
let slice = span[1..<3]  // Span<Int> viewing [2, 3]
```

### MutableSpan for Modifications

```swift
var array = [10, 20, 30, 40, 50]

// Get mutable span
let mutableSpan = array.mutableSpan

// Modify through span
mutableSpan[0] = 100
mutableSpan[1] = 200

print(array)  // [100, 200, 30, 40, 50]

// Safe bounds checking
// mutableSpan[10] = 0  // Fatal error: Index out of range
```

### RawSpan for Untyped Bytes

```swift
struct PacketHeader {
    var version: UInt8
    var flags: UInt8
    var length: UInt16
}

func parsePacket(_ data: RawSpan) -> PacketHeader? {
    guard data.count >= MemoryLayout<PacketHeader>.size else {
        return nil
    }

    // Safe byte-level access
    let version = data[0]
    let flags = data[1]
    let lengthLow = data[2]
    let lengthHigh = data[3]

    return PacketHeader(
        version: version,
        flags: flags,
        length: UInt16(lengthHigh) << 8 | UInt16(lengthLow)
    )
}

// Usage
let bytes: [UInt8] = [1, 0x80, 0x00, 0x10]  // Version 1, flags 0x80, length 16
let rawSpan = bytes.rawSpan
if let header = parsePacket(rawSpan) {
    print("Packet version: \(header.version)")
}
```

### Span-Providing Properties

Swift 6.2 collections automatically provide span properties:

```swift
// Array provides .span and .mutableSpan
let array = [1, 2, 3]
let span: Span<Int> = array.span

// ContiguousArray provides spans
let contiguous = ContiguousArray([1, 2, 3])
let span2 = contiguous.span

// UnsafeBufferPointer provides .span (migration path)
let buffer: UnsafeBufferPointer<Int> = ...
let span3 = buffer.span  // Modern safe wrapper
```

### Performance Characteristics

```swift
// ❌ Array copy - heap allocation
func process(_ array: [Int]) {
    // Array copied if passed across module boundary
}

// ❌ UnsafeBufferPointer - no bounds checking
func process(_ buffer: UnsafeBufferPointer<Int>) {
    buffer[100]  // Crash or memory corruption!
}

// ✅ Span - no copy, bounds-checked, temporal safety
func process(_ span: Span<Int>) {
    span[100]  // Safe trap if out of bounds
}

// Performance: Span is as fast as UnsafeBufferPointer (~2ns access)
// but with safety guarantees (bounds checks are optimized away when safe)
```

### Non-Escapable Lifetime Safety

```swift
// ✅ Safe - span lifetime bound to array
func useSpan() {
    let array = [1, 2, 3, 4, 5]
    let span = array.span
    process(span)  // Safe - array still alive
}

// ❌ Compiler prevents this
func dangerousSpan() -> Span<Int> {
    let array = [1, 2, 3]
    return array.span  // Error: Cannot return non-escapable value
}

// This is what temporal safety prevents
// (Compare to UnsafeBufferPointer which ALLOWS this bug!)
```

### Integration with InlineArray

```swift
// InlineArray provides span access
let inline = InlineArray<10, UInt8>()
let span: Span<UInt8> = inline.span
let mutableSpan: MutableSpan<UInt8> = inline.mutableSpan

// Efficient zero-copy parsing
func parseHeader(_ span: Span<UInt8>) -> Header {
    // Direct access to inline storage via span
    Header(
        magic: span[0],
        version: span[1],
        flags: span[2]
    )
}

let header = parseHeader(inline.span)  // No heap allocation!
```

### Migration from UnsafeBufferPointer

```swift
// Old pattern (unsafe)
func processLegacy(_ buffer: UnsafeBufferPointer<Int>) {
    for i in 0..<buffer.count {
        print(buffer[i])
    }
}

// New pattern (safe)
func processModern(_ span: Span<Int>) {
    for element in span {  // Safe iteration
        print(element)
    }
}

// Migration bridge
let buffer: UnsafeBufferPointer<Int> = ...
let span = buffer.span  // Wrap unsafe pointer in safe span
processModern(span)
```

### Common Patterns

```swift
// Pattern 1: Binary parsing with RawSpan
func parse<T>(_ span: RawSpan) -> T? {
    guard span.count >= MemoryLayout<T>.size else {
        return nil
    }
    return span.load(as: T.self)  // Safe type reinterpretation
}

// Pattern 2: Chunked processing
func processChunks(_ data: Span<UInt8>, chunkSize: Int) {
    var offset = 0
    while offset < data.count {
        let end = min(offset + chunkSize, data.count)
        let chunk = data[offset..<end]  // Span slice, no copy
        processChunk(chunk)
        offset += chunkSize
    }
}

// Pattern 3: Safe C interop
func sendToC(_ span: Span<UInt8>) {
    span.withUnsafeBufferPointer { buffer in
        // Only escape to unsafe inside controlled scope
        c_function(buffer.baseAddress, buffer.count)
    }
}
```

### When NOT to Use Span

```swift
// ❌ Don't use Span for ownership
struct Document {
    var data: Span<UInt8>  // Error: Span can't be stored
}

// ✅ Use Array for owned data
struct Document {
    var data: [UInt8]

    // Provide span access when needed
    var dataSpan: Span<UInt8> {
        data.span
    }
}

// ❌ Don't try to escape Span from scope
func getSpan() -> Span<Int> {  // Error: Non-escapable
    let array = [1, 2, 3]
    return array.span
}

// ✅ Process in scope, return owned data
func processAndReturn() -> [Int] {
    let array = [1, 2, 3]
    process(array.span)  // Process with span
    return array  // Return owned data
}
```

---

## Copy-Paste Patterns

### Pattern 1: COW Wrapper

```swift
final class Storage<T> {
    var value: T
    init(_ value: T) { self.value = value }
}

struct COWWrapper<T> {
    private var storage: Storage<T>

    init(_ value: T) {
        storage = Storage(value)
    }

    var value: T {
        get { storage.value }
        set {
            if !isKnownUniquelyReferenced(&storage) {
                storage = Storage(newValue)
            } else {
                storage.value = newValue
            }
        }
    }
}
```

### Pattern 2: Performance-Critical Loop

```swift
func processLargeArray(_ input: [Int]) -> [Int] {
    var result = ContiguousArray<Int>()
    result.reserveCapacity(input.count)

    for element in input {
        result.append(transform(element))
    }

    return Array(result)
}
```

### Pattern 3: Inline Cache Lookup

```swift
private var cache: [Key: Value] = [:]

@inlinable
func getCached(_ key: Key) -> Value? {
    return cache[key]  // Inlined across modules
}
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Premature Optimization

```swift
// Don't optimize without measuring first!

// ❌ Complex optimization with no measurement
struct OverEngineered {
    @usableFromInline var data: ContiguousArray<UInt8>
    // 100 lines of COW logic...
}

// ✅ Start simple, measure, then optimize
struct Simple {
    var data: [UInt8]
}
// Profile → Optimize if needed
```

### ❌ Anti-Pattern 2: Weak Everywhere

```swift
class Manager {
    // ❌ Unnecessary weak reference overhead
    weak var delegate: Delegate?
    weak var dataSource: DataSource?
    weak var observer: Observer?
}

// ✅ Use unowned when lifetime is guaranteed
class Manager {
    unowned let delegate: Delegate  // Delegate outlives Manager
    weak var dataSource: DataSource?  // Optional, may be nil
}
```

### ❌ Anti-Pattern 3: Actor for Everything

```swift
// ❌ Actor overhead for simple synchronous data
actor SimpleCounter {
    private var count = 0

    func increment() {
        count += 1
    }
}

// ✅ Use lock-free atomics or @unchecked Sendable
import Atomics
struct AtomicCounter: @unchecked Sendable {
    private let count = ManagedAtomic<Int>(0)

    func increment() {
        count.wrappingIncrement(ordering: .relaxed)
    }
}
```

---

## Code Review Checklist

### Memory Management
- [ ] Large structs (>64 bytes) use indirect storage or are classes
- [ ] COW types use `isKnownUniquelyReferenced` before mutation
- [ ] Collections use `reserveCapacity` when size is known
- [ ] Weak references only where needed (prefer unowned when safe)

### Generics
- [ ] Protocol types use `some` instead of `any` where possible
- [ ] Hot paths use concrete types or `@_specialize`
- [ ] Generic constraints are as specific as possible

### Collections
- [ ] Pure Swift code uses `ContiguousArray` over `Array`
- [ ] Dictionary keys have efficient `hash(into:)` implementations
- [ ] Lazy evaluation used for short-circuit operations

### Concurrency
- [ ] Synchronous operations don't use `async`
- [ ] Actor calls are batched when possible
- [ ] Task creation is minimized (use TaskGroup)
- [ ] CPU-intensive work uses `@concurrent` (Swift 6.2)

### Optimization
- [ ] Profiling data exists before optimization
- [ ] Inlining only for small, frequently called functions
- [ ] Memory layout optimized for cache locality (large structs)

---

## Pressure Scenarios

### Scenario 1: "Just make it faster, we ship tomorrow"

**The Pressure**: Manager sees "slow" in profiler, demands immediate action.

**Red Flags**:
- No baseline measurements
- No Time Profiler data showing hotspots
- "Make everything faster" without targets

**Time Cost Comparison**:
- Premature optimization: 2 days of work, no measurable improvement
- Profile-guided optimization: 2 hours profiling + 4 hours fixing actual bottleneck = 40% faster

**How to Push Back Professionally**:
```
"I want to optimize effectively. Let me spend 30 minutes with Instruments
to find the actual bottleneck. This prevents wasting time on code that's
not the problem. I've seen this save days of work."
```

### Scenario 2: "Use actors everywhere for thread safety"

**The Pressure**: Team adopts Swift 6, decides "everything should be an actor."

**Red Flags**:
- Actor for simple value types
- Actor for synchronous-only operations
- Async overhead in tight loops

**Time Cost Comparison**:
- Actor everywhere: 100μs overhead per operation, janky UI
- Appropriate isolation: 10μs overhead, smooth 60fps

**How to Push Back Professionally**:
```
"Actors are great for isolation, but they add overhead. For this simple
counter, lock-free atomics are 10x faster. Let's use actors where we need
them—shared mutable state—and avoid them for pure value types."
```

### Scenario 3: "Inline everything for speed"

**The Pressure**: Someone reads that inlining is faster, marks everything `@inlinable`.

**Red Flags**:
- Large functions marked `@inlinable`
- Internal implementation details exposed
- Binary size increases 50%

**Time Cost Comparison**:
- Inline everything: Code bloat, slower app launch (3s → 5s)
- Selective inlining: Fast launch, actual hotspots optimized

**How to Push Back Professionally**:
```
"Inlining trades code size for speed. The compiler already inlines when
beneficial. Manual @inlinable should be for small, frequently called
functions. Let's profile and inline the 3 actual hotspots, not everything."
```

---

## Real-World Examples

### Example 1: Image Processing Pipeline

**Problem**: Processing 1000 images takes 30 seconds.

**Investigation**:
```swift
// Original code
func processImages(_ images: [UIImage]) -> [ProcessedImage] {
    var results: [ProcessedImage] = []
    for image in images {
        results.append(expensiveProcess(image))  // Reallocations!
    }
    return results
}
```

**Solution**:
```swift
func processImages(_ images: [UIImage]) -> [ProcessedImage] {
    var results = ContiguousArray<ProcessedImage>()
    results.reserveCapacity(images.count)  // Single allocation

    for image in images {
        results.append(expensiveProcess(image))
    }

    return Array(results)
}
```

**Result**: 30s → 8s (73% faster) by eliminating reallocations.

### Example 2: Actor Batching for Counter

**Problem**: Actor counter in tight loop causes UI jank.

**Investigation**:
```swift
// Original - 10,000 actor hops
for _ in 0..<10000 {
    await counter.increment()  // ~100μs each = 1 second total!
}
```

**Solution**:
```swift
// Batch operations
actor Counter {
    private var value = 0

    func incrementBatch(_ count: Int) {
        value += count
    }
}

await counter.incrementBatch(10000)  // Single actor hop
```

**Result**: 1000ms → 0.1ms (10,000x faster) by batching.

### Example 3: Generic Specialization

**Problem**: Protocol-based rendering is slow.

**Investigation**:
```swift
// Original - existential overhead
func render(shapes: [any Shape]) {
    for shape in shapes {
        shape.draw()  // Dynamic dispatch
    }
}
```

**Solution**:
```swift
// Specialized generic
func render<S: Shape>(shapes: [S]) {
    for shape in shapes {
        shape.draw()  // Static dispatch after specialization
    }
}

// Or use @_specialize
@_specialize(where S == Circle)
@_specialize(where S == Rectangle)
func render<S: Shape>(shapes: [S]) { }
```

**Result**: 100ms → 10ms (10x faster) by eliminating witness table overhead.

### Example 4: Apple Password Monitoring Migration

**Problem**: Apple's Password Monitoring service needed to scale while reducing costs.

**Original Implementation**: Java-based service
- High memory usage (gigabytes)
- 50% Kubernetes cluster utilization
- Moderate throughput

**Swift Rewrite Benefits**:
```swift
// Key performance wins from Swift's features:

// 1. Deterministic memory management (no GC pauses)
//    - No stop-the-world garbage collection
//    - Predictable latency for real-time processing

// 2. Value semantics + COW
//    - Efficient data sharing without defensive copying
//    - Reduced memory churn

// 3. Zero-cost abstractions
//    - Generic specialization eliminates runtime overhead
//    - Protocol conformances optimized away
```

**Results** (Apple's published metrics):
- **40% throughput increase** vs Java implementation
- **100x memory reduction**: Gigabytes → Megabytes
- **50% Kubernetes capacity freed**: Same workload, half the resources

**Why This Matters**: This real-world production service demonstrates that the performance patterns in this skill (COW, value semantics, generic specialization, ARC) deliver measurable business impact at scale.

**Source**: [Swift.org - Password Monitoring Case Study](https://www.swift.org/blog/password-monitoring/)

---

## Resources

**WWDC**: 2025-312, 2024-10217, 2024-10170, 2021-10216, 2016-416

**Docs**: /swift/inlinearray, /swift/span

**Skills**: axiom-performance-profiling, axiom-swift-concurrency, axiom-swiftui-performance

---

**Last Updated**: 2025-12-18
**Swift Version**: 6.2+ (for InlineArray, Span, `@concurrent`)
**Status**: Production-ready

**Remember**: Profile first, optimize later. Readability > micro-optimizations.
