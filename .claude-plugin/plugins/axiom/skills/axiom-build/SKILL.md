---
name: axiom-build
description: Use when ANY iOS build fails, test crashes, Xcode misbehaves, or environment issue occurs before debugging code. Covers build failures, compilation errors, dependency conflicts, simulator problems, environment-first diagnostics.
license: MIT
---

# Build & Environment

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

**Invoke**: `skills/xcode-debugging.md`

---

### 2. Slow Builds → **build-performance**
**Triggers**:
- Compilation takes too long
- Type checking bottlenecks
- Want to optimize build time
- Build Timeline shows slow phases

**Invoke**: `skills/build-performance.md`

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

### 6. Build Failure Auto-Fix → **build-fixer** (Agent)
**Triggers**:
- BUILD FAILED with no clear error details
- Build sometimes succeeds, sometimes fails
- App builds but runs old code
- "Unable to boot simulator" error
- Want automated environment-first diagnostics

**Why build-fixer**: Autonomous agent that checks zombie processes, Derived Data, SPM cache, and simulator state before investigating code. Saves 30+ minutes on environment issues.

**Invoke**: Launch `build-fixer` agent or `/axiom:fix-build`

---

### 7. Slow Build Optimization → **build-optimizer** (Agent)
**Triggers**:
- Builds take too long
- Want to identify slow type checking
- Expensive build phase scripts
- Suboptimal build settings
- Want parallelization opportunities

**Why build-optimizer**: Scans Xcode projects for build performance optimizations — slow type checking, expensive scripts, suboptimal settings — to reduce build times by 30-50%.

**Invoke**: Launch `build-optimizer` agent or `/axiom:optimize-build`

---

### 8. General Dependency Issues → **build-debugging**
**Triggers**:
- CocoaPods resolution failures
- "Multiple commands produce" errors
- Framework version mismatches
- Non-SPM dependency graph conflicts

**Invoke**: `skills/build-debugging.md`

---

### 9. TestFlight Crash Triage → **testflight-triage**
**Triggers**:
- Beta tester reported a crash
- Crash reports in Xcode Organizer
- Crash logs aren't symbolicated
- TestFlight feedback with screenshots
- App was killed but no crash report

**Why testflight-triage**: Systematic workflow for investigating TestFlight crashes and reviewing beta feedback. Covers symbolication, crash interpretation, common patterns, and Claude-assisted analysis.

**Invoke**: See axiom-shipping (skills/testflight-triage.md)

---

### 10. App Store Connect Navigation → **app-store-connect-ref**
**Triggers**:
- How to find crashes in App Store Connect
- ASC metrics dashboard navigation
- Understanding crash-free users percentage
- Comparing crash rates between versions
- Exporting crash data from ASC
- App Store Connect API for crash data

**Why app-store-connect-ref**: Reference for navigating ASC crash analysis, metrics dashboards, and data export workflows.

**Invoke**: See axiom-shipping (skills/app-store-connect-ref.md)

---

### 11. Crash Log Analysis → **crash-analyzer** (Agent)
**Triggers**:
- User has .ips or .crash file to analyze
- User pasted crash report text
- Need to parse crash log programmatically
- Identify crash pattern from exception type
- Check symbolication status

**Why crash-analyzer**: Autonomous agent that parses crash reports, identifies patterns (null pointer, Swift runtime, watchdog, jetsam), and generates actionable analysis.

**Invoke**: Launch `crash-analyzer` agent or `/axiom:analyze-crash`

---

### 12. MetricKit API Reference → **metrickit-ref**
**Triggers**:
- MetricKit setup and subscription
- MXMetricPayload parsing (CPU, memory, launches, hitches)
- MXDiagnosticPayload parsing (crashes, hangs, disk writes)
- MXCallStackTree decoding and symbolication
- Field crash/hang collection
- Background exit metrics

**Why metrickit-ref**: Complete MetricKit API reference with setup patterns, payload parsing, and integration with crash reporting systems.

**Invoke**: See axiom-performance (`skills/metrickit-ref.md`)

---

### 13. Hang Diagnostics → **hang-diagnostics**
**Triggers**:
- App hangs or freezes
- Main thread blocked for >1 second
- UI unresponsive to touches
- Xcode Organizer shows hang diagnostics
- MXHangDiagnostic from MetricKit
- Watchdog terminations (app killed during launch/background transition)

**Why hang-diagnostics**: Systematic diagnosis of hangs with decision tree for busy vs blocked main thread, tool selection (Time Profiler, System Trace), and 8 common hang patterns with fixes.

**Invoke**: See axiom-performance (`skills/hang-diagnostics.md`)

---

### 14. Live Debugging → **axiom-lldb**
**Triggers**:
- Need to reproduce a crash interactively
- Want to set breakpoints and inspect state
- Crash report analyzed, now need live investigation
- Need to attach debugger to running app

**Why axiom-lldb**: Crash reports tell you WHAT crashed. LLDB tells you WHY.

**Invoke**: `skills/lldb.md`

---

### 16. Runtime Console Capture → **xclog-ref**
**Triggers**:
- Need to see what the app is logging at runtime
- App crashes but no crash report (need console output)
- Silent failures (network, data, auth) with no UI feedback
- Want to capture print()/os_log() output from simulator
- Need structured log output for analysis
- "What is the app printing?"

**Why xclog-ref**: Xcode's debug console isn't accessible externally. xclog combines simctl stdout/stderr with `log stream` JSON to capture everything print(), NSLog(), os_log(), and Logger emit — with structured fields (level, subsystem, category) for automated analysis.

**Invoke**: `/axiom:console`

---

### 15. Code Signing Issues → **code-signing**
**Triggers**:
- "No signing certificate found"
- "Provisioning profile doesn't include signing certificate"
- errSecInternalComponent in CI
- ITMS-90035 Invalid Signature on upload
- Ambiguous identity / multiple certificates
- Entitlement mismatch or missing capability
- Setting up CI/CD code signing (GitHub Actions, fastlane match)
- Certificate expired or revoked

**Why code-signing**: Code signing errors are NEVER code bugs — they are 100% configuration (certificates, profiles, entitlements, keychains). Diagnosing with CLI tools takes 5 minutes vs hours of guessing.

**Invoke**: See axiom-security (skills/code-signing.md) (workflows) or See axiom-security (skills/code-signing-diag.md) (troubleshooting)

---

## Decision Tree

1. Mysterious/intermittent/clean build fails? → xcode-debugging (environment-first)
2. SPM dependency conflict? → spm-conflict-resolver (Agent)
3. CocoaPods/other dependency conflict? → build-debugging
4. Slow build time? → build-performance
5. Security/privacy/App Store prep? → security-privacy-scanner (Agent)
6. Want automated build fix (environment-first diagnostics)? → build-fixer (Agent)
7. Want build time optimization scan? → build-optimizer (Agent)
8. Modernization/deprecated APIs? → modernization-helper (Agent)
9. TestFlight crash/feedback? → testflight-triage
10. Navigating App Store Connect? → app-store-connect-ref
11. Have a crash log (.ips/.crash)? → crash-analyzer (Agent)
12. MetricKit setup/parsing? → metrickit-ref
13. App hang/freeze/watchdog? → hang-diagnostics
14. Need to reproduce crash interactively / inspect runtime state? → axiom-lldb
15. Code signing error (certificate, profile, entitlement, Keychain)? → code-signing / code-signing-diag
16. Need to see runtime console output (print/os_log)? → xclog-ref or `/axiom:console`

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I know how to fix this linker error" | Linker errors have 4+ root causes. xcode-debugging diagnoses all in 2 min. |
| "Let me just clean the build folder" | Clean builds mask the real issue. xcode-debugging finds the root cause. |
| "It's just an SPM issue, I'll fix Package.swift" | SPM conflicts cascade. spm-conflict-resolver analyzes the full dependency graph. |
| "The simulator is just slow today" | Simulator issues indicate environment corruption. xcode-debugging checks systematically. |
| "I'll skip environment checks, it compiles locally" | Environment-first saves 30+ min. Every time. |
| "I'll read the crash report more carefully instead of reproducing" | Crash reports show WHAT crashed, not WHY. Reproducing in LLDB with breakpoints reveals the actual state. axiom-lldb has the workflow. |
| "I know my certificate is fine, let me check the code" | Code signing errors are NEVER code bugs. 100% configuration. code-signing diagnoses with CLI in 5 min. |
| "I can't see what the app is logging without Xcode" | xclog captures print() + os_log from the simulator. Structured JSON output with level, subsystem, category. `/axiom:console`. |

## When NOT to Use (Conflict Resolution)

**Do NOT use ios-build for these — use the correct router instead:**

| Error Type | Correct Router | Why NOT ios-build |
|------------|----------------|-------------------|
| Swift 6 concurrency errors | `/skill axiom-concurrency` | Code error, not environment |
| SwiftData migration errors | `/skill axiom-data` | Schema issue, not build environment |
| "Sending 'self' risks data race" | `/skill axiom-concurrency` | Language error, not Xcode issue |
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
→ Invoke: `skills/xcode-debugging.md` (environment-first diagnostic)

User: "Builds are taking 10 minutes"
→ Invoke: `skills/build-performance.md`

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
→ Invoke: See axiom-shipping (skills/testflight-triage.md)

User: "I see crashes in App Store Connect but don't know how to investigate"
→ Invoke: See axiom-shipping (skills/testflight-triage.md)

User: "My crash logs aren't symbolicated"
→ Invoke: See axiom-shipping (skills/testflight-triage.md)

User: "I need to review TestFlight feedback"
→ Invoke: See axiom-shipping (skills/testflight-triage.md)

User: "How do I find crashes in App Store Connect?"
→ Invoke: See axiom-shipping (skills/app-store-connect-ref.md)

User: "Where's the crash-free users metric in ASC?"
→ Invoke: See axiom-shipping (skills/app-store-connect-ref.md)

User: "How do I export crash data from App Store Connect?"
→ Invoke: See axiom-shipping (skills/app-store-connect-ref.md)

User: "Analyze this crash log" [pastes .ips content]
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "Parse this .ips file: ~/Library/Logs/DiagnosticReports/MyApp.ips"
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "Why did my app crash? Here's the report..."
→ Invoke: `crash-analyzer` agent or `/axiom:analyze-crash`

User: "How do I set up MetricKit to collect crash data?"
→ Invoke: See axiom-performance (`skills/metrickit-ref.md`)

User: "How do I parse MXDiagnosticPayload?"
→ Invoke: See axiom-performance (`skills/metrickit-ref.md`)

User: "What's in MXCallStackTree and how do I decode it?"
→ Invoke: See axiom-performance (`skills/metrickit-ref.md`)

User: "My app hangs sometimes"
→ Invoke: See axiom-performance (`skills/hang-diagnostics.md`)

User: "The main thread is blocked and UI is unresponsive"
→ Invoke: See axiom-performance (`skills/hang-diagnostics.md`)

User: "Xcode Organizer shows hang diagnostics for my app"
→ Invoke: See axiom-performance (`skills/hang-diagnostics.md`)

User: "My app was killed by watchdog during launch"
→ Invoke: See axiom-performance (`skills/hang-diagnostics.md`)

User: "I have a crash report and need to reproduce it in the debugger"
→ Invoke: `skills/lldb.md`

User: "How do I set breakpoints to catch this crash?"
→ Invoke: `skills/lldb.md`

User: "My build is failing with BUILD FAILED but no error details"
→ Invoke: `build-fixer` agent or `/axiom:fix-build`

User: "Build sometimes succeeds, sometimes fails"
→ Invoke: `build-fixer` agent or `/axiom:fix-build`

User: "How can I speed up my Xcode build times?"
→ Invoke: `build-optimizer` agent or `/axiom:optimize-build`

User: "No signing certificate found when I try to build"
→ Invoke: See axiom-security (skills/code-signing-diag.md)

User: "errSecInternalComponent in my GitHub Actions CI"
→ Invoke: See axiom-security (skills/code-signing-diag.md)

User: "How do I set up code signing for GitHub Actions?"
→ Invoke: See axiom-security (skills/code-signing.md)

User: "What is my app printing to the console?"
→ Invoke: `/axiom:console`

User: "I need to see the simulator console output"
→ Invoke: `/axiom:console`

User: "The app fails silently, no error in the UI"
→ Invoke: `/axiom:console`
