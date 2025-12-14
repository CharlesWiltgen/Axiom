# /axiom:audit-codable

Scan for Codable anti-patterns and JSON serialization issues that cause silent data loss and production bugs.

## Command

```bash
/axiom:audit-codable
```

## What It Checks

### High-Severity Anti-Patterns
- **Manual JSON string building** — Injection risk, escaping bugs, no type safety
- **try? swallowing DecodingError** — Silent failures, data loss, debugging nightmares
- **String interpolation in JSON** — Injection vulnerabilities, breaks on special characters

### Medium-Severity Issues
- **JSONSerialization instead of Codable** — Legacy pattern, 3x more boilerplate, harder to maintain
- **Date properties without explicit strategy** — Timezone bugs, intermittent failures
- **DateFormatter without locale/timezone** — Locale-dependent parsing failures
- **Optional properties to avoid decode errors** — Masks structural problems

### Low-Severity Issues
- **Missing error context in catch blocks** — No debugging information when decoding fails

## Example Output

```markdown
## Codable Audit Results

### Summary
- Files scanned: 47
- Total issues: 5
  - HIGH: 2
  - MEDIUM: 2
  - LOW: 1

### 🔴 High Priority (2 issues)
- **src/API/Response.swift:45** - Manual JSON building with string interpolation
  ```swift
  let json = "{\"key\": \"\(value)\"}"
  ```
  **Fix**: Use JSONEncoder with Codable type
  **Impact**: Injection vulnerabilities, escaping bugs

- **src/Network/Parser.swift:112** - `try?` swallowing DecodingError
  ```swift
  let user = try? decoder.decode(User.self, from: data)
  ```
  **Fix**: Handle DecodingError cases explicitly
  **Impact**: Silent data loss, impossible to debug

### 🟡 Medium Priority (2 issues)
- **src/Models/User.swift:23** - Date property without explicit strategy
  **Fix**: Set decoder.dateDecodingStrategy = .iso8601
  **Impact**: Prevents timezone bugs

- **src/Legacy/OldAPI.swift:67** - JSONSerialization usage (migrate to Codable)
  **Fix**: Use modern Codable
  **Time saved**: Reduce boilerplate by 60%

### 🟢 Low Priority (1 issue)
- **src/Utils/Parser.swift:89** - Missing error context in catch block

### Recommendations
1. **Immediate**: Fix all HIGH severity issues (silent failures, injection risks)
2. **This sprint**: Address MEDIUM severity (technical debt, potential bugs)
3. **Backlog**: Clean up LOW severity (code quality improvements)
```

## Usage Tips

**Scan specific files:**
```bash
/axiom:audit-codable src/Network/
/axiom:audit-codable APIClient.swift
```

**Before major releases:**
```bash
/axiom:audit-codable
```
Review all HIGH priority issues before shipping.

**During code review:**
```bash
/axiom:audit-codable NewFeature/
```
Catch Codable anti-patterns early.

## Related Skills

- **codable** — Comprehensive Codable patterns and anti-patterns guide
- **swift-concurrency** — Codable + Sendable patterns for async code
- **networking** — Network.framework Coder protocol
- **swiftdata** — @Model Codable conformance for CloudKit

## Related Agents

- **codable-auditor** — Autonomous agent that runs this audit (can be triggered with natural language: "check my Codable code")

## Why This Command Matters

**Silent data loss** is one of the hardest categories of bugs to debug in production:
- No crash logs (just missing data)
- Intermittent (only certain API responses trigger it)
- Hard to reproduce (timezone or locale-specific)
- Costly (lost customer data, support burden)

This command catches these issues **before** they reach production.
