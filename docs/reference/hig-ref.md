---
name: hig-ref
description: Comprehensive Human Interface Guidelines reference with code examples
skill_type: reference
version: 1.0.0
apple_platforms: iOS, iPadOS, macOS, watchOS, tvOS, visionOS
---

# Human Interface Guidelines Reference

Comprehensive reference for Apple's Human Interface Guidelines. Covers semantic colors, typography, spacing, icons, accessibility, and platform-specific patterns with code examples.

## When to Use This Reference

Use this reference when you need:
- Complete semantic color names and their purposes
- Typography scale and Dynamic Type sizes
- Exact spacing values and layout guidelines
- Icon design specifications
- Accessibility implementation details
- Platform-specific design requirements

**For quick decisions:** See [hig](/skills/ui-design/hig) for decision trees and checklists.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the semantic label colors and when should I use each?"
- "What's the difference between grouped and ungrouped background colors?"
- "What are the SF Symbol weight recommendations for different contexts?"
- "What's the minimum touch target size for accessibility?"
- "What are the exact Dynamic Type sizes at each text style?"
- "How do tint colors work in iOS?"

## What's Covered

### Color System
- Label hierarchy (label, secondaryLabel, tertiaryLabel, quaternaryLabel)
- Background colors (ungrouped vs grouped)
- System colors (systemRed, systemBlue, etc.)
- Separator colors
- Fill colors
- Tint colors and accent colors

### Typography
- Text styles (largeTitle through caption2)
- Font weights and when to use them
- Dynamic Type support
- Font scaling behavior
- Minimum readable sizes

### Spacing & Layout
- Standard spacing values (4, 8, 12, 16, 20, 24pt)
- Content margins
- Safe areas
- Grid systems

### Icons & SF Symbols
- Symbol weights and scales
- Symbol configurations
- Rendering modes
- Variable color
- Accessibility considerations

### Touch & Interaction
- Minimum 44×44pt touch targets
- Gesture patterns
- Feedback expectations
- Interactive states

### Accessibility
- VoiceOver labels and hints
- Dynamic Type requirements
- Color contrast ratios
- Reduce Motion support
- Button shapes

### Platform Specifics
- iOS vs iPadOS patterns
- macOS considerations
- watchOS constraints
- visionOS spatial design
- tvOS focus model

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

### Dynamic Type Scale

```swift
// Automatic scaling with text styles
Text("Large Title").font(.largeTitle)  // 34pt at default
Text("Title").font(.title)              // 28pt
Text("Headline").font(.headline)        // 17pt semibold
Text("Body").font(.body)                // 17pt
Text("Footnote").font(.footnote)        // 13pt
Text("Caption").font(.caption)          // 12pt
```

## Documentation Scope

This page documents the `axiom-hig-ref` reference skill—comprehensive HIG coverage Claude uses when you need specific design values, color names, or implementation details.

**For quick decisions:** See [hig](/skills/ui-design/hig) for decision frameworks and quick lookups.

**For Liquid Glass:** See [liquid-glass](/skills/ui-design/liquid-glass) for iOS 26 material design.

## Related

- [hig](/skills/ui-design/hig) — Quick decision frameworks
- [liquid-glass](/skills/ui-design/liquid-glass) — iOS 26 Liquid Glass material design
- [accessibility-auditor](/agents/accessibility-auditor) — Automated accessibility scanning

## Resources

**WWDC**: 2023-10148, 2024-10154, 2019-214 (Dark Mode)

**Docs**: developer.apple.com/design/human-interface-guidelines
