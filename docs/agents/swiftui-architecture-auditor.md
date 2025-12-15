# swiftui-architecture-auditor

Audits SwiftUI code for architectural issues: separation of concerns, testability boundaries, async boundary correctness, and common property-wrapper mistakes.

## Use When
- You want to remove business logic from SwiftUI views
- You are refactoring a view with heavy state/async logic
- You suspect incorrect use of `@State`, `@Environment`, or `@Bindable`

## Explicit Command

```bash
/axiom:audit-swiftui-architecture
```

## Related
- [swiftui-architecture](../skills/ui-design/swiftui-architecture.md)
- [/axiom:audit-swiftui-performance](../commands/ui-design/audit-swiftui-performance.md)
- [/axiom:audit-swiftui-nav](../commands/ui-design/audit-swiftui-nav.md)
