---
name: swiftui-toolbars
description: Use when adding, customizing, or debugging SwiftUI toolbars on iOS or macOS — .toolbar modifier, ToolbarItem, ToolbarItemGroup, ToolbarSpacer, placements, customization, ToolbarRole
---

# SwiftUI Toolbars

Discipline-enforcing skill for `.toolbar` content on iOS, iPadOS, macOS, watchOS, and visionOS. Covers placement selection, customization, the iOS 26 `ToolbarSpacer`, sheet button rules, and the anti-patterns that silently break toolbars.

## When to Use

Use this skill when you're:
- Adding action buttons to a navigation bar, bottom bar, or window toolbar
- Choosing between `ToolbarItem`, `ToolbarItemGroup`, and `ToolbarSpacer`
- Picking a `ToolbarItemPlacement` (semantic like `.primaryAction` vs positional like `.topBarTrailing`)
- Building a customizable toolbar where users can rearrange items
- Setting toolbar visibility, background material, or color scheme
- Adopting iOS 26 / macOS 26 `ToolbarSpacer` for visual breaks
- Migrating from deprecated `.navigationBarLeading` / `.navigationBarTrailing`
- Debugging missing, misplaced, or flickering toolbar items
- Reviewing toolbar code before shipping

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I add a Save button to my navigation bar?"
- "My toolbar items aren't showing up. What's wrong?"
- "Should I use `ToolbarItem` or `ToolbarItemGroup`?"
- "How do I make my toolbar customizable so users can rearrange items?"
- "I'm getting a deprecation warning on `.navigationBarLeading`. What's the replacement?"
- "Why does the spacer between my toolbar items disappear when the bar overflows?"
- "What does Apple's HIG say about Cancel and Done buttons in a sheet?"
- "How do I control which toolbar items collapse into the overflow menu? (iOS 27)"

## What This Skill Provides

### Placement decisions

- Semantic placements (`.primaryAction`, `.confirmationAction`, `.cancellationAction`, `.destructiveAction`) vs positional placements (`.topBarLeading`, `.topBarTrailing`, `.bottomBar`)
- Cross-platform behavior — why `.primaryAction` is preferred over `.topBarTrailing` when you want correct iOS / macOS / watchOS layout without branching
- Full `ToolbarItemPlacement` reference with iOS / iPadOS / macOS columns

### Pattern catalog

- Basic toolbar with one primary action (Save / Done / Add)
- Sheet `.confirmationAction` + `.cancellationAction` pair with the HIG button-placement rules (updated 2026-03-24)
- Separate `ToolbarItem`s vs `ToolbarItemGroup` — when each is correct
- `ToolbarSpacer(.fixed)` and `.flexible` for iOS 26 / macOS 26 visual breaks
- Customizable toolbars with `.toolbar(id:)` + per-item `id:` + `customizationBehavior`
- `.toolbarRole(.editor)` for three-column NavigationSplitView layouts
- Toolbar visibility, background material, and color scheme per bar
- macOS `windowToolbarStyle` on the Scene (not the View)
- Toolbar overflow & visibility priority — `ToolbarOverflowMenu`, `.visibilityPriority`, `.topBarPinnedTrailing` (iOS 27)

### HIG sheet button rules

- Always pair confirmation with Cancel or Back — a solo Done implies completing the task is the only exit
- Don't show Cancel, Done, and Back together — too many dismiss/commit affordances confuse the exit path
- iOS / iPadOS: Cancel leading, Done trailing — `.cancellationAction` and `.confirmationAction` do this automatically; don't override with topBar placements
- watchOS: prefer SF Symbols for action labels at glance-and-tap sizes

### Anti-patterns prevented

- Standalone view with `.toolbar` — items silently disappear without a navigation container
- Conditional `if` inside `.toolbar` — rebuilds the whole toolbar on state change, causing flicker
- Two `.primaryAction` items per surface — violates HIG, SwiftUI lays them out unpredictably
- Regular `Spacer()` between separate `ToolbarItem`s — toolbar layout is not an HStack, the spacer is ignored
- `id:` on items without `.toolbar(id:)` on the parent — customization sheet stays empty
- Custom `.background` on a child view — use `.toolbarBackground(_:for:)` instead

### Code review checklist

A 10-item pre-merge checklist covering navigation containers, deprecation, sheet button placements, primary-action count, conditional content, spacer usage, customization setup, bottom-bar specifics, editor-role layouts, and Liquid Glass interaction in iOS 26 apps.

## Key Pattern

### Primary action in a navigation container

```swift
NavigationStack {
    Form {
        TextField("Title", text: $title)
    }
    .navigationTitle("New Task")
    .toolbar {
        ToolbarItem(placement: .primaryAction) {
            Button("Save") { save() }
                .disabled(title.isEmpty)
        }
    }
}
```

The `.primaryAction` placement adapts across platforms — top-trailing on iOS and iPadOS, primary toolbar slot on macOS, principal area on watchOS — so you don't need `#if os(...)` branches.

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) – `.toolbar` requires a navigation container; this skill covers the NavigationStack / NavigationSplitView it attaches to
- [swiftui-architecture](/skills/ui-design/swiftui-architecture) – view composition patterns that affect where toolbar modifiers belong
- [liquid-glass](/skills/ui-design/liquid-glass) – iOS 26 changes how toolbar backgrounds render; consult before customizing background materials
- [windows](/skills/macos/windows) – macOS `windowToolbarStyle`, MenuBarExtra, and window-toolbar integration
- [hig](/skills/ui-design/hig) – broader Human Interface Guidelines context for toolbar action prioritization

## Resources

**WWDC**: 2020-10146, 2021-10054, 2022-10054, 2024-10148, 2025-219, 2026-269

**Docs**: /swiftui/toolbar, /swiftui/toolbaritem, /swiftui/toolbaritemgroup, /swiftui/toolbarspacer, /swiftui/toolbaritemplacement, /swiftui/toolbarrole, /swiftui/customizabletoolbarcontent, /swiftui/toolbaritemplacement/topbarpinnedtrailing, /swiftui/toolbaroverflowmenu, /swiftui/toolbaritemvisibilitypriority
