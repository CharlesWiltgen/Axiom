# build-optimizer

Automatically scans Xcode projects for build performance optimizations and provides quick wins with measurable time savings.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My builds are slow"
- "How can I speed up build times?"
- "Optimize my Xcode build performance"
- "Builds are taking forever"
- "Can you make my builds faster?"

**Explicit command:**
```bash
/axiom:optimize-build
```

## What It Checks

1. **Build Settings** (HIGH) — Compilation mode, architecture settings, debug info format
2. **Build Phase Scripts** (HIGH) — Conditional execution, sandboxing, unnecessary scripts in Debug
3. **Type Checking Performance** (MEDIUM) — Slow-compiling functions, complex type inference
4. **Compiler Flags** (MEDIUM) — Suboptimal Swift compiler flags

## Expected Results

Based on typical findings:
- **30-50% faster** incremental debug builds
- **5-10 seconds saved** per build from conditional scripts
- **Measurable improvements** in Build Timeline

## Model & Tools

- **Model**: haiku
- **Tools**: Bash, Read, Grep, Glob
- **Color**: green
- **Scan Time**: <5 seconds

## Related Skills

- **build-performance** skill — Comprehensive build optimization workflows with Build Timeline analysis, WWDC 2018-408 and WWDC 2022-110364 guidance
