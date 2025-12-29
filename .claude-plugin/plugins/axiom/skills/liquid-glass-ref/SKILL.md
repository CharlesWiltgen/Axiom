---
name: liquid-glass-ref
description: Use when planning comprehensive Liquid Glass adoption across an app, auditing existing interfaces for Liquid Glass compatibility, implementing app icon updates, or understanding platform-specific Liquid Glass behavior - comprehensive reference guide covering all aspects of Liquid Glass adoption from WWDC 2025
version: 1.0.0
last_updated: 2025-12-01
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+, tvOS, watchOS, visionOS 3+
skill_type: reference
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
- Use `liquid-glass` for implementing the Liquid Glass material itself and design review pressure scenarios
- Use `swiftui-performance` for profiling Liquid Glass rendering performance
- Use `accessibility-diag` for accessibility testing

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

#### Settings That Affect Liquid Glass
- Reduce Transparency (makes glass frostier)
- Increase Contrast (makes elements predominantly black/white)
- Reduce Motion (decreases animation intensity)

#### Testing Checklist
- [ ] Enable Reduce Transparency → verify frosted appearance works
- [ ] Enable Increase Contrast → verify contrasting borders appear
- [ ] Enable Reduce Motion → verify elastic properties disabled
- [ ] All settings → verify legibility maintained
- [ ] Standard components adapt automatically
- [ ] Custom elements provide fallback experience

#### How to Test
```swift
// Launch arguments for accessibility testing
app.launchArguments += [
    "-UIAccessibilityIsReduceTransparencyEnabled", "1",
    "-UIAccessibilityButtonShapesEnabled", "1",
    "-UIAccessibilityIsReduceMotionEnabled", "1"
]
```

### Avoid Overusing Liquid Glass

#### ❌ DON'T: Apply to Every Custom Control

Liquid Glass seeks to bring attention to underlying content. Overusing this material in multiple custom controls distracts from content and provides subpar user experience.

#### ✅ DO: Limit to Important Functional Elements

```swift
// ✅ Selective application to navigation layer
struct ContentView: View {
    var body: some View {
        ZStack {
            // Content layer - no glass
            ScrollView {
                ForEach(articles) { article in
                    ArticleCard(article) // No glass
                }
            }

            // Navigation layer — Liquid Glass
            VStack {
                Spacer()
                HStack {
                    Button("Filter") { }
                        .glassEffect() // ✅ Important functional element
                    Spacer()
                    Button("Sort") { }
                        .glassEffect() // ✅ Important functional element
                }
                .padding()
            }
        }
    }
}
```

---

## App Icons

App icons now take on a design that's dynamic and expressive. Updates to the icon grid result in standardized iconography that's visually consistent across devices. App icons contain layers that dynamically respond to lighting and visual effects.

### Platform Support

#### Layered Icons
- iOS 26+
- iPadOS 26+
- macOS Tahoe+
- watchOS (rounded rectangle → circular mask)

#### Appearance Variants
- Default (light)
- Dark
- Clear
- Tinted (Home Screen personalization)

### Design Principles

#### Key Principles
1. **Visually consistent** across platforms
2. **Optically balanced** design
3. **Simplified design** with solid, filled, overlapping semi-transparent shapes
4. **Let system handle effects** (masking, blurring, reflection, refraction)

#### ❌ DON'T: Include System Effects in Design

```
❌ Design includes:
   - Pre-applied blur
   - Manual shadows
   - Hardcoded highlights
   - Fixed masking
```

#### ✅ DO: Design Clean Layers

```
✅ Design includes:
   - Clean vector shapes
   - Solid fills
   - Semi-transparent overlays
   - Foreground/middle/background separation

   System automatically adds:
   - Reflection, refraction
   - Shadow, blur, highlights
   - Masking to final shape
```

### Design Using Layers

#### Layer Structure
- **Foreground Layer**: Primary visual elements
- **Middle Layer**: Supporting elements
- **Background Layer**: Foundation elements

#### Export from Design App
```
Export settings:
- Format: PNG or vector (SVG recommended)
- Resolution: @1x, @2x, @3x
- Transparency: Preserved
- One file per layer
```

#### System-Applied Effects
- Reflection (light bouncing off surface)
- Refraction (light bending through material)
- Shadow (depth and elevation)
- Blur (atmospheric depth)
- Highlights (light sources)

### Icon Composer

#### Compose and Preview

Icon Composer app (included in Xcode 26+):
1. Drag and drop exported layers
2. Add background (optional - system provides default for irregular shapes)
3. Create layer groupings
4. Adjust layer attributes (opacity, position, scale)
5. Preview with system effects and appearance variants

#### Download Icon Composer
- Included in Xcode 26+
- Standalone: https://developer.apple.com/design/resources/

#### Capabilities
- Real-time preview with system effects
- Light/dark/clear/tinted appearance previews
- Layer management (order, opacity, grouping)
- Export asset catalog directly

### Preview Against Updated Grids

#### Grid Updates
- iOS/iPadOS/macOS: Rounded rectangle mask
- watchOS: Circular mask

#### What to Check
- Keep elements centered to avoid clipping
- Irregular shapes receive system-provided background
- Test at all sizes (small, medium, large)

#### Download Grids
https://developer.apple.com/design/resources/

#### Testing Checklist
- [ ] Icon centered within grid
- [ ] No critical elements clipped by mask
- [ ] Looks good at all sizes
- [ ] Appears balanced with system-provided background (if irregular)
- [ ] All appearance variants (light/dark/clear/tinted) look intentional

#### Example Issue
```
❌ Problem: Logo text clipped at edges
✅ Solution: Center design, reduce size to fit safe area
```

---

## Controls

Controls have refreshed look across platforms and come to life during interaction. Knobs transform into Liquid Glass during interaction, buttons fluidly morph into menus/popovers. Hardware shape informs curvature of controls (rounder forms nestle into corners).

### Updated Appearance

#### What Changed
- Rounder forms (inspired by hardware curvature)
- Knobs transform into Liquid Glass during interaction
- Buttons morph into menus/popovers
- Extra-large size option for labels and accents

#### Automatic Adoption
```swift
// ✅ Standard controls adopt changes automatically
Slider(value: $volume)
Toggle("Enabled", isOn: $isEnabled)
Button("Action") { }
```

#### If you hard-coded layout metrics
```swift
// ❌ Hard-coded dimensions may break
Slider(value: $volume)
    .frame(width: 250, height: 44) // May not match new dimensions

// ✅ Use automatic sizing
Slider(value: $volume)
```

### Review Updated Controls

#### Controls to Audit
- Sliders (knob transforms to glass)
- Toggles (knob transforms to glass)
- Buttons (morph into menus/popovers)
- Steppers
- Pickers
- Segmented controls
- Progress indicators

#### What to Check
- Appearance matches rest of interface
- Spacing around controls looks natural
- Controls not cropped by containers
- Interaction feedback feels responsive

### Color in Controls

#### ✅ DO: Use System Colors

```swift
// ✅ System colors adapt to light/dark contexts
Button("Primary") { }
    .tint(.accentColor)

Toggle("Feature", isOn: $enabled)
    .tint(.blue) // System blue adapts
```

#### ❌ DON'T: Hard-code Custom Colors

```swift
// ❌ May not adapt to context
Button("Primary") { }
    .foregroundColor(Color(red: 0.2, green: 0.4, blue: 0.8))
```

#### Legibility Guidelines
- Be judicious with color in controls and navigation
- Leverage system colors for automatic adaptation
- Test in light and dark modes
- Verify contrast ratios (WCAG AA minimum)

### Check for Crowding or Overlapping

#### ❌ AVOID: Crowding Controls

```swift
// ❌ Controls too close together
HStack(spacing: 4) { // Too tight
    Button("Action 1") { }.glassEffect()
    Button("Action 2") { }.glassEffect()
    Button("Action 3") { }.glassEffect()
}
```

#### ✅ DO: Use Standard Spacing

```swift
// ✅ System spacing feels natural
HStack {
    Button("Action 1") { }.glassEffect()
    Button("Action 2") { }.glassEffect()
    Button("Action 3") { }.glassEffect()
}
```

**Why** Liquid Glass elements need breathing room. Overcrowding or layering glass on glass creates visual noise.

### Optimize for Legibility with Scroll Edge Effects

**Problem** Content scrolling beneath controls can reduce legibility.

**Solution** `scrollEdgeEffectStyle(_:for:)`

```swift
// ✅ Obscure content scrolling beneath controls
ScrollView {
    LazyVStack {
        ForEach(items) { item in
            ItemRow(item)
        }
    }
}
.scrollEdgeEffectStyle(.hard, for: .top) // Maintain legibility at top edge
```

#### System bars adopt this automatically
- Toolbars
- Navigation bars
- Tab bars

#### Custom bars need registration
```swift
// Custom bar with controls/text/icons
CustomToolbar()
    .scrollEdgeEffectStyle(.hard, for: .top)
```

### Align Control Shapes with Containers

**Principle** Shape of hardware informs curvature throughout interface.

#### Use `containerRelativeShape()`

```swift
// ✅ Control shape aligns with container curvature
Button("Action") { }
    .containerRelativeShape(.roundedRectangle)
```

#### Creates visual continuity
- Controls → concentric to sheets
- Sheets → concentric to windows
- Windows → concentric to display

**Result** Nested elements feel visually harmonious.

### New Button Styles

#### Instead of custom Liquid Glass effects, use built-in styles

#### `.borderedProminent`
```swift
Button("Primary Action") { }
    .buttonStyle(.borderedProminent)
    .tint(.blue)
// Filled button with Liquid Glass adaptation
```

#### `.bordered`
```swift
Button("Secondary Action") { }
    .buttonStyle(.bordered)
// Bordered button with Liquid Glass effects
```

#### `.plain` with Liquid Glass
```swift
Button("Tertiary") { }
    .buttonStyle(.plain)
    .glassEffect()
// Custom glass application for specific needs
```

**Best Practice** Use `.borderedProminent` for primary actions, `.bordered` for secondary, `.plain` for tertiary.

---

## Navigation

Liquid Glass applies to topmost layer where you define navigation. Key navigation elements like tab bars and sidebars float in this Liquid Glass layer to help people focus on underlying content.

### Clear Navigation Hierarchy

#### ✅ DO: Separate Content from Navigation

```
┌─────────────────────────────────┐
│  Navigation Layer (Liquid Glass)│  ← Tab bar, sidebar, toolbar
│  • Clear functional layer       │
│  • Floats above content         │
├─────────────────────────────────┤
│  Content Layer (No Glass)       │  ← Articles, photos, data
│  • Underlying content           │
│  • Focus of user attention      │
└─────────────────────────────────┘
```

#### ❌ DON'T: Blur the Boundary

```swift
// ❌ Content and navigation compete
List(items) { item in
    ItemRow(item)
        .glassEffect() // ❌ Content layer shouldn't have glass
}
```

**Why** Clear separation establishes distinct functional layers, helping users understand what's navigation vs content.

### Tab Bar Adapting to Sidebar

#### Automatic Adaptation

```swift
// ✅ Tab bar adapts to sidebar depending on context
TabView {
    ContentView()
        .tabItem { Label("Home", systemImage: "house") }

    SearchView()
        .tabItem { Label("Search", systemImage: "magnifyingglass") }
}
.tabViewStyle(.sidebarAdaptable) // NEW in iOS 26
```

#### When it adapts
- iPad: Can switch to sidebar for better space usage
- iPhone: Remains tab bar
- macOS: Sidebar preferred
- Adaptive window sizes: Transitions fluidly

#### Benefits
- Consistent experience across platforms
- Better space usage on larger screens
- Automatic with minimal code

### Split Views for Sidebar + Inspector Layouts

#### Use split views for consistent layouts

```swift
// ✅ Split view with sidebar + content + inspector
NavigationSplitView {
    // Sidebar
    List(folders, selection: $selectedFolder) { folder in
        Label(folder.name, systemImage: folder.icon)
    }
    .navigationTitle("Folders")
} content: {
    // Main content
    List(items, selection: $selectedItem) { item in
        ItemRow(item)
    }
} detail: {
    // Inspector
    InspectorView(item: selectedItem)
}
```

#### Platform Optimization
- iOS: Adaptive column visibility
- iPadOS: All columns visible on large screens
- macOS: Sidebar + content + inspector layout
- Liquid Glass applied automatically to sidebars/inspectors

### Check Content Safe Areas

**Problem** Content might not peek through appropriately beneath sidebars/inspectors.

#### Solution: Audit Safe Areas

```swift
// ✅ Respect safe areas for proper content peeking
ScrollView {
    LazyVStack {
        ForEach(items) { item in
            ItemRow(item)
        }
    }
    .safeAreaInset(edge: .leading) {
        // Sidebar occupies this space
        Color.clear.frame(width: 0)
    }
}
```

#### Padding with Liquid Glass Materials

When implementing Liquid Glass effects that extend edge-to-edge, use `.safeAreaPadding()` instead of `.padding()` to ensure content respects device safe areas (notch, Dynamic Island, home indicator).

```swift
// ❌ WRONG - Content hits notch/home indicator with Liquid Glass background
ZStack {
    // Liquid Glass background extends edge-to-edge
    RoundedRectangle(cornerRadius: 12)
        .fill(.thinMaterial)
        .ignoresSafeArea()

    VStack {
        content
    }
    .padding(.horizontal, 20)  // Doesn't account for safe areas!
}

// ✅ CORRECT - Content properly inset from safe areas + custom margin
ZStack {
    RoundedRectangle(cornerRadius: 12)
        .fill(.thinMaterial)
        .ignoresSafeArea()

    VStack {
        content
    }
    .safeAreaPadding(.horizontal, 20)  // 20pt beyond safe areas
}
```

**Key pattern for Liquid Glass**: When your material extends edge-to-edge with `.ignoresSafeArea()`, always use `.safeAreaPadding()` on the content layer to maintain proper spacing from screen edges and device-specific features.

**Common Liquid Glass scenarios requiring `.safeAreaPadding()`**:
- Full-screen sheets with `.ultraThinMaterial` backgrounds
- Edge-to-edge toolbars with glass effects
- Floating panels that extend to screen edges
- Custom navigation bars with Liquid Glass styling

**Platform availability**: `.safeAreaPadding()` requires iOS 17+. For iOS 16 and earlier, use `.safeAreaInset()` or manual GeometryReader calculations. See `swiftui-layout-ref` skill for complete `.safeAreaPadding()` vs `.padding()` guidance.

#### What to Check
- Content visible beneath sidebar/inspector
- Content not cropped inappropriately
- Background peek-through looks intentional
- Scrolling content visible through Liquid Glass
- Content properly inset from notch, Dynamic Island, home indicator (use `.safeAreaPadding()` with edge-to-edge Liquid Glass)

### Background Extension Effect

#### What It Is
Background extension effect creates impression of stretching content under sidebar/inspector without actually scrolling it there. Mirrors adjacent content + applies blur for legibility.

#### Perfect For
- Hero images on product pages
- Full-bleed photo galleries
- Edge-to-edge content experiences
- Apps using split views

#### How It Works
```swift
// ✅ Background extends under sidebar
NavigationSplitView {
    SidebarView()
} detail: {
    DetailView()
        .backgroundExtension(.enabled) // NEW API (placeholder)
}
```

#### Visual Effect
1. Content appears to extend beneath sidebar
2. Mirrored content subtly visible
3. Blur maintains sidebar legibility
4. Creates immersive, edge-to-edge feel

#### When to Use
- Split view layouts
- Sidebar/inspector UIs
- Media-rich content
- Product/photo detail views

### Automatically Minimize Tab Bar (iOS)

#### New Behavior

Tab bars can recede when scrolling to elevate underlying content.

#### How to Configure

```swift
TabView {
    ContentView()
        .tabItem { Label("Home", systemImage: "house") }
}
.tabBarMinimizationBehavior(.onScrollDown) // NEW in iOS 26
```

#### Options
- `.onScrollDown` - Minimize when scrolling down
- `.onScrollUp` - Minimize when scrolling up
- `.automatic` - System determines
- `.never` - Always visible

#### When minimized
- Tab bar recedes (smaller visual footprint)
- Expands when scrolling in opposite direction
- Content gains more screen space

**Best Practice** Use `.onScrollDown` for content-focused apps (reading, media).

---

## Menus and Toolbars

Menus have refreshed look across platforms. They adopt Liquid Glass, and menu items for common actions use icons to help people quickly scan and identify actions. iPadOS now has menu bar for faster access to common commands.

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

### Toolbar Item Grouping

#### Group items that share a background

```swift
// ✅ Fixed spacer separates groups
.toolbar {
    ToolbarItemGroup(placement: .topBarTrailing) {
        // Navigation group
        Button("Up") { }
        Button("Down") { }

        Spacer(.fixed) // NEW in iOS 26 - separates groups

        // Action group
        Button("Settings") { }
    }
}
```

#### Visual Effect
- Items within group share Liquid Glass background
- `.fixed` spacer creates visual separation
- Clear grouping of related actions

#### Best Practices
- Group similar actions (navigation, formatting, settings)
- Maintain consistent groupings across platforms
- Use `.fixed` for logical separation

### Icons vs Text in Toolbars

#### ✅ DO: Use Icons for Common Actions

```swift
// ✅ Icons declutter interface
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button {
            share()
        } label: {
            Label("Share", systemImage: "square.and.arrow.up")
        }
    }
}
```

#### ❌ DON'T: Mix Icons and Text in Same Group

```swift
// ❌ Inconsistent visual style
.toolbar {
    ToolbarItemGroup {
        Button("Save") { } // Text
        Button {
            share()
        } label: {
            Image(systemName: "square.and.arrow.up") // Icon
        }
    }
}
```

**Guideline** Pick one style (icons OR text) per background group, not both.

### Provide Accessibility Labels for Icons

#### Always specify accessibility label

```swift
// ✅ Icon has accessibility label
Button {
    share()
} label: {
    Image(systemName: "square.and.arrow.up")
}
.accessibilityLabel("Share")
```

**Why** People using VoiceOver or Voice Control need text labels even when icons are shown visually.

### Audit Toolbar Customizations

#### What to Check
- Custom fixed spacers → verify they work with new Liquid Glass backgrounds
- Custom items → verify appearance consistent with system behavior
- Toolbar visibility → verify hiding/showing works correctly

#### Common Issue: Empty Toolbar Items

#### ❌ Problem
```swift
// ❌ Hiding view instead of item
.toolbar {
    ToolbarItem {
        if showButton {
            Button("Action") { }
        } else {
            EmptyView() // ❌ Creates empty toolbar item
        }
    }
}
```

#### ✅ Solution
```swift
// ✅ Hide entire toolbar item
.toolbar {
    if showButton {
        ToolbarItem {
            Button("Action") { }
        }
    }
}
```

---

## Windows and Modals

Windows adopt rounder corners to fit controls and navigation elements. iPadOS apps show window controls and support continuous window resizing. Sheets and action sheets adopt Liquid Glass with increased corner radius.

### Arbitrary Window Sizes (iPadOS)

#### Support continuous resizing

```swift
// ✅ Content adapts to arbitrary window sizes
WindowGroup {
    ContentView()
}
.defaultSize(width: 600, height: 800)
.windowResizability(.contentSize) // NEW in iPadOS 26
```

#### What Changed
- No longer transitions between preset sizes
- Windows resize fluidly down to minimum size
- Content should reflow gracefully

#### Developer Action
- Remove hard-coded size assumptions
- Use flexible layouts (VStack, HStack, Grid)
- Test at various window sizes

### Split Views for Fluid Column Resizing

#### Use split views for automatic reflow

```swift
// ✅ Split view handles continuous resizing
NavigationSplitView(columnVisibility: $columnVisibility) {
    SidebarView()
} detail: {
    DetailView()
}
```

#### Benefits
- Automatic content reflow
- Beautiful, fluid transitions
- Minimal code
- System-optimized animations

#### Without split views
- Manual layout calculations
- Custom animation code
- More complexity

### Use Layout Guides and Safe Areas

#### Specify safe areas for automatic adjustment

```swift
// ✅ Content respects safe areas
VStack {
    ContentView()
}
.safeAreaInset(edge: .top) {
    // Window controls and title bar
    Color.clear.frame(height: 0)
}
```

#### System Automatically Adjusts
- Window controls position
- Title bar layout
- Content layout relative to chrome

### Sheets: Increased Corner Radius

#### What Changed
- Sheets have increased corner radius
- Half sheets inset from edge (content peeks through)
- Half sheets transitioning to full height become more opaque

#### Check Content Around Edges

#### Inside Sheet
- Content too close to rounder corners?
- Controls cropped by corner radius?

#### Outside Sheet
- Content peeking through between inset sheet and edge looks intentional?
- Background visible around half sheet edges?

#### Testing
```swift
// Test half sheet presentation
.sheet(isPresented: $showSheet) {
    SheetContent()
        .presentationDetents([.medium, .large])
}
```

### Audit Sheet/Popover Backgrounds

#### ❌ REMOVE: Custom Background Views

```swift
// ❌ Custom visual effect view in popover
.popover(isPresented: $showPopover) {
    ContentView()
        .background(
            VisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
        ) // ❌ Interferes with Liquid Glass
}
```

#### ✅ DO: Let System Handle Background

```swift
// ✅ System applies Liquid Glass automatically
.popover(isPresented: $showPopover) {
    ContentView()
    // No background modifier needed
}
```

### Action Sheets: Inline Appearance

#### What Changed

Action sheets originate from the element that initiates the action (not bottom edge of display). When active, action sheets let people interact with other parts of interface.

#### Specify Source of Action Sheet

```swift
// ✅ Action sheet anchored to source
Button("Options") {
    showActionSheet = true
}
.confirmationDialog("Options", isPresented: $showActionSheet) {
    Button("Option 1") { }
    Button("Option 2") { }
    Button("Cancel", role: .cancel) { }
}
// System positions sheet next to button automatically
```

#### Benefits
- Clear relationship to source
- Doesn't block entire interface
- More flexible interaction
- Inline appearance feels lighter

---

## Organization and Layout

Lists, tables, and forms have larger row height and padding to give content room to breathe. Sections have increased corner radius to match curvature of controls.

### Larger Row Height and Padding

#### What Changed
- Lists: Larger row height
- Tables: More padding
- Forms: Increased spacing
- Sections: Increased corner radius

#### Automatic Adoption
```swift
// ✅ Standard components adopt new metrics
List(items) { item in
    Text(item.name)
}
```

#### If you hard-coded metrics
```swift
// ❌ May look cramped with new design
List(items) { item in
    Text(item.name)
        .frame(height: 44) // ❌ Hard-coded height
        .padding(.vertical, 4) // ❌ Hard-coded padding
}

// ✅ Use automatic sizing
List(items) { item in
    Text(item.name)
    // System determines row height and padding
}
```

### Section Header Capitalization

#### What Changed

Section headers no longer render entirely in capital letters. They now respect title-style capitalization you provide.

#### Before (iOS 18 and earlier)
```swift
Section(header: Text("User settings")) {
    // Rendered as "USER SETTINGS"
}
```

#### After (iOS 26+)
```swift
Section(header: Text("User Settings")) {
    // Rendered as "User Settings" (title-style)
}
```

#### Action Required

Update section headers to title-style capitalization:

```swift
// ❌ Old style (all lowercase)
Section(header: Text("user settings")) {
    // Renders as "user settings" (looks wrong)
}

// ✅ New style (title-style)
Section(header: Text("User Settings")) {
    // Renders as "User Settings" (correct)
}
```

### Adopt Forms for Platform-Optimized Layouts

#### Use `.grouped` form style

```swift
// ✅ Form adopts platform-optimized layout
Form {
    Section("Personal Information") {
        TextField("Name", text: $name)
        TextField("Email", text: $email)
    }

    Section("Preferences") {
        Toggle("Notifications", isOn: $notificationsEnabled)
        Picker("Theme", selection: $theme) {
            Text("Light").tag(Theme.light)
            Text("Dark").tag(Theme.dark)
            Text("Auto").tag(Theme.auto)
        }
    }
}
.formStyle(.grouped) // Platform-optimized metrics
```

#### Benefits
- Automatic row height updates
- Correct padding and spacing
- Section corner radius matches controls
- Consistent across platforms

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

### watchOS

#### Minimal Changes

Liquid Glass changes are minimal in watchOS. They appear automatically when you open app on latest release even without building against latest SDK.

#### To Ensure Proper Adoption
- Adopt standard toolbar APIs
- Use standard button styles from watchOS 10

```swift
// ✅ Standard button styles on watchOS
Button("Action") { }
    .buttonStyle(.bordered)
```

### tvOS

#### Focus-Based Appearance

Standard buttons and controls take on Liquid Glass appearance when focus moves to them.

#### System Requirements
- Apple TV 4K (2nd generation) and newer: Full Liquid Glass effects
- Older devices: Maintains current appearance

#### Adopt Standard Focus APIs

```swift
// ✅ Standard focus APIs for Liquid Glass on focus
Button("Action") { }
    .focusable()
```

#### For Custom Controls

Apply Liquid Glass effects when they gain focus:

```swift
// ✅ Custom control with focus-based glass
struct CustomControl: View {
    @FocusState private var isFocused: Bool

    var body: some View {
        Text("Custom")
            .glassEffect()
            .opacity(isFocused ? 1.0 : 0.5)
            .focused($isFocused)
    }
}
```

### Combining Custom Liquid Glass Effects

#### Use `GlassEffectContainer` for Performance

```swift
// ✅ Combine effects in container for optimization
GlassEffectContainer {
    HStack {
        Button("Action 1") { }
            .glassEffect()

        Button("Action 2") { }
            .glassEffect()

        Button("Action 3") { }
            .glassEffect()
    }
}
```

#### Benefits
- Optimizes rendering performance
- Fluidly morphs Liquid Glass shapes into each other
- Better animation performance
- Reduces compositor overhead

#### When to Use
- Multiple custom Liquid Glass elements
- Morphing animations between glass shapes
- Performance-critical interfaces

### Performance Testing

#### Profile Your App

Building with latest SDKs is opportunity to assess and improve performance.

#### Use Instruments
- Time Profiler (CPU usage)
- SwiftUI (view updates - see `swiftui-performance` skill)
- Allocations (memory usage)
- Core Animation (rendering performance)

#### What to Check
- Scrolling performance with Liquid Glass
- Animation smoothness
- Memory usage patterns
- CPU usage during interactions

#### See Related Skills
- `swiftui-performance` - SwiftUI Instrument workflows
- `performance-profiling` - Instruments decision trees

### Backward Compatibility

#### Maintain Previous Appearance

To ship with latest SDKs while keeping app as it looked when built against previous SDKs:

#### Add `UIDesignRequiresCompatibility` key

```xml
<!-- Info.plist -->
<key>UIDesignRequiresCompatibility</key>
<true/>
```

#### Effect
- App built with iOS 26 SDK
- Appearance matches iOS 18 and earlier
- Liquid Glass effects disabled
- Previous blur/material styles used

#### When to Use
- Need time to audit interface changes
- Gradual adoption strategy
- Maintain exact appearance temporarily

#### Migration Strategy
1. Ship with `UIDesignRequiresCompatibility` enabled
2. Audit interface changes in separate build
3. Update interface incrementally
4. Remove key when ready for Liquid Glass

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
- [ ] `.tabBarMinimizationBehavior(_:)` - Minimize on scroll
- [ ] `.tabRole(.search)` - Semantic search tabs
- [ ] `NavigationSplitView` for sidebar + inspector layouts

### Toolbars and Menus
- [ ] `Spacer(.fixed)` - Separate toolbar groups
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

Use this checklist when auditing app for Liquid Glass adoption:

### Visual Refresh
- [ ] Built with Xcode 26 SDK
- [ ] Run on latest platform releases
- [ ] Standard components adopt Liquid Glass automatically
- [ ] Custom backgrounds in controls/navigation removed
- [ ] Tested with Reduce Transparency
- [ ] Tested with Increase Contrast
- [ ] Tested with Reduce Motion
- [ ] Liquid Glass not overused on custom controls

### App Icons
- [ ] Designed with foreground/middle/background layers
- [ ] Exported layers from design app
- [ ] Composed in Icon Composer
- [ ] Previewed against updated grids
- [ ] All appearance variants tested (light/dark/clear/tinted)
- [ ] Elements centered to avoid clipping

### Controls
- [ ] Updated appearance reviewed
- [ ] Hard-coded layout metrics removed
- [ ] System colors used for adaptation
- [ ] Controls not crowded or overlapping
- [ ] Scroll edge effects applied where needed
- [ ] Control shapes aligned with containers (if desired)
- [ ] New button styles adopted (`.borderedProminent`, `.bordered`)

### Navigation
- [ ] Clear hierarchy (navigation layer vs content layer)
- [ ] Tab bar adapts to sidebar (if appropriate)
- [ ] Split views used for sidebar + inspector layouts
- [ ] Content safe areas checked
- [ ] Background extension effect considered
- [ ] Tab bar minimization configured (if desired)

### Menus and Toolbars
- [ ] Standard selectors used for automatic menu icons
- [ ] Top menu actions match swipe actions
- [ ] Toolbar items grouped logically with `Spacer(.fixed)`
- [ ] Icons OR text used per group (not mixed)
- [ ] Accessibility labels provided for all icons
- [ ] Custom toolbar items audited for compatibility

### Windows and Modals
- [ ] Arbitrary window sizes supported (iPadOS)
- [ ] Split views used for fluid column resizing
- [ ] Layout guides and safe areas specified
- [ ] Sheet content checked around rounder corners
- [ ] Content peeking through half sheets reviewed
- [ ] Custom sheet/popover backgrounds removed
- [ ] Action sheets specify source element

### Organization and Layout
- [ ] Hard-coded row heights removed
- [ ] Section headers use title-style capitalization
- [ ] `.formStyle(.grouped)` adopted for forms
- [ ] Automatic row height and padding respected

### Search
- [ ] Keyboard layout tested when activating search
- [ ] `.tabRole(.search)` used for search tabs (if tab-based)
- [ ] Search placement appropriate for platform

### Platform Considerations
- [ ] watchOS: Standard toolbar APIs and button styles adopted
- [ ] tvOS: Standard focus APIs adopted for custom controls
- [ ] `GlassEffectContainer` used for combining custom effects
- [ ] Performance tested with Instruments
- [ ] `UIDesignRequiresCompatibility` key considered (if backward compatibility needed)

---

## Resources

**WWDC**: 219, 323

**Docs**: /TechnologyOverviews/adopting-liquid-glass, /design/Human-Interface-Guidelines/materials

**Skills**: liquid-glass, swiftui-performance, swiftui-debugging, accessibility-diag

---

**Last Updated**: 2025-12-01
**Minimum Platform**: iOS 26, iPadOS 26, macOS Tahoe, tvOS, watchOS, visionOS 3
**Xcode Version**: Xcode 26+
**Skill Type**: Reference (comprehensive adoption guide)
