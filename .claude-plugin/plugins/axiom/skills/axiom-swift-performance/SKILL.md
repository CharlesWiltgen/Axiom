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

## The Four Principles of Swift Performance

From WWDC 2024-10217: Swift's low-level performance characteristics come down to four areas. Each maps to a Part in this skill.

| Principle | What It Costs | Skill Coverage |
|-----------|--------------|----------------|
| **Function Calls** | Dispatch overhead, optimization barriers | Part 5 (Generics), Part 6 (Inlining) |
| **Memory Allocation** | Stack vs heap, allocation frequency | Part 3 (Value vs Reference), Part 7 (Collections) |
| **Memory Layout** | Cache locality, padding, contiguity | Part 9 (Memory Layout), Part 11 (Span) |
| **Value Copying** | COW triggers, defensive copies, ARC traffic | Part 1 (Noncopyable), Part 2 (COW), Part 4 (ARC) |

Understanding which principle is causing your bottleneck determines which Part to use.

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

For custom COW implementation, see Copy-Paste Pattern 1 (COW Wrapper) below.

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

### Defensive Copies

From WWDC 2024-10217: Swift sometimes inserts *defensive copies* when it cannot prove a value won't be mutated through a shared reference.

```swift
class DataStore {
    var items: [Item] = []  // COW type stored in class
}

func process(_ store: DataStore) {
    for item in store.items {
        // Swift may defensively copy `items` because:
        // 1. store.items is a class property (another reference could mutate it)
        // 2. The loop needs a stable snapshot
        handle(item)
    }
}
```

**How to avoid**: Copy to a local variable first — one explicit copy instead of repeated defensive copies:

```swift
func process(_ store: DataStore) {
    let items = store.items  // One copy
    for item in items {
        handle(item)  // No more defensive copies
    }
}
```

**In profiler**: Defensive copies appear as unexpected `swift_retain`/`swift_release` pairs or `Array.__allocating_init` calls when you didn't expect allocation.

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

For large data that needs value semantics externally with reference storage internally, use the COW Wrapper pattern — see Copy-Paste Pattern 1 below.

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

### Closure Capture Costs

From WWDC 2024-10217: Closures have different performance profiles depending on whether they escape.

```swift
// Non-escaping closure — stack-allocated context, zero ARC overhead
func processItems(_ items: [Item], using transform: (Item) -> Result) -> [Result] {
    items.map(transform)  // Closure context lives on stack
}

// Escaping closure — heap-allocated context, ARC on every captured reference
func processItemsLater(_ items: [Item], transform: @escaping (Item) -> Result) {
    // Closure context heap-allocated as anonymous class instance
    // Each captured reference gets retain/release
    self.pending = { items.map(transform) }
}
```

**Why this matters**: `@Sendable` closures are always escaping, meaning every Task closure heap-allocates its capture context.

**In hot paths**: Prefer non-escaping closures. If you see `swift_allocObject` in Time Profiler for closure contexts, look for escaping closures that could be non-escaping.

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
```

Object lifetimes can change between Xcode versions, Debug vs Release, and unrelated code changes. Enable "Optimize Object Lifetimes" (Xcode 13+) during development to expose hidden lifetime bugs early.

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

### Existential Container Overhead

**From WWDC 2016-416**: `any Protocol` uses a 40-byte existential container (5 words on 64-bit). The container stores type metadata + protocol witness table (16 bytes) plus a 24-byte inline value buffer. Types ≤24 bytes are stored directly in the buffer (fast, ~5ns access); larger types require a heap allocation with pointer indirection (slower, ~15ns). `some Protocol` eliminates all container overhead (~2ns).

**When `some` isn't available** (heterogeneous collections require `any`):
- **Reduce type sizes to ≤24 bytes** — keep protocol-conforming types small enough for inline storage (3 words: e.g., `Point { x, y, z: Double }` fits exactly)
- **Use enum dispatch instead** — `enum Shape { case circle(Circle), rect(Rect) }` with `switch` eliminates containers entirely, trades flexibility for performance
- **Batch operations** — amortize per-element existential overhead by processing in chunks rather than one-at-a-time
- **Measure first** — existential overhead (~10ns/access) only matters in tight loops; for UI-level code it's negligible

### `@_specialize` Attribute

Force specialization for common types when the compiler doesn't do it automatically:

```swift
@_specialize(where T == Int)
@_specialize(where T == String)
func process<T: Comparable>(_ value: T) -> T { value }
// Generates specialized versions + generic fallback
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

Fixed-size arrays stored directly on the stack—no heap allocation, no COW overhead. Uses value generics to encode size in the type.

```swift
// Traditional Array - heap allocated, COW overhead
var sprites: [Sprite] = Array(repeating: .default, count: 40)

// InlineArray - stack allocated, no COW (value generic syntax)
var sprites = InlineArray<40, Sprite>(repeating: .default)
```

**Conformances**: `RandomAccessCollection`, `MutableCollection`, `BitwiseCopyable`, `Sendable`. Supports `~Copyable` element types.

**When to Use InlineArray**:
- Fixed size known at compile time
- Performance-critical paths (tight loops, hot paths)
- Want to avoid heap allocation entirely
- Small to medium sizes (practical limit ~1KB stack usage)

InlineArray is stack-allocated (no heap), eagerly copied (not COW), and provides `.span`/`.mutableSpan` for zero-copy access. Measure your own benchmarks for allocation/copy/mutation trade-offs vs Array.

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

### Async Overhead

Each async suspension costs ~20-30μs. Keep synchronous operations synchronous—don't mark a function `async` if it doesn't need to await.

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

For `nonisolated` performance patterns and detailed actor isolation guidance, see `axiom-swift-concurrency`.

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

### Exclusivity Checks

From WWDC 2025-312: Runtime exclusivity enforcement (`swift_beginAccess`/`swift_endAccess`) appears in Time Profiler when the compiler cannot prove memory safety statically.

**What they are**: Swift enforces that no two accesses to the same variable overlap if one is a write. For struct properties, this is checked at compile time. For class stored properties, runtime checks are inserted.

**How to identify**: Look for `swift_beginAccess` and `swift_endAccess` in Time Profiler or Processor Trace flame graphs.

```swift
// ❌ Class properties require runtime exclusivity checks
class Parser {
    var state: ParserState
    var cache: [Int: Pixel]

    func parse() {
        state.advance()         // swift_beginAccess / swift_endAccess
        cache[key] = pixel      // swift_beginAccess / swift_endAccess
    }
}

// ✅ Struct properties checked at compile time — zero runtime cost
struct Parser {
    var state: ParserState
    var cache: InlineArray<64, Pixel>

    mutating func parse() {
        state.advance()         // No runtime check
        cache[key] = pixel      // No runtime check
    }
}
```

**Real-world impact**: In WWDC 2025-312's QOI image parser, moving properties from a class to a struct eliminated all runtime exclusivity checks, contributing to a measurable speedup as part of a >700x total improvement.

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
let span = array.span        // Read-only view
print(span[0])               // Subscript access
for element in span { }      // Safe iteration
let slice = span[1..<3]      // Span slice, no copy
```

### MutableSpan for Modifications

```swift
var array = [10, 20, 30, 40, 50]
let mutableSpan = array.mutableSpan
mutableSpan[0] = 100  // Modifies array in-place, bounds-checked
```

### RawSpan for Untyped Bytes

```swift
func parsePacket(_ data: RawSpan) -> PacketHeader? {
    guard data.count >= MemoryLayout<PacketHeader>.size else { return nil }
    // Safe byte-level access via subscript
    return PacketHeader(version: data[0], flags: data[1],
        length: UInt16(data[3]) << 8 | UInt16(data[2]))
}

let header = parsePacket(bytes.rawSpan)  // .rawSpan on any [UInt8]
```

All Swift 6.2 collections provide `.span` and `.mutableSpan` properties, including `Array`, `ContiguousArray`, and `UnsafeBufferPointer` (migration path). Span access speed matches `UnsafeBufferPointer` (~2ns) with bounds checking.

### Non-Escapable Lifetime Safety

Span's lifetime is bound to its source. The compiler prevents returning a Span from a function where the source would be deallocated — unlike `UnsafeBufferPointer`, which allows this bug silently.

```swift
func dangerousSpan() -> Span<Int> {
    let array = [1, 2, 3]
    return array.span  // ❌ Error: Cannot return non-escapable value
}
```

InlineArray also provides `.span`/`.mutableSpan` — see Part 7 for InlineArray usage and copy-avoidance via Span.

### Migration from UnsafeBufferPointer

```swift
// Migration bridge: wrap unsafe in safe span
let buffer: UnsafeBufferPointer<Int> = ...
let span = buffer.span  // UnsafeBufferPointer provides .span

func processModern(_ span: Span<Int>) {
    for element in span {  // Safe iteration, bounds-checked
        print(element)
    }
}
```

### OutputSpan — Safe Initialization

OutputSpan/OutputRawSpan replace `UnsafeMutableBufferPointer` for initializing new collections without intermediate allocations. Use for building byte arrays, binary serialization, image pixel data. Apple's open-source [Swift Binary Parsing](https://github.com/apple/swift-binary-parsing) library is built entirely on Span types.

### When NOT to Use Span

- **Ownership**: Span can't be stored in structs/classes — use Array for owned data, provide `.span` access via computed property
- **Return values**: Span is non-escapable — process in scope, return owned data
- **Long-lived references**: Span lifetime is bound to source — use Array if data must outlive the current scope

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

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Premature optimization** | Complex COW/ContiguousArray with no profiling data | Start simple, profile, optimize what matters |
| **Weak everywhere** | `weak` on every delegate (atomic overhead) | Use `unowned` when lifetime is guaranteed (see Part 4) |
| **Actor for everything** | Actor isolation on simple counters (~100μs/call) | Use lock-free atomics (`ManagedAtomic`) for simple sync data |

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

### Example 2: Generic Specialization

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

---

## Resources

**WWDC**: 2025-312, 2024-10217, 2024-10170, 2021-10216, 2016-416

**Docs**: /swift/inlinearray, /swift/span, /swift/outputspan

**Skills**: axiom-performance-profiling, axiom-swift-concurrency, axiom-swiftui-performance

---
