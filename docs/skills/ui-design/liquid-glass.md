---
name: liquid-glass
description: Use when implementing Liquid Glass effects, reviewing UI for Liquid Glass adoption, debugging visual artifacts, optimizing performance, or requesting expert review of Liquid Glass implementation — provides comprehensive design principles, API patterns, and troubleshooting guidance from WWDC 2025
version: 1.2.0
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+, visionOS 3+
---

# Liquid Glass

Apple's next-generation material design system introduced at WWDC 2025. Liquid Glass dynamically bends light (lensing) rather than scattering it, creating controls that feel ultra-lightweight and transparent while remaining visually distinguishable.

## When to Use This Skill

Use this skill when you're:
- Implementing Liquid Glass effects in your app
- Reviewing existing UI for Liquid Glass adoption opportunities
- Debugging visual artifacts with Liquid Glass materials
- Deciding between Regular and Clear variants
- Handling design review pressure about material choices
- Troubleshooting tinting, legibility, or adaptive behavior issues

**Automatic adoption:** Simply recompiling with Xcode 26 brings Liquid Glass to standard controls automatically.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How is Liquid Glass different from blur effects I've used before? Should I adopt it?"
- "I'm implementing Liquid Glass but the lensing effect looks like a regular blur. What am I missing?"
- "Liquid Glass works great on iPhone but looks odd on iPad. Should I adjust for different screen sizes?"
- "How do I ensure text contrast while using Liquid Glass?"
- "We want to do a design review of our Liquid Glass implementation. What are the expert criteria?"
- "When should I use Clear variant vs Regular variant?"
- "My designer wants Clear variant everywhere. How do I push back professionally?"

## What's Covered

### Visual Properties
- Lensing (primary characteristic) — light bending vs scattering
- Motion and fluidity — flex, energize, gel-like flexibility
- Adaptive behavior — content-aware, platform-aware, no fixed light/dark

### Variants
- **Regular** (default, 95% of cases) — full adaptive behavior, automatic legibility
- **Clear** (special cases) — requires 3 conditions: media-rich background, dimming layer acceptable, bold/bright content above

### Implementation
- `glassEffect()` modifier basics
- `glassBackgroundEffect()` for custom views (iOS 26+)
- `scrollEdgeEffectStyle(_:for:)` for custom bars
- `GlassEffectContainer` for performance optimization
- Toolbar patterns with `Spacer(.fixed)` and tinted buttons
- Bottom-aligned search and search tab role

### Design Principles
- Reserve for navigation layer (not content)
- Never stack glass on glass
- Avoid content intersections in steady state
- Tinting for primary actions only

### Troubleshooting
- Visual artifacts (too transparent, opaque, harsh edges)
- Dark mode issues
- Performance problems (scrolling, animations)

### Pressure Scenarios
- Professional push-back frameworks for design reviews
- When to accept design decisions vs defend guidelines
- Documentation templates for overruled decisions

## Key Pattern

### Regular vs Clear Decision

```swift
// ✅ Regular (default) — use for 95% of cases
Button("Action") { }
    .glassEffect()

// ⚠️ Clear — ONLY when ALL THREE conditions met:
// 1. Over media-rich content
// 2. Dimming layer acceptable
// 3. Bold, bright content above
ZStack {
    VideoPlayer(player: player)
        .overlay(.black.opacity(0.4))  // Dimming layer required

    PlayButton()
        .glassEffect(.clear)
}
```

## Documentation Scope

This page documents the `axiom-liquid-glass` skill—comprehensive Liquid Glass guidance Claude uses when answering your questions. The skill contains design principles, API patterns, expert review checklists, and pressure scenario handling.

**For automated scanning:** Use the [liquid-glass-auditor](/agents/liquid-glass-auditor) agent to scan your codebase for Liquid Glass adoption opportunities and migration from UIBlurEffect.

**For app-wide adoption:** See [liquid-glass-ref](/reference/liquid-glass-ref) for comprehensive guidance on app icons, controls, navigation, menus, windows, and platform considerations.

## Related

- [liquid-glass-auditor](/agents/liquid-glass-auditor) — Autonomous agent that scans for adoption opportunities
- [liquid-glass-ref](/reference/liquid-glass-ref) — Comprehensive app-wide adoption guide
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Performance optimization when glass causes issues
- [hig](/skills/ui-design/hig) — Human Interface Guidelines for design decisions

## Resources

**WWDC**: 2025-219, 2025-323, 2025-256

**Docs**: /TechnologyOverviews/adopting-liquid-glass, /SwiftUI/Applying-Liquid-Glass-to-custom-views
