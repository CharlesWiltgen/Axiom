---
name: build-performance
description: Use when build times are slow, investigating build performance, analyzing Build Timeline, identifying type checking bottlenecks, or optimizing incremental builds - comprehensive build optimization workflows based on WWDC 2018/408, WWDC 2022/110364, and real-world optimization patterns
skill_type: discipline
version: 1.0
last_updated: 2025-12-07
apple_platforms: iOS 14+, macOS 11+, iPadOS 14+, tvOS 14+, watchOS 7+, visionOS 1.0+
xcode_version: Xcode 14+
wwdc_sessions: [2018-408, 2022-110364]
---

# Build Performance Optimization

## Overview

Systematic Xcode build performance analysis and optimization. **Core principle**: Measure before optimizing, then optimize the critical path first.

## When to Use This Skill

- Build times have increased significantly
- Incremental builds taking too long
- Want to analyze Build Timeline
- Need to identify slow-compiling Swift code
- Optimizing CI/CD build times
- Build performance regression investigation

## Quick Win: Run the Agent First

For automated scanning and quick wins:
```bash
/axiom:optimize-build
```

The build-optimizer agent scans for common issues and provides immediate fixes. Use this skill for deep analysis.

## The Build Performance Workflow

### Step 1: Measure Baseline (Required)

**Why**: You can't improve what you don't measure. Baseline prevents placebo optimizations.

```bash
# Clean build (eliminates all caching)
xcodebuild clean build -scheme YourScheme

# Measure time
time xcodebuild build -scheme YourScheme

# Or use Xcode UI
Product → Perform Action → Build with Timing Summary
```

**Record**:
- Total build time
- Incremental build time (change one file, rebuild)
- Which phase takes longest (compilation vs linking vs scripts)

**Example baseline**:
```
Clean build: 247 seconds
Incremental (1 file change): 12 seconds
Longest phase: Compile Swift sources (189s)
```

### Step 2: Analyze Build Timeline (Xcode 14+)

**Access**:
1. Build your project (Cmd+B)
2. Open Report Navigator (Cmd+9)
3. Select latest build
4. Show Assistant Editor (Cmd+Option+Return)
5. Build Timeline appears alongside build log

**What to look for**:

#### Critical Path (The Build's Speed Limit)
The **critical path** is the shortest possible build time with unlimited CPU cores. It's defined by the longest chain of dependent tasks.

```
┌─────────────────────────────────────────┐
│  Critical Path: A → B → C → D (120s)   │
│                                         │
│  Task A: 30s  ─────────┐               │
│  Task B: 40s           ├─→ D: 20s      │
│  Task C: 30s  ─────────┘               │
│                                         │
│  Even with 100 CPUs, build takes 120s  │
└─────────────────────────────────────────┘
```

**Goal**: Shorten the critical path by breaking dependencies.

#### Timeline Red Flags

**Empty vertical space**: Tasks waiting for inputs
```
Timeline:
████████░░░░░░░░████████  ← Bad: idle cores waiting
████████████████████████  ← Good: continuous work
```

**Long horizontal bars**: Slow individual tasks
```
Task A: ████████████████████ (45 seconds) ← Investigate
Task B: ███ (3 seconds)      ← Fine
```

**Serial target builds**: Targets waiting unnecessarily
```
Framework: ████████░░░░░░░░░░ ← Waiting
App:       ░░░░░░░░░░████████ ← Delayed

Better (parallel):
Framework: ████████
App:       ░░░░████████████
```

### Step 3: Identify Bottlenecks (Decision Tree)

**Is compilation the slowest phase?**
├─ YES → Check type checking performance (Step 4)
└─ NO → Is linking slow?
    ├─ YES → Check link dependencies (Step 5)
    └─ NO → Are scripts slow?
        ├─ YES → Optimize build phase scripts (Step 6)
        └─ NO → Check parallelization (Step 7)

## Optimization Patterns

### Pattern 1: Type Checking Performance (MEDIUM-HIGH IMPACT)

**Symptom**: "Compile Swift sources" takes >50% of build time.

**Diagnosis**:

Enable compiler warnings to find slow functions:

```swift
// Add to Debug build settings → Other Swift Flags
-warn-long-function-bodies 100
-warn-long-expression-type-checking 100
```

Build → Xcode shows warnings:
```
MyView.swift:42: Function body took 247ms to type-check (limit: 100ms)
LoginViewModel.swift:18: Expression took 156ms to type-check (limit: 100ms)
```

**Fix slow type checking**:

```swift
// ❌ SLOW - Complex type inference (247ms)
func calculateTotal(items: [Item]) -> Double {
    return items
        .filter { $0.isActive }
        .map { $0.price * $0.quantity }
        .reduce(0, +)
}

// ✅ FAST - Explicit types (12ms)
func calculateTotal(items: [Item]) -> Double {
    let activeItems: [Item] = items.filter { $0.isActive }
    let prices: [Double] = activeItems.map { $0.price * $0.quantity }
    let total: Double = prices.reduce(0, +)
    return total
}
```

**Common slow patterns**:
- Complex chained operations without intermediate types
- Deeply nested closures
- Large literals (dictionaries, arrays)
- Operator overloading in complex expressions

**Expected impact**: 10-30% faster compilation for affected files.

---

### Pattern 2: Build Phase Script Optimization (HIGH IMPACT)

**Symptom**: Build Timeline shows long script phases in Debug builds.

**Common culprits**:
- dSYM/Crashlytics uploads running in Debug
- Asset processing on every build
- Code generation scripts without caching

**Fix**: Make scripts conditional

```bash
# ❌ BAD - Runs in ALL configurations (adds 6+ seconds to debug builds)
#!/bin/bash
firebase crashlytics upload-symbols

# ✅ GOOD - Skip in Debug
#!/bin/bash
if [ "${CONFIGURATION}" = "Release" ]; then
    firebase crashlytics upload-symbols
fi

# Example savings: 6.3 seconds per incremental debug build
```

**Script Phase Sandboxing** (Xcode 14+)

Enable to prevent data races and improve parallelization:

```
Build Settings → User Script Sandboxing → YES
```

**Why**: Forces you to declare inputs/outputs explicitly, enabling parallel execution.

```bash
# Script phase with proper inputs/outputs
Input Files:
  $(SRCROOT)/input.txt
  $(DERIVED_FILE_DIR)/checksum.txt

Output Files:
  $(DERIVED_FILE_DIR)/output.html

# Now Xcode knows dependencies and can parallelize safely
```

**Parallel Script Execution**:

```
Build Settings → FUSE_BUILD_SCRIPT_PHASES → YES
```

**⚠️ WARNING**: Only enable if ALL scripts have correct inputs/outputs declared. Otherwise you'll get data races.

**Expected impact**: 5-10 seconds saved per incremental debug build.

---

### Pattern 3: Compilation Mode Settings (CRITICAL)

**Symptom**: Incremental builds recompile entire modules.

**Check current settings**:

```bash
# In project.pbxproj
grep "SWIFT_COMPILATION_MODE" project.pbxproj
```

**Optimal configuration**:

| Configuration | Setting | Why |
|---|---|---|
| **Debug** | `singlefile` (Incremental) | Only recompiles changed files |
| **Release** | `wholemodule` | Maximum optimization |

```swift
// ❌ BAD - Whole module in Debug
SWIFT_COMPILATION_MODE = wholemodule; // ALL configs

// ✅ GOOD - Incremental for Debug
Debug: SWIFT_COMPILATION_MODE = singlefile;
Release: SWIFT_COMPILATION_MODE = wholemodule;
```

**How to fix**:
1. Project → Build Settings
2. Filter: "Compilation Mode"
3. Set Debug to "Incremental"
4. Set Release to "Whole Module"

**Expected impact**: 40-60% faster incremental debug builds.

---

### Pattern 4: Build Active Architecture Only (HIGH IMPACT)

**Symptom**: Debug builds compile for multiple architectures (x86_64 + arm64).

**Check**:
```bash
grep "ONLY_ACTIVE_ARCH" project.pbxproj
```

**Fix**:

| Configuration | Setting | Why |
|---|---|---|
| **Debug** | `YES` | Only build for current device (arm64 OR x86_64) |
| **Release** | `NO` | Build universal binary |

**How to fix**:
1. Build Settings → "Build Active Architecture Only"
2. Set Debug to YES
3. Keep Release as NO

**Expected impact**: 40-50% faster debug builds (half the architectures).

---

### Pattern 5: Debug Information Format (MEDIUM IMPACT)

**Symptom**: Debug builds generating dSYMs unnecessarily.

**Optimal configuration**:

| Configuration | Setting | Why |
|---|---|---|
| **Debug** | `dwarf` | Embedded debug info, faster |
| **Release** | `dwarf-with-dsym` | Separate dSYM for crash reporting |

```bash
# Check current
grep "DEBUG_INFORMATION_FORMAT" project.pbxproj
```

**How to fix**:
1. Build Settings → "Debug Information Format"
2. Set Debug to "DWARF"
3. Set Release to "DWARF with dSYM File"

**Expected impact**: 3-5 seconds saved per debug build.

---

### Pattern 6: Target Parallelization (WWDC 2018-408)

**Symptom**: Build Timeline shows targets building sequentially when they could be parallel.

**Check scheme configuration**:
1. Product → Scheme → Edit Scheme
2. Build tab
3. Check "Parallelize Build" checkbox
4. Verify target order allows parallelization

**Dependency graph example**:

```
App ──┬──→ Framework A
      └──→ Framework B

Framework A ──→ Utilities
Framework B ──→ Utilities
```

**Timeline (bad - serial)**:
```
Utilities:   ████████░░░░░░░░░░░░░░
Framework A: ░░░░░░░░████████░░░░░░
Framework B: ░░░░░░░░░░░░░░░░████████
App:         ░░░░░░░░░░░░░░░░░░░░░░████
```

**Timeline (good - parallel)**:
```
Utilities:   ████████
Framework A: ░░░░░░░░████████
Framework B: ░░░░░░░░████████
App:         ░░░░░░░░░░░░░░░░████
```

**Expected impact**: Proportional to number of independent targets (e.g., 2 parallel targets = ~2x faster).

---

### Pattern 7: Emit Module Optimization (Xcode 14+, Swift 5.7+)

**What it is**: Swift modules are produced separately from compilation, unblocking downstream targets faster.

**Before (Xcode 13)**:
```
Framework: Compile ████████████ → Emit Module █
App:       ░░░░░░░░░░░░░░░░░░░░░░░░░█████████
           ↑
           Waiting for Framework compilation to finish
```

**After (Xcode 14+)**:
```
Framework: Compile ████████████
           Emit Module ███
App:       ░░░░░░███████████
           ↑
           Starts as soon as module emitted
```

**Automatic**: No configuration needed, works in Xcode 14+ with Swift 5.7+.

**Expected impact**: Reduces idle time in multi-target builds by 20-40%.

---

### Pattern 8: Eager Linking (Xcode 14+)

**What it is**: Linking can start before all compilation finishes if the module is ready.

**Impact**: Further reduces critical path in dependency chains.

**Automatic**: Works in Xcode 14+ automatically.

---

## Measurement & Verification

### Before and After Comparison

**Required steps**:

1. **Baseline** (before changes):
   ```bash
   xcodebuild clean build -scheme YourScheme 2>&1 | tee baseline.log
   ```

2. **Apply ONE optimization at a time**

3. **Measure improvement**:
   ```bash
   xcodebuild clean build -scheme YourScheme 2>&1 | tee optimized.log
   ```

4. **Compare**:
   ```bash
   # Extract build time from logs
   grep "Build succeeded" baseline.log
   grep "Build succeeded" optimized.log
   ```

**Example**:
```
Baseline:   Build succeeded (247.3 seconds)
Optimized:  Build succeeded (156.8 seconds)
Improvement: 90.5 seconds (36.6% faster)
```

### Build Timeline Visual Verification

**Before optimization**:
- Look for empty vertical space (idle cores)
- Long horizontal bars (slow tasks)
- Serial target builds

**After optimization**:
- Timeline should be more "filled"
- Shorter horizontal bars
- Parallel target builds

**Critical path**: Should be visibly shorter.

---

## Real-World Optimization Examples

### Example 1: Large iOS App (50+ source files)

**Baseline**:
- Clean build: 247 seconds
- Incremental (1 file): 12 seconds

**Optimizations applied**:
1. Debug compilation mode: singlefile (saved 89s)
2. Build Active Architecture: YES (saved 45s)
3. Conditional dSYM upload script (saved 6.3s per incremental)

**Result**:
- Clean build: 156 seconds (36% faster)
- Incremental: 5.7 seconds (52% faster)

---

### Example 2: Multi-Framework Project

**Baseline**:
- 5 frameworks built serially
- Total: 189 seconds

**Optimizations applied**:
1. Enabled parallel builds in scheme
2. Fixed unnecessary dependencies
3. Emit module optimization (automatic in Xcode 14)

**Result**:
- Total: 94 seconds (50% faster)
- Critical path reduced from 189s to 94s

---

## Common Pitfalls

### Pitfall 1: Optimizing Without Measuring

**Mistake**: "I think this will help" → make change → no measurement.

**Why bad**: Placebo improvements, wasted time, actual regressions unnoticed.

**Fix**: Always measure before → change one thing → measure after.

---

### Pitfall 2: Optimizing Release Builds for Speed

**Mistake**: Set Release to incremental compilation for "faster builds".

**Why bad**: Release builds should optimize for runtime performance, not build speed. You ship Release builds to users.

**Fix**: Only optimize Debug builds for speed. Keep Release optimized for runtime.

---

### Pitfall 3: Breaking Dependencies for Parallelization

**Mistake**: Remove legitimate dependencies to "make builds parallel".

**Why bad**: Build errors, undefined behavior, race conditions.

**Fix**: Only parallelize truly independent targets. Use Build Timeline to identify safe opportunities.

---

### Pitfall 4: Enabling FUSE_BUILD_SCRIPT_PHASES Without Sandboxing

**Mistake**: Enable parallel scripts but don't declare inputs/outputs.

**Why bad**: Data races, non-deterministic build failures, incorrect builds.

**Fix**: First enable `ENABLE_USER_SCRIPT_SANDBOXING = YES`, fix all errors, THEN enable `FUSE_BUILD_SCRIPT_PHASES`.

---

## Troubleshooting

### Problem: Builds Still Slow After Optimizations

**Check**:
1. Did you clean before measuring? (`xcodebuild clean`)
2. Are you measuring the right build? (Debug vs Release)
3. Is your machine thermal throttling? (Activity Monitor → CPU tab)
4. Are other apps using CPU? (Quit Xcode, Docker, VMs during measurement)

---

### Problem: Build Timeline Shows No Parallelization

**Check**:
1. Scheme → Parallelize Build checked?
2. Are targets actually independent? (Check dependency graph)
3. Do targets have unnecessary explicit dependencies?

---

### Problem: Type Checking Warnings Don't Appear

**Check**:
1. Added flags to correct configuration? (Debug, not Release)
2. Syntax correct? `-warn-long-function-bodies 100` (with hyphen)
3. Building the right scheme?
4. Clean build to force recompilation

---

## Advanced: Analyzing Build Logs

### Extract Compilation Times

```bash
# Find slowest files to compile
xcodebuild -workspace YourApp.xcworkspace \
  -scheme YourScheme \
  clean build \
  OTHER_SWIFT_FLAGS="-Xfrontend -debug-time-function-bodies" 2>&1 | \
  grep ".[0-9]ms" | \
  sort -nr | \
  head -20
```

**Output**:
```
247.3ms  MyViewModel.swift:42:1  func calculateTotal
156.8ms  LoginView.swift:18:3    var body
89.2ms   NetworkManager.swift:67:1  func handleResponse
...
```

**Action**: Add explicit types to slowest functions.

---

### Extract Build Phase Times

```bash
# From build log
Build target 'MyApp' (project 'MyApp')
    Compile Swift source files (128.4 seconds)
    Link MyApp (12.3 seconds)
    Run custom shell script (6.7 seconds)
```

**Action**: Optimize the longest phase first.

---

## Checklist: Build Performance Audit

Before considering your build optimized:

- [ ] Measured baseline (clean + incremental)
- [ ] Debug uses incremental compilation
- [ ] Build Active Architecture = YES (Debug only)
- [ ] Debug uses DWARF (not dSYM)
- [ ] Build phase scripts are conditional (skip in Debug when possible)
- [ ] Enabled script sandboxing if using parallel scripts
- [ ] Parallelize Build enabled in scheme
- [ ] No unnecessary target dependencies
- [ ] Type checking warnings enabled
- [ ] Fixed slow type-checking functions (>100ms)
- [ ] Verified improvement in Build Timeline
- [ ] Documented baseline → optimized comparison

---

## Resources

### WWDC Sessions
- [WWDC 2018-408: Building Faster in Xcode](https://developer.apple.com/videos/play/wwdc2018/408/)
- [WWDC 2022-110364: Demystify parallelization in Xcode builds](https://developer.apple.com/videos/play/wwdc2022/110364/)

### Tools
- Xcode Build Timeline (Xcode 14+)
- Build with Timing Summary (Product → Perform Action)
- Instruments: Time Profiler (for runtime, not build time)

### Articles
- [Analyzing Build Performance - Antoine van der Lee](https://www.avanderlee.com/optimization/analysing-build-performance-xcode/)

---

**Remember**: Build performance optimization is about systematic measurement and targeted improvements. Optimize the critical path first, measure everything, and verify improvements in the Build Timeline.
