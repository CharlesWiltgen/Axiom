# swiftui-nav-auditor

Scans SwiftUI navigation code for architecture and correctness issues — from known anti-patterns like missing NavigationPath to architectural gaps like orphan destinations, incomplete deep link coverage, and missing state preservation.

## What It Does

- Detects 10 known anti-patterns (missing NavigationPath, deep link gaps, state restoration, type safety, wrong container, deprecated APIs, and more)
- Identifies navigation completeness gaps (orphan destination types, unvalidated deep link targets, modal/stack conflicts)
- Correlates findings that compound into higher severity
- Produces a Navigation Health Score (SOLID / FRAGILE / BROKEN)

**Note**: This agent checks navigation **architecture and correctness**. For navigation **performance** issues (NavigationPath recreation, large models in state), use **swiftui-performance-analyzer**.

## How to Use

**Natural language:**
- "Check my SwiftUI navigation for correctness issues"
- "My deep links aren't working, can you scan my navigation code?"
- "Review my navigation state restoration"

**Explicit command:**
```bash
/axiom:audit swiftui-nav
```

## Related

- **swiftui-nav** skill — the navigation patterns this auditor checks against
- **swiftui-nav-diag** skill — systematic debugging for navigation failures (unexpected pops, deep link misroutes)
- **swiftui-performance-analyzer** agent — overlaps on NavigationPath recreation performance
- **ux-flow-auditor** agent — overlaps on deep link dead ends and user journey completeness
