---
name: axiom-liquid-glass-ref
description: Use when planning comprehensive Liquid Glass adoption across an app, auditing existing interfaces for Liquid Glass compatibility, implementing app icon updates, or understanding platform-specific Liquid Glass behavior - comprehensive reference guide covering all aspects of Liquid Glass adoption from WWDC 2025
license: MIT
compatibility: iOS/iPadOS 26+, macOS Tahoe+, tvOS, watchOS, visionOS 3+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-01"
---

# Liquid Glass Adoption — Reference Guide

## When to Use This Skill

Use when:
- Planning comprehensive Liquid Glass adoption across your entire app
- Auditing existing interfaces for Liquid Glass compatibility
- Implementing app icon updates with Icon Composer
- Understanding platform-specific Liquid Glass behavior (iOS, iPadOS, macOS, tvOS, watchOS)
- Migrating from previous materials (blur effects, custom translucency)
- Ensuring accessibility compliance with Liquid Glass interfaces
- Reviewing search, navigation, or organizational component updates

#### Related Skills
- Use `axiom-liquid-glass` for implementing the Liquid Glass material itself and design review pressure scenarios
- Use `axiom-swiftui-performance` for profiling Liquid Glass rendering performance
- Use `axiom-accessibility-diag` for accessibility testing

---

## Overview

Adopting Liquid Glass doesn't mean reinventing your app from the ground up. Start by building your app in the latest version of Xcode to see the changes. If your app uses standard components from SwiftUI, UIKit, or AppKit, your interface picks up the latest look and feel automatically on the latest platform releases.

#### Key Adoption Strategy
1. Build with latest Xcode SDKs
2. Run on latest platform releases
3. Review changes using this reference
4. Adopt best practices incrementally

---

## Visual Refresh

### What Changes Automatically

#### Standard Components Get Liquid Glass
- Navigation bars, tab bars, toolbars
- Sheets, popovers, action sheets
- Buttons, sliders, toggles, and controls
- Sidebars, split views, menus

#### How It Works
- Liquid Glass combines optical properties of glass with fluidity
- Forms distinct functional layer for controls and navigation
- Adapts in response to overlap, focus state, and environment
- Helps bring focus to underlying content

### Leverage System Frameworks

#### ✅ DO: Use Standard Components

Standard components from SwiftUI, UIKit, and AppKit automatically adopt Liquid Glass with minimal code changes.

```swift
// ✅ Standard components get Liquid Glass automatically
NavigationView {
    List(items) { item in
        Text(item.name)
    }
    .toolbar {
        ToolbarItem {
            Button("Add") { }
        }
    }
}
// Recompile with Xcode 26 → Liquid Glass applied
```

#### ❌ DON'T: Override with Custom Backgrounds

```swift
// ❌ Custom backgrounds interfere with Liquid Glass
NavigationView { }
    .background(Color.blue.opacity(0.5)) // Breaks Liquid Glass effects
    .toolbar {
        ToolbarItem { }
            .background(LinearGradient(...)) // Overlays system effects
    }
```

#### What to Audit
- Split views
- Tab bars
- Toolbars
- Navigation bars
- Any component with custom background/appearance

**Solution** Remove custom effects and let the system determine background appearance.

### Test with Accessibility Settings

Liquid Glass adapts to: Reduce Transparency (frostier), Increase Contrast (black/white borders), Reduce Motion (no elastic animations). Verify legibility maintained under each setting and that custom elements provide fallback experiences. For detailed accessibility testing workflows, see `axiom-liquid-glass` discipline skill.

```swift
app.launchArguments += ["-UIAccessibilityIsReduceTransparencyEnabled", "1",
    "-UIAccessibilityButtonShapesEnabled", "1", "-UIAccessibilityIsReduceMotionEnabled", "1"]
```

### Avoid Overusing Liquid Glass

Liquid Glass brings attention to underlying content. Overusing it on multiple custom controls distracts from content. Apply `.glassEffect()` only to important functional elements (navigation, primary actions) — not content cards, list rows, or decorative elements.

```swift
// ✅ Content layer: no glass. Navigation layer: glass on functional buttons only.
ZStack {
    ScrollView { ForEach(articles) { ArticleCard($0) } }
    VStack {
        Spacer()
        HStack {
            Button("Filter") { }.glassEffect()
            Spacer()
            Button("Sort") { }.glassEffect()
        }.padding()
    }
}
```

---

## App Icons

App icons now take on a design that's dynamic and expressive. Updates to the icon grid result in standardized iconography that's visually consistent across devices. App icons contain layers that dynamically respond to lighting and visual effects.

### Platform Support

Layered icons: iOS/iPadOS 26+, macOS Tahoe+, watchOS (circular mask). Appearance variants: default (light), dark, clear, tinted (Home Screen personalization).

### Design Principles

Design clean, simplified layers with solid fills and semi-transparent overlays. Let the system handle effects (reflection, refraction, shadow, blur, masking). Do NOT bake in pre-applied blur, manual shadows, hardcoded highlights, or fixed masking.

### Design Using Layers

Three layers: foreground (primary elements), middle (supporting), background (foundation). Export each layer as PNG or SVG at @1x/@2x/@3x with transparency preserved.

### Icon Composer

Included in Xcode 26+ (also standalone from developer.apple.com/design/resources). Drag and drop layers, add optional background, adjust attributes (opacity, position, scale), preview with system effects and all appearance variants, export directly to asset catalog.

### Preview Against Updated Grids

Grids: iOS/iPadOS/macOS use rounded rectangle mask; watchOS uses circular mask. Download from developer.apple.com/design/resources. Keep elements centered to avoid clipping, test at all sizes, verify all appearance variants look intentional.

---

## Controls

Controls have refreshed look across platforms and come to life during interaction. Knobs transform into Liquid Glass during interaction, buttons fluidly morph into menus/popovers. Hardware shape informs curvature of controls (rounder forms nestle into corners).

### Updated Appearance

Bordered buttons default to capsule shape (mini/small/medium on macOS retain rounded-rectangle). Knobs transform into glass during interaction; buttons morph into menus/popovers. New `controlSize(.extraLarge)` option; heights slightly taller on macOS. Use `controlSize(.small)` for backward-compatible high-density layouts. Standard controls adopt automatically — remove hard-coded `.frame()` dimensions.

### Review Updated Controls

Audit sliders, toggles, buttons, steppers, pickers, segmented controls, and progress indicators. Verify appearance matches interface, spacing looks natural, controls aren't cropped, and interaction feedback is responsive.

### Color in Controls

Use system colors (`.tint(.blue)`, `.accentColor`) — they adapt to light/dark contexts automatically. Avoid hard-coded RGB values (`Color(red:green:blue:)`) which may not adapt. Test in both modes and verify WCAG AA contrast ratios.

### Check for Crowding or Overlapping

Liquid Glass elements need breathing room. Use default `HStack` spacing (not `spacing: 4`) for glass buttons. Overcrowding or layering glass-on-glass creates visual noise. Use `GlassEffectContainer` when multiple glass elements must be close together.

### Optimize for Legibility with Scroll Edge Effects

Use `.scrollEdgeEffectStyle(.hard, for: .top)` to obscure content scrolling beneath controls. System bars (toolbars, navigation bars, tab bars) adopt this automatically; custom bars need it explicitly.

### Align Control Shapes with Containers

Use `containerRelativeShape()` to align control curvature with containers — creates concentric visual continuity from controls to sheets to windows to display.

### New Button Styles

Use built-in styles instead of custom glass effects: `.borderedProminent` (primary, with `.tint()`), `.bordered` (secondary), `.plain` + `.glassEffect()` (tertiary/custom). Each adapts to Liquid Glass automatically.

---

## Navigation

Liquid Glass applies to topmost layer where you define navigation. Key navigation elements like tab bars and sidebars float in this Liquid Glass layer to help people focus on underlying content.

### Clear Navigation Hierarchy

Maintain two distinct layers: **Navigation** (tab bar, sidebar, toolbar — Liquid Glass) floats above **Content** (articles, photos, data — no glass). Do NOT apply `.glassEffect()` to content items like list rows — glass on the content layer blurs the boundary and competes with navigation.

### Tab Bar Adapting to Sidebar

Use `.tabViewStyle(.sidebarAdaptable)` (iOS 26) to let the tab bar adapt to sidebar on iPad/macOS while remaining a tab bar on iPhone. Transitions fluidly with adaptive window sizes.

```swift
TabView {
    ContentView().tabItem { Label("Home", systemImage: "house") }
    SearchView().tabItem { Label("Search", systemImage: "magnifyingglass") }
}
.tabViewStyle(.sidebarAdaptable)
```

### Split Views for Sidebar + Inspector Layouts

Use `NavigationSplitView` with sidebar, content, and detail columns. Liquid Glass applies automatically to sidebars and inspectors. iOS adapts column visibility; iPadOS/macOS shows all columns on large screens.

```swift
NavigationSplitView {
    List(folders, selection: $selectedFolder) { Label($0.name, systemImage: $0.icon) }
        .navigationTitle("Folders")
} content: {
    List(items, selection: $selectedItem) { ItemRow($0) }
} detail: {
    InspectorView(item: selectedItem)
}
```

### Check Content Safe Areas

Verify content peeks through appropriately beneath sidebars/inspectors. Use `.safeAreaInset(edge:)` when content needs to account for sidebar/inspector space.

#### Padding with Edge-to-Edge Glass

When glass extends edge-to-edge via `.ignoresSafeArea()`, use `.safeAreaPadding()` (not `.padding()`) on the content layer to respect device safe areas (notch, Dynamic Island, home indicator):

```swift
// ❌ .padding(.horizontal, 20) — doesn't account for safe areas
// ✅ .safeAreaPadding(.horizontal, 20) — 20pt beyond safe areas
```

Applies to: full-screen sheets with materials, edge-to-edge toolbars, floating panels, custom glass navigation bars. Requires iOS 17+. See `axiom-swiftui-layout-ref` for full `.safeAreaPadding()` vs `.padding()` guidance.

Verify: content visible beneath sidebar/inspector, not cropped, peek-through looks intentional, properly inset from notch/Dynamic Island/home indicator.

### Background Extension Effect

Mirrors and blurs content under sidebar/inspector for an immersive edge-to-edge feel, without actually scrolling content there. Best for hero images, photo galleries, and media-rich split views.

```swift
NavigationSplitView {
    SidebarView()
} detail: {
    DetailView()
        .backgroundExtensionEffect()
}
```

### Automatically Minimize Tab Bar (iOS)

Tab bars can recede when scrolling via `.tabBarMinimizeBehavior()` (iOS 26). Options: `.onScrollDown` (recommended for reading/media apps), `.onScrollUp`, `.automatic`, `.never`. Tab bar expands when scrolling in opposite direction.

---

## Menus and Toolbars

Menus have refreshed look across platforms. They adopt Liquid Glass, and menu items for common actions use icons to help people quickly scan and identify actions. iPadOS now has menu bar for faster access to common commands.

### Cross-Platform Menu Consistency

Menus now have consistent layout across iOS and macOS — icons on leading edge, same API (`Label` or standard control initializers) produces the same visual result on both platforms.

### Menu Icons for Standard Actions

#### Automatic Icon Adoption

```swift
// ✅ Standard selectors get icons automatically
Menu("Actions") {
    Button(action: cut) {
        Text("Cut")
    }
    Button(action: copy) {
        Text("Copy")
    }
    Button(action: paste) {
        Text("Paste")
    }
}
// System uses selector to determine icon
// cut() → scissors icon
// copy() → documents icon
// paste() → clipboard icon
```

#### Standard Selectors
- `cut()` → ✂️ scissors
- `copy()` → 📄 documents
- `paste()` → 📋 clipboard
- `delete()` → 🗑️ trash
- `share()` → ↗️ share arrow
- Many more...

#### Custom Actions
```swift
// ✅ Provide icon for custom actions
Button {
    customAction()
} label: {
    Label("Custom Action", systemImage: "star.fill")
}
```

### Match Top Menu Actions to Swipe Actions

#### For consistency and predictability

```swift
// ✅ Swipe actions match contextual menu
List(emails) { email in
    EmailRow(email)
        .swipeActions(edge: .leading) {
            Button("Archive", systemImage: "archivebox") {
                archive(email)
            }
        }
        .swipeActions(edge: .trailing) {
            Button("Delete", systemImage: "trash", role: .destructive) {
                delete(email)
            }
        }
        .contextMenu {
            // ✅ Same actions appear at top
            Button("Archive", systemImage: "archivebox") {
                archive(email)
            }
            Button("Delete", systemImage: "trash", role: .destructive) {
                delete(email)
            }

            Divider()

            // Additional actions below
            Button("Mark Unread") { }
        }
}
```

**Why** Users expect swipe actions and menu actions to match. Consistency builds trust and predictability.

### Toolbar Grouping, Spacers, and Morphing

See `axiom-swiftui-26-ref` for complete toolbar API coverage: `ToolbarSpacer`, `ToolbarItemGroup` visual grouping, `.sharedBackgroundVisibility(.hidden)`, toolbar morphing, `DefaultToolbarItem`, user-customizable toolbars, monochrome icon rendering, backward-compatible toolbar labels, and floating glass buttons.

**Liquid Glass-specific toolbar guidance:**
- Pick one style (icons OR text) per toolbar background group — mixing creates inconsistent visual weight under glass
- Use `.tint()` only to convey meaning (call to action, next step), not for decoration — monochrome reduces visual noise under Liquid Glass

### Provide Accessibility Labels for Icons

All icon-only buttons need `.accessibilityLabel("Action Name")` for VoiceOver and Voice Control users. Use `Label("Share", systemImage: "square.and.arrow.up")` to get automatic accessibility support.

### Audit Toolbar Customizations

Verify custom spacers, items, and visibility work with Liquid Glass backgrounds. Common issue: conditionally hiding content inside `ToolbarItem` creates empty pills — move the `if` outside to hide the entire `ToolbarItem` instead.

---

## Windows and Modals

Windows adopt rounder corners to fit controls and navigation elements. iPadOS apps show window controls and support continuous window resizing. Sheets and action sheets adopt Liquid Glass with increased corner radius.

### Arbitrary Window Sizes (iPadOS)

iPadOS 26 windows resize continuously (no preset size transitions). Use `.windowResizability(.contentSize)` and flexible layouts. Remove hard-coded size assumptions and test at various window sizes.

### Split Views for Fluid Column Resizing

Use `NavigationSplitView(columnVisibility:)` for automatic content reflow during continuous window resizing — avoids manual layout calculations and custom animation code.

### Use Layout Guides and Safe Areas

Use `.safeAreaInset(edge:)` so content automatically adjusts around window controls, title bars, and chrome.

### Sheets: Increased Corner Radius

Sheets have increased corner radius; half sheets are inset from edge (content peeks through) and become more opaque when transitioning to full height. Check that content isn't cropped by rounder corners and that background peek-through looks intentional.

### Remove presentationBackground

Remove `.presentationBackground()` from sheets — the system applies Liquid Glass sheet material automatically. Custom backgrounds interfere with the new material.

### Audit Sheet/Popover Backgrounds

Remove custom `VisualEffectView`/`UIBlurEffect` backgrounds from popovers and sheets. The system applies Liquid Glass automatically — no background modifier needed.

### Action Sheets: Inline Appearance

Action sheets now originate from the source element (not bottom edge) and allow interaction with other parts of the interface. Use `.confirmationDialog()` attached to the triggering button — the system positions the sheet automatically.

---

## Organization and Layout

Lists, tables, and forms have larger row height and padding to give content room to breathe. Sections have increased corner radius to match curvature of controls.

### Larger Row Height and Padding

Lists, tables, forms, and sections all have increased height, padding, spacing, and corner radius. Standard components adopt automatically. Remove hard-coded `.frame(height:)` and `.padding(.vertical:)` — let the system determine row height and padding.

### Section Header Capitalization

iOS 26 no longer uppercases section headers — they render exactly as provided. Update to title-style capitalization: `Section(header: Text("User Settings"))` not `"user settings"`.

### Adopt Forms for Platform-Optimized Layouts

Use `.formStyle(.grouped)` for automatic row height, padding, spacing, and section corner radius that matches controls across platforms.

---

## Search

Platform conventions for search location and behavior optimize experience for each device. Review search field design conventions to provide engaging search experience.

### Keyboard Layout When Activating Search

#### What Changed (iOS)

When a person taps search field to give it focus, it slides upwards as keyboard appears.

#### Testing
- Tap search field
- Verify smooth upward slide
- Keyboard appears without covering search field
- Consistent with system search experiences (Spotlight, Safari)

#### No Code Changes Required
```swift
// ✅ Existing searchable modifier adopts new behavior
List(items) { item in
    Text(item.name)
}
.searchable(text: $searchText)
```

### Semantic Search Tabs

For Tab API patterns including `.tabRole(.search)`, see swiftui-nav-ref skill Section 5 (Tab Navigation Integration).

---

## Platform Considerations

Liquid Glass can have distinct appearance and behavior across platforms, contexts, and input methods. Test across devices to understand material appearance.

### watchOS and tvOS

| Platform | Adoption | Key Requirement |
|----------|----------|-----------------|
| watchOS | Automatic on latest release, even without latest SDK | Use standard toolbar APIs and `.buttonStyle(.bordered)` from watchOS 10 |
| tvOS | Focus-based — glass appears when controls gain focus (Apple TV 4K 2nd gen+) | Use `.focusable()` on standard controls; for custom controls, apply `.glassEffect()` with `@FocusState`-driven opacity |

### glassBackgroundEffect()

For custom views that need to reflect content behind them (not just apply glass material on top), use `.glassBackgroundEffect()`. This creates a glass-like background that shows through underlying content, distinct from `.glassEffect()` which applies glass as an overlay material.

```swift
// Custom floating panel with glass background reflecting content behind it
struct FloatingPanel: View {
    var body: some View {
        VStack {
            Text("Panel Content")
            // ...
        }
        .padding()
        .glassBackgroundEffect() // Reflects content beneath, not on top
    }
}
```

**`.glassEffect()` vs `.glassBackgroundEffect()`**: Use `.glassEffect()` for controls and navigation elements (buttons, toolbars). Use `.glassBackgroundEffect()` for content containers that should show through to underlying layers (panels, cards that need depth).

### ScrollView + Glass Interaction

When Liquid Glass elements overlay scrollable content, handle clipping and visibility carefully:

```swift
ZStack {
    ScrollView {
        LazyVStack {
            ForEach(items) { item in
                ItemRow(item)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear.frame(height: 80) // Space for floating glass controls
        }
    }

    VStack {
        Spacer()
        HStack {
            Button("Action") { }
                .glassEffect()
        }
        .padding()
    }
}
```

**Common issue**: Glass elements can clip or lose their effect at scroll view bounds. Use `.clipped()` on the scroll content (not the glass element) and ensure glass elements are outside the scroll view's hierarchy, not inside it.

### UIBlurEffect Migration Mapping

| Legacy (Pre-iOS 26) | Liquid Glass Equivalent |
|---------------------|------------------------|
| `UIBlurEffect(style: .systemMaterial)` | `.glassEffect()` (standard) |
| `UIBlurEffect(style: .systemUltraThinMaterial)` | `.glassEffect(.clear)` (with conditions) |
| `UIBlurEffect(style: .systemChromeMaterial)` | System toolbar/navigation glass (automatic) |
| `UIVisualEffectView` with blur | Remove entirely — use `.glassEffect()` on SwiftUI view |
| `.background(.thinMaterial)` | `.glassEffect()` or keep material (adapts automatically) |
| `.background(.ultraThinMaterial)` | `.glassBackgroundEffect()` for content containers |
| Custom `NSVisualEffectView` (macOS) | `.glassEffect()` or system components |

**Migration steps**: (1) Remove `UIVisualEffectView`/`NSVisualEffectView` wrappers, (2) Replace with `.glassEffect()` on the SwiftUI view, (3) Test with Reduce Transparency to verify fallback, (4) Profile performance — glass effects use GPU compositing.

### Combining Custom Liquid Glass Effects

Wrap multiple `.glassEffect()` views in `GlassEffectContainer { }` to optimize rendering, enable fluid morphing between glass shapes, and reduce compositor overhead. Use for nearby glass elements, morphing animations, and performance-critical interfaces.

### Performance Testing

Profile scrolling, animations, memory, and CPU with Instruments (Time Profiler, SwiftUI, Allocations, Core Animation). See `axiom-swiftui-performance` for SwiftUI Instrument workflows and `axiom-performance-profiling` for Instruments decision trees.

### Backward Compatibility

Add `UIDesignRequiresCompatibility = true` to Info.plist to ship with iOS 26 SDK while maintaining iOS 18 appearance (Liquid Glass disabled, previous blur/material styles used). Migration strategy: ship with key enabled, audit changes in separate build, update incrementally, remove key when ready.

---

## Quick Reference: API Checklist

### Core Liquid Glass APIs
- [ ] `glassEffect()` - Apply Liquid Glass material
- [ ] `glassEffect(.clear)` - Clear variant (requires 3 conditions)
- [ ] `glassEffect(in: Shape)` - Custom shape
- [ ] `glassBackgroundEffect()` - For custom views reflecting content

### Scroll Edge Effects
- [ ] `scrollEdgeEffectStyle(_:for:)` - Maintain legibility where glass meets scrolling content
- [ ] `.hard` style for pinned accessory views
- [ ] `.soft` style for gradual fade

### Controls and Shapes
- [ ] `containerRelativeShape()` - Align control shapes with containers
- [ ] `.borderedProminent` button style
- [ ] `.bordered` button style
- [ ] System colors with `.tint()` for adaptation

### Navigation
- [ ] `.tabViewStyle(.sidebarAdaptable)` - Tab bar adapts to sidebar
- [ ] `.tabBarMinimizeBehavior(_:)` - Minimize on scroll
- [ ] `.tabRole(.search)` - Semantic search tabs
- [ ] `NavigationSplitView` for sidebar + inspector layouts

### Toolbars and Menus
- [ ] `ToolbarSpacer(.fixed)` - Separate toolbar groups
- [ ] Standard selectors for automatic menu icons
- [ ] Match contextual menu actions to swipe actions

### Organization and Layout
- [ ] `.formStyle(.grouped)` - Platform-optimized form layouts
- [ ] Title-style capitalization for section headers
- [ ] Respect automatic row height and padding

### Performance
- [ ] `GlassEffectContainer` - Combine multiple glass effects
- [ ] Profile with Instruments
- [ ] Test with accessibility settings

### Backward Compatibility
- [ ] `UIDesignRequiresCompatibility` in Info.plist (if needed)

---

## Audit Checklist

Use this checklist when auditing app for Liquid Glass adoption. 30 highest-impact items grouped by category:

### Build and Test
- [ ] Built with Xcode 26 SDK and run on latest platform releases
- [ ] Tested with Reduce Transparency, Increase Contrast, and Reduce Motion
- [ ] Performance profiled with Instruments (scrolling, animations, memory)

### Remove Custom Overrides
- [ ] Custom backgrounds removed from navigation bars, toolbars, tab bars
- [ ] `presentationBackground` removed from sheets and popovers
- [ ] Hard-coded control heights and row heights removed
- [ ] Custom blur/material backgrounds removed from sheets and popovers

### Icons and App Icon
- [ ] App icon uses foreground/middle/background layers, composed in Icon Composer
- [ ] All appearance variants tested (light/dark/clear/tinted)
- [ ] Accessibility labels provided for all toolbar/menu icons

### Controls
- [ ] New capsule button shapes reviewed; `controlSize(.small)` for high-density layouts
- [ ] System colors used (not hard-coded RGB); `.borderedProminent`/`.bordered` adopted
- [ ] Controls have adequate spacing (no crowding glass-on-glass)
- [ ] Scroll edge effects applied where glass meets scrolling content

### Navigation and Layout
- [ ] Clear hierarchy: navigation layer (glass) vs content layer (no glass)
- [ ] Tab bar adapts to sidebar where appropriate (`.sidebarAdaptable`)
- [ ] Content safe areas checked; `.safeAreaPadding()` for edge-to-edge glass
- [ ] Background extension effect considered for split views
- [ ] Section headers updated to title-style capitalization
- [ ] `.formStyle(.grouped)` adopted for forms

### Menus and Toolbars
- [ ] Standard selectors used for automatic menu icons
- [ ] Swipe actions match contextual menu actions
- [ ] Toolbar items grouped logically (see `axiom-swiftui-26-ref`)

### Windows and Modals
- [ ] Arbitrary window sizes supported (iPadOS); flexible layouts used
- [ ] Sheet content checked around increased corner radius

### Platform
- [ ] watchOS: Standard toolbar APIs and button styles adopted
- [ ] tvOS: Standard focus APIs for Liquid Glass on focus
- [ ] `GlassEffectContainer` used for multiple nearby glass effects
- [ ] `UIDesignRequiresCompatibility` key considered if needed

---

## Resources

**WWDC**: 2025-219, 2025-323 (Build a SwiftUI app with the new design)

**Docs**: /TechnologyOverviews/liquid-glass, /TechnologyOverviews/adopting-liquid-glass, /design/Human-Interface-Guidelines/materials

**Sample Code**: /SwiftUI/Landmarks-Building-an-app-with-Liquid-Glass

**Skills**: axiom-liquid-glass, axiom-swiftui-performance, axiom-swiftui-debugging, axiom-accessibility-diag

---

**Last Updated**: 2025-12-01
**Minimum Platform**: iOS/iPadOS 26, macOS Tahoe, tvOS, watchOS, visionOS 3
**Xcode Version**: Xcode 26+
**Skill Type**: Reference (comprehensive adoption guide)
