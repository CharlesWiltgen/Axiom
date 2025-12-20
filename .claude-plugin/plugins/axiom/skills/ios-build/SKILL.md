---
name: ios-build
description: Use when ANY iOS build fails, test crashes, Xcode misbehaves, or environment issue occurs before debugging code. Covers build failures, compilation errors, dependency conflicts, simulator problems, environment-first diagnostics.
---

# iOS Build & Environment Router

**You MUST use this skill for ANY build, environment, or Xcode-related issue before debugging application code.**

## When to Use

Use this router when you encounter:
- Build failures (`BUILD FAILED`, compilation errors, linker errors)
- Test crashes or hangs
- Simulator issues (won't boot, device errors)
- Xcode misbehavior (stale builds, zombie processes)
- Dependency conflicts (CocoaPods, SPM)
- Build performance issues (slow compilation)
- Environment issues before debugging code

## Routing Logic

This router invokes specialized skills based on the specific issue:

### 1. Environment-First Issues → **xcode-debugging**
**Triggers**:
- `BUILD FAILED` without obvious code cause
- Tests crash in clean project
- Simulator hangs or won't boot
- "No such module" after SPM changes
- Zombie `xcodebuild` processes
- Stale builds (old code still running)
- Clean build differs from incremental build

**Why xcode-debugging first**: 90% of mysterious issues are environment, not code. Check this BEFORE debugging code.

**Invoke**: `/skill xcode-debugging`

---

### 2. Slow Builds → **build-performance**
**Triggers**:
- Compilation takes too long
- Type checking bottlenecks
- Want to optimize build time
- Build Timeline shows slow phases

**Invoke**: `/skill build-performance`

---

### 3. Dependency Conflicts → **build-troubleshooting**
**Triggers**:
- CocoaPods/SPM resolution failures
- "Multiple commands produce" errors
- Framework version mismatches
- Dependency graph conflicts

**Invoke**: `/skill build-troubleshooting`

---

## Decision Tree

```
User reports build/environment issue
  ├─ Is it mysterious/intermittent/clean build fails?
  │  └─ YES → xcode-debugging (environment-first)
  │
  ├─ Is it dependency conflict?
  │  └─ YES → build-troubleshooting
  │
  └─ Is it slow build time?
     └─ YES → build-performance
```

## Anti-Rationalization

**Do NOT skip this router for:**
- "Simple" build errors (may have environment cause)
- "Obvious" code errors (verify environment first)
- "Quick fixes" (environment issues return if not addressed)

**Environment issues are the #1 time sink in iOS development.** Check environment before debugging code.

## Example Invocations

User: "My build failed with a linker error"
→ Invoke: `/skill xcode-debugging` (environment-first diagnostic)

User: "Builds are taking 10 minutes"
→ Invoke: `/skill build-performance`

User: "SPM won't resolve dependencies"
→ Invoke: `/skill build-troubleshooting`
