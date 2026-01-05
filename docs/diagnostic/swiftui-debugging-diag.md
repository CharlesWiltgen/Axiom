---
name: swiftui-debugging-diag
description: Systematic diagnostics for view update failures, intermittent UI issues, and Instruments workflows
skill_type: diagnostic
version: 1.0.0
---

# SwiftUI Debugging Diagnostics

Advanced diagnostic workflows for SwiftUI issues that persist after basic troubleshooting. Uses Self._printChanges() and SwiftUI Instrument for evidence-based diagnosis.

## Symptoms This Diagnoses

Use when you're experiencing:
- View not updating after basic troubleshooting
- Self._printChanges() shows unexpected update patterns
- Intermittent issues ("works sometimes")
- Complex dependency chains causing cascading updates
- Views updating too often (performance)
- Preview crashes that aren't immediately obvious
- State resets unexpectedly

## Example Prompts

- "My view isn't updating even though state changed"
- "Self._printChanges() shows @self changed but I don't know why"
- "View updates intermittently — works sometimes, fails others"
- "Too many views updating when I change one value"
- "Preview crashes without clear error message"
- "State resets when navigating back"

## Diagnostic Workflow

Claude guides you through evidence-based diagnosis:

### Pattern D1: Self._printChanges() Analysis

```swift
var body: some View {
    let _ = Self._printChanges()  // Add temporarily
    // Output tells you exactly what triggered update
}
```

**Output interpretation:**
- `@self changed` → View value or environment changed
- `propertyName changed` → That specific state triggered update
- Nothing logged → Body not being called at all

### Pattern D2: SwiftUI Instrument

For complex cases, use Instruments 26:
1. Launch Instruments with SwiftUI template (Cmd-I)
2. Record while reproducing issue
3. Check "Long View Body Updates" lane for expensive views
4. Use "Cause & Effect Graph" to trace data flow

### Pattern D3: View Identity Investigation

For state that resets unexpectedly:
- Check for views inside `if/else` conditionals
- Search for `.id()` modifiers with changing values
- Verify ForEach uses unique, stable identifiers

### Pattern D4: Environment Dependency Check

For cascading updates:
- Search for `.environment()` modifiers
- Check if frequently-changing values are in environment
- Consider using direct parameters instead

## Quick Diagnostic Table

| Symptom | First Check | Pattern | Fix Time |
|---------|-------------|---------|----------|
| View doesn't update | Self._printChanges() | D1 | 10 min |
| View updates too often | Instruments | D2 | 30 min |
| State resets | .id() modifiers | D3 | 15 min |
| Cascade updates | Environment | D4 | 20 min |
| Preview crashes | Diagnostics button | D5 | 10 min |

## Documentation Scope

This page documents the `axiom-swiftui-debugging-diag` diagnostic skill—advanced troubleshooting Claude uses when basic SwiftUI debugging doesn't resolve the issue.

**For basic troubleshooting:** See [swiftui-debugging](/skills/ui-design/swiftui-debugging) for common issues.

**For performance:** See [swiftui-performance](/skills/ui-design/swiftui-performance) for optimization.

## Related

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — Basic view update troubleshooting
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Performance optimization with Instruments
- [xcode-debugging](/skills/debugging/xcode-debugging) — Environment-first Xcode diagnostics

## Resources

**WWDC**: 2025-306 (SwiftUI Instruments), 2023-10160 (Performance), 2021-10022 (View identity)

**Docs**: /swiftui, /xcode/instruments
