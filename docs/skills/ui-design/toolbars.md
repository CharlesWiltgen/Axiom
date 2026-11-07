---
name: swiftui-toolbars
description: Use when adding, customizing, or debugging SwiftUI toolbars on iOS or macOS — .toolbar modifier, ToolbarItem, ToolbarItemGroup, ToolbarSpacer, placements, customization, ToolbarRole
---

# SwiftUI Toolbars

Guidance for SwiftUI toolbar content (`.toolbar`) on iOS, iPadOS, macOS, watchOS, and visionOS. Covers choosing a placement, customizable toolbars, the iOS 26 `ToolbarSpacer`, the HIG rules for sheet buttons, and the mistakes that silently break toolbars.

## When to Use

Use this skill when you're:
- Adding action buttons to a navigation bar, bottom bar, or window toolbar
- Choosing between `ToolbarItem`, `ToolbarItemGroup`, and `ToolbarSpacer`
- Picking a `ToolbarItemPlacement` (semantic, like `.primaryAction`, or positional, like `.topBarTrailing`)
- Building a customizable toolbar where users can rearrange items
- Setting toolbar visibility, background material, or color scheme
- Adopting `ToolbarSpacer` for visual breaks (iOS 26, macOS 26)
- Adding a navigation subtitle or custom content under the large title (iOS 26)
- Controlling overflow and bar minimization (OS 27)
- Giving each of two stacked `NavigationStack`s its own bar inside a split view (iOS 27.3)
- Migrating from the deprecated `.navigationBarLeading` and `.navigationBarTrailing`
- Debugging missing, misplaced, or flickering toolbar items
- Reviewing toolbar code before shipping

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "How do I add a Save button to my navigation bar?"
- "My toolbar items aren't showing up. What's wrong?"
- "Should I use `ToolbarItem` or `ToolbarItemGroup`?"
- "How do I make my toolbar customizable so users can rearrange items?"
- "I'm getting a deprecation warning on `.navigationBarLeading`. What's the replacement?"
- "Why won't a `Spacer()` between my toolbar items compile?"
- "What does Apple's HIG say about Cancel and Done buttons in a sheet?"
- "How do I control which toolbar items collapse into the overflow menu?" (iOS 27)
- "Which toolbar items stay visible in iPhone Duo's vertical bar?"
- "How do I make the navigation bar minimize as the user scrolls?" (iOS 27)
- "How do I wire up EditButton and editMode for my List?"
- "How do I show an unread count under my navigation title?" (iOS 26)
- "Why is my `.largeSubtitle` content centered instead of aligned with the title?"
- "Two `NavigationStack`s in my split view's detail column share one toolbar. How do I give each its own?" (iOS 27.3)

## What This Skill Provides

### Placement Decisions

- Semantic placements (`.primaryAction`, `.confirmationAction`, `.cancellationAction`, `.destructiveAction`) versus positional placements (`.topBarLeading`, `.topBarTrailing`, `.bottomBar`)
- Cross-platform behavior: why `.primaryAction` beats `.topBarTrailing` when you want correct iOS, macOS, and watchOS layout without branching
- A full `ToolbarItemPlacement` reference with iOS, iPadOS, and macOS columns

### Pattern Catalog

- A basic toolbar with one primary action (Save, Done, or Add)
- The sheet `.confirmationAction` and `.cancellationAction` pair, with the HIG button-placement rules (updated 2026-03-24)
- Separate `ToolbarItem`s versus a `ToolbarItemGroup`, and when each is correct
- `ToolbarSpacer(.fixed)` and `ToolbarSpacer(.flexible)` for visual breaks (iOS 26, macOS 26)
- Customizable toolbars with `.toolbar(id:)`, a per-item `id:`, and `customizationBehavior`
- `.toolbarRole(.editor)` for three-column `NavigationSplitView` layouts
- `.toolbarContainerBehavior(.local)` for separate bars on stacked `NavigationStack`s inside a split view (iOS 27.3; `.local` is iOS only)
- Toolbar visibility, background material, and color scheme per bar
- The macOS `windowToolbarStyle`, set on the scene rather than the view
- Search in the toolbar with `.searchable`, never a `TextField` item
- Overflow and visibility priority with `ToolbarOverflowMenu`, `.visibilityPriority`, and `.topBarPinnedTrailing` (iOS and visionOS 27; `.visibilityPriority` reaches every platform at 27, and macOS at 26.1)
- Bar minimization on scroll with `toolbarMinimizationBehavior`, safe-area adjustment, and restoration, per `ToolbarPlacement` (OS 27)
- `EditButton` and `editMode` wiring for `List` editing, and the direct-manipulation alternatives on the Mac
- Navigation title alignment (iOS 27.2): `toolbarTitleAlignment(_:)` with `.automatic`, `.leading`, or `.center`, reading the resolved alignment from the environment in a custom title, and the `#if os(iOS)` gate for shared code
- Navigation subtitles (iOS 26): `navigationSubtitle` and the `.title`, `.subtitle`, `.largeTitle`, and `.largeSubtitle` placements, what happens when the title collapses, alignment, and the fallback for iOS 18 and for apps that keep `UIDesignRequiresCompatibility`, where subtitles don't render

### HIG Sheet Button Rules

- Always pair a confirmation button with Cancel or Back, because a solo Done implies finishing the task is the only exit
- Don't show Cancel, Done, and Back together, because too many dismiss and commit buttons confuse the exit path
- On iOS and iPadOS, Cancel goes leading and Done trailing; `.cancellationAction` and `.confirmationAction` do this automatically, so don't override them with top-bar placements
- On watchOS, prefer SF Symbols for action labels at glance-and-tap sizes

### Anti-Patterns Prevented

- `.toolbar` on a standalone view, whose items silently disappear without a navigation container
- A conditional `if` inside `.toolbar`, which rebuilds the whole toolbar on state change and causes flicker
- Two `.primaryAction` items on one surface, which violates the HIG and lays out unpredictably
- A regular `Spacer()` between separate `ToolbarItem`s, which isn't toolbar content and doesn't compile; use `ToolbarSpacer`
- `id:` on items without `.toolbar(id:)` on the parent, which leaves the customization sheet empty
- A custom `.background` on a child view instead of `.toolbarBackground(_:for:)`
- Icon-only customizable or overflowing items, which need a `Label` so their menu rows have names

### Review and Troubleshooting

A pre-merge checklist covering navigation containers, deprecations, sheet button placements, primary-action count, conditional content, spacers, customization setup, bottom-bar specifics, editor-role layouts, Liquid Glass in iOS 26 apps, iOS 27 overflow gating, and navigation subtitles, plus a symptom-to-fix troubleshooting table.

## Key Pattern

### Primary Action in a Navigation Container

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

The `.primaryAction` placement adapts across platforms (top-trailing on iOS and iPadOS, the primary toolbar slot on macOS, and the principal area on watchOS), so you don't need `#if os(...)` branches.

## Documentation Scope

This page documents the `toolbars` skill (in the `axiom-swiftui` suite), which your assistant draws on when you add, customize, or debug SwiftUI toolbars.

- For multi-token search, scopes, suggestions, and programmatic search control, see [swiftui-search-ref](/reference/swiftui-search-ref)

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) – The `NavigationStack` or `NavigationSplitView` a toolbar needs to appear at all
- [liquid-glass](/skills/ui-design/liquid-glass) – How iOS 26 renders toolbar backgrounds; read it before customizing background materials
- [windows](/skills/macos/windows) – The macOS `windowToolbarStyle` choice, `MenuBarExtra`, and window-toolbar integration
- [menus-and-commands](/skills/macos/menus-and-commands) – Menu bar commands and keyboard shortcuts, the Mac's other home for actions
- [iphone-duo](/skills/ui-design/iphone-duo) – iPhone Duo's vertical bars, where these placements and visibility priorities set item order and overflow
- [uikit-modernization](/skills/ui-design/uikit-modernization) – The UIKit side of navigation subtitles and bar minimization, for UIKit screens in the same app
- [hig](/skills/ui-design/hig) – Broader Human Interface Guidelines context for prioritizing actions

## Resources

**WWDC**: 2020-10146, 2021-10054, 2022-10054, 2024-10148, 2025-219, 2025-284, 2026-269

**Docs**: /swiftui/toolbaritem, /swiftui/toolbaritemgroup, /swiftui/toolbarspacer, /swiftui/toolbaritemplacement, /swiftui/toolbaritemplacement/topbarpinnedtrailing, /swiftui/toolbaritemplacement/title, /swiftui/toolbaritemplacement/subtitle, /swiftui/toolbaritemplacement/largetitle, /swiftui/toolbaritemplacement/largesubtitle, /swiftui/view/navigationsubtitle(_:), /swiftui/toolbarrole, /swiftui/customizabletoolbarcontent, /swiftui/toolbaroverflowmenu, /swiftui/toolbaritemvisibilitypriority, /swiftui/view/toolbarminimizationbehavior(_:for:), /swiftui/editbutton, /swiftui/editmode
