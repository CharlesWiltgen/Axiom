
# borrowing & consuming — Parameter Ownership

Explicit ownership modifiers for performance optimization and noncopyable type support.

## When to Use

✅ **Use when:**
- Large value types being passed read-only (make copies inside the callee explicit)
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

The default parameter convention is already `borrowing` — the caller keeps the
buffer and nothing is copied at the call site, so there is no copy to avoid.
Write the modifier explicitly to document intent and to make the body's copies
explicit: with `borrowing`, an implicit copy inside the body is an error
(Pattern 3).

```swift
struct LargeBuffer {
    var data: [UInt8]  // Could be megabytes
}

// ✅ Default convention: already a borrow, no call-site copy
func process(_ buffer: LargeBuffer) -> Int {
    buffer.data.count
}

// ✅ Explicit `borrowing`: same codegen, and copies inside the body must now
//    be written `copy buffer`
func inspect(_ buffer: borrowing LargeBuffer) -> Int {
    buffer.data.count
}
```

### Pattern 2: Consuming Factory

```swift
struct Builder: ~Copyable {
    var config: Configuration

    // Consumes self — builder invalid after call
    consuming func build() -> Product {
        Product(config: config)
    }
}

func makeProduct() -> Product {
    let builder = Builder(config: .default)
    return builder.build()
    // `builder` has been moved — reuse is `error: 'builder' used after consume`
}
```

The move only compiles inside a function: a top-level `let builder` is a *global*,
and a global noncopyable value cannot be consumed
(`error: cannot consume noncopyable stored property 'builder' that is global`).
Only a `~Copyable` builder is invalidated this way — for a copyable `Builder` the
call passes a copy and the caller keeps a usable value, so a `consuming` method
on a copyable type documents intent rather than enforcing use-once.

### Pattern 3: Explicit Copy in Borrowing

With `borrowing`, copies must be explicit:

```swift
mutating func store(_ value: borrowing LargeValue) {
    // ❌ error: 'value' is borrowed and cannot be consumed
    self.cached = value

    // ✅ Explicit copy
    self.cached = copy value
}
```

### Pattern 4: Consume Operator

Transfer ownership explicitly:

```swift
func consumeOnce() {
    let data = loadLargeData()      // a ~Copyable value
    process(consume data)
    // data has been moved — reuse is `error: 'data' used after consume`
}
```

The move needs a function scope: a top-level `let data` is a *global*, and a
global noncopyable value cannot be consumed
(`error: cannot consume noncopyable stored property 'data' that is global`).
`consume` also only moves a value of `~Copyable` type. Applied to a copyable
value it changes nothing: the compiler warns `'consume' applied to
bitwise-copyable type 'LargeValue' has no effect` and the original binding stays
usable.

### Pattern 5: Noncopyable Type

For `~Copyable` types, *parameters* of a noncopyable type must state ownership
(`error: parameter of noncopyable type 'Token' must specify ownership`). Methods
on a `~Copyable` type default to `borrowing self` and need no modifier.

```swift
struct FileHandle: ~Copyable {
    private let fd: Int32

    init(path: String) throws {
        fd = open(path, O_RDONLY)
        guard fd >= 0 else { throw POSIXError(.EIO) }
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

Class parameters already use the guaranteed (+0) convention: the callee receives
a borrow, so `borrowing` changes nothing at the call site and removes no ARC
traffic. Both functions below compile to the same `@guaranteed ExpensiveObject`
parameter with no retain/release in either body:

```swift
class ExpensiveObject { /* ... */ }

// ✅ Already a borrow — SIL: @guaranteed ExpensiveObject -> @owned String
func inspect(_ obj: ExpensiveObject) -> String {
    obj.description
}

// ✅ Adding `borrowing` documents the intent; codegen is identical
func inspectBorrowing(_ obj: borrowing ExpensiveObject) -> String {
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
mutating func cache(_ value: borrowing LargeValue) {
    // ❌ error: 'value' is borrowed and cannot be consumed
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
| Can't capture in closures by default | Capturing the value consumes it into the closure | Use `borrowing` closure parameters |
| Protocol existentials of noncopyable protocols | `any P` (`P: ~Copyable`) won't hold a `~Copyable` value | Use generics; `any ~Copyable` itself is supported |

**Common compiler errors when adopting ownership modifiers:**

```swift
// Error: 'value' is borrowed and cannot be consumed
// Fix: Add explicit `copy` or change to consuming
mutating func store(_ v: borrowing LargeValue) {
    self.cached = copy v  // ✅ Explicit copy
}

// Error: global function 'use' requires that 'Token' conform to 'Copyable'
//        ('where T: Copyable' is implicit here)
// Fix: Constrain generic to ~Copyable
func use<T: ~Copyable>(_ value: borrowing T) { }  // ✅

// Error: 'v' is borrowed and cannot be consumed
// Fix: Change to consuming if you need ownership transfer
func takeOwnership(_ v: consuming FileHandle) { }  // ✅

// Error: parameter of noncopyable type 'Token' must specify ownership
// Fix: Noncopyable *parameters* need an ownership modifier — methods on a
//      ~Copyable type default to `borrowing self` and need none
struct Token: ~Copyable {
    borrowing func peek() -> String { ... }   // ✅ Explicit
    consuming func redeem() { ... }           // ✅ Explicit
    func plain() -> String { ... }            // ✅ Also fine — implies borrowing self
}
```

**When NOT to use ~Copyable:**
- If you need collection storage (arrays, dictionaries)
- If you need to work with existing generic APIs
- If the type needs broad protocol conformance
- Prefer `consuming func` on regular types to express use-once intent — it takes ownership of a copy, so callers can still reuse the value; only `~Copyable` enforces it

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

`InlineArray` and the value-generics feature itself require iOS 26 (`@available(anyAppleOS 26.0, *)`); on an earlier deployment target the compiler reports `'InlineArray' is only available in iOS 26.0 or newer` and `values in generic types are only available in iOS 26.0.0 or newer`.

### Declaration

```swift
@frozen struct InlineArray<let count: Int, Element>: ~Copyable where Element: ~Copyable
```

The `let count: Int` is a **value generic** — the size is part of the type, checked at compile time. `InlineArray<3, Int>` and `InlineArray<4, Int>` are different types. The array is `~Copyable` itself, so it becomes noncopyable when `Element` is (`InlineArray<4, Token>` for a `~Copyable` `Token` cannot be assigned or copied).

On Swift 6.4 (Xcode 27) you can also write the type with the `[count of Element]` shorthand — it denotes the same iOS 26+ `InlineArray`:

```swift
let rgb: [3 of Double] = [0.2, 0.4, 0.8]   // == InlineArray<3, Double>
```

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

Containers with contiguous storage expose `.span` and `.mutableSpan` — both are iOS 26 (`@available(anyAppleOS 26.0, *)`; targeting an older OS gives `'span' is only available in iOS 26.0 or newer`). `Span` and `MutableSpan` themselves back-deploy to iOS 12.2; it is the container accessors that are new:

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
// ❌ Sema rejects the return position itself, whatever the body does:
//    error: a function cannot return a ~Escapable result
//    (a lending function needs @lifetime(borrow:), an experimental feature in 6.4)
func getSpan() -> Span<UInt8> {
    let array: [UInt8] = Array(repeating: 0, count: 128)
    return array.span
}

// ❌ A span cannot escape the borrow's scope — binding the closure escapes it:
//    error: lifetime-dependent variable 'span' escapes its scope
let span = array.span
let closure = { span.count }

// ❌ Cannot mutate the container while a span borrows it
var array = [1, 2, 3]
let span = array.span
array.append(4)  // error: overlapping accesses to 'array', but modification requires
                 // exclusive access; consider copying to a local variable [#ExclusivityViolation]
```

These constraints prevent use-after-free, dangling pointers, and overlapping mutation at **compile time** with zero runtime cost.

Reads are not the problem: `span[0]` on its own compiles, and a non-escaping
closure may capture the span (`use { span.count }`) — what the compiler rejects
is the container mutation while the borrow is live, and any use that lets the
span outlive its scope.

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
    var raw = data.span.bytes  // RawSpan over the array's bytes (Span<Element: BitwiseCopyable>.bytes)
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

Currently limited to `Int` parameters (a `let n: UInt8` parameter is rejected: `'UInt8' is not a supported value type for 'n'`), and gated to iOS 26 like the rest of the feature. Enables stack-allocated, fixed-size abstractions where the compiler verifies size compatibility at compile time.

## Swift 6.4 Additions (OS27)

The 6.4 toolchain (Xcode 27) extends the ownership toolkit. These are verified against the Xcode 27.0 compiler:

### `borrow` / `mutate` accessors

Replace `get`/`set` to expose shared storage **without copying** — and to vend `~Copyable` values from a computed property:

```swift
var value: Value {
    borrow { storage }             // read-only, no copy
    mutate { &storage }            // exclusive in-place access
}
```

A `borrow` accessor may only yield a stored property, a property that itself has
`borrow`/`mutate` accessors, or a global `let`. Yielding something else — a
`get`-based property such as `UnsafeMutablePointer.pointee` — is rejected
(`error: invalid return value from a borrow accessor`); the stdlib's own
`UniqueBox.value` adds `@_unsafeSelfDependentResult` to `borrow { pointer.pointee }`
to opt in.

### Noncopyable & nonescapable conformances

`Equatable`, `Comparable`, and `Hashable` now work on `~Copyable` types — all three are declared `: ~Copyable, ~Escapable`, so they work on `~Escapable` types too — and associated types may be `~Copyable` / `~Escapable`. You no longer have to make a unique-resource type copyable just to compare or hash it:

```swift
struct FileHandle: ~Copyable, Equatable {
    let fd: Int32
    static func == (a: borrowing FileHandle, b: borrowing FileHandle) -> Bool { a.fd == b.fd }
}
```

### Single-value & unique containers

The 6.4 stdlib adds lightweight ownership containers — verified usable in Xcode 27.0 (no experimental flag). Each gates on `@available(anyAppleOS 27, *)`:

| Type | Copyability | Init | Role |
|------|-------------|------|------|
| `UniqueBox<Value>` | `~Copyable` | `UniqueBox(consuming value)` | Heap box that uniquely owns a `~Copyable` value |
| `UniqueArray<Element>` | `~Copyable` | `UniqueArray()` / `UniqueArray(capacity:)` | Growable heap array that uniquely owns `~Copyable` elements |
| `Ref<Value>` | `Copyable`, `~Escapable` | `Ref(borrowing value)` | Shareable read-only borrow of a single value |
| `MutableRef<Value>` | `~Copyable`, `~Escapable` | `MutableRef(&value)` | Exclusive in-place borrow of a single value |

```swift
@available(anyAppleOS 27, *)
func demo() {
    var counter = 0
    let handle = MutableRef(&counter)   // exclusive borrow, cannot escape
    _ = handle

    let box = UniqueBox(LargeValue())   // sole heap owner
    _ = consume box
}
```

`UniqueArray` is the growable collection form — a `~Copyable` heap array of `~Copyable` elements, the array analog of `UniqueBox`. Element access is via `borrow`/`mutate` subscript accessors (no implicit copy); assigning it to another binding **consumes** it, so pass `borrowing`/`consuming` explicitly (or `clone()` when `Element` is `Copyable`) when you need a second owner:

```swift
@available(anyAppleOS 27, *)
func buildIDs() {
    var ids = UniqueArray<Int>()      // or UniqueArray(capacity: 4)
    ids.append(1)
    ids.append(2)
    ids[0] = 10                       // mutate accessor, in place
    let last = ids.popLast()          // -> Element?
    _ = (ids.count, ids.isEmpty, last)
    consumeIDs(ids)                   // moves ownership; `ids` unusable after
}

@available(anyAppleOS 27, *)
func consumeIDs(_ x: consuming UniqueArray<Int>) { _ = x.count }
```

`Ref`/`MutableRef` are the single-value analog of `Span`/`MutableSpan`: non-escapable, so the borrow can't outlive its source. On the concurrency side, `withTaskCancellationShield` is usable now and the single-resume `Continuation` is present but limited through 27.1 — see `swift-concurrency-ref`.

Paren-free optional existentials and opaque types now compile under Swift 6.4 — `var overlay: any Drawable?` and `some P?` no longer have to be written `(any Drawable)?`.

### Borrowing iteration `OS27`

`for`-in over a `~Copyable` / `~Escapable` container without copying it. The protocol is `Iterable`, with `BorrowingIteratorProtocol` supplying `nextSpan(maxCount:)`. Usable with no experimental flag.

```swift
@available(anyAppleOS 27, *)
func sum(_ span: Span<Int>) -> Int {
    var total = 0
    for x in span { total += x }      // borrows; no copy of the container
    return total
}

@available(anyAppleOS 27, *)
func sum(_ a: borrowing UniqueArray<Int>) -> Int {
    var total = 0
    for x in a { total += x }
    return total
}
```

Conforming stdlib types: `Span`, `RawSpan`, `MutableSpan`, `MutableRawSpan`, `OutputSpan`, `OutputRawSpan`, `InlineArray`, `UniqueArray`.

`Array`, `Set`, and `Dictionary` do **not** conform — `Iterable` is for the ownership containers, not a retrofit of the copyable collections. Keep using `Sequence` for those.

A generic helper needs `Failure == Never` to iterate without `try`, because `Iterable` carries a typed `Failure`:

```swift
@available(anyAppleOS 27, *)
func total<S: Iterable>(_ s: borrowing S) -> Int
where S: ~Copyable & ~Escapable, S.Element == Int, S.Failure == Never {
    var t = 0
    for x in s { t += x }
    return t
}
```

Drop the `S.Failure == Never` constraint and the loop must be written `for try x in s` in a `throws` function.

### Announced for 6.4, absent from Xcode 27.0 and 27.1

Two stdlib features announced at WWDC 2026-262 are not in Xcode 27.0 or 27.1 (swiftlang-6.4.0.34.1; compile-verified on both):

| Feature | State in 27.0 / 27.1 |
|---------|---------------|
| `Dictionary.mapKeyedValues` | Absent |
| `FilePath` as a stdlib type | Still requires `import System` |

Don't write code that waits for them; on a newer toolchain, compile-check before using them.

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

**Swift Evolution**: SE-0377, SE-0447 (Span), SE-0453 (InlineArray), SE-0452 (value generics)

**WWDC**: 2024-10170, 2025-245, 2025-312, 2026-262

**Docs**: /swift/inlinearray, /swift/span

**Skills**: axiom-performance (skills/swift-performance.md), axiom-concurrency
