---
name: swiftui-nav-diag
description: Systematic diagnostics for navigation failures, unexpected pops, deep linking issues, and state loss
skill_type: diagnostic
version: 1.0.0
---

# SwiftUI Navigation Diagnostics

Systematic troubleshooting for SwiftUI navigation problems. Covers NavigationStack, NavigationPath, deep linking, and state restoration issues.

## Symptoms This Diagnoses

Use when you're experiencing:
- Navigation tap does nothing (link present but doesn't push)
- Back button pops to wrong screen or root
- Deep link opens app but shows wrong screen
- Navigation state lost when switching tabs
- Navigation state lost when app backgrounds
- Same NavigationLink pushes twice
- Crash with `navigationDestination` in stack trace
- "A navigationDestination for [Type] was not found"

## Example Prompts

- "Why doesn't my NavigationLink respond to taps?"
- "Navigation pushes then immediately pops back"
- "Deep link works in foreground but fails on cold start"
- "Navigation state resets when I switch tabs"
- "How do I preserve navigation state when app backgrounds?"
- "Crash: No destination found for my type"

## Diagnostic Workflow

Claude guides you through systematic diagnosis:

### Step 1: Identify Problem Category

| Symptom | Likely Cause |
|---------|--------------|
| Link tap does nothing | Link outside NavigationStack or missing destination |
| Push then immediate pop | Path recreated every render |
| Deep link fails on cold start | Timing/lifecycle issue |
| State lost on tab switch | Shared NavigationStack across tabs |
| State lost on background | No persistence mechanism |

### Step 2: Mandatory First Checks

Before changing code:
1. Add `onChange(of: path.count)` logging
2. Verify NavigationLink is inside NavigationStack hierarchy
3. Check @State path location (must be stable, not recreated)
4. Test with minimal reproduction using String values

### Step 3: Apply Targeted Pattern

Claude provides specific fix patterns based on your symptom:
- **Pattern 1a-1e**: Link/destination issues
- **Pattern 2a-2e**: Unexpected pop issues
- **Pattern 3a-3d**: Deep linking issues
- **Pattern 4a-4d**: State loss issues
- **Pattern 5a-5c**: Crash issues

## Key Diagnostic Patterns

### Navigation Tap Does Nothing

```swift
// Add logging to see if path changes
.onChange(of: path.count) { old, new in
    print("📍 Path: \(old) → \(new)")
    // If never fires: link outside NavigationStack
    // If fires but no push: missing navigationDestination
}
```

### Path State Recreation

```swift
// ❌ Path recreated every render
var body: some View {
    let path = NavigationPath()  // Reset every time!
    NavigationStack(path: .constant(path)) { ... }
}

// ✅ Persistent path
@State private var path = NavigationPath()
var body: some View {
    NavigationStack(path: $path) { ... }
}
```

### Deep Link Cold Start

```swift
// Queue deep links until NavigationStack ready
@State private var pendingDeepLink: URL?
@State private var isReady = false

.onOpenURL { url in
    if isReady {
        handleDeepLink(url)
    } else {
        pendingDeepLink = url  // Process in onAppear
    }
}
```

## Documentation Scope

This page documents the `axiom-swiftui-nav-diag` diagnostic skill—systematic troubleshooting Claude uses when you report SwiftUI navigation problems.

**For patterns:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for implementation guidance.

**For API reference:** See [swiftui-nav-ref](/reference/swiftui-nav-ref) for complete APIs.

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) — Navigation architecture patterns
- [swiftui-nav-ref](/reference/swiftui-nav-ref) — Complete navigation API reference
- [swiftui-nav-auditor](/agents/swiftui-nav-auditor) — Automated navigation code review

## Resources

**WWDC**: 2022-10054, 2024-10147, 2025-256

**Docs**: /swiftui/navigationstack, /swiftui/navigationpath
