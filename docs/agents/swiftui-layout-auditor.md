# swiftui-layout-auditor

Scans SwiftUI layout code for the 10 most critical violations — GeometryReader misuse, deprecated screen APIs, hardcoded breakpoints, identity loss from conditional stacks, and missing lazy containers.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my SwiftUI layouts for issues?"
- "Review my adaptive layout code"
- "My layout breaks on iPad, can you scan for problems?"
- "Check for GeometryReader misuse in my views"

**Explicit command:**
```bash
/axiom:audit swiftui-layout
```

## What It Does

1. **GeometryReader in Stacks Without .frame()** (CRITICAL) — Collapses sibling views
2. **UIScreen.main / UIDevice.current** (CRITICAL) — Deprecated, unreliable in SwiftUI
3. **UIRequiresFullScreen** (CRITICAL) — Disables all iPad multitasking
4. **Size Class as Orientation Proxy** (HIGH) — Breaks on iPad and large iPhones
5. **Conditional HStack/VStack** (HIGH) — Destroys child view state on switch
6. **Nested GeometryReaders** (HIGH) — Confusing size propagation
7. **Hardcoded Width/Height Breakpoints** (MEDIUM) — Breaks on new device sizes
8. **Large Fixed Frames (300+ px)** (MEDIUM) — Clips on smaller devices
9. **Non-Lazy ForEach in Stacks** (MEDIUM) — Launch lag with 100+ items
10. **Missing containerRelativeFrame** (LOW) — Modernization opportunity (iOS 17+)

## Related

- **swiftui-layout** — Adaptive layout decision trees (ViewThatFits, AnyLayout)
- **swiftui-layout-ref** — Complete SwiftUI layout API reference
