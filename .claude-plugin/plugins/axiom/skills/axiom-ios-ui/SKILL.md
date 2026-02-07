---
name: axiom-ios-ui
description: Use when building, fixing, or improving ANY iOS UI including SwiftUI, UIKit, layout, navigation, animations, design guidelines. Covers view updates, layout bugs, navigation issues, performance, architecture, Apple design compliance.
license: MIT
---

# iOS UI Router

**You MUST use this skill for ANY iOS UI work including SwiftUI, UIKit, layout, navigation, animations, and design.**

## When to Use

Use this router when working with:
- SwiftUI views, state, bindings
- UIKit views and constraints
- Layout issues (Auto Layout, SwiftUI layout)
- Navigation (NavigationStack, deep linking)
- Animations and transitions
- Liquid Glass design (iOS 26+)
- Apple Human Interface Guidelines
- UI architecture and patterns
- Accessibility UI issues

## Conflict Resolution

**ios-ui vs ios-performance**: When UI is slow (e.g., "SwiftUI List slow"):
1. **Try ios-ui FIRST** — Domain-specific fixes (LazyVStack, view identity, @State optimization) often solve UI performance in 5 minutes
2. **Only use ios-performance** if domain fixes don't help — Profiling takes longer and may confirm what domain knowledge already knows

**Rationale**: Jumping to Instruments wastes time when the fix is a known SwiftUI pattern. Profile AFTER trying domain fixes, not before.

## Routing Logic

### SwiftUI Issues

**View not updating** → `/skill axiom-swiftui-debugging`
**Navigation issues** → `/skill axiom-swiftui-nav`
**Performance/lag** → `/skill axiom-swiftui-performance`
**Layout problems** → `/skill axiom-swiftui-layout`
**Stacks/grids/outlines** → `/skill axiom-swiftui-containers-ref`
**Animation issues** → `/skill axiom-swiftui-animation-ref`
**Gesture conflicts** → `/skill axiom-swiftui-gestures`
**Architecture/testability** → `/skill axiom-swiftui-architecture`
**App-level composition** → `/skill axiom-app-composition`
**Search implementation** → `/skill axiom-swiftui-search-ref`
**iOS 26 features** → `/skill axiom-swiftui-26-ref`

### UIKit Issues

**Auto Layout conflicts** → `/skill axiom-auto-layout-debugging`
**Animation timing issues** → `/skill axiom-uikit-animation-debugging`

### Design & Guidelines

**Liquid Glass adoption** → `/skill axiom-liquid-glass`
**SF Symbols (effects, rendering, custom)** → `/skill axiom-sf-symbols`
**Design decisions** → `/skill axiom-hig`
**Typography** → `/skill axiom-typography-ref`
**TextKit/rich text** → `/skill axiom-textkit-ref`

### Accessibility

**VoiceOver, Dynamic Type** → `/skill axiom-accessibility-diag`

### Testing

**UI test flakiness** → `/skill axiom-ui-testing`

## Decision Tree

```dot
digraph ios_ui {
    start [label="UI issue" shape=ellipse];
    is_swiftui [label="SwiftUI?" shape=diamond];
    is_uikit [label="UIKit?" shape=diamond];
    is_design [label="Design/guidelines?" shape=diamond];

    start -> is_swiftui;
    is_swiftui -> swiftui_type [label="yes"];
    is_swiftui -> is_uikit [label="no"];
    is_uikit -> uikit_type [label="yes"];
    is_uikit -> is_design [label="no"];
    is_design -> design_type [label="yes"];
    is_design -> "accessibility-diag" [label="accessibility"];

    swiftui_type [label="What's wrong?" shape=diamond];
    swiftui_type -> "swiftui-debugging" [label="view not updating"];
    swiftui_type -> "swiftui-nav" [label="navigation"];
    swiftui_type -> "swiftui-performance" [label="slow/lag"];
    swiftui_type -> "swiftui-layout" [label="adaptive layout"];
    swiftui_type -> "swiftui-containers-ref" [label="stacks/grids/outlines"];
    swiftui_type -> "swiftui-architecture" [label="feature architecture"];
    swiftui_type -> "app-composition" [label="app-level (root, auth, scenes)"];
    swiftui_type -> "swiftui-animation-ref" [label="animations"];
    swiftui_type -> "swiftui-gestures" [label="gestures"];
    swiftui_type -> "swiftui-search-ref" [label="search"];
    swiftui_type -> "swiftui-26-ref" [label="iOS 26 features"];

    uikit_type [label="UIKit issue?" shape=diamond];
    uikit_type -> "auto-layout-debugging" [label="Auto Layout"];
    uikit_type -> "uikit-animation-debugging" [label="animations"];

    design_type [label="Design topic?" shape=diamond];
    design_type -> "liquid-glass" [label="Liquid Glass"];
    design_type -> "sf-symbols" [label="SF Symbols"];
    design_type -> "hig" [label="HIG compliance"];
    design_type -> "typography-ref" [label="typography"];
    design_type -> "textkit-ref" [label="TextKit/rich text"];
}
```

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Simple SwiftUI layout, no need for the layout skill" | SwiftUI layout has 12 gotchas. swiftui-layout covers all of them. |
| "I know how NavigationStack works" | Navigation has state restoration, deep linking, and identity traps. swiftui-nav prevents 2-hour debugging. |
| "It's just a view not updating, I'll debug it" | View update failures have 4 root causes. swiftui-debugging diagnoses in 5 min. |
| "I'll just add .animation() and fix later" | Animation issues compound. swiftui-animation-ref has the correct patterns. |
| "This UI is simple, no architecture needed" | Even small features benefit from separation. swiftui-architecture prevents refactoring debt. |
| "I know how .searchable works" | Search has 6 gotchas (navigation container, isSearching level, suggestion completion). swiftui-search-ref covers all of them. |
| "I know SF Symbols, it's just Image(systemName:)" | 4 rendering modes, 12+ effects, 3 Draw playback modes, custom symbol authoring. sf-symbols has decision trees for all of them. |

## Example Invocations

User: "My SwiftUI view isn't updating when I change the model"
→ Invoke: `/skill axiom-swiftui-debugging`

User: "How do I implement Liquid Glass in my toolbar?"
→ Invoke: `/skill axiom-liquid-glass`

User: "NavigationStack is popping unexpectedly"
→ Invoke: `/skill axiom-swiftui-nav`

User: "Should I use MVVM for this SwiftUI app?"
→ Invoke: `/skill axiom-swiftui-architecture`

User: "How do I switch between login and main screens?"
→ Invoke: `/skill axiom-app-composition`

User: "Where should auth state live in my app?"
→ Invoke: `/skill axiom-app-composition`

User: "How do I create a grid layout with LazyVGrid?"
→ Invoke: `/skill axiom-swiftui-containers-ref`

User: "What's the difference between VStack and LazyVStack?"
→ Invoke: `/skill axiom-swiftui-containers-ref`

User: "How do I display hierarchical data with OutlineGroup?"
→ Invoke: `/skill axiom-swiftui-containers-ref`

User: "How do I add search to my SwiftUI list?"
→ Invoke: `/skill axiom-swiftui-search-ref`

User: "My search suggestions aren't working"
→ Invoke: `/skill axiom-swiftui-search-ref`

User: "How do I animate an SF Symbol when tapped?"
→ Invoke: `/skill axiom-sf-symbols`

User: "My SF Symbol Draw animation isn't working on my custom symbol"
→ Invoke: `/skill axiom-sf-symbols`

User: "Which rendering mode should I use for my toolbar icons?"
→ Invoke: `/skill axiom-sf-symbols`
