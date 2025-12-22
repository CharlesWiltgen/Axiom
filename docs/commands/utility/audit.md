# /axiom:audit

Unified audit command with two modes: **Smart mode** (analyzes your project and suggests audits) and **Direct mode** (runs a specific audit area).

## Command

```bash
# Smart mode - analyze project and suggest audits
/axiom:audit

# Direct mode - run specific audit
/axiom:audit [area]
```

## Two Modes

### Smart Mode (No Arguments)

When you run `/axiom:audit` without specifying an area, it analyzes your project structure and suggests the most relevant audits:

**What it checks:**
- Project type (SwiftUI vs UIKit)
- Data models (.xcdatamodeld, SwiftData)
- Framework imports (CloudKit, Network.framework)
- Deployment target versions
- File patterns (async/await, Timer usage, etc.)

**Example interaction:**

```text
📊 Axiom Audit Analysis

Based on your project:
- SwiftUI project detected
- Core Data model found (Model.xcdatamodeld)
- Async/await usage found
- Deployment target: iOS 16.0

Recommended Audits:
1. concurrency - Swift 6 data races, unsafe Task captures
2. core-data - Thread safety, schema migrations
3. swiftui-performance - Expensive operations in view bodies
4. accessibility - VoiceOver labels, Dynamic Type

Which audits would you like to run?
```

### Direct Mode (With Area Argument)

Specify an audit area to run that specific audit immediately:

```bash
/axiom:audit memory              # Run memory leak detection
/axiom:audit swiftui-performance # Run SwiftUI performance audit
/axiom:audit accessibility       # Run accessibility audit
```

## Available Audit Areas

### UI & Design

| Area | What It Checks |
|------|----------------|
| `accessibility` | VoiceOver labels, Dynamic Type, color contrast, WCAG compliance, touch targets |
| `liquid-glass` | iOS 26 Liquid Glass adoption opportunities, toolbar improvements, blur effect migrations |
| `swiftui-architecture` | Logic in view bodies, MVVM patterns, testability, boundary violations |
| `swiftui-nav` | NavigationStack issues, path management, deep linking, state restoration |
| `swiftui-performance` | Expensive operations, formatters in body, whole-collection dependencies, missing lazy |
| `textkit` | TextKit 1 fallback triggers, glyph API usage, Writing Tools integration |

### Code Quality

| Area | What It Checks |
|------|----------------|
| `codable` | Manual JSON string building, try? swallowing errors, JSONSerialization usage |
| `concurrency` | Swift 6 data races, unsafe Task captures, @MainActor violations, Sendable issues |
| `memory` | Retain cycles, Timer leaks, observer leaks, closure captures, delegate patterns |
| `swift-performance` | Unnecessary copies, ARC overhead, unspecialized generics, collection inefficiencies |

### Persistence & Storage

| Area | What It Checks |
|------|----------------|
| `core-data` | Thread-confinement violations, missing migration options, N+1 queries, production risks |
| `icloud` | Missing NSFileCoordinator, CloudKit error handling, entitlement checks, conflict resolution |
| `storage` | Files in tmp/ directory, missing backup exclusions, file protection, wrong storage locations |

### Integration

| Area | What It Checks |
|------|----------------|
| `networking` | Deprecated APIs (SCNetworkReachability, CFSocket, NSStream), reachability anti-patterns, blocking socket calls |

### Build

| Area | What It Checks |
|------|----------------|
| `build` | Build time optimization opportunities, compiler settings, type checking slowdowns |

## Batch Execution Patterns

### Pre-Release Audit

Run critical audits before shipping:

```bash
/axiom:audit core-data       # CRITICAL - Data corruption risk
/axiom:audit storage         # CRITICAL - Data loss risk
/axiom:audit concurrency     # HIGH - Production crashes
/axiom:audit memory          # HIGH - Memory leaks
/axiom:audit networking      # HIGH - App Store rejection risk
```

### Architecture Review

Audit codebase architecture and patterns:

```bash
/axiom:audit swiftui-architecture  # Separation of concerns
/axiom:audit swiftui-nav          # Navigation patterns
/axiom:audit swiftui-performance  # Performance issues
```

### Performance Tuning

Optimize app performance:

```bash
/axiom:audit swift-performance     # ARC, allocations
/axiom:audit swiftui-performance  # View body overhead
/axiom:audit memory               # Leak detection
```

### App Store Preparation

Prepare for App Store submission:

```bash
/axiom:audit accessibility  # WCAG compliance
/axiom:audit networking     # Deprecated APIs
/axiom:audit storage        # File protection
```

## Priority Ordering

Audits are categorized by severity:

1. **CRITICAL** (Data corruption/loss risk)
   - core-data, storage, icloud

2. **HIGH** (Production crashes, App Store rejection)
   - concurrency, memory, networking

3. **MEDIUM** (Architecture, performance)
   - swiftui-architecture, swiftui-performance, swift-performance

4. **LOW** (Enhancement opportunities)
   - accessibility, liquid-glass, codable

## Output Management

All audits have built-in output limits to prevent overwhelming results on large codebases:

- **>50 issues per category**: Shows top 10 examples + total count
- **>100 total issues**: Summarizes by category, shows only CRITICAL/HIGH details
- **Always shows**: Severity counts, top 3 files with most issues

## Example Usage

### Find all memory leaks

```bash
/axiom:audit memory
```

**Output:**
```text
=== Memory Audit Results ===

CRITICAL Issues: 2
HIGH Issues: 5
MEDIUM Issues: 3

[CRITICAL/HIGH] Timer Leak
File: src/ViewModels/TimerManager.swift:45
Code:
```swift
timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    self.update()  // Strong reference cycle!
}
```
Issue: Timer retains target strongly, prevents deallocation
Fix: Add timer?.invalidate() in deinit
...
```

### Check SwiftUI architecture

```bash
/axiom:audit swiftui-architecture
```

**Output:**
```text
=== SwiftUI Architecture Audit ===

HIGH Issues: 8 (Logic in views, testability)
MEDIUM Issues: 3 (God ViewModels)

[HIGH] Logic in View Body
File: Views/OrderList.swift:88
Code:
```swift
var body: some View {
    List(orders.filter { $0.status == "pending" }.sorted { $0.date > $1.date }) {
        // ...
    }
}
```
Issue: Business logic hidden in View; untestable and re-runs on every render
Fix: Move to ViewModel or @Observable model computed property
...
```

### Smart mode analysis

```bash
/axiom:audit
```

**Output:**
```text
📊 Axiom Audit Analysis

Analyzing project structure...

Found:
- 142 Swift files with SwiftUI imports
- Core Data model (AppModel.xcdatamodeld)
- CloudKit entitlements
- Async/await usage in 45 files
- Timer usage in 8 files

Recommended priority audits:
1. core-data - Core Data safety (thread violations, migrations)
2. concurrency - Swift 6 concurrency issues (45 async files found)
3. memory - Memory leak detection (8 Timer instances found)
4. icloud - CloudKit integration issues

Medium priority:
5. swiftui-performance - SwiftUI performance anti-patterns
6. swiftui-architecture - Architecture and testability

Would you like to run these audits? (all/specific/cancel)
```

## Tips

- **Start with smart mode** (`/axiom:audit`) to get tailored recommendations
- **Run CRITICAL audits before release** to prevent data loss
- **Use batch patterns** for common scenarios (pre-release, architecture review, performance tuning)
- **Check output limits** - agents show top issues first on large codebases
- **Follow file:line references** for quick fixes

## Related

- [/axiom:status](./status.md) - Check project environment health
- [/axiom:ask](./ask.md) - Natural language entry point to Axiom
