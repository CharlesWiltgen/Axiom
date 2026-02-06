---
name: sf-symbols
description: Use when implementing SF Symbols rendering modes, symbol effects, animations, custom symbols, or troubleshooting symbol appearance — covers the full effects system from iOS 17 through SF Symbols 7 Draw animations in iOS 26
version: 1.0.0
apple_platforms: iOS 17+, iOS 18+, iOS 26+
---

# SF Symbols

Master SF Symbols' rendering modes, animation effects, and the new Draw animations from SF Symbols 7. Covers the full lifecycle from choosing the right rendering mode to implementing complex animated symbol states.

## When to Use This Skill

Use this skill when you're:
- Choosing between rendering modes (Monochrome, Hierarchical, Palette, Multicolor)
- Adding animation effects to symbols (Bounce, Pulse, Scale, Wiggle, Rotate, Breathe, Draw)
- Working with SF Symbols 7 Draw On/Off animations (iOS 26+)
- Creating custom symbols with Draw annotation
- Troubleshooting symbol colors, effects not playing, or weight mismatches
- Handling accessibility for animated symbols (Reduce Motion)

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My SF Symbol shows as a flat color but I want it to have depth. How do I fix this?"
- "I want my download button to animate when tapped, then pulse while downloading."
- "How do I use the new SF Symbols 7 Draw animations?"
- "Which symbol effect should I use for a loading indicator?"
- "My custom symbol's Draw animation looks wrong — paths draw in the wrong order."
- "How do I create a symbol that changes from play to pause with a smooth animation?"
- "I need my symbol effects to work on iOS 17 but I want Wiggle on iOS 18+."

## What This Skill Provides

- **Rendering mode decision tree** — which of the 4 modes (Monochrome, Hierarchical, Palette, Multicolor) fits your design
- **Effect selection guide** — 12+ effects mapped to UX purposes (tap feedback, loading, show/hide, symbol swap)
- **SF Symbols 7 Draw animations** (iOS 26+) — Draw On/Off, playback modes, Variable Draw, gradient rendering
- **Custom symbol authoring** — Draw annotation with guide points in SF Symbols app
- **Anti-patterns and troubleshooting** — wrong mode, effect not playing, weight mismatches, version checks
- **Pressure scenarios** — pushing back on "just use PNGs" and "add animations later"

## Key Pattern

### Choosing the Right Effect

```swift
// Tap feedback — one-shot bounce
Image(systemName: "arrow.down.circle")
    .symbolEffect(.bounce, value: downloadCount)

// Loading state — continuous pulse
Image(systemName: "network")
    .symbolEffect(.pulse, isActive: isConnecting)

// Symbol swap — replace transition
Image(systemName: isPlaying ? "pause.fill" : "play.fill")
    .contentTransition(.symbolEffect(.replace))

// Hand-drawn entrance (iOS 26+)
Image(systemName: "checkmark.circle")
    .symbolEffect(.drawOn, isActive: isComplete)
```

## Documentation Scope

This page documents the `axiom-sf-symbols` skill — decision trees, effect selection guidance, and troubleshooting for SF Symbols implementation.

**For complete API reference:** See [SF Symbols Reference](/reference/sf-symbols-ref) for every modifier signature, UIKit equivalents, and the full platform availability matrix.

## Related

- [SF Symbols Reference](/reference/sf-symbols-ref) — Complete API reference for all rendering modes, effects, and UIKit equivalents
- [SwiftUI Animation](/reference/swiftui-animation-ref) — General SwiftUI animation (non-symbol)
- [HIG Reference](/reference/hig-ref) — Broader icon design guidelines
- [Liquid Glass](/skills/ui-design/liquid-glass) — For Liquid Glass material design (complements symbol effects)

## Resources

**WWDC**: 2023-10257, 2023-10258, 2024-10188, 2025-337

**Docs**: /symbols, /symbols/symboleffect, /swiftui/image/symbolrenderingmode(_:)
