# swiftui-performance-analyzer

Scans SwiftUI code for performance issues — from known anti-patterns like formatters in view bodies to context-dependent problems like expensive operations amplified inside scrolling cells.

## What It Does

- Detects 10 known anti-patterns (file I/O in view body, expensive formatters, image processing, whole-collection dependencies, missing lazy loading, and more)
- Identifies context-dependent performance issues (same code is fine in a settings screen but devastating in a List cell)
- Correlates findings that compound into higher severity
- Produces a Performance Health Score (SMOOTH / JANKY / BROKEN)

## How to Use

**Natural language:**
- "My SwiftUI app has janky scrolling"
- "Check my code for performance issues"
- "My views are updating too often"
- "App feels slow during scrolling"

**Explicit command:**
```bash
/axiom:audit swiftui-performance
```

## Related

- **swiftui-performance** skill — use to profile and fix the issues this auditor finds, including Instruments workflows
- **swiftui-debugging** skill — systematic view update diagnosis
- **memory-auditor** agent — overlaps on timer/observer leaks in views
