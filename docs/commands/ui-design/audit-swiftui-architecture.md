# /axiom:audit-swiftui-architecture

Scan SwiftUI code for architectural anti-patterns (launches `swiftui-architecture-auditor` agent).

## Command

```bash
/axiom:audit-swiftui-architecture
```

## What It Checks

### Correctness
- **Async Boundaries**: Detects `withAnimation` patterns that cross `await` boundaries
- **Source of Truth**: Detects `@State var item: Item` patterns that copy passed-in models

### Testability & Separation
- **Logic in Views**: Non-trivial work inside `body` (formatters, filtering, sorting)
- **Coupling**: Models/services importing `SwiftUI`
- **Cohesion**: Suspiciously large ViewModels ("God ViewModel" heuristic)

## When to Use
- You want views that are UI-only and fully testable logic in models
- You are refactoring a large SwiftUI view
- You suspect state bugs from incorrect property wrappers

## Related
- [/axiom:audit-swiftui-performance](./audit-swiftui-performance.md) - Performance anti-patterns
- [/axiom:audit-swiftui-nav](./audit-swiftui-nav.md) - Navigation correctness and architecture
- [swiftui-architecture](../../skills/ui-design/swiftui-architecture.md) - Refactoring workflows and decision trees
