---
name: swiftui-architecture
description: Architecture patterns for SwiftUI — Apple patterns, MVVM, TCA, and Coordinator
skill_type: discipline
version: 1.0
apple_platforms: iOS 26+, iOS 27 (@State macro)
---

# SwiftUI Architecture

Architecture patterns for modern SwiftUI. Covers Apple's native patterns (@Observable, State-as-Bridge), MVVM, TCA, and Coordinator approaches with decision frameworks for choosing between them.

## When to Use This Skill

Use this skill when you're:
- Logic in SwiftUI view files that you want to extract
- Choosing between MVVM, TCA, vanilla SwiftUI, or Coordinator
- Refactoring views to separate concerns
- Making SwiftUI code testable
- Asking "where should this code go?"
- Deciding which property wrapper to use (@State, @Binding, @Environment, @Bindable)

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "There's quite a bit of code in my view files about logic things. How do I extract it?"
- "Should I use MVVM, TCA, or Apple's vanilla patterns?"
- "How do I make my SwiftUI code testable?"
- "Where should formatters and calculations go?"
- "Which property wrapper do I use?"
- "My @State property stopped compiling after upgrading to Xcode 27"
- "Why is my @State model being recreated every time the view is rebuilt?"
- "I set my @State value in init but the view shows the old one"

## What This Skill Provides

### Apple's Native Patterns
- @Observable for data models (replaces ObservableObject)
- State-as-Bridge for async boundaries (WWDC 2025)
- Four property wrappers: @State, @Binding, @Environment, @Bindable — and why `@Bindable` does not compile on a value type
- Synchronous UI updates for animations
- `.task` modifier lifecycle (cancels on view destruction or identity change, not body re-evaluation; `.task(id:)` pitfalls)
- Bridging actor state to SwiftUI via `@Observable` proxy layer, and `Observations` for the reverse direction
- **@State is a macro** (Xcode 27) — the initial value is evaluated at most once instead of on every view init, but only for `private`/`fileprivate` declarations
- The three TN3211 source-compat breaks, plus the one that compiles and is still wrong: pairing an inline initial value with an `init` assignment silently discards the `init` value

### MVVM Pattern
- When MVVM adds value (complex presentation logic)
- ViewModel responsibilities
- Testing strategies

### TCA (The Composable Architecture)
- When TCA is appropriate
- Complexity trade-offs
- Team onboarding considerations

### Coordinator Pattern
- When coordinators help
- Navigation separation from views
- State restoration

### Property Wrapper Decision Tree
- @State for view-local state
- @Environment for dependencies
- @Bindable for two-way binding to @Observable
- Plain properties for read-only data

### Anti-Patterns
- 7 anti-patterns with before/after code, including logic in view body, wrong property wrapper, god ViewModel, and circular state in @ViewBuilder closures

### Refactoring Workflow
- Identifying logic in views
- Extracting to model layer
- Testing extracted code

## Key Pattern

### State-as-Bridge Pattern (WWDC 2025)

```swift
// UI logic stays synchronous (for animations)
// Async code lives in models (testable without SwiftUI)
// State bridges the two

@Observable
class ColorExtractor {
    var isLoading = false
    var colors: [Color] = []

    func extract(from image: UIImage) async {
        isLoading = true
        let extracted = await heavyComputation(image)
        colors = extracted  // Synchronous mutation triggers UI update
        isLoading = false
    }
}

struct ColorView: View {
    @State private var extractor = ColorExtractor()

    var body: some View {
        VStack {
            if extractor.isLoading {
                ProgressView()
            } else {
                // Display colors with animation
            }
        }
        .task { await extractor.extract(from: selectedImage) }
    }
}
```

### Architecture Decision Tree

```mermaid
flowchart TD
    A[How complex is your<br/>presentation logic?] --> B{Complexity}
    B -->|Simple| C[Use Apple's vanilla<br/>@Observable patterns]
    B -->|Medium| D[Extract to @Observable<br/>model classes]
    B -->|Complex state| E{Team size?}
    B -->|Complex navigation| F[Add Coordinator pattern]
    E -->|Small team| G[MVVM with @Observable]
    E -->|Large team| H[Consider TCA]

    style C fill:#d4edda
    style D fill:#d4edda
    style G fill:#d4edda
    style H fill:#fff3cd
    style F fill:#d4edda
```

### Property Wrapper Decision Tree

```mermaid
flowchart TD
    A[Where does this<br/>data come from?] --> B{Source}
    B -->|View-local, temporary| C["@State"]
    B -->|Shared dependency| D["@Environment"]
    B -->|Two-way binding<br/>to @Observable| E["@Bindable"]
    B -->|Read-only from parent| F[Plain property<br/>no wrapper]

    style C fill:#cce5ff
    style D fill:#cce5ff
    style E fill:#cce5ff
    style F fill:#e2e3e5
```

## Documentation Scope

This page documents the `axiom-swiftui-architecture` skill — architecture patterns Claude uses when you're organizing SwiftUI code, extracting logic from views, or choosing between patterns.

**For navigation:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for NavigationStack and deep linking patterns.

**For app-level composition:** See [app-composition](/skills/ui-design/app-composition) for @main, root switching, and scene lifecycle.

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) – Navigation patterns (NavigationStack, deep linking)
- [app-composition](/skills/ui-design/app-composition) – App-level patterns (@main, root switching)
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Async patterns for models

## Resources

**WWDC**: 2025-266, 2024-10150, 2023-10149

**Docs**: /swiftui/model-data, /observation, /technotes/tn3211
