---
name: swiftui-nav
description: Use when implementing navigation patterns, choosing between NavigationStack and NavigationSplitView, handling deep links, adopting coordinator patterns, or requesting code review of navigation implementation - prevents navigation state corruption, deep link failures, and state restoration bugs for iOS 18+
skill_type: discipline
version: 1.0.0
apple_platforms: iOS 18+ (Tab/Sidebar), iOS 26+ (Liquid Glass)
---

# SwiftUI Navigation

Navigation architecture patterns for modern SwiftUI. Covers NavigationStack, NavigationSplitView, deep linking, state restoration, and coordinator patterns.

## When to Use This Skill

Use this skill when you're:
- Choosing navigation architecture (NavigationStack vs NavigationSplitView vs TabView)
- Implementing programmatic navigation with NavigationPath
- Setting up deep linking and URL routing
- Implementing state restoration for navigation
- Adopting Tab/Sidebar patterns (iOS 18+)
- Implementing coordinator/router patterns
- Code review of navigation implementation before shipping

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Should I use NavigationStack or NavigationSplitView for my app?"
- "How do I navigate programmatically in SwiftUI?"
- "My deep links aren't working. The app opens but shows the wrong screen."
- "Navigation state is lost when my app goes to background."
- "How do I implement a coordinator pattern in SwiftUI?"
- "How do I pop to root in NavigationStack?"
- "What's the difference between navigationDestination(for:) and navigationDestination(item:)?"

## What's Covered

### Architecture Decision Tree
- NavigationStack vs NavigationSplitView vs TabView
- Device targets and content hierarchy depth
- Multiplatform requirements

### NavigationStack Patterns
- NavigationPath manipulation (push, pop, pop-to-root)
- Type-safe navigation with navigationDestination(for:)
- Value-based navigation

### NavigationSplitView Patterns
- Two-column and three-column layouts
- Column visibility control
- Detail placeholder views

### Deep Linking
- URL parsing and path construction
- onOpenURL handling and timing issues
- Universal links integration

### State Restoration
- Codable NavigationPath persistence
- SceneStorage for automatic save/restore
- Crash-resistant restoration patterns

### iOS 18+ Tab/Sidebar
- Tab role for customization
- Sidebar integration
- Adaptive layout patterns

### Coordinator/Router Patterns
- When coordinators add value vs complexity
- Router implementation examples
- Navigation flow separation

## Key Pattern

### Programmatic Navigation

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List(items) { item in
                NavigationLink(value: item) {
                    Text(item.title)
                }
            }
            .navigationDestination(for: Item.self) { item in
                DetailView(item: item)
            }
        }
    }

    // Programmatic navigation
    func navigateTo(_ item: Item) {
        path.append(item)
    }

    func popToRoot() {
        path.removeLast(path.count)
    }
}
```

## Documentation Scope

This page documents the `axiom-swiftui-nav` skill—navigation architecture guidance Claude uses when answering your questions. The skill contains decision trees, patterns, and pressure scenario handling.

**For troubleshooting:** Use [swiftui-nav-diag](/diagnostic/swiftui-nav-diag) for systematic diagnosis of navigation failures.

**For API reference:** See [swiftui-nav-ref](/reference/swiftui-nav-ref) for comprehensive API coverage with WWDC examples.

## Related

- [swiftui-nav-diag](/diagnostic/swiftui-nav-diag) — Systematic troubleshooting for navigation bugs
- [swiftui-nav-ref](/reference/swiftui-nav-ref) — Comprehensive API reference with WWDC examples
- [swiftui-nav-auditor](/agents/swiftui-nav-auditor) — Autonomous agent for navigation code review
- [swiftui-layout](/skills/ui-design/swiftui-layout) — Adaptive layout patterns for navigation containers

## Resources

**WWDC**: 2022-10054, 2024-10147, 2025-256, 2025-323

**Docs**: /swiftui/navigation, /swiftui/navigationstack, /swiftui/navigationsplitview
