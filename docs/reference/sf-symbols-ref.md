---
name: sf-symbols-ref
description: Complete SF Symbols API reference — rendering modes, symbol effects, configuration options, UIKit equivalents, custom symbols, and platform availability matrix
---

# SF Symbols Reference

Complete API reference for SF Symbols rendering modes, animation effects, configuration options, and UIKit/AppKit equivalents. Covers iOS 13 symbol display through iOS 26 Draw animations and gradient rendering.

## When to Use This Reference

Use this reference when:
- You need exact API signatures for rendering modes or symbol effects
- You need UIKit/AppKit equivalents for SwiftUI symbol APIs
- You need platform availability for a specific feature
- You need configuration options (weight, scale, variable values)
- You need custom symbol template structure and Draw annotation details

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What's the exact SwiftUI modifier for Hierarchical rendering?"
- "How do I add a Bounce effect in UIKit?"
- "Which symbol effects are available on iOS 17 vs iOS 18?"
- "How do I combine rendering mode with symbol effects?"
- "What's the UIKit equivalent of .contentTransition(.symbolEffect(.replace))?"
- "How do I create a custom symbol with Draw animation support?"

## What's Covered

### Symbol Display
- SwiftUI `Image(systemName:)`, `Label`, font sizing, image scale, weight, variable values
- UIKit `UIImage.SymbolConfiguration` — point size, weight, scale, text style
- AppKit `NSImage.SymbolConfiguration`

### Rendering Modes
- Monochrome, Hierarchical, Palette, Multicolor — SwiftUI and UIKit APIs
- Combining configurations in UIKit
- `SymbolRenderingMode` enum values

### Symbol Effects (Complete)
- **Bounce** — `DiscreteSymbolEffect`, directional options
- **Pulse** — `DiscreteSymbolEffect` + `IndefiniteSymbolEffect`
- **Variable Color** — iterative, cumulative, reversing, hide/dim inactive
- **Scale** — up/down, by layer
- **Wiggle** (iOS 18+) — 8 directional options + custom angle
- **Rotate** (iOS 18+) — clockwise/counterClockwise, by layer
- **Breathe** (iOS 18+) — plain/pulse variants
- **Appear/Disappear** — transition effects, directional
- **Replace** — content transition, Magic Replace, directional variants
- **Draw On/Off** (iOS 26+) — playback modes, Variable Draw, gradient rendering

### Configuration
- `SymbolEffectOptions` — speed, repeat count, continuous, nonRepeating
- Effect protocol hierarchy (Discrete, Indefinite, Transition, ContentTransition)

### UIKit Complete Reference
- `addSymbolEffect()`, `removeSymbolEffect()`, `setSymbolImage()`
- `UIBarButtonItem` effect support
- Completion handlers

### Custom Symbols
- Template structure and layer annotations
- Draw annotation guide points
- Weight interpolation
- Importing to Xcode

### Platform Availability Matrix
- Rendering modes: iOS 13+ through iOS 26+
- Effects: iOS 17+ through iOS 26+
- Cross-platform (macOS, watchOS, tvOS, visionOS)

### Accessibility
- Labels, Reduce Motion, Bold Text, Dynamic Type interactions

### Common Patterns
- Notification badge, WiFi strength, animated toggle, task checkbox, play/pause, download progress

## Documentation Scope

This page documents the `axiom-sf-symbols-ref` skill — the comprehensive API reference Claude uses for SF Symbols implementation details.

**For decision guidance:** See [SF Symbols](/skills/ui-design/sf-symbols) for rendering mode decision trees, effect selection guidance, anti-patterns, and troubleshooting.

## Related

- [SF Symbols](/skills/ui-design/sf-symbols) — Decision trees, anti-patterns, troubleshooting, pressure scenarios
- [SwiftUI Animation](/reference/swiftui-animation-ref) — General animation reference (VectorArithmetic, @Animatable, springs)
- [HIG Reference](/reference/hig-ref) — Icon and symbol design guidelines
- [Typography](/reference/typography-ref) — SF Pro font that symbols are designed to match

## Resources

**WWDC**: 2023-10257, 2023-10258, 2024-10188, 2025-337

**Docs**: /symbols, /symbols/symboleffect, /symbols/symbolrenderingmode, /uikit/uiimage/symbolconfiguration
