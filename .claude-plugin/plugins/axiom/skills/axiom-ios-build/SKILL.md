---
name: axiom-ios-build
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

**Invoke**: `/skill axiom-xcode-debugging`

---

### 2. Slow Builds → **build-performance**
**Triggers**:
- Compilation takes too long
- Type checking bottlenecks
- Want to optimize build time
- Build Timeline shows slow phases

**Invoke**: `/skill axiom-build-performance`

---

### 3. SPM Dependency Conflicts → **spm-conflict-resolver** (Agent)
**Triggers**:
- SPM resolution failures
- "No such module" after adding package
- Duplicate symbol linker errors
- Version conflicts between packages
- Swift 6 package compatibility issues
- Package.swift / Package.resolved conflicts

**Why spm-conflict-resolver**: Specialized agent that analyzes Package.swift and Package.resolved to diagnose and resolve Swift Package Manager conflicts.

**Invoke**: Launch `spm-conflict-resolver` agent

---

### 4. Security & Privacy Audit → **security-privacy-scanner** (Agent)
**Triggers**:
- App Store submission prep
- Privacy Manifest requirements (iOS 17+)
- Hardcoded credentials in code
- Sensitive data storage concerns
- ATS violations
- Required Reason API declarations

**Why security-privacy-scanner**: Specialized agent that scans for security vulnerabilities and privacy compliance issues.

**Invoke**: Launch `security-privacy-scanner` agent or `/axiom:audit security`

---

### 5. iOS 17→18 Modernization → **modernization-helper** (Agent)
**Triggers**:
- Migrate ObservableObject to @Observable
- Update @StateObject to @State
- Adopt modern SwiftUI patterns
- Deprecated API cleanup
- iOS 17+ migration

**Why modernization-helper**: Specialized agent that scans for legacy patterns and provides migration paths with code examples.

**Invoke**: Launch `modernization-helper` agent or `/axiom:audit modernization`

---

### 6. General Dependency Issues → **build-debugging**
**Triggers**:
- CocoaPods resolution failures
- "Multiple commands produce" errors
- Framework version mismatches
- Non-SPM dependency graph conflicts

**Invoke**: `/skill axiom-build-debugging`

---

## Decision Tree

```
User reports build/environment issue
  ├─ Is it mysterious/intermittent/clean build fails?
  │  └─ YES → xcode-debugging (environment-first)
  │
  ├─ Is it SPM dependency conflict?
  │  └─ YES → spm-conflict-resolver (Agent)
  │
  ├─ Is it CocoaPods/other dependency conflict? (legacy)
  │  └─ YES → build-debugging (note: CocoaPods is legacy; prefer SPM)
  │
  ├─ Is it slow build time?
  │  └─ YES → build-performance
  │
  ├─ Is it security/privacy/App Store prep?
  │  └─ YES → security-privacy-scanner (Agent)
  │
  └─ Is it modernization/deprecated APIs/iOS 17+ migration?
     └─ YES → modernization-helper (Agent)
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
→ Invoke: `/skill axiom-xcode-debugging` (environment-first diagnostic)

User: "Builds are taking 10 minutes"
→ Invoke: `/skill axiom-build-performance`

User: "SPM won't resolve dependencies"
→ Invoke: `spm-conflict-resolver` agent

User: "Two packages require different versions of the same dependency"
→ Invoke: `spm-conflict-resolver` agent

User: "Duplicate symbol linker error"
→ Invoke: `spm-conflict-resolver` agent

User: "I need to prepare for App Store security review"
→ Invoke: `security-privacy-scanner` agent

User: "Do I need a Privacy Manifest?"
→ Invoke: `security-privacy-scanner` agent

User: "Are there hardcoded credentials in my code?"
→ Invoke: `security-privacy-scanner` agent

User: "How do I migrate from ObservableObject to @Observable?"
→ Invoke: `modernization-helper` agent

User: "Update my code to use modern SwiftUI patterns"
→ Invoke: `modernization-helper` agent

User: "Should I still use @StateObject?"
→ Invoke: `modernization-helper` agent
