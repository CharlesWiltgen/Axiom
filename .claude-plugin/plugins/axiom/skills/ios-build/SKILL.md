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

### 3. Dependency Conflicts → **build-debugging**
**Triggers**:
- CocoaPods/SPM resolution failures
- "Multiple commands produce" errors
- Framework version mismatches
- Dependency graph conflicts

**Invoke**: `/skill build-debugging`

---

## Decision Tree

```
User reports build/environment issue
  ├─ Is it mysterious/intermittent/clean build fails?
  │  └─ YES → xcode-debugging (environment-first)
  │
  ├─ Is it dependency conflict?
  │  └─ YES → build-debugging
  │
  └─ Is it slow build time?
     └─ YES → build-performance
```

## Anti-Rationalization

**Do NOT skip this router for:**
- "Simple" build errors (may have environment cause)
- "Quick fixes" (environment issues return if not addressed)

**Environment issues are the #1 time sink in iOS development.** Check environment before debugging code.

## When NOT to Use (Conflict Resolution)

**Do NOT use ios-build for these — use the correct router instead:**

| Error Type | Correct Router | Why NOT ios-build |
|------------|----------------|-------------------|
| Swift 6 concurrency errors | **ios-concurrency** | Code error, not environment |
| SwiftData migration errors | **ios-data** | Schema issue, not build environment |
| "Sending 'self' risks data race" | **ios-concurrency** | Language error, not Xcode issue |
| Type mismatch / compilation errors | Fix the code | These are code bugs |

**ios-build is for environment mysteries**, not code errors:
- ✅ "No such module" when code is correct
- ✅ Simulator won't boot
- ✅ Clean build fails, incremental works
- ✅ Zombie xcodebuild processes
- ❌ Swift concurrency warnings/errors
- ❌ Database migration failures
- ❌ Type checking errors in valid code

## Example Invocations

User: "My build failed with a linker error"
→ Invoke: `/skill xcode-debugging` (environment-first diagnostic)

User: "Builds are taking 10 minutes"
→ Invoke: `/skill build-performance`

User: "SPM won't resolve dependencies"
→ Invoke: `/skill build-debugging`
