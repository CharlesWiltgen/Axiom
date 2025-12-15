---
name: audit-swiftui-architecture
description: Scan SwiftUI code for architectural issues (logic in view, wrapper misuse, testability) - launches swiftui-architecture-auditor
---

# SwiftUI Architecture Audit

Launches the **swiftui-architecture-auditor** agent to scan for architectural anti-patterns, separation of concerns violations, and testability gaps.

## What It Checks

### Correctness
- **Async Boundaries**: `withAnimation` misuse, `Task` side-effect violations
- **Property Wrappers**: `@State` copying passed-in models (source of truth bugs)

### Testability & Clean Code
- **Logic in View**: Formatters, filtering, sorting, or business logic inside `body`
- **Coupling**: Models importing SwiftUI (making them hard to unit test)
- **Cohesion**: "God ViewModels" that do too much (SRP violations)

## When to Use
- You want to separate business logic from UI
- You are refactoring a messy SwiftUI view
- You suspect state synchronization bugs (`@State` vs `let`)
- You want to make your SwiftUI codebase testable

## Related
- [/axiom:audit-swiftui-performance](./audit-swiftui-performance.md) - For performance-specific issues
- [/axiom:audit-swiftui-nav](./audit-swiftui-nav.md) - For navigation architecture
- [swiftui-architecture](../ui-design/swiftui-architecture.md) - Comprehensive architecture guide
