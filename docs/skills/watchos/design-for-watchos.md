---
name: design-for-watchos
description: Use when picking top-level navigation on watchOS (TabView verticalPage, NavigationSplitView, NavigationStack), placing toolbar buttons, adding full-color container backgrounds, designing for Always On, or auditing a watchOS 10+ app for Liquid Glass material consistency.
---

# Designing for watchOS

watchOS 10+ design patterns — vertical scrolling with the Digital Crown, glanceable screens, toolbar placement, full-color backgrounds, and the two-brightness reality of Always On.

## When to Use This Skill

Use this skill when you're:
- Picking the right top-level navigation for a watchOS screen
- Placing toolbar buttons on the leading, trailing, or bottom bar
- Adding full-color or gradient backgrounds that flow through nav bars and toolbars
- Designing screens for Always On without leaking sensitive data
- Reviewing a screen for glanceability and vertical-scroll fitness
- Auditing a watchOS 10+ app for watchOS 26 Liquid Glass material consistency

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Should this watch screen use TabView or NavigationSplitView?"
- "How do I make the navigation bar and safe area share a background color?"
- "My gradient background cuts off at the nav bar — what's the fix?"
- "What do I need to change so my app looks right in Always On?"
- "Why does tab selection stop working when my detail view is a TabView?"

## What This Skill Provides

### Navigation Primitives
- Decision tree between `TabView(.verticalPage)`, `NavigationSplitView`, and `NavigationStack`
- Page-indicator behavior alongside the Digital Crown
- The `Optional` tag gotcha when `TabView` sits inside `NavigationSplitView`'s detail

### Toolbar Placement Rules
- Capacity and behavior of `.topBarLeading`, `.topBarTrailing`, `.bottomBar` (up to 3), and `.primaryAction`
- Making a center button prominent with `.controlSize(.large)` and a capsule tint

### Full-Color Backgrounds
- When to use `containerBackground(_:for:)` instead of `.background(_:)`
- Gradient shorthand (`.blue.gradient`) and the role of color in communicating state, emotion, and spatial sense
- `matchedGeometryEffect` for shared elements that flow between tabs

### Always On
- Frontmost-vs-background display behavior
- The two environment values that matter — `\.isLuminanceReduced` and `\.redactionReasons`
- `privacySensitive()` for auto-blurring balances, health readings, and account numbers
- Matching update cadence with `TimelineView` and `scenePhase`
- Previewing both appearances in Xcode

### Liquid Glass on watchOS 26
- What the refreshed toolbar and control styles change by default
- Where custom styles need an audit (legibility on new materials, hand-rolled blurs)

## Key Pattern

Use `containerBackground(_:for:)` — not `.background(_:)` — for colors that flow through navigation and toolbars inside a container:

```swift
.containerBackground(.blue.gradient, for: .tabView)
.containerBackground(.green.gradient, for: .navigation)
```

Without it, color stops at the content bounds and the navigation bar falls back to the system default.

## Documentation Scope

This page documents the `design-for-watchos` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about watchOS navigation, toolbars, backgrounds, and Always On.

**For general SwiftUI layout and state** — Use [swiftui-layout](/skills/ui-design/swiftui-layout) and [swiftui-nav](/skills/ui-design/swiftui-nav) for cross-platform SwiftUI fundamentals; this skill covers what's watch-specific on top.

## Related

- [platform-basics](/skills/watchos/platform-basics) — Covers app structure, `WKSupportsAlwaysOnDisplay`, and delegate adoption
- [swiftui-nav](/skills/ui-design/swiftui-nav) — Cross-platform `NavigationStack` and `NavigationSplitView` fundamentals the watchOS versions build on
- [swiftui-layout](/skills/ui-design/swiftui-layout) — Adaptive layout primitives used inside watchOS views
- [accessibility-diag](/diagnostic/accessibility-diag) — Use when auditing a watchOS screen for VoiceOver, Dynamic Type, and contrast; watchOS-specific rotor/AssistiveTouch/Double Tap guidance lives in the axiom-accessibility suite

## Resources

**WWDC**: 2023-10138, 2023-10031, 2022-10133, 2022-10051

**Docs**: /watchos-apps/creating-an-intuitive-and-effective-ui-in-watchos-10, /watchos-apps/designing-your-app-for-the-always-on-state, /swiftui/tabview, /swiftui/navigationsplitview, /swiftui/navigationstack, /swiftui/containerbackground, /swiftui/privacysensitive, /swiftui/matchedgeometryeffect, /swiftui/timelineview, /swiftui/scenephase, /design/human-interface-guidelines/designing-for-watchos

**Skills**: axiom-watchos, platform-basics, smart-stack-and-complications, modernization
