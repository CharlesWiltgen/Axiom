# /axiom:optimize-build

Scan Xcode project for build performance optimizations (launches the `build-optimizer` agent).

## Command

```bash
/axiom:optimize-build
```

## What It Checks
1. **Build Settings**: Compilation mode, architecture settings, optimization levels
2. **Build Phases**: Scripts running unconditionally (missing input/output files)
3. **Type Checking**: Slow compilation paths in Swift code
4. **Project Structure**: Dependency graph bottlenecks

## Expected Results
- **30-50% faster** incremental debug builds
- **5-10 seconds saved** per build from fixing script phases
- Reduced thermal throttling on your machine

## When to Use
- Incremental builds take > 15 seconds
- "Indexing..." hangs for long periods
- Your fan spins up immediately when building
- You want to audit your project configuration against best practices

## Related
- [/axiom:fix-build](./fix-build.md) - Fix failing builds
- [build-performance](../../skills/debugging/build-performance.md) - Deep dive into build optimization
