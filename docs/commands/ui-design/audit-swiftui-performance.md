# /axiom:audit-swiftui-performance

Scan SwiftUI code for performance anti-patterns that cause frame drops (launches `swiftui-performance-analyzer` agent).

## Command

```bash
/axiom:audit-swiftui-performance
```

## What It Checks

### Critical Impact (Frame Drops)
- **File I/O in body**: Blocking the main thread during render
- **Heavy Initialization**: Creating `DateFormatter` or `NumberFormatter` inside view body

### High Impact
- **Image Processing**: Resizing/filtering images inside the body (should be backgrounded)
- **Collection Dependencies**: Using `.count` on large collections instead of stable IDs

### Medium Impact
- **Lazy Loading**: Missing `LazyVStack`/`LazyHStack` in scroll views
- **Environment Churn**: Frequently changing environment values triggering redraws
- **View Identity**: Implicit `AnyView` usage breaking diffing

## When to Use
- Scrolling is janky or stutters
- Animations drop frames
- View updates feel sluggish
- Device gets hot during simple usage

## Related
- [/axiom:audit-swiftui-nav](./audit-swiftui-nav.md) - Check navigation correctness
- [swiftui-performance](../../skills/ui-design/swiftui-performance.md) - Optimization guide
