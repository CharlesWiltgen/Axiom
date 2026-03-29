---
name: axiom-liquid-glass
description: Use when implementing Liquid Glass effects, reviewing UI for Liquid Glass adoption, debugging visual artifacts, optimizing performance, or requesting expert review of Liquid Glass implementation - provides comprehensive design principles, API patterns, and troubleshooting guidance from WWDC 2025. Includes design review pressure handling and professional push-back frameworks
license: MIT
compatibility: iOS 26+, iPadOS 26+, macOS Tahoe+, axiom-visionOS 3+
metadata:
  version: "1.2.0"
  last-updated: "Added new iOS 26 APIs and backward compatibility guidance"
---

# Liquid Glass — Apple's New Material Design System

## When to Use This Skill

Use when:
- Implementing Liquid Glass effects in your app
- Reviewing existing UI for Liquid Glass adoption opportunities
- Debugging visual artifacts with Liquid Glass materials
- Optimizing Liquid Glass performance
- **Requesting expert review of Liquid Glass implementation**
- Understanding when to use Regular vs Clear variants
- Troubleshooting tinting, legibility, or adaptive behavior issues

#### Related Skills
- Use `axiom-liquid-glass-ref` for comprehensive app-wide adoption guidance (app icons, controls, navigation, menus, windows, platform considerations)

## Example Prompts

- "How is Liquid Glass different from blur effects? Should I adopt it?"
- "My lensing effect looks like a regular blur. What am I missing?"
- "Liquid Glass looks odd on iPad vs iPhone. How do I adjust?"
- "How do I ensure text contrast on top of Liquid Glass?"
- "What are the expert criteria for reviewing a Liquid Glass implementation?"

---

## What is Liquid Glass?

Liquid Glass is Apple's next-generation material design system introduced at WWDC 2025. It represents a significant evolution from previous materials (Aqua, iOS 7 blurs, Dynamic Island) by creating a new digital meta-material that:

- **Dynamically bends and shapes light** (lensing) rather than scattering it
- **Moves organically** like a lightweight liquid, responding to touch and app dynamism
- **Adapts automatically** to size, environment, content, and light/dark modes
- **Unifies design language** across all Apple platforms (iOS, iPadOS, macOS, axiom-visionOS)

**Core Philosophy**: Liquid Glass complements the evolution of rounded, immersive screens with rounded, floating forms that feel natural to touch interaction while letting content shine through.

---

## Visual Properties

### 1. Lensing (Primary Visual Characteristic)

Liquid Glass defines itself through **lensing** — warping and bending light to communicate presence, motion, and form. Elements materialize in/out by modulating light bending (not fading). Controls feel ultra-lightweight yet visually distinguishable.

### 2. Motion & Fluidity

- Responds to interaction by flexing with light
- Gel-like flexibility communicates transient, malleable nature
- Elements lift into Liquid Glass on interaction (controls)
- Dynamic morphing between app states as a singular floating plane

### 3. Adaptive Behavior

Liquid Glass **continuously adapts** without fixed light/dark appearance:
- Shadows intensify when text scrolls underneath; tint shifts for legibility
- Small elements (navbars) independently flip light/dark; large elements (menus, sidebars) don't flip but adapt depth
- Ambient environment subtly spills onto surface

---

## Implementation Guide

### Basic API Usage

#### SwiftUI: `glassEffect` Modifier

```swift
// Basic usage - applies glass within capsule shape
Text("Hello")
    .glassEffect()

// Custom shape
Text("Hello")
    .glassEffect(in: RoundedRectangle(cornerRadius: 12))

// Interactive elements (iOS - for controls/containers)
Button("Tap Me") {
    // action
}
.glassEffect()
.interactive() // Add for custom controls on iOS
```

**Automatic Adoption**: Simply recompiling with Xcode 26 brings Liquid Glass to standard controls automatically.

### Variants: Regular vs Clear

**CRITICAL DECISION**: Never mix Regular and Clear in the same interface.

#### Regular Variant (Default — 95% of Cases)

Most versatile. Full adaptive effects, automatic legibility, works in any size over any content. Use for navigation bars, tab bars, toolbars, buttons, menus, sidebars.

#### Clear Variant (Special Cases Only)

Permanently more transparent, no adaptive behaviors. **Requires dimming layer** for legibility.

**Use ONLY when ALL three conditions are met**:
1. Element is over **media-rich content**
2. Content layer won't be negatively affected by **dimming layer**
3. Content above glass is **bold and bright**

Using Clear without meeting all three conditions results in poor legibility. See `axiom-liquid-glass-ref` for implementation examples.

---

## Layered System Architecture

Liquid Glass is composed of four layers working together:

1. **Highlights** — Light sources produce highlights responding to geometry; some respond to device motion
2. **Shadows** — Content-aware: stronger over text, weaker over light backgrounds
3. **Internal Glow** — Material illuminates from within on interaction; spreads to nearby glass elements
4. **Adaptive Tinting** — Multiple layers adapt together to maintain hierarchy; all built-in automatically

---

## Scroll Edge Effects

Scroll edge effects dissolve content into background as it scrolls, lifting glass above moving content. Use `.scrollEdgeEffect(.hard)` when pinned accessory views exist (e.g., column headers) for extra visual separation. See `axiom-liquid-glass-ref` for full API details.

---

## Tinting & Color

Liquid Glass introduces **adaptive tinting** — selecting a color generates tones mapped to content brightness underneath, inspired by colored glass in reality. Compatible with all glass behaviors (morphing, adaptation, interaction).

### Tinting Rules

```swift
// ✅ Tint primary actions only
Button("View Bag") { }.tint(.red).glassEffect()

// ❌ Don't tint everything — when everything is tinted, nothing stands out
VStack {
    Button("Action 1").tint(.blue).glassEffect()
    Button("Action 2").tint(.green).glassEffect()  // No hierarchy
}

// ❌ Solid fills break Liquid Glass character
Button("Action") { }.background(.red)  // Opaque, wrong

// ✅ Use .tint() instead of solid fills
Button("Action") { }.tint(.red).glassEffect()  // Grounded in environment
```

Reserve tinting for primary UI actions. Use color in the content layer for overall app color scheme.

---

## Legibility & Contrast

SwiftUI automatically uses **vibrant text and tint colors** within glass effects — no manual adjustment needed. Small elements (navbars, tabbars) flip light/dark for discernibility. Large elements (menus, sidebars) adapt but don't flip (too distracting for large surface area). Symbols/glyphs mirror glass behavior and maximize contrast automatically.

Use custom tint colors selectively for distinct functional purpose (e.g., `.tint(.orange)` on a single toolbar button for emphasis).

---

## Accessibility

Liquid Glass offers several accessibility features that modify material **without sacrificing its magic**:

### Reduced Transparency
- Makes Liquid Glass frostier
- Obscures more content behind it
- Applied automatically when system setting enabled

### Increased Contrast
- Makes elements predominantly black or white
- Highlights with contrasting border
- Applied automatically when system setting enabled

### Reduced Motion
- Decreases intensity of effects
- Disables elastic properties
- Applied automatically when system setting enabled

**Developer Action Required**: None - all features available automatically when using Liquid Glass.

---

## Performance Considerations

### View Hierarchy Impact

**Concern**: Liquid Glass rendering cost in complex view hierarchies

**Guidance**:
- Regular variant optimized for performance
- Larger elements (menus, sidebars) use more pronounced effects but managed by system
- Avoid excessive nesting of glass elements

**Optimization**:
```swift
// ❌ Avoid deep nesting
ZStack {
    GlassContainer1()
        .glassEffect()
    ZStack {
        GlassContainer2()
            .glassEffect()
        // More nesting...
    }
}

// ✅ Flatten hierarchy
VStack {
    GlassContainer1()
        .glassEffect()

    GlassContainer2()
        .glassEffect()
}
```

### Rendering Costs

**Adaptive behaviors have computational cost**:
- Light/dark switching
- Shadow adjustments
- Tint calculations
- Lensing effects

**System handles optimization**, but be mindful:
- Don't animate Liquid Glass elements unnecessarily
- Use Clear variant sparingly (requires dimming layer computation)
- Profile with Instruments if experiencing performance issues

---

## Testing Liquid Glass

Test across these configurations:
- Light/dark modes
- Reduced Transparency enabled
- Increased Contrast enabled
- Reduced Motion enabled
- Dynamic Type (larger text sizes)
- Content scrolling (verify scroll edge effects)
- Right-to-left languages

See `axiom-ui-testing` for comprehensive UI testing patterns including visual regression and accessibility testing.

---

## Design Review Pressure: Defending Your Implementation

### The Problem

Under design review pressure, you'll face requests to:
- "Use Clear variant everywhere — Regular is too opaque"
- "Glass on all controls for visual cohesion"
- "More transparency to let content shine through"

These sound reasonable. **But they violate the framework.** Your job: defend using evidence, not opinion.

### Red Flags — Designer Requests That Violate Skill Guidelines

If you hear ANY of these, **STOP and reference the skill**:

- ❌ **"Use Clear everywhere"** – Clear requires three specific conditions, not design preference
- ❌ **"Glass looks better than fills"** – Correct layer (navigation vs content) trumps aesthetics
- ❌ **"Users won't notice the difference"** – Clear variant fails legibility tests in low-contrast scenarios
- ❌ **"Stack glass on glass for consistency"** – Explicitly prohibited; use fills instead
- ❌ **"Apply glass to Lists for sophistication"** – Lists are content layer; causes visual confusion

### How to Push Back Professionally

#### Step 1: Show the Framework

```
"I want to make this change, but let me show you Apple's guidance on Clear variant.
It requires THREE conditions:

1. Media-rich content background
2. Dimming layer for legibility
3. Bold, bright controls on top

Let me show which screens meet all three..."
```

#### Step 2: Demonstrate the Risk

Open the app on a device. Show:
- Clear variant in low-contrast scenario (unreadable)
- Regular variant in same scenario (legible)

#### Step 3: Offer Compromise

```
"Clear can work beautifully in these 6 hero sections where all three conditions apply.
Regular handles everything else with automatic legibility. Best of both worlds."
```

#### Step 4: Document the Decision

If overruled (designer insists on Clear everywhere):

```
Slack message to PM + designer:

"Design review decided to use Clear variant across all controls.
Important: Clear variant requires legibility testing in low-contrast scenarios
(bright sunlight, dark content). If we see accessibility issues after launch,
we'll need an expedited follow-up. I'm flagging this proactively."
```

#### Why this works
- You're not questioning their taste (you like Clear too)
- You're raising accessibility/legibility risk
- You're offering a solution that preserves their vision in hero sections
- You're documenting the decision (protects you post-launch)

### Real-World Example: App Store Launch Blocker (36-Hour Deadline)

#### Scenario
- 36 hours to launch
- Chief designer says: "Clear variant everywhere"
- Client watching the review meeting
- You already implemented Regular per the skill

#### What to do

```swift
// In the meeting, demo side-by-side:

// Regular variant (current implementation)
NavigationBar()
    .glassEffect() // Automatic legibility

// Clear variant (requested)
NavigationBar()
    .glassEffect(.clear) // Requires dimming layer below

// Show the three-condition checklist
// Demonstrate which screens pass/fail
// Offer: Clear in hero sections, Regular elsewhere
```

#### Result
- 30-minute compromise demo
- 90 minutes to implement changes
- Launch on schedule with optimal legibility
- No post-launch accessibility complaints

### When to Accept the Design Decision (Even If You Disagree)

Sometimes designers have valid reasons to override the skill. Accept if:

- [ ] They understand the three-condition framework
- [ ] They're willing to accept legibility risks
- [ ] You document the decision in writing
- [ ] They commit to monitoring post-launch feedback

#### Document in Slack

```
"Design review decided to use Clear variant [in these locations].
We understand this requires:
- All three conditions met: [list them]
- Potential legibility issues in low-contrast scenarios
- Accessibility testing across brightness levels

Monitoring plan:
- Gather user feedback first 48 hours
- Run accessibility audit
- Have fallback to Regular variant ready for push if needed"
```

This protects both of you and shows you're not blocking - just de-risking.

---

## Expert Review Checklist

When reviewing Liquid Glass implementation (your code or others'), check:

### 1. Material Appropriateness
- [ ] Is Liquid Glass used only on navigation layer (not content)?
- [ ] Are standard controls getting glass automatically via Xcode 26 recompile?
- [ ] Is glass avoided on glass situations?

### 2. Variant Selection
- [ ] Is Regular variant used for most cases?
- [ ] If Clear variant used, do all three conditions apply?
  - [ ] Over media-rich content?
  - [ ] Dimming layer acceptable?
  - [ ] Content above is bold and bright?
- [ ] Are Regular and Clear never mixed in same interface?

### 3. Legibility & Contrast
- [ ] Are primary actions selectively tinted (not everything)?
- [ ] Is color used in content layer for overall app color scheme?
- [ ] Are solid fills avoided on glass elements?
- [ ] Do elements maintain legibility on various backgrounds?

### 4. Layering & Hierarchy
- [ ] Are content intersections avoided in steady states?
- [ ] Are elements on top of glass using fills/transparency (not glass)?
- [ ] Is visual hierarchy clear (navigation layer vs content layer)?

### 5. Scroll Edge Effects
- [ ] Are scroll edge effects applied where Liquid Glass meets scrolling content?
- [ ] Is hard style used for pinned accessory views?

### 6. Accessibility
- [ ] Does implementation work with Reduced Transparency?
- [ ] Does implementation work with Increased Contrast?
- [ ] Does implementation work with Reduced Motion?
- [ ] Are interactive elements hittable in all configurations?

### 7. Performance
- [ ] Is view hierarchy reasonably flat?
- [ ] Are glass elements animated only when necessary?
- [ ] Is Clear variant used sparingly?

---

## Common Mistakes & Solutions

### Glass Placement Errors

```swift
// ❌ Glass on content layer — competes with navigation
List(landmarks) { landmark in
    LandmarkRow(landmark).glassEffect()
}

// ✅ Glass on navigation layer only
.toolbar {
    ToolbarItem { Button("Add") { }.glassEffect() }
}

// ❌ Clear without dimming — poor legibility
ZStack {
    VideoPlayer(player: player)
    PlayButton().glassEffect(.clear)
}

// ✅ Clear with dimming layer
ZStack {
    VideoPlayer(player: player)
        .overlay(.black.opacity(0.4))
    PlayButton().glassEffect(.clear)
}
```

### Over-Tinting

Tint primary action only. When everything is tinted, nothing stands out.

### Static Material Expectations

Don't hardcode shadows or fixed opacity. Embrace adaptive behavior — test across light/dark modes and backgrounds.

---

## Troubleshooting

### Visual Artifacts

**Issue**: Glass appears too transparent or invisible

**Check**:
1. Are you using Clear variant? (Switch to Regular if inappropriate)
2. Is background content extremely light or dark? (Glass adapts - this may be correct behavior)
3. Is Reduced Transparency enabled? (Check accessibility settings)

**Issue**: Glass appears opaque or has harsh edges

**Check**:
1. Are you using solid fills on glass? (Remove, use tinting)
2. Is Increased Contrast enabled? (Expected behavior)
3. Is custom shape too complex? (Simplify geometry)

### Dark Mode Issues

**Issue**: Glass doesn't flip to dark style on dark backgrounds

**Check**:
1. Is element large (menu, sidebar)? (Large elements don't flip - by design)
2. Is background actually dark? (Use Color Picker to verify)
3. Are you overriding appearance? (Remove `.preferredColorScheme()` if unintended)

**Issue**: Content on glass not legible in dark mode

**Fix**:
```swift
// Let SwiftUI handle contrast automatically
Text("Label")
    .foregroundStyle(.primary) // ✅ Adapts automatically

// Don't hardcode colors
Text("Label")
    .foregroundColor(.black) // ❌ Won't adapt to dark mode
```

### Performance Issues

**Issue**: Scrolling feels janky with Liquid Glass

**Debug**:
1. Profile with Instruments (see `axiom-swiftui-performance` skill)
2. Check for excessive view body updates
3. Simplify view hierarchy under glass
4. Verify not applying glass to content layer (major performance hit)

**Issue**: Animations stuttering

**Check**:
1. Are you animating glass shape changes? (Expensive)
2. Profile with SwiftUI Instrument for long view updates
3. Consider reducing glass usage if critical path

---

## Migration from Previous Materials

### From UIBlurEffect / NSVisualEffectView

**Before** (UIKit):
```swift
let blurEffect = UIBlurEffect(style: .systemMaterial)
let blurView = UIVisualEffectView(effect: blurEffect)
view.addSubview(blurView)
```

**After** (SwiftUI with Liquid Glass):
```swift
ZStack {
    // Content
}
.glassEffect()
```

**Benefits**: Automatic adaptation (no manual style switching), built-in interaction feedback, platform-appropriate appearance, accessibility features included.

### From Custom Materials

1. **Try Liquid Glass first** — may provide desired effect automatically
2. **Evaluate Regular vs Clear** — Clear may match custom transparency needs
3. **Test across configurations** — Liquid Glass adapts automatically

**When to keep custom materials**: Specific artistic effect not achievable with Liquid Glass, backward compatibility with iOS < 26 required, or non-standard UI paradigm incompatible with Liquid Glass principles.

### UIKit + SwiftUI Interop

When migrating incrementally, glass effects apply per-framework:
- SwiftUI views get `.glassEffect()` / `.glassBackgroundEffect()`
- UIKit views use the UIKit Liquid Glass APIs (see `axiom-liquid-glass-ref` for migration mapping)
- Hosted SwiftUI views inside `UIHostingController` get glass effects independently

See `axiom-liquid-glass-ref` for complete UIBlurEffect migration mapping table.

---

## Backward Compatibility

### UIDesignRequiresCompatibility Key (iOS 26)

To ship with latest SDKs while maintaining previous appearance:

```xml
<key>UIDesignRequiresCompatibility</key>
<true/>
```

**Effect**: App built with iOS 26 SDK, appearance matches iOS 18 and earlier, Liquid Glass effects disabled, previous blur/material styles used.

**When to use**: Need time to audit interface changes, gradual adoption strategy, or maintain exact appearance temporarily.

**Migration strategy**:
1. Ship with `UIDesignRequiresCompatibility` enabled
2. Audit interface changes in separate build
3. Update interface incrementally
4. Remove key when ready for Liquid Glass

---

## API Reference

For complete API reference including `glassEffect()`, `glassBackgroundEffect()`, toolbar modifiers, scroll edge effects, navigation/search APIs, controls/layout, `GlassEffectContainer`, `glassEffectID`, types, and backward compatibility, see `axiom-liquid-glass-ref`.

---

## Resources

**WWDC**: 2025-219, 2025-256, 2025-323 (Build a SwiftUI app with the new design)

**Docs**: /technologyoverviews/adopting-liquid-glass, /swiftui/landmarks-building-an-app-with-liquid-glass, /swiftui/applying-liquid-glass-to-custom-views

**Skills**: axiom-liquid-glass-ref

---

**Platforms:** iOS 26+, iPadOS 26+, macOS Tahoe, axiom-visionOS 3
**Xcode:** 26+
**History:** See git log for changes
