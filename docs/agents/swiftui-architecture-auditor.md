# swiftui-architecture-auditor

Scans SwiftUI code for architectural issues — from known anti-patterns like logic in view bodies and async boundary violations to architectural gaps like untestable business logic, inconsistent patterns, and missing separation of concerns.

## What It Does

- Detects 5 known anti-patterns (logic in view body, async boundary violations, property wrapper misuse, god viewmodels, testability violations)
- Identifies architectural completeness gaps (untested logic in views, inconsistent patterns, view-owned dependencies, cross-view duplication)
- Correlates findings that compound into higher severity
- Produces an Architecture Health Score (CLEAN / TANGLED / MONOLITHIC)

## How to Use

**Natural language:**
- "Check my SwiftUI architecture for separation of concerns"
- "Review my view models and state management"
- "Audit my app for testability"

**Explicit command:**
```bash
/axiom:audit swiftui-architecture
```

## Related

- **swiftui-architecture** skill — the architecture patterns this auditor checks against
- **swiftui-performance-analyzer** agent — overlaps on logic-in-view-body findings (performance impact)
- **swiftui-nav-auditor** agent — overlaps on navigation logic scattered across views
