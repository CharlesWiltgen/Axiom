---
name: hig-ref
description: Human Interface Guidelines reference with code examples
skill_type: reference
version: 1.0.0
apple_platforms: iOS, iPadOS, macOS, watchOS, tvOS, visionOS
---

# Human Interface Guidelines Reference

Reference for Apple's Human Interface Guidelines: semantic colors, typography, shapes, materials, layout, icons, input, accessibility, and platform-specific patterns, with SwiftUI code examples. Use it when you need a specific design value or rule rather than a quick decision.

## When to Use This Reference

Use this reference when you need:
- Semantic color names and their purposes
- Text styles, font weights, and Dynamic Type requirements
- Shape, material, and layout guidance, including Liquid Glass
- Rules for alerts and action sheets: when to show one, how to word it, and where Cancel and destructive buttons go
- Touch target sizes and gesture conventions
- Accessibility requirements for vision, hearing, mobility, and cognition
- Platform-specific design requirements
- A fix for a common HIG problem, such as failing contrast or a launch screen rejected for branding

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "What are all the semantic label colors, and when should I use each?"
- "What's the difference between grouped and ungrouped background colors?"
- "Which font weights should I avoid, and why?"
- "What's the minimum touch target size for accessibility?"
- "How much text scaling does my app need to support?"
- "How do tint colors work in iOS?"
- "Where do Cancel and Done go on a sheet?"
- "Should my delete confirmation button use the destructive style?"

## What's Covered

### Design Principles
- Clarity, consistency, and deference
- Designing as a system

### Color System
- Label hierarchy (`label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`)
- Background colors (ungrouped vs. grouped), base vs. elevated backgrounds
- Tint colors
- Fill colors and separator colors
- When to use a permanently dark appearance
- Creating custom colors

### Typography
- System fonts: San Francisco and New York
- Font weight recommendations
- Text styles (`largeTitle` through `caption2`)
- Dynamic Type requirements (200% scaling on iOS and iPadOS, 140% on watchOS)
- Custom fonts and leading

### Shapes & Geometry
- The three shape types (fixed, capsule, concentric) in iOS 26
- Concentricity principle for nested containers
- Platform-specific corner radius guidance
- Optical centering

### Materials & Depth
- Standard materials (ultraThin, thin, regular, thick)
- Vibrancy with materials
- Liquid Glass (iOS 26+): regular vs. clear variants
- Modals and sheets: automatic Liquid Glass adoption, semantic backgrounds
- Sheet button placement: Cancel/Done pairing rules, platform-specific placements

### Alerts & Action Sheets
- Alert vs. action sheet vs. menu vs. inline indicator
- Alert titles, messages, and tone
- Button titles, default and Cancel buttons, placement
- Destructive style: the alert rule and the opposite action-sheet rule
- macOS and visionOS alert differences
- SwiftUI, UIKit, and AppKit mapping (`alert`, `confirmationDialog`, `dialogSeverity`, `UIAlertController`, `NSAlert`)

### Layout Principles
- Visual hierarchy, grouping, and alignment
- Content extension to display edges
- Safe areas, layout guides, and margins
- Adaptability across size classes

### Icons & Symbols
- SF Symbols overview: weights, scales, rendering modes
- Custom interface icons
- When to use icons vs. text
- Accessibility labels

### Gestures & Input
- Standard gestures and custom gesture guidelines
- Minimum touch targets by platform (44×44 pt on iOS and iPadOS)
- Gesture accessibility

### Accessibility
- Vision: text legibility, color contrast, color alone, screen readers
- Hearing: media alternatives and audio cues
- Mobility
- Cognitive: interaction design, Reduce Motion, game accommodations
- visionOS-specific accessibility

### Motion & Animation
- Core principles for purposeful motion
- Reduce Motion accommodations
- Best practices for feedback animations
- Platform-specific motion guidance

### Launch & Onboarding
- Launch screens
- Onboarding

### Platform Specifics
- iOS and iPadOS patterns
- macOS considerations
- watchOS constraints
- tvOS focus model
- visionOS spatial design

### Inclusive Design and Branding
- Language, visual representation, gender identity, disability, and localization
- Branding restraint and appropriate placement

### Troubleshooting
- Contrast failures, small touch targets, Dark Mode issues, light font weights
- Dynamic Type not working, Reduce Motion ignored, missing VoiceOver labels
- Information conveyed only by color, launch screen branding rejections, custom appearance toggles

## Key Pattern

### Semantic Colors in SwiftUI

```swift
// Label hierarchy
Text("Title").foregroundStyle(.primary)      // label
Text("Subtitle").foregroundStyle(.secondary) // secondaryLabel
Text("Detail").foregroundStyle(.tertiary)    // tertiaryLabel

// Backgrounds - ungrouped (flat)
Color(.systemBackground)           // Primary background
Color(.secondarySystemBackground)  // Elevated content
Color(.tertiarySystemBackground)   // Further elevation

// Backgrounds - grouped (Settings-style)
Color(.systemGroupedBackground)           // Page background
Color(.secondarySystemGroupedBackground)  // Cell background

// System colors (adaptive)
Color(.systemRed)    // Adapts to light/dark
Color(.systemBlue)
Color(.systemGreen)
```

### Dynamic Type

```swift
// ✅ Scales automatically with Dynamic Type
Text("Hello")
    .font(.body)

// ❌ Fixed size, doesn't scale
Text("Hello")
    .font(.system(size: 17))
```

## Documentation Scope

This page documents the `hig-ref` skill (in the `axiom-design` suite), the HIG detail your assistant uses when you need specific design values, color names, or implementation details. SF Symbols rendering modes, symbol effects, and custom symbols are covered in depth in [sf-symbols-ref](/reference/sf-symbols-ref).

## Related

- [hig](/skills/ui-design/hig) – Quick decision trees and checklists built on this reference
- [liquid-glass](/skills/ui-design/liquid-glass) – Implementing the iOS 26 Liquid Glass material
- [liquid-glass-ref](/reference/liquid-glass-ref) – App-wide Liquid Glass adoption, including sheets and popovers
- [accessibility-auditor](/agents/accessibility-auditor) – Scans your code for the accessibility issues this reference describes

## Resources

**WWDC**: 2025-356, 2019-808

**Docs**: /design/human-interface-guidelines, /design/human-interface-guidelines/color, /design/human-interface-guidelines/dark-mode, /design/human-interface-guidelines/materials, /design/human-interface-guidelines/typography, /design/human-interface-guidelines/layout, /design/human-interface-guidelines/accessibility, /design/human-interface-guidelines/icons
