# swiftui-nav-auditor

Automatically scans SwiftUI navigation code for architecture and correctness issues.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my SwiftUI navigation for correctness issues"
- "Review my navigation implementation for architectural problems"
- "My deep links aren't working, can you scan my navigation code?"
- "Audit my app's navigation state restoration"

**Explicit command:**
```bash
/axiom:audit-swiftui-nav
```

## What It Checks

**IMPORTANT**: This agent checks navigation **architecture and correctness**. For navigation **performance** issues (NavigationPath recreation, large models in state), use the **swiftui-performance-analyzer** agent instead.

### Architecture Issues

1. **Missing NavigationPath** (HIGH) — Dynamic navigation without `@State` NavigationPath binding
2. **Deep Link Gaps** (CRITICAL) — Missing `.onOpenURL`, no URL scheme registration, unhandled URL patterns
3. **State Restoration Issues** (HIGH) — Missing `.navigationDestination(for:)`, no state preservation
4. **Wrong Container** (MEDIUM) — NavigationStack for master-detail, NavigationSplitView for linear flows
5. **Type Safety Issues** (HIGH) — Multiple `.navigationDestination` with same type, type mismatches
6. **Tab/Nav Integration** (MEDIUM) — iOS 18+ missing `.tabViewStyle(.sidebarAdaptable)`, state conflicts
7. **Missing State Preservation** (HIGH) — No `@SceneStorage` for navigation path, state lost on termination
8. **Coordinator Pattern Violations** (LOW) — Navigation logic scattered across views

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: blue
- **Scan Time**: <1 second

## Related Skills

- **swiftui-nav** skill — NavigationStack vs NavigationSplitView decision trees, deep linking, coordinator patterns
- **swiftui-nav-diag** skill — Systematic navigation debugging (not responding, unexpected pops, deep link failures)
- **swiftui-nav-ref** skill — Complete API reference with WWDC code examples
- **swiftui-performance-analyzer** agent — For navigation **performance** issues (not architecture)
