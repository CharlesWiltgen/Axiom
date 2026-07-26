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

## What It Does

### High Priority (Significant Benefits)
- **ObservableObject to @Observable** – Better performance, simpler syntax
- **@StateObject to @State** – Works with @Observable models
- **@ObservedObject to plain property or @Bindable** – Simpler code
- **@EnvironmentObject to @Environment** – Type-safe, works with @Observable

### Medium Priority (Code Quality)
- **Deprecated onChange modifier** – Old `perform:` syntax to new two-parameter version
- **Completion handlers to async/await** – Cleaner code, better error handling

### Low Priority (Minor Improvements)
- **withAnimation closures** – Animation parameter style improvements

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

## What It Won't Migrate

Some `ObservableObject` conformances are deliberately left alone:

- **Framework-owned classes** – you can't redeclare a type you don't own, whatever your deployment target.
- **`GroupSession` (SharePlay)** – beyond being framework-owned, code observing it must stay on Combine. There is no AsyncSequence for `state`, `activity`, or `activeParticipants`, and the standard late-joiner catch-up depends on `@Published` publishing from `willSet` — inside the sink the property still holds the previous value, which is what makes the participant delta work. Migrating it returns an empty delta with no crash and no warning, so late joiners silently never receive state.

When the agent skips something for these reasons, it says so rather than staying quiet.

## Related

- [swiftui-architecture](/skills/ui-design/swiftui-architecture) – Modern SwiftUI architecture patterns
- [swift-concurrency](/skills/concurrency/swift-concurrency) – async/await adoption patterns
