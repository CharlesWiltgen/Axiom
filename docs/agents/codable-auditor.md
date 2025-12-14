# codable-auditor

Automatically scans for Codable anti-patterns and JSON serialization issues that cause silent data loss and production bugs.

## How to Use This Agent

**Natural language:**
- "Check my Codable code for issues"
- "Review my JSON encoding/decoding for best practices"
- "Audit my code for proper Codable usage"
- "Check for JSONSerialization that should use Codable"
- "Scan for try? decoder issues before release"

**Explicit command:**
```bash
/axiom:audit-codable
```

## What It Checks

### High-Severity Anti-Patterns
1. **Manual JSON String Building** (HIGH) — String interpolation in JSON, injection vulnerabilities, escaping bugs
2. **try? Swallowing DecodingError** (HIGH) — Silent failures with `try? JSONDecoder().decode()`, data loss
3. **String Interpolation in JSON** (HIGH) — Injection risks, breaks on special characters

### Medium-Severity Issues
4. **JSONSerialization Instead of Codable** (MEDIUM) — Legacy pattern, 3x more boilerplate, no type safety
5. **Date Without Explicit Strategy** (MEDIUM) — Timezone bugs, intermittent failures across regions
6. **DateFormatter Without Locale/Timezone** (MEDIUM) — Locale-dependent parsing failures
7. **Optional Properties to Avoid Decode Errors** (MEDIUM) — Masks structural problems, runtime crashes

### Low-Severity Issues
8. **No Error Context in Catch Blocks** (LOW) — Missing debugging information

## Example Output

```markdown
## Codable Audit Results

### 🔴 High Priority (2 issues)
- **src/API/Response.swift:45** - Manual JSON building with string interpolation
  Fix: Use JSONEncoder with Codable type

- **src/Network/Parser.swift:112** - `try?` swallowing DecodingError
  Fix: Handle DecodingError cases explicitly

### 🟡 Medium Priority (3 issues)
- **src/Models/User.swift:23** - Date property without explicit strategy
  Fix: Set decoder.dateDecodingStrategy = .iso8601

- **src/Legacy/OldAPI.swift:67** - JSONSerialization usage
  Fix: Migrate to Codable
```

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: blue
- **Scan Time**: <2 seconds

## Related Skills

- **codable** — Comprehensive Codable patterns and anti-patterns
- **swift-concurrency** — Codable + Sendable for crossing actor boundaries
- **networking** — Network.framework Coder protocol
- **swiftdata** — @Model types use Codable for CloudKit sync

## Why This Matters

This agent prevents production disasters:

- **Injection vulnerabilities** — Manual JSON building exposes attack vectors
- **Silent failures** — Swallowed errors lose customer data without logs
- **Timezone bugs** — Issues appear only in certain locales
- **Legacy debt** — JSONSerialization should use modern Codable

Catch these during development. Production fixes upset customers and cost more.
