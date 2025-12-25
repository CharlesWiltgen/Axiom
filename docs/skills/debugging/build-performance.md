# build-performance

Comprehensive build performance optimization with Build Timeline analysis, type checking improvements, and parallelization workflows.

## When to Use

- Build times are slow
- Investigating build performance
- Analyzing Build Timeline (Xcode 14+)
- Identifying type checking bottlenecks
- Optimizing incremental builds
- CI/CD build time optimization

## Key Features

### Build Timeline Analysis
- **Critical Path Optimization** — Identify and shorten the longest chain of dependent tasks
- **Timeline Visualization** — Interpret empty vertical space (idle cores), long horizontal bars (slow tasks)
- **Parallelization Gaps** — Detect targets waiting unnecessarily

### 8 Optimization Patterns

1. **Type Checking Performance** — Identify slow functions with `-warn-long-function-bodies`, add explicit types
2. **Build Phase Scripts** — Conditional execution (skip in Debug), script sandboxing, parallel execution
3. **Compilation Mode** — Incremental (Debug) vs Whole Module (Release)
4. **Build Active Architecture** — Only build for current device in Debug
5. **Debug Information Format** — DWARF (Debug) vs DWARF with dSYM (Release)
6. **Target Parallelization** — Enable parallel builds in scheme configuration
7. **Emit Module Optimization** — Xcode 14+ feature (automatic)
8. **Eager Linking** — Xcode 14+ optimization (automatic)

### Measurement & Verification
- Baseline measurement workflow
- Before/after comparison
- Build Timeline visual verification
- Real-world optimization examples

## Quick Win

Use the `/axiom:optimize-build` command to automatically scan for common issues:

```bash
/axiom:optimize-build
```

The build-optimizer agent will:
- Scan build settings for quick wins
- Check build phase scripts for conditional execution
- Identify type checking performance issues
- Detect suboptimal compiler flags
- Provide specific fixes with expected time savings

## Expected Impact

Based on typical findings:
- **30-50% faster** incremental debug builds
- **5-10 seconds saved** per build from conditional scripts
- **Measurable improvements** in Build Timeline
- **40-60% faster** incremental builds (compilation mode fix)
- **40-50% faster** debug builds (architecture fix)

## Common Optimizations

### Type Checking Example

**Before** (247ms to type-check):
```swift
func calculateTotal(items: [Item]) -> Double {
    return items
        .filter { $0.isActive }
        .map { $0.price * $0.quantity }
        .reduce(0, +)
}
```

**After** (12ms to type-check):
```swift
func calculateTotal(items: [Item]) -> Double {
    let activeItems: [Item] = items.filter { $0.isActive }
    let prices: [Double] = activeItems.map { $0.price * $0.quantity }
    let total: Double = prices.reduce(0, +)
    return total
}
```

### Build Phase Script Optimization

**Before** (6+ seconds every build):
```bash
#!/bin/bash
firebase crashlytics upload-symbols
```

**After** (0 seconds in Debug):
```bash
#!/bin/bash
if [ "${CONFIGURATION}" = "Release" ]; then
    firebase crashlytics upload-symbols
fi
```

## Workflow

1. **Measure Baseline** — Clean build + incremental build times
2. **Analyze Build Timeline** — Product → Perform Action → Build with Timing Summary
3. **Identify Bottlenecks** — Compilation? Linking? Scripts?
4. **Apply ONE optimization** — Don't batch changes
5. **Measure Improvement** — Compare against baseline
6. **Verify in Build Timeline** — Visual confirmation

## Based On

- WWDC 2018-408: Building Faster in Xcode
- WWDC 2022-110364: Demystify parallelization in Xcode builds
- Real-world optimization case studies

## Related

- **build-debugging** — Fixing broken builds
- **xcode-debugging** — Environment-first Xcode diagnostics
- `/axiom:optimize-build` — Automated scanning for quick wins

## Resources

- [WWDC 2018-408: Building Faster in Xcode](https://developer.apple.com/videos/play/wwdc2018/408/)
- [WWDC 2022-110364: Demystify parallelization](https://developer.apple.com/videos/play/wwdc2022/110364/)
- [Analyzing Build Performance - Antoine van der Lee](https://www.avanderlee.com/optimization/analysing-build-performance-xcode/)
