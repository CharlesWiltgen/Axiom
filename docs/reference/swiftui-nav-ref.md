---
name: swiftui-nav-ref
description: Comprehensive SwiftUI navigation API reference with NavigationStack, NavigationSplitView, and NavigationPath
version: 1.0.0
skill_type: reference
apple_platforms: iOS 16+, iOS 18+ (Tab/Sidebar), iOS 26+ (Liquid Glass)
---

# SwiftUI Navigation API Reference

Comprehensive API reference for SwiftUI navigation. Covers NavigationStack, NavigationSplitView, NavigationPath, deep linking, state restoration, Tab/Sidebar integration, and Liquid Glass navigation.

## When to Use This Reference

Use this reference when you need:
- Complete API signatures for NavigationStack or NavigationSplitView
- NavigationPath manipulation patterns
- Deep linking with URL routing
- State restoration with Codable paths
- iOS 18+ Tab/Sidebar integration patterns
- iOS 26+ Liquid Glass navigation APIs

**For discipline patterns:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for decision trees and anti-patterns.

**For troubleshooting:** See [swiftui-nav-diag](/diagnostic/swiftui-nav-diag) for systematic diagnosis.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the NavigationPath methods for manipulating the stack?"
- "How do I implement navigationDestination(for:) with multiple types?"
- "What's the complete pattern for Codable NavigationPath with SceneStorage?"
- "How do I use Tab with sidebar on iPad?"
- "What Liquid Glass APIs are available for navigation bars?"
- "How does navigationDestination(item:) differ from navigationDestination(for:)?"

## What's Covered

### NavigationStack (iOS 16+)
- NavigationStack initialization with path binding
- NavigationPath: append, removeLast, count
- Codable path serialization for state restoration
- navigationDestination(for:) and navigationDestination(item:)

### NavigationSplitView (iOS 16+)
- Two-column and three-column layouts
- Column visibility control
- Detail placeholder views
- Automatic collapse on iPhone

### NavigationPath
- Type-erased heterogeneous paths
- CodableRepresentation for persistence
- Push (append) and pop (removeLast) operations
- Pop-to-root pattern

### Deep Linking
- URL parsing and path construction
- onOpenURL handling
- Timing considerations for path manipulation

### State Restoration
- Codable NavigationPath pattern
- SceneStorage for automatic save/restore
- Crash-resistant restoration

### Tab/Sidebar (iOS 18+)
- Tab role for customization
- sidebarAdaptable style
- TabSection for grouping
- Per-tab NavigationStack

### Liquid Glass (iOS 26+)
- Automatic glass navigation bars
- backgroundExtensionEffect
- tabBarMinimizeBehavior
- Bottom-aligned search

### API Evolution
- NavigationView (deprecated iOS 16)
- NavigationStack/SplitView (iOS 16+)
- Tab/Sidebar unification (iOS 18+)
- Liquid Glass design (iOS 26+)

## Key Pattern

### NavigationPath with State Restoration

```swift
struct ContentView: View {
    @SceneStorage("navigationPath") private var pathData: Data?
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
        .onAppear { restorePath() }
        .onChange(of: path) { savePath() }
    }

    private func savePath() {
        pathData = try? JSONEncoder().encode(path.codable)
    }

    private func restorePath() {
        guard let data = pathData,
              let codable = try? JSONDecoder().decode(
                  NavigationPath.CodableRepresentation.self, from: data
              ) else { return }
        path = NavigationPath(codable)
    }
}
```

### NavigationPath Manipulation

```swift
// Push
path.append(item)

// Pop one
path.removeLast()

// Pop to root
path.removeLast(path.count)

// Pop to specific depth
path.removeLast(path.count - 2)  // Keep first 2 items
```

## Documentation Scope

This page documents the `axiom-swiftui-nav-ref` reference skill—comprehensive API coverage Claude uses when you need specific navigation API details.

**For patterns and decisions:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for architecture decisions and anti-patterns.

**For troubleshooting:** See [swiftui-nav-diag](/diagnostic/swiftui-nav-diag) for systematic diagnosis.

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) — Discipline skill with decision trees
- [swiftui-nav-diag](/diagnostic/swiftui-nav-diag) — Systematic troubleshooting
- [swiftui-nav-auditor](/agents/swiftui-nav-auditor) — Automated navigation code review

## Resources

**WWDC**: 2022-10054, 2024-10147, 2025-256, 2025-323

**Docs**: /swiftui/navigationstack, /swiftui/navigationsplitview, /swiftui/navigationpath
