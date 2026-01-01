# build-performance

Comprehensive build performance optimization with Build Timeline analysis, type checking improvements, parallelization workflows, and Xcode 26 compilation caching.

## When to Use

- Build times are slow
- Investigating build performance
- Analyzing Build Timeline (Xcode 14+)
- Identifying type checking bottlenecks
- Optimizing incremental builds
- CI/CD build time optimization
- Enabling Xcode 26 compilation caching
- Reducing module variants in explicitly built modules

## Example Prompts

- "My builds are slow, how can I speed them up?"
- "How do I analyze the Build Timeline?"
- "What is compilation caching in Xcode 26?"
- "Why is the same module being built multiple times?"
- "How do I enable parallel script execution?"

## What This Skill Provides

### Build Timeline Analysis
- **Critical Path Optimization** — Identify and shorten the longest chain of dependent tasks
- **Timeline Visualization** — Interpret empty vertical space (idle cores), long horizontal bars (slow tasks)
- **Parallelization Gaps** — Detect targets waiting unnecessarily

### 10 Optimization Patterns

| Pattern | What It Does | Impact |
|---------|--------------|--------|
| 1. Type Checking | Identify slow functions with `-warn-long-function-bodies` | 10-30% |
| 2. Build Phase Scripts | Conditional execution, sandboxing, parallel scripts | 5-10s saved |
| 3. Compilation Mode | Incremental (Debug) vs Whole Module (Release) | 40-60% |
| 4. Build Active Architecture | Only build for current device in Debug | 40-50% |
| 5. Debug Information | DWARF (Debug) vs DWARF with dSYM (Release) | 3-5s saved |
| 6. Target Parallelization | Enable parallel builds in scheme | ~2x faster |
| 7. Emit Module | Xcode 14+ automatic optimization | 20-40% |
| 8. Eager Linking | Xcode 14+ automatic optimization | — |
| 9. Compilation Caching | Xcode 26 cache across clean builds | 20-40% |
| 10. Explicitly Built Modules | Three-phase build, reduce module variants | 10-30% |

### Xcode 26 Features

**Compilation Caching** — Reuse compiled artifacts across clean builds:
```
Build Settings → COMPILATION_CACHE_ENABLE_CACHING → YES
```

**Explicitly Built Modules** — Default for Swift in Xcode 26. Separates build into Scan → Build Modules → Compile phases. Use "modules report" filter in build log to identify duplicate module variants.

## Quick Win

Use the `/axiom:optimize-build` command to automatically scan for common issues:

```bash
/axiom:optimize-build
```

The build-optimizer agent scans build settings, scripts, and compiler flags, providing specific fixes with expected time savings.

## Workflow

1. **Measure Baseline** — Clean build + incremental build times
2. **Analyze Build Timeline** — Product → Perform Action → Build with Timing Summary
3. **Identify Bottlenecks** — Compilation? Linking? Scripts? Module variants?
4. **Apply ONE optimization** — Don't batch changes
5. **Measure Improvement** — Compare against baseline
6. **Verify in Build Timeline** — Visual confirmation

## Related

- **build-debugging** — Fixing broken builds (dependency conflicts, SPM issues)
- **xcode-debugging** — Environment-first Xcode diagnostics (zombie processes, simulator)
- `/axiom:optimize-build` — Automated scanning agent for quick wins

## Resources

**WWDC**: 2018-408, 2022-110364, 2024-10171, 2025-247

**Docs**: /xcode/improving-the-speed-of-incremental-builds, /xcode/building-your-project-with-explicit-module-dependencies

**Tools**: Build Timeline (Xcode 14+), Modules Report (Xcode 16+), Build with Timing Summary
