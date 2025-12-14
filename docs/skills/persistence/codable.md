# codable

Comprehensive Codable patterns for JSON and PropertyList encoding/decoding in Swift 6.x. Prevent silent data loss, handle errors properly, and master Swift's universal serialization protocol.

## When to Use This Skill

Use this skill when:
- Working with JSON APIs and decoding responses
- Implementing Codable conformance for custom types
- Encountering "Type does not conform to Decodable" errors
- JSON decoding fails with keyNotFound or typeMismatch
- Date parsing behaves differently across timezones
- Customizing CodingKeys or implementing manual encode/decode
- Debugging DecodingError issues

## Quick Decision Tree

```
Has your type...
├─ All properties Codable? → Automatic synthesis (add : Codable)
├─ Property names differ from JSON? → CodingKeys customization
├─ Needs to exclude properties? → CodingKeys customization
├─ Enum with associated values? → Check enum synthesis patterns
├─ Needs structural transformation? → Manual implementation + bridge types
├─ Needs data not in JSON? → DecodableWithConfiguration (iOS 15+)
└─ Complex nested JSON? → Manual implementation + nested containers
```

## What This Skill Covers

### Part 1: Automatic Synthesis
- When Swift synthesizes Codable for free
- Struct and enum synthesis patterns
- Three enum encoding patterns (raw value, no values, associated values)
- When synthesis breaks

### Part 2: CodingKeys Customization
- Renaming keys to match JSON
- Excluding properties from encoding/decoding
- Snake case conversion
- Enum associated value keys (`{CaseName}CodingKeys`)

### Part 3: Manual Implementation
- Container types (keyed, unkeyed, single-value, nested)
- Flattening hierarchical JSON
- Bridge types for structural mismatches

### Part 4: Date Handling
- Built-in strategies (iso8601, secondsSince1970, milliseconds)
- ISO 8601 timezone nuances
- Custom DateFormatter patterns
- Performance considerations

### Part 5: Type Transformation
- StringBacked wrapper for string-encoded numbers
- Type coercion for loosely-typed APIs

### Part 6: Advanced Patterns
- DecodableWithConfiguration (iOS 15+)
- userInfo workaround for iOS 15-16
- Partial decoding

### Part 7: Debugging
- DecodingError cases (keyNotFound, typeMismatch, etc.)
- Pretty-printing JSON
- Validating JSON structure

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad |
|--------------|--------------|
| Manual JSON string building | Injection vulnerabilities, no type safety |
| `try?` swallowing DecodingError | Silent failures, impossible to debug |
| Optional properties to avoid errors | Masks structural problems, runtime crashes |
| Duplicating partial models | Maintenance burden, sync issues |
| Ignoring date timezone | Intermittent bugs across regions |
| JSONSerialization for Codable types | 3x more boilerplate, error-prone |
| No locale on DateFormatter | Parsing fails in non-US locales |

## Pressure Scenarios

The skill includes 3 real-world pressure scenarios with professional push-back templates:

### Scenario 1: "Just Use try? to Make It Compile"
- Deadline pressure to ship broken error handling
- Why you'll rationalize ("it's only 1% of requests")
- What actually happens (silent data loss, customer complaints)
- 5-minute proper fix

### Scenario 2: "Dates Are Intermittent, Must Be Server Bug"
- Works in your timezone, fails for European QA
- Why you'll blame the server
- What actually happens (missing timezone in date strings)
- Proper timezone handling

### Scenario 3: "Just Make It Optional"
- Product pressure to ship fast
- Why making fields optional seems easier
- What actually happens (crashes 3 months later)
- 10-minute investigation to find root cause

## Code Examples

All examples are:
- ✅ Complete and compilable
- ✅ Tested against Swift 6.x
- ✅ Copy-paste ready
- ✅ Include both ❌ DON'T and ✅ DO patterns

## Related Skills

- **swift-concurrency** — Codable types crossing actor boundaries need Sendable
- **swiftdata** — @Model types use Codable for CloudKit sync
- **networking** — Coder protocol wraps Codable for Network.framework
- **app-intents-ref** — AppEnum parameters use Codable serialization

## Related Agents

- **codable-auditor** — Scans for Codable anti-patterns and legacy code

## Key Takeaways

1. **Prefer automatic synthesis** — Add `: Codable` when structure matches JSON
2. **Use CodingKeys for simple mismatches** — Rename or exclude without manual code
3. **Manual implementation for structural differences** — Nested containers, bridge types
4. **Always set locale and timezone** — DateFormatter requires `en_US_POSIX` and explicit timezone
5. **Never swallow errors with try?** — Handle DecodingError cases explicitly
6. **Codable + Sendable** — Value types (structs/enums) are ideal for async networking

**Core Principle**: Codable is Swift's universal serialization protocol. Master it once, use it everywhere (SwiftData, App Intents, URLSession, UserDefaults, CloudKit, WidgetKit).
