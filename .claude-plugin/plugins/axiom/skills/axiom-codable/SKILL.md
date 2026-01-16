---
name: axiom-codable
description: Use when working with Codable protocol, JSON encoding/decoding, CodingKeys customization, enum serialization, date strategies, custom containers, or encountering "Type does not conform to Decodable/Encodable" errors - comprehensive Codable patterns and anti-patterns for Swift 6.x
user-invocable: true
skill_type: discipline
version: 1.0
---

# Swift Codable Patterns

Comprehensive guide to Codable protocol conformance for JSON and PropertyList encoding/decoding in Swift 6.x.

## Quick Reference

### Decision Tree: When to Use Each Approach

```
Has your type...
├─ All properties Codable? → Automatic synthesis (just add `: Codable`)
├─ Property names differ from JSON keys? → CodingKeys customization
├─ Needs to exclude properties? → CodingKeys customization
├─ Enum with associated values? → Check enum synthesis patterns
├─ Needs structural transformation? → Manual implementation + bridge types
├─ Needs data not in JSON? → DecodableWithConfiguration (iOS 15+)
└─ Complex nested JSON? → Manual implementation + nested containers
```

### Common Triggers

| Error | Solution |
|-------|----------|
| "Type 'X' does not conform to protocol 'Decodable'" | Ensure all stored properties are Codable |
| "No value associated with key X" | Check CodingKeys match JSON keys |
| "Expected to decode X but found Y instead" | Type mismatch; check JSON structure or use bridge type |
| "keyNotFound" | JSON missing expected key; make property optional or provide default |
| "Date parsing failed" | Configure dateDecodingStrategy on decoder |

---

## Part 1: Automatic Synthesis

Swift automatically synthesizes Codable conformance when all stored properties are Codable.

### Struct Synthesis

```swift
// ✅ Automatic synthesis
struct User: Codable {
    let id: UUID              // Codable
    var name: String          // Codable
    var membershipPoints: Int // Codable
}

// JSON: {"id":"...", "name":"Alice", "membershipPoints":100}
```

**Requirements**:
- All stored properties must conform to Codable
- Properties use standard Swift types or other Codable types
- No custom initialization logic needed

### Enum Synthesis Patterns

#### Pattern 1: Raw Value Enums

```swift
enum Direction: String, Codable {
    case north, south, east, west
}

// Encodes as: "north"
```

The raw value itself becomes the JSON representation.

#### Pattern 2: Enums Without Associated Values

```swift
enum Status: Codable {
    case success
    case failure
    case pending
}

// Encodes as: {"success":{}}
```

Each case becomes an object with the case name as the key and empty dictionary as value.

#### Pattern 3: Enums With Associated Values

```swift
enum APIResult: Codable {
    case success(data: String, count: Int)
    case error(code: Int, message: String)
}

// success case encodes as:
// {"success":{"data":"example","count":5}}
```

**Gotcha**: Unlabeled associated values generate `_0`, `_1` keys:

```swift
enum Command: Codable {
    case store(String, Int)  // ❌ Unlabeled
}

// Encodes as: {"store":{"_0":"value","_1":42}}
```

**Fix**: Always label associated values for predictable JSON:

```swift
enum Command: Codable {
    case store(key: String, value: Int)  // ✅ Labeled
}

// Encodes as: {"store":{"key":"value","value":42}}
```

### When Synthesis Breaks

Automatic synthesis fails when:
1. **Computed properties** - Only stored properties are encoded
2. **Non-Codable properties** - Custom types without Codable conformance
3. **Property wrappers** - `@Published`, `@State` (except `@AppStorage` with Codable types)
4. **Class inheritance** - Subclasses must implement `init(from:)` manually

---

## Part 2: CodingKeys Customization

Use `CodingKeys` enum to customize encoding/decoding without full manual implementation.

### Renaming Keys

```swift
struct Article: Codable {
    let url: URL
    let title: String
    let body: String

    enum CodingKeys: String, CodingKey {
        case url = "source_link"      // JSON uses "source_link"
        case title = "content_name"   // JSON uses "content_name"
        case body                     // Matches JSON key
    }
}

// JSON: {"source_link":"...", "content_name":"...", "body":"..."}
```

### Excluding Properties

Omit properties from `CodingKeys` to exclude them from encoding/decoding:

```swift
struct NoteCollection: Codable {
    let name: String
    let notes: [Note]
    var localDrafts: [Note] = []  // ✅ Must have default value

    enum CodingKeys: CodingKey {
        case name
        case notes
        // localDrafts omitted - not encoded/decoded
    }
}
```

**Rule**: Excluded properties require default values or you must implement `init(from:)` manually.

### Snake Case Conversion

For consistent snake_case → camelCase conversion:

```swift
let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase

// JSON: {"first_name":"Alice", "last_name":"Smith"}
// Decodes to: User(firstName: "Alice", lastName: "Smith")
```

### Enum Associated Value Keys

Customize keys for enum associated values using `{CaseName}CodingKeys`:

```swift
enum Command: Codable {
    case store(key: String, value: Int)
    case delete(key: String)

    enum StoreCodingKeys: String, CodingKey {
        case key = "identifier"  // Renames "key" to "identifier"
        case value = "data"      // Renames "value" to "data"
    }

    enum DeleteCodingKeys: String, CodingKey {
        case key = "identifier"
    }
}

// store case encodes as: {"store":{"identifier":"x","data":42}}
```

**Pattern**: `{CaseName}CodingKeys` with capitalized case name.

---

## Part 3: Manual Implementation

For structural differences between JSON and Swift models, implement `init(from:)` and `encode(to:)`.

### Container Types

| Container | When to Use |
|-----------|-------------|
| **Keyed** | Dictionary-like data with string keys |
| **Unkeyed** | Array-like sequential data |
| **Single-value** | Wrapper types that encode as a single value |
| **Nested** | Hierarchical JSON structures |

### Nested Containers Example

Flatten hierarchical JSON:

```swift
// JSON:
// {
//   "latitude": 37.7749,
//   "longitude": -122.4194,
//   "additionalInfo": {
//     "elevation": 52
//   }
// }

struct Coordinate {
    var latitude: Double
    var longitude: Double
    var elevation: Double  // Nested in JSON, flat in Swift

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, additionalInfo
    }

    enum AdditionalInfoKeys: String, CodingKey {
        case elevation
    }
}

extension Coordinate: Decodable {
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        latitude = try values.decode(Double.self, forKey: .latitude)
        longitude = try values.decode(Double.self, forKey: .longitude)

        let additionalInfo = try values.nestedContainer(
            keyedBy: AdditionalInfoKeys.self,
            forKey: .additionalInfo
        )
        elevation = try additionalInfo.decode(Double.self, forKey: .elevation)
    }
}

extension Coordinate: Encodable {
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)

        var additionalInfo = container.nestedContainer(
            keyedBy: AdditionalInfoKeys.self,
            forKey: .additionalInfo
        )
        try additionalInfo.encode(elevation, forKey: .elevation)
    }
}
```

### Bridge Types for Structural Mismatches

When JSON structure fundamentally differs from Swift model:

```swift
// JSON: {"USD": 1.0, "EUR": 0.85, "GBP": 0.73}
// Want: [ExchangeRate]

struct ExchangeRate {
    let currency: String
    let rate: Double
}

// Bridge type for decoding
private extension ExchangeRate {
    struct List: Decodable {
        let values: [ExchangeRate]

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            let dictionary = try container.decode([String: Double].self)
            values = dictionary.map { ExchangeRate(currency: $0, rate: $1) }
        }
    }
}

// Public interface
extension ExchangeRate {
    static func decode(from data: Data) throws -> [ExchangeRate] {
        let list = try JSONDecoder().decode(List.self, from: data)
        return list.values
    }
}
```

---

## Part 4: Date Handling

### Built-in Strategies

```swift
let decoder = JSONDecoder()

// 1. ISO 8601 (recommended)
decoder.dateDecodingStrategy = .iso8601
// Expects: "2024-02-15T17:00:00+01:00"

// 2. Unix timestamp (seconds)
decoder.dateDecodingStrategy = .secondsSince1970
// Expects: 1708012800

// 3. Unix timestamp (milliseconds)
decoder.dateDecodingStrategy = .millisecondsSince1970
// Expects: 1708012800000

// 4. Custom formatter
let formatter = DateFormatter()
formatter.dateFormat = "yyyy-MM-dd"
formatter.locale = Locale(identifier: "en_US_POSIX")  // ✅ Always set
formatter.timeZone = TimeZone(secondsFromGMT: 0)      // ✅ Always set
decoder.dateDecodingStrategy = .formatted(formatter)

// 5. Custom closure
decoder.dateDecodingStrategy = .custom { decoder in
    let container = try decoder.singleValueContainer()
    let dateString = try container.decode(String.self)

    if let date = ISO8601DateFormatter().date(from: dateString) {
        return date
    }

    throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Cannot decode date string \(dateString)"
    )
}
```

### ISO 8601 Nuances

**Default**: `2024-02-15T17:00:00+01:00`
**Timezone required**: Without timezone offset, decoding may fail across regions

```swift
// ❌ No timezone - parsing depends on device locale
"2024-02-15T17:00:00"

// ✅ With timezone - unambiguous
"2024-02-15T17:00:00+01:00"
```

### Performance Consideration

**Custom closures run for every date** - optimize expensive operations:

```swift
// ❌ Creates new formatter for every date
decoder.dateDecodingStrategy = .custom { decoder in
    let formatter = DateFormatter()  // Expensive!
    // ...
}

// ✅ Reuse formatter
let sharedFormatter = DateFormatter()
sharedFormatter.dateFormat = "yyyy-MM-dd"

decoder.dateDecodingStrategy = .custom { decoder in
    // Use sharedFormatter
}
```

---

## Part 5: Type Transformation

### StringBacked Wrapper

Handle APIs that encode numbers as strings:

```swift
protocol StringRepresentable: CustomStringConvertible {
    init?(_ string: String)
}

extension Int: StringRepresentable {}
extension Double: StringRepresentable {}

struct StringBacked<Value: StringRepresentable>: Codable {
    var value: Value

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)

        guard let value = Value(string) else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot convert '\(string)' to \(Value.self)"
            )
        }

        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value.description)
    }
}

// Usage
struct Product: Codable {
    let name: String
    private let _price: StringBacked<Double>

    var price: Double {
        get { _price.value }
        set { _price = StringBacked(value: newValue) }
    }

    enum CodingKeys: String, CodingKey {
        case name
        case _price = "price"
    }
}

// JSON: {"name":"Widget","price":"19.99"}
// Decodes to: Product(name: "Widget", price: 19.99)
```

### Type Coercion

For loosely typed APIs that may return different types:

```swift
struct FlexibleValue: Codable {
    let stringValue: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let string = try? container.decode(String.self) {
            stringValue = string
        } else if let int = try? container.decode(Int.self) {
            stringValue = String(int)
        } else if let double = try? container.decode(Double.self) {
            stringValue = String(double)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode value to String, Int, or Double"
            )
        }
    }
}
```

**Warning**: Avoid this pattern unless the API is truly unpredictable. Prefer strict types.

---

## Part 6: Advanced Patterns

### DecodableWithConfiguration (iOS 15+)

For types that need data unavailable in JSON:

```swift
struct User: Encodable, DecodableWithConfiguration {
    let id: UUID
    var name: String
    var favorites: Favorites  // Not in JSON, injected via configuration

    enum CodingKeys: CodingKey {
        case id, name
    }

    init(from decoder: Decoder, configuration: Favorites) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        favorites = configuration  // Injected
    }
}

// Usage (iOS 17+)
let favorites = try await fetchFavorites()
let user = try JSONDecoder().decode(
    User.self,
    from: data,
    configuration: favorites
)
```

### userInfo Workaround (iOS 15-16)

```swift
extension JSONDecoder {
    private struct ConfigurationDecodingWrapper<T: DecodableWithConfiguration>: Decodable {
        var wrapped: T

        init(from decoder: Decoder) throws {
            let config = decoder.userInfo[configurationUserInfoKey] as! T.DecodingConfiguration
            wrapped = try T(from: decoder, configuration: config)
        }
    }

    func decode<T: DecodableWithConfiguration>(
        _ type: T.Type,
        from data: Data,
        configuration: T.DecodingConfiguration
    ) throws -> T {
        let decoder = JSONDecoder()
        decoder.userInfo[Self.configurationUserInfoKey] = configuration
        let wrapper = try decoder.decode(ConfigurationDecodingWrapper<T>.self, from: data)
        return wrapper.wrapped
    }
}

private let configurationUserInfoKey = CodingUserInfoKey(rawValue: "configuration")!
```

### Partial Decoding

Decode only the fields you need:

```swift
struct ArticlePreview: Decodable {
    let id: UUID
    let title: String
    // Omit body, comments, etc.
}

// JSON has many more fields, but we only decode id and title
```

---

## Part 7: Debugging

### DecodingError Cases

```swift
do {
    let user = try decoder.decode(User.self, from: data)
} catch DecodingError.keyNotFound(let key, let context) {
    print("Missing key '\(key)' at path: \(context.codingPath)")
} catch DecodingError.typeMismatch(let type, let context) {
    print("Type mismatch for \(type) at path: \(context.codingPath)")
} catch DecodingError.valueNotFound(let type, let context) {
    print("Value not found for \(type) at path: \(context.codingPath)")
} catch DecodingError.dataCorrupted(let context) {
    print("Data corrupted at path: \(context.codingPath)")
} catch {
    print("Other error: \(error)")
}
```

### Debugging Techniques

**1. Pretty-print JSON**

```swift
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let jsonData = try encoder.encode(user)
print(String(data: jsonData, encoding: .utf8)!)
```

**2. Inspect coding path**

```swift
// In custom init(from:)
print("Decoding at path: \(decoder.codingPath)")
```

**3. Validate JSON structure**

```swift
// Quick check: Can it decode as Any?
let json = try JSONSerialization.jsonObject(with: data)
print(json)  // See actual structure
```

---

## Anti-Patterns

| Anti-Pattern | Cost | Better Approach |
|--------------|------|-----------------|
| **Manual JSON string building** | Injection vulnerabilities, escaping bugs, no type safety | Use `JSONEncoder` |
| **`try?` swallowing DecodingError** | Silent failures, debugging nightmares, data loss | Handle specific error cases |
| **Optional properties to avoid decode errors** | Runtime crashes, nil checks everywhere, masks structural issues | Fix JSON/model mismatch or use `DecodableWithConfiguration` |
| **Duplicating partial models** | 2-5 hours maintenance per change, sync issues, fragile | Use bridge types or configuration |
| **Ignoring date timezone** | Intermittent bugs across regions, data corruption | Always use ISO8601 with timezone or explicit UTC |
| **`JSONSerialization` for Codable types** | 3x more boilerplate, manual type casting, error-prone | Use `JSONDecoder`/`JSONEncoder` |
| **No locale on DateFormatter** | Parsing fails in non-US locales | Set `locale = Locale(identifier: "en_US_POSIX")` |

### Why try? is Dangerous

```swift
// ❌ Silent failure - production bug waiting to happen
let user = try? JSONDecoder().decode(User.self, from: data)
// If this fails, user is nil - why? No idea.

// ✅ Explicit error handling
do {
    let user = try JSONDecoder().decode(User.self, from: data)
} catch {
    logger.error("Failed to decode user: \(error)")
    // Now you know WHY it failed
}
```

---

## Pressure Scenarios

### Scenario 1: "Just Use try? to Make It Compile"

**Context**: API integration deadline tomorrow, decoder failing on some edge case.

**Pressure**: "We can debug it later, just make it work now."

**Why You'll Rationalize**:
- "It's only failing on 1% of requests"
- "We can add logging later"
- "Customers won't notice"

**What Actually Happens**:
- Silent data loss for that 1%
- No logs, so you can't debug in production
- Customer complaints 3 months later
- You've forgotten the context by then

**Discipline Response**:

> "Using `try?` here means we'll lose data silently. Let me spend 5 minutes handling the specific error case. If it's truly rare, I'll log it so we can fix the root cause."

**5-Minute Fix**:

```swift
do {
    return try decoder.decode(User.self, from: data)
} catch DecodingError.keyNotFound(let key, let context) {
    logger.error("Missing key '\(key)' in API response", metadata: [
        "path": .string(context.codingPath.description),
        "rawJSON": .string(String(data: data, encoding: .utf8) ?? "")
    ])
    throw APIError.invalidResponse(reason: "Missing key: \(key)")
} catch {
    logger.error("Failed to decode User", error: error)
    throw APIError.decodingFailed(error)
}
```

**Result**: You discover the API sometimes omits the `email` field for deleted users. Fix: make `email` optional only for that case, not all users.

---

### Scenario 2: "Dates Are Intermittent, Must Be Server Bug"

**Context**: Date parsing works in your timezone but fails for European QA team.

**Pressure**: "It works for me, QA must be doing something wrong."

**Why You'll Rationalize**:
- "My tests pass locally"
- "The server is probably sending bad data"
- "It's their device settings"

**What Actually Happens**:
- Server sends dates without timezone: `"2024-12-14T10:00:00"`
- Your device (PST) interprets as 10:00 PST
- QA device (CET) interprets as 10:00 CET
- Different absolute times, intermittent bugs

**Discipline Response**:

> "Intermittent date failures are almost always timezone issues. Let me check if we're using ISO8601 with timezone offsets."

**Check**:

```swift
// ❌ Current (fails across timezones)
decoder.dateDecodingStrategy = .iso8601

// Server sends: "2024-12-14T10:00:00" (no timezone)
// PST device: Dec 14, 10:00 PST
// CET device: Dec 14, 10:00 CET
// Bug: Different times!

// ✅ Fix: Require server to send timezone
// "2024-12-14T10:00:00+00:00"
// OR: Explicitly parse as UTC
decoder.dateDecodingStrategy = .custom { decoder in
    let container = try decoder.singleValueContainer()
    let dateString = try container.decode(String.self)

    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(secondsFromGMT: 0)  // Force UTC

    guard let date = formatter.date(from: dateString) else {
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid ISO8601 date: \(dateString)"
        )
    }

    return date
}
```

**Result**: Bug fixed, server adds timezone to API (or you parse explicitly as UTC). No more intermittent failures.

---

### Scenario 3: "Just Make It Optional"

**Context**: New API field causes decoding to fail. Product manager wants a fix in 1 hour.

**Pressure**: "Can't you just make that field optional? We need this shipped."

**Why You'll Rationalize**:
- "It's faster than fixing the API"
- "We can make it non-optional later"
- "Users won't notice"

**What Actually Happens**:
- Field is actually required for the feature
- You add `user.email ?? ""` everywhere
- 3 months later: production crash because `email` was nil
- Now you can't remember why it was optional

**Discipline Response**:

> "Making it optional masks the real problem. Let me check if the API is wrong or our model is wrong. This will take 10 minutes."

**Investigation**:

```swift
// Step 1: Print raw JSON
do {
    let json = try JSONSerialization.jsonObject(with: data)
    print(json)
} catch {
    print("Invalid JSON: \(error)")
}

// Step 2: Check if key exists but value is null
// {"email": null} vs key missing entirely

// Step 3: Check API docs - is email actually required?
```

**Common Outcomes**:
1. **API is wrong**: Field should be there → File bug, get hotfix
2. **Model is wrong**: Field is optional in some flows → Use proper optionality with clear documentation
3. **Structural mismatch**: Field is nested → Use nested container

**Result**: You discover `email` is nested in `user.contact.email` in the new API version. Fix with nested container, not optionality.

```swift
// ✅ Correct fix
struct User: Decodable {
    let id: UUID
    let email: String  // Still required

    enum CodingKeys: CodingKey {
        case id, contact
    }

    enum ContactKeys: CodingKey {
        case email
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)

        let contact = try container.nestedContainer(
            keyedBy: ContactKeys.self,
            forKey: .contact
        )
        email = try contact.decode(String.self, forKey: .email)
    }
}
```

---

## Related Skills

- **swift-concurrency** — Codable types crossing actor boundaries must be `Sendable`
- **swiftdata** — `@Model` types use Codable for CloudKit sync
- **networking** — `Coder` protocol wraps Codable for Network.framework
- **app-intents-ref** — `AppEnum` parameters use Codable serialization

---

## Key Takeaways

1. **Prefer automatic synthesis** — Add `: Codable` when structure matches JSON
2. **Use CodingKeys for simple mismatches** — Rename or exclude without manual code
3. **Manual implementation for structural differences** — Nested containers, bridge types
4. **Always set locale and timezone** — `DateFormatter` requires `en_US_POSIX` and explicit timezone
5. **Never swallow errors with try?** — Handle `DecodingError` cases explicitly
6. **Codable + Sendable** — Value types (structs/enums) are ideal for async networking

**Core Principle**: Codable is Swift's universal serialization protocol. Master it once, use it everywhere.
