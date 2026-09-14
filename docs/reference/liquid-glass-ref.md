---
name: liquid-glass-ref
description: Comprehensive Liquid Glass adoption guide — app icons, controls, navigation, menus, windows, search, platform considerations
---

# Liquid Glass Reference

Comprehensive adoption guide for Apple's Liquid Glass design system introduced at WWDC 2025.

## Overview

Liquid Glass is Apple's new material design system for iOS 26+, replacing traditional blur effects with dynamic, context-aware glass surfaces. This reference covers system-wide adoption across your entire app.

## What's Covered

### Design System Components

#### App-Wide Adoption
- App icons and branding
- Navigation bars and toolbars
- Tab bars and bottom sheets
- Sidebars and split views

#### Interactive Controls
- Buttons and segmented controls
- Menus and context menus
- Popovers and alerts
- Search fields and filters

#### Platform Considerations
- iOS and iPadOS vs macOS, watchOS, tvOS, and visionOS
- Light mode vs Dark mode
- Accessibility (reduce transparency)
- Performance impact

### Migration Strategies

#### From UIBlurEffect
- Replacing `UIVisualEffectView` with `.glassEffect()`
- Material style mapping (Regular for most floating surfaces, Clear over media; content-layer backgrounds keep material)
- Animation transitions
- Backwards compatibility patterns, including the `UIDesignRequiresCompatibility` opt-out

#### From Custom Blurs
- Recreating custom effects with Liquid Glass APIs
- Tinting and vibrancy

## When to Use This Reference

Use this reference when:
- Planning system-wide Liquid Glass adoption
- Migrating from UIBlurEffect or custom blurs
- Designing new iOS 26+ features
- Reviewing UI for modern material design
- Preparing App Store screenshots with new materials

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What do I need to change to adopt Liquid Glass across my whole app?"
- "Which `UIBlurEffect` styles map to Regular glass, and which to Clear?"
- "How do I make my tab bar adapt to a sidebar on iPad?"
- "How does Liquid Glass differ on watchOS, tvOS, and visionOS?"
- "Can I keep the old look with `UIDesignRequiresCompatibility` after I move to the iOS 27 SDK?"

## Key APIs

```swift
// Glass effect (iOS, iPadOS, macOS, tvOS, watchOS 26; visionOS uses glassBackgroundEffect())
.glassEffect()
.glassEffect(.clear, in: .rect(cornerRadius: 16))

// Toolbar spacer between ToolbarItems (iOS 26+)
ToolbarSpacer(.fixed)

// Search field
.searchable(text: $query)

// Search tab
TabView {
    Tab("Inbox", systemImage: "tray") { InboxView() }
    Tab(role: .search) { NavigationStack { SearchView() } }
}
```

## Related Skills

- [liquid-glass](/skills/ui-design/liquid-glass) – TDD-tested implementation skill with design review defense
- [swiftui-26-ref](/reference/swiftui-26-ref) – All iOS 26 SwiftUI features including Liquid Glass
- [audit-liquid-glass](/commands/ui-design/audit-liquid-glass) – Quick scan for adoption opportunities

## Documentation Scope

This is a **reference skill** — comprehensive guide without mandatory workflows. For discipline-enforcing implementation guidance with pressure scenario defense, use the [liquid-glass skill](/skills/ui-design/liquid-glass).

#### Reference includes
- Complete API catalog
- Platform-specific patterns
- Migration checklists
- Accessibility considerations
- Performance optimization

#### Skills include
- Mandatory design review workflows
- Pressure defense (tight deadlines, authority pressure)
- Red flags and rationalizations
- Step-by-step implementation
- TDD-tested patterns

## WWDC 2025 Sessions

Based on WWDC 2025 guidance for Liquid Glass adoption and iOS 26 material design system.

## Size

29 KB - Comprehensive reference with complete adoption guide
