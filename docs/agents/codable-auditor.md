# codable-auditor

Scans Swift code for Codable safety violations, architectural gaps, and semantic risks that cause silent data loss, revenue leaks, and production crashes.

## How to Use

**Natural language (automatic triggering):**
- "Check my Codable code for issues"
- "Review my JSON encoding/decoding for best practices"
- "Audit my code for proper Codable usage"
- "Check for JSONSerialization that should use Codable"
- "Scan for try? decoder issues before release"

**Explicit command:**
```bash
/axiom:audit codable
```

## What It Does

### Detection — Known Anti-Patterns (Phase 2)
1. **Manual JSON String Building** (HIGH) — String interpolation in JSON, injection vulnerabilities, escaping bugs
2. **try? Swallowing DecodingError** (HIGH) — Silent decode failures, data loss without logs
3. **Dict-as-Payload + JSONSerialization** (MEDIUM) — Untyped `[String: Any]` request bodies
4. **JSONSerialization + Cast Chain on Reads** (MEDIUM) — Legacy pattern, no type safety
5. **Date Without Decoder Strategy** (MEDIUM) — Timezone bugs, intermittent failures across regions
6. **DateFormatter Without Locale/TimeZone** (MEDIUM) — Locale-dependent parsing failures
7. **Optional-to-Avoid-Decode-Errors** (MEDIUM) — Masks structural problems, crashes later
8. **Empty or Context-less Catch Blocks** (LOW) — Missing debugging information

### Completeness Reasoning (Phase 3)
9. **Missing CodingKeys for snake_case** — The most common Codable bug; camelCase struct + snake_case API with no mapping
10. **@propertyWrapper silent fallback** — Custom wrappers whose `init(from:)` uses `try?` hide silent decoding failures on fields like payment or auth
11. **Closed enum decoded from server** — String enums without unknown-case handling crash when the server adds values
12. **Cross-file encoder/decoder drift** — Same data format encoded in one file with one strategy, decoded in another with a different one
13. **Silent field drop** — Server-supplied fields that the struct simply doesn't declare (e.g. paywall signals)
14. **Missing Sendable on Codable crossing actors** — Swift 6 isolation violations
15. **Repeated decoder instantiation** — Per-call creation scatters strategy configuration

### Compound Findings (Phase 4)
Severity bumps when multiple findings interact — e.g. `try?` on decode of a payment field, wrapper-hidden fallback on subscription state, encoder/decoder drift on persistence round-trips.

### Health Score (Phase 5)
Reports overall serialization hygiene as **SAFE**, **HARDENING NEEDED**, or **UNSAFE** with specific metrics (Codable coverage, strategy consistency, silent-failure risk, CodingKeys coverage, enum future-proofing, cross-file alignment).

## Related

- **codable** skill — Comprehensive Codable patterns and anti-patterns; use to fix issues this auditor finds
- **axiom-concurrency** skill — Codable + Sendable for crossing actor boundaries
- **concurrency-auditor** agent — Investigates Sendable gaps this auditor identifies
- **swiftdata-auditor** agent — Investigates @Model Codable relationships this auditor flags
- **ux-flow-auditor** agent — Investigates missing error UI for decode failures this auditor finds

## Why This Matters

Silent decoding bugs are the hardest production issues to catch. This agent hunts for:

- **Injection vulnerabilities** — Manual JSON building with user input breaks on any quote character
- **Silent failures** — `try?` and property wrapper fallbacks lose customer data without a single log line
- **Revenue leaks** — Structs that silently drop paywall or subscription fields
- **Future-case crashes** — Closed String enums decoded from server-controlled values
- **Round-trip corruption** — Encoder and decoder using different strategies on the same data format

A pattern-matching scan catches the obvious cases. The semantic reasoning phases catch the expensive ones you won't notice until a customer emails support.
