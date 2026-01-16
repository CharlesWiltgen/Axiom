---
name: axiom-ios-build
description: Use when ANY iOS build fails, test crashes, Xcode misbehaves, or environment issue occurs before debugging code. Covers build failures, compilation errors, dependency conflicts, simulator problems, environment-first diagnostics.
user-invocable: false
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

### 7. TestFlight Crash Triage → **testflight-triage**
**Triggers**:
- Beta tester reported a crash
- Crash reports in Xcode Organizer
- Crash logs aren't symbolicated
- TestFlight feedback with screenshots
- App was killed but no crash report

**Why testflight-triage**: Systematic workflow for investigating TestFlight crashes and reviewing beta feedback. Covers symbolication, crash interpretation, common patterns, and Claude-assisted analysis.

**Invoke**: `/skill axiom-testflight-triage`

---

### 8. App Store Connect Navigation → **app-store-connect-ref**
**Triggers**:
- How to find crashes in App Store Connect
- ASC metrics dashboard navigation
- Understanding crash-free users percentage
- Comparing crash rates between versions
- Exporting crash data from ASC
- App Store Connect API for crash data

**Why app-store-connect-ref**: Reference for navigating ASC crash analysis, metrics dashboards, and data export workflows.

**Invoke**: `/skill axiom-app-store-connect-ref`

---

### 9. Crash Log Analysis → **crash-analyzer** (Agent)
**Triggers**:
- User has .ips or .crash file to analyze
- User pasted crash report text
- Need to parse crash log programmatically
- Identify crash pattern from exception type
- Check symbolication status

**Why crash-analyzer**: Autonomous agent that parses crash reports, identifies patterns (null pointer, Swift runtime, watchdog, jetsam), and generates actionable analysis.

**Invoke**: Launch `crash-analyzer` agent or `/axiom:analyze-crash`

---

### 10. MetricKit API Reference → **metrickit-ref**
**Triggers**:
- MetricKit setup and subscription
- MXMetricPayload parsing (CPU, memory, launches, hitches)
- MXDiagnosticPayload parsing (crashes, hangs, disk writes)
- MXCallStackTree decoding and symbolication
- Field crash/hang collection
- Background exit metrics

**Why metrickit-ref**: Complete MetricKit API reference with setup patterns, payload parsing, and integration with crash reporting systems.

**Invoke**: `/skill axiom-metrickit-ref`

---

### 11. Hang Diagnostics → **hang-diagnostics**
**Triggers**:
- App hangs or freezes
- Main thread blocked for >1 second
- UI unresponsive to touches
- Xcode Organizer shows hang diagnostics
- MXHangDiagnostic from MetricKit
- Watchdog terminations (app killed during launch/background transition)

**Why hang-diagnostics**: Systematic diagnosis of hangs with decision tree for busy vs blocked main thread, tool selection (Time Profiler, System Trace), and 8 common hang patterns with fixes.

**Invoke**: `/skill axiom-hang-diagnostics`

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
  ├─ Is it modernization/deprecated APIs/iOS 17+ migration?
  │  └─ YES → modernization-helper (Agent)
  │
  ├─ Is it TestFlight crash/feedback triage?
  │  └─ YES → testflight-triage
  │
  ├─ Is it navigating App Store Connect for crashes/metrics?
  │  └─ YES → app-store-connect-ref
  │
  ├─ Do they have a crash log (.ips/.crash) to analyze?
  │  └─ YES → crash-analyzer (Agent)
  │
  ├─ Is it MetricKit setup or payload parsing?
  │  └─ YES → metrickit-ref
  │
  └─ Is it app hang/freeze/watchdog termination?
     └─ YES → hang-diagnostics
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

User: "A beta tester said my app crashed"
→ Invoke: `/skill axiom-testflight-triage`

User: "I see crashes in App Store Connect but don't know how to investigate"
→ Invoke: `/skill axiom-testflight-triage`

User: "My crash logs aren't symbolicated"
→ Invoke: `/skill axiom-testflight-triage`

User: "I need to review TestFlight feedback"
→ Invoke: `/skill axiom-testflight-triage`

User: "How do I find crashes in App Store Connect?"
→ Invoke: `/skill axiom-app-store-connect-ref`

User: "Where's the crash-free users metric in ASC?"
→ Invoke: `/skill axiom-app-store-connect-ref`

User: "How do I export crash data from App Store Connect?"
→ Invoke: `/skill axiom-app-store-connect-ref`

User: "Analyze this crash log" [pastes .ips content]
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "Parse this .ips file: ~/Library/Logs/DiagnosticReports/MyApp.ips"
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "Why did my app crash? Here's the report..."
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "How do I set up MetricKit to collect crash data?"
→ Invoke: `/skill axiom-metrickit-ref`

User: "How do I parse MXDiagnosticPayload?"
→ Invoke: `/skill axiom-metrickit-ref`

User: "What's in MXCallStackTree and how do I decode it?"
→ Invoke: `/skill axiom-metrickit-ref`

User: "My app hangs sometimes"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "The main thread is blocked and UI is unresponsive"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "Xcode Organizer shows hang diagnostics for my app"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "My app was killed by watchdog during launch"
→ Invoke: `/skill axiom-hang-diagnostics`
