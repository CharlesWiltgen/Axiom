# swiftui-layout-auditor

Scans SwiftUI layout code for issues — from known anti-patterns like GeometryReader misuse and deprecated screen APIs to architectural gaps like missing multitasking support, identity-losing conditional stacks, and layouts that clip on smaller devices.

## What It Does

- Detects 10 known layout violations (GeometryReader in stacks, deprecated UIScreen/UIDevice, UIRequiresFullScreen, size class misuse, conditional stacks, hardcoded breakpoints, and more)
- Identifies layout completeness gaps (missing multitasking support, near-edge fixed sizing, GeometryReader in scroll contexts, no iOS 26 free-form window support)
- Correlates findings that compound into higher severity
- Produces a Layout Health Score (ADAPTIVE / RIGID / BROKEN)

## How to Use

**Natural language:**
- "Can you check my SwiftUI layouts for issues?"
- "My layout breaks on iPad, can you scan for problems?"
- "Check for GeometryReader misuse in my views"

**Explicit command:**
```bash
/axiom:audit swiftui-layout
```

## Related

- **swiftui-layout** skill — adaptive layout decision trees (ViewThatFits, AnyLayout, onGeometryChange)
- **swiftui-layout-ref** skill — complete SwiftUI layout API reference
- **swiftui-performance-analyzer** agent — overlaps on non-lazy ForEach and GeometryReader in scrolling contexts
- **accessibility-auditor** agent — overlaps on fixed dimensions that clip with Dynamic Type
