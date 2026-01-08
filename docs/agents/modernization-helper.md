# modernization-helper

Scans for legacy iOS patterns and provides migration paths to modern iOS 17/18+ APIs with code examples.

## How to Use This Agent

**Natural language (automatic triggering):**
- "How do I migrate from ObservableObject to @Observable?"
- "Are there any deprecated APIs in my SwiftUI code?"
- "Update my code to use modern SwiftUI patterns"
- "Should I still use @StateObject?"
- "Modernize my app for iOS 18"

**Explicit command:**
```bash
/axiom:audit modernization
# or
/axiom:modernize
```

## What It Checks

### High Priority (Significant Benefits)
- **ObservableObject to @Observable** — Better performance, simpler syntax
- **@StateObject to @State** — Works with @Observable models
- **@ObservedObject to plain property or @Bindable** — Simpler code
- **@EnvironmentObject to @Environment** — Type-safe, works with @Observable

### Medium Priority (Code Quality)
- **Deprecated onChange modifier** — Old `perform:` syntax to new two-parameter version
- **Completion handlers to async/await** — Cleaner code, better error handling

### Low Priority (Minor Improvements)
- **withAnimation closures** — Animation parameter style improvements

## Example Output

```markdown
# Modernization Analysis Results

## Summary
- **HIGH Priority**: 8 (Significant performance/maintainability gains)
- **MEDIUM Priority**: 3 (Deprecated APIs)
- **LOW Priority**: 2 (Minor improvements)

## Migration Order
1. **First**: Migrate models to `@Observable`
2. **Second**: Update view property wrappers
3. **Third**: Update `.environmentObject()` calls
4. **Fourth**: Adopt async/await (optional)

## Breaking Changes Warning
Full migration requires iOS 17+
```

## Model & Tools

- **Model**: haiku (fast pattern scanning)
- **Tools**: Glob, Grep, Read
- **Color**: cyan

## Related

- [swiftui-architecture](/skills/ui-design/swiftui-architecture) — Modern SwiftUI architecture patterns
- [swift-concurrency](/skills/concurrency/swift-concurrency) — async/await adoption patterns
