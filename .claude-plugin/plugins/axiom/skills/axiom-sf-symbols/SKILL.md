---
name: axiom-sf-symbols
description: Use when implementing SF Symbols rendering modes, symbol effects, animations, custom symbols, or troubleshooting symbol appearance - covers the full symbol effects system from iOS 17 through SF Symbols 7 Draw animations in iOS 26
license: MIT
compatibility: iOS 17+, iOS 18+ (Wiggle/Rotate/Breathe), iOS 26+ (Draw animations)
metadata:
  version: "1.0.0"
---

# SF Symbols — Effects, Rendering, and Custom Symbols

## When to Use This Skill

Use when:
- Choosing between rendering modes (Monochrome, Hierarchical, Palette, Multicolor)
- Implementing symbol effects or animations (Bounce, Pulse, Scale, Wiggle, Rotate, Breathe, Draw)
- Working with SF Symbols 7 Draw On/Off animations
- Creating custom symbols in the SF Symbols app
- Troubleshooting symbol colors, effects not playing, or weight mismatches
- Deciding which effect matches a specific UX purpose
- Handling accessibility with symbol animations (Reduce Motion)

#### Related Skills
- Use `axiom-sf-symbols-ref` for complete API reference with all modifiers, UIKit equivalents, and platform availability matrix
- Use `axiom-swiftui-animation-ref` for general SwiftUI animation (not symbol-specific)
- Use `axiom-hig-ref` for broader icon design guidelines

## Example Prompts

#### 1. "My SF Symbol shows as a single flat color but I want it to have depth with multiple shades. How do I fix this?"
> The skill covers rendering mode selection — Hierarchical for depth from a single color, Palette for explicit per-layer colors

#### 2. "I want my download button to animate when tapped, then show a spinning indicator while downloading, and animate to a checkmark when done."
> The skill covers effect selection: Bounce for tap feedback, Breathe/Pulse for in-progress, Replace with content transition for completion

#### 3. "I'm trying to use the new Draw animations from SF Symbols 7 but the effect isn't playing."
> The skill covers Draw On/Off implementation, playback modes, iOS 26 requirements, and common troubleshooting

#### 4. "How do I create a custom symbol that supports all rendering modes and the new Draw animation?"
> The skill covers custom symbol authoring workflow, template layers, Draw annotation with guide points

---

## Part 1: Rendering Mode Decision Tree

SF Symbols support 4 rendering modes. The right choice depends on your design intent.

### Quick Decision

```
Need depth from ONE color?           → Hierarchical
Need specific colors per layer?      → Palette
Want Apple's curated colors?         → Multicolor
Just need a tinted icon?             → Monochrome (default)
```

### Monochrome

The default mode. Every layer renders in the same color (your `foregroundStyle`).

```swift
Image(systemName: "cloud.rain.fill")
    .foregroundStyle(.blue)
// All layers are blue
```

**When to use**: Simple tinted icons, matching text color, toolbar items, tab bar items.

### Hierarchical

Renders layers at different opacities derived from a **single** color. Primary layers are fully opaque; secondary and tertiary layers get progressively more transparent. Creates depth without specifying multiple colors.

```swift
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(.blue)
// Cloud is full blue, rain drops are lighter blue
```

**When to use**: When you want visual depth but still want the icon to feel cohesive with a single hue. Most common choice for polished UI.

### Palette

Each layer gets an **explicit** color. Unlike Hierarchical, no automatic opacity derivation — you control each layer's color directly.

```swift
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.palette)
    .foregroundStyle(.blue, .cyan)
// Cloud is blue, rain drops are cyan
```

**When to use**: Branded icons, status indicators where specific colors carry meaning, designs requiring exact color control.

**Gotcha**: If you provide fewer colors than layers, extra layers reuse the last color. If the symbol has 3 layers and you provide 2 colors, the third layer uses the second color.

### Multicolor

Uses Apple's predefined color scheme for each symbol. Colors are fixed — you cannot customize them.

```swift
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.multicolor)
// Cloud is white, rain drops are blue (Apple's design)
```

**When to use**: Weather indicators, file type icons, or anywhere Apple's curated design intent matches your needs. Not all symbols support Multicolor — unsupported symbols fall back to Monochrome.

### Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| Using `.foregroundColor()` with Multicolor | Overrides Apple's colors | Remove foreground color modifier |
| Setting Palette with only 1 color | Looks like Monochrome | Provide colors for each layer |
| Assuming all symbols support Multicolor | Fallback to Monochrome | Check in SF Symbols app first |
| Using Hierarchical when layers need distinct meanings | Colors don't carry semantic intent | Use Palette instead |

---

## Part 2: Symbol Effects System

Symbol effects bring SF Symbols to life with motion. Every effect falls into one of four behavioral categories.

### Effect Categories

| Category | Trigger | Duration | Use Case |
|----------|---------|----------|----------|
| **Discrete** | Value change | One-shot | Tap feedback, event notification |
| **Indefinite** | `isActive` bool | Continuous until stopped | Loading states, ongoing processes |
| **Transition** | View insert/remove | One-shot | Appear/disappear with style |
| **Content Transition** | Symbol swap | One-shot | Replacing one symbol with another |

### Which Effect for Which UX Purpose

```
User tapped something               → Bounce (discrete)
Something changed, draw attention    → Wiggle (discrete, iOS 18+)
Ongoing process/loading              → Pulse, Breathe, or Variable Color (indefinite)
Rotation indicates progress          → Rotate (indefinite, iOS 18+)
Show/hide symbol                     → Appear/Disappear (transition)
Swap between two symbols             → Replace (content transition)
Symbol enters with hand-drawn style  → Draw On (iOS 26+)
Symbol exits with hand-drawn style   → Draw Off (iOS 26+)
Progress indicator along path        → Variable Draw (iOS 26+)
Scale up/down for emphasis           → Scale (indefinite)
```

### Discrete Effects

Fire once when a value changes. The symbol performs the animation and returns to its resting state.

#### Bounce

The most common discrete effect. A brief, springy animation.

```swift
@State private var downloadCount = 0

Image(systemName: "arrow.down.circle")
    .symbolEffect(.bounce, value: downloadCount)
```

The animation triggers each time `downloadCount` changes.

**Directional options**: `.bounce.up`, `.bounce.down`

#### Wiggle (iOS 18+)

A horizontal shake that draws attention to the symbol.

```swift
Image(systemName: "bell.fill")
    .symbolEffect(.wiggle, value: notificationCount)
```

**Directional options**: `.wiggle.left`, `.wiggle.right`, `.wiggle.forward`, `.wiggle.backward`

`.forward` and `.backward` respect reading direction — use these for RTL support.

#### Rotate (as Discrete, iOS 18+)

A single rotation when triggered by value change.

```swift
Image(systemName: "arrow.trianglehead.2.clockwise")
    .symbolEffect(.rotate, value: refreshCount)
```

**Options**: `.rotate.clockwise`, `.rotate.counterClockwise`

**By Layer**: Some symbols rotate only specific layers (e.g., fan blades spin but the housing stays fixed). Use `.rotate.byLayer` to activate this.

### Indefinite Effects

Run continuously while `isActive` is `true`. Stop when `isActive` becomes `false`.

#### Pulse

A subtle opacity pulse. Good for "waiting" states.

```swift
Image(systemName: "network")
    .symbolEffect(.pulse, isActive: isConnecting)
```

#### Variable Color

Iterates through the symbol's layers, highlighting each in sequence. Creates a "filling up" or "cycling" look.

```swift
Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative, isActive: isSearching)
```

**Variants**:
- `.variableColor.iterative` — highlights one layer at a time
- `.variableColor.cumulative` — progressively fills layers
- `.variableColor.reversing` — cycles back and forth
- Combine: `.variableColor.iterative.reversing`

#### Scale

Scales the symbol up or down.

```swift
Image(systemName: "mic.fill")
    .symbolEffect(.scale.up, isActive: isRecording)
```

#### Breathe (iOS 18+)

A smooth, rhythmic scale animation — like the symbol is breathing.

```swift
Image(systemName: "heart.fill")
    .symbolEffect(.breathe, isActive: isMonitoring)
```

**Variants**: `.breathe.plain` (scale only), `.breathe.pulse` (scale + opacity)

#### Rotate (as Indefinite, iOS 18+)

Continuous rotation for processing indicators.

```swift
Image(systemName: "gear")
    .symbolEffect(.rotate, isActive: isProcessing)
```

### Effect Options

All effects accept `SymbolEffectOptions` via the `options` parameter.

```swift
// Repeat 3 times
.symbolEffect(.bounce, options: .repeat(3), value: count)

// Double speed
.symbolEffect(.pulse, options: .speed(2.0), isActive: true)

// Repeat continuously
.symbolEffect(.variableColor, options: .repeat(.continuous), isActive: true)

// Non-repeating (run once)
.symbolEffect(.breathe, options: .nonRepeating, isActive: true)

// Combine options
.symbolEffect(.bounce, options: .repeat(5).speed(1.5), value: count)
```

### Transition Effects

Used when a symbol-based view appears or disappears from the view hierarchy.

```swift
if showSymbol {
    Image(systemName: "checkmark.circle.fill")
        .transition(.symbolEffect(.appear))
}
```

**Available transitions**: `.appear`, `.disappear`

**Variants**: `.appear.up`, `.appear.down`, `.disappear.up`, `.disappear.down`

### Content Transitions

Used to animate from one symbol to another. Applied to the container, not the symbol.

```swift
@State private var isFavorite = false

Button {
    isFavorite.toggle()
} label: {
    Image(systemName: isFavorite ? "star.fill" : "star")
        .contentTransition(.symbolEffect(.replace))
}
```

**Replace variants**:
- `.replace.downUp` — old symbol moves down, new moves up
- `.replace.upUp` — both move up
- `.replace.offUp` — old fades off, new moves up

#### Magic Replace

When two symbols share a common structure (like `star` and `star.fill`, or `pause.fill` and `play.fill`), Replace automatically performs a **Magic Replace** — morphing shared elements while transitioning differing parts. Magic Replace is the default behavior for `.replace` in iOS 18+. For explicit control:

```swift
// Explicit Magic Replace with fallback
.contentTransition(.symbolEffect(.replace.magic(fallback: .replace.downUp)))
```

---

## Part 3: SF Symbols 7 — Draw Animations (iOS 26+)

Draw animations simulate the natural flow of drawing a symbol with a pen. This is the signature new feature in SF Symbols 7.

### Draw On and Draw Off

**Draw On** animates a symbol appearing by "drawing" it stroke by stroke.
**Draw Off** animates a symbol disappearing by "erasing" it.

```swift
// Draw On — symbol draws in when isComplete becomes true
Image(systemName: "checkmark.circle")
    .symbolEffect(.drawOn, isActive: isComplete)

// Draw Off — symbol draws out when isHidden becomes true
Image(systemName: "star.fill")
    .symbolEffect(.drawOff, isActive: isHidden)
```

### Playback Modes

Control how multi-layer symbols animate their draw:

```swift
// By Layer (default) — staggered timing, layers overlap
Image(systemName: "square.and.arrow.up")
    .symbolEffect(.drawOn.byLayer, isActive: showIcon)

// Whole Symbol — all layers draw simultaneously
Image(systemName: "square.and.arrow.up")
    .symbolEffect(.drawOn.wholeSymbol, isActive: showIcon)

// Individually — sequential, each layer completes before next starts
Image(systemName: "square.and.arrow.up")
    .symbolEffect(.drawOn.individually, isActive: showIcon)
```

**When to use each mode**:
- **By Layer** (default): Most natural feel, good for most symbols
- **Whole Symbol**: When the symbol should appear as one unit, not in parts
- **Individually**: When you want to emphasize each layer separately (storytelling, onboarding)

### Draw Off Direction

Draw Off supports controlling whether the animation plays forward or in reverse:

```swift
// Forward (default) — follows the draw path
.symbolEffect(.drawOff.nonReversed, isActive: isHidden)

// Reversed — erases in reverse order of how it was drawn
.symbolEffect(.drawOff.reversed, isActive: isErasing)
```

### Variable Draw

Variable Draw uses `SymbolVariableValueMode.draw` to partially draw a symbol's stroke path based on a 0.0 to 1.0 value — perfect for progress indicators.

```swift
Image(systemName: "thermometer.high", variableValue: temperature)
    .symbolVariableValueMode(.draw) // iOS 26+
```

Compare with traditional Variable Color (which sets opacity per layer):

```swift
Image(systemName: "wifi", variableValue: signalStrength)
    .symbolVariableValueMode(.color) // iOS 17+ (default behavior)
```

**Constraint**: A symbol can support both Variable Color and Variable Draw, but only one mode can be active at render time. Setting an unsupported mode has no visible effect.

### Gradient Rendering

SF Symbols 7 introduces `SymbolColorRenderingMode` for gradient fills generated from a single source color.

```swift
Image(systemName: "star.fill")
    .symbolColorRenderingMode(.gradient) // iOS 26+
    .foregroundStyle(.red)
```

| Mode | Description |
|------|-------------|
| `.flat` | Solid color fill (default) |
| `.gradient` | Axial gradient from source color |

Gradients work with all rendering modes and are most effective at larger sizes.

### Magic Replace with Draw

When using `.contentTransition(.symbolEffect(.replace))` between certain symbol pairs, the system now combines Draw Off on the outgoing symbol with Draw On for the incoming symbol. The enclosure (if shared, like a circle outline) is preserved while inner elements transition with draw animations.

```swift
// Automatic Draw-enhanced Magic Replace
Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
    .contentTransition(.symbolEffect(.replace))
```

### Custom Symbol Draw Annotation

To enable Draw animations on custom symbols, annotate paths in the SF Symbols app:

1. **Open** your custom symbol in SF Symbols 7
2. **Select** a path layer
3. **Add guide points** to define draw direction:
   - **Start point** (open circle): Where drawing begins
   - **End point** (closed circle): Where drawing ends
   - **Corner point** (diamond): Sharp direction changes
   - **Bidirectional point**: Enables center-outward drawing
   - **Attachment point**: Connects non-drawing decorative elements
4. **Minimum**: Two guide points per path (start and end)
5. **Test** using the Preview panel in SF Symbols app

**Option-drag** guide points for precise placement. Use context menus to configure direction and end caps.

---

## Part 4: Anti-Patterns

### Wrong Rendering Mode

| Pattern | Problem | Fix |
|---------|---------|-----|
| Palette with 1 color | Equivalent to Monochrome, wasted API call | Use Monochrome or provide multiple colors |
| Multicolor for branded icons | Can't customize Apple's fixed colors | Use Palette with brand colors |
| Hardcoded `.foregroundColor(.blue)` | Ignores Dark Mode, Dynamic Type, accessibility | Use semantic colors or `.tint` |
| Hierarchical for status indicators | Layers don't carry distinct meaning | Use Palette with semantic colors |

### Wrong Effect Choice

| Pattern | Problem | Fix |
|---------|---------|-----|
| Bounce for loading state | One-shot, doesn't convey "ongoing" | Use Pulse, Breathe, or Variable Color |
| Pulse for tap feedback | Too subtle for confirming action | Use Bounce |
| Continuous Rotate for non-mechanical symbols | Looks unnatural for organic shapes | Use Breathe for organic symbols |
| Draw On for transient state changes | Too dramatic for frequent toggles | Use Replace or Scale |

### Missing iOS Version Checks

```swift
// ❌ Crashes on iOS 17
Image(systemName: "bell")
    .symbolEffect(.wiggle, value: count) // Wiggle requires iOS 18+

// ✅ Safe version check
Image(systemName: "bell")
    .modifier(BellEffectModifier(count: count))

struct BellEffectModifier: ViewModifier {
    let count: Int
    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.symbolEffect(.wiggle, value: count)
        } else {
            content.symbolEffect(.bounce, value: count)
        }
    }
}
```

### Ignoring Reduce Motion

Symbol effects **automatically** respect the Reduce Motion accessibility setting — most effects are suppressed or simplified. However, if you're using effects to convey essential information (not just decoration), provide an alternative:

```swift
// Variable Color conveys WiFi strength — provide text fallback
Image(systemName: "wifi")
    .symbolEffect(.variableColor, isActive: isSearching)
    .accessibilityLabel("Searching for WiFi networks")
```

**Do not** disable Reduce Motion or try to force-play effects. The system handles this correctly.

### Missing Accessibility Labels

```swift
// ❌ VoiceOver says "star.fill"
Image(systemName: "star.fill")

// ✅ VoiceOver says "Favorite"
Image(systemName: "star.fill")
    .accessibilityLabel("Favorite")
```

When using `.contentTransition(.symbolEffect(.replace))` to swap symbols, update the accessibility label to match the current state:

```swift
Image(systemName: isFavorite ? "star.fill" : "star")
    .contentTransition(.symbolEffect(.replace))
    .accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
```

---

## Part 5: Troubleshooting

### Effect Not Playing

**Symptom**: `.symbolEffect()` modifier applied but no animation visible.

1. **Check iOS version** — Bounce/Pulse/Scale require iOS 17+, Wiggle/Rotate/Breathe require iOS 18+, Draw requires iOS 26+
2. **Check Reduce Motion** — Settings > Accessibility > Motion > Reduce Motion. If on, most effects are suppressed
3. **Check trigger type** — Discrete effects need `value:` that changes. Indefinite effects need `isActive: true`. Transition effects need the view to actually enter/leave the hierarchy
4. **Check symbol compatibility** — Not all symbols support all effects. Open the SF Symbols app, select the symbol, and check the Animation inspector
5. **Check for conflicting effects** — Multiple `.symbolEffect()` modifiers on the same view can conflict. Use a single effect or combine with options

### Wrong Colors in Rendering Mode

**Symptom**: Symbol colors don't match expected appearance.

1. **Check rendering mode** — If you set `.foregroundStyle` but see only one color, you may need `.symbolRenderingMode(.palette)` or `.hierarchical`
2. **Check `.tint` vs `.foregroundStyle`** — In UIKit, `tintColor` affects Monochrome and Hierarchical. For Palette, use `UIImage.SymbolConfiguration(paletteColors:)`
3. **Check Multicolor support** — Not all symbols have Multicolor variants. Unsupported symbols fall back to Monochrome
4. **Check environment** — `.foregroundStyle` from a parent view may override your rendering mode. Apply `.symbolRenderingMode()` directly on the Image

### Custom Symbol Weight Mismatch

**Symptom**: Custom symbol looks too thin or too thick next to text or other symbols.

1. **Check template weight** — Custom symbols need weight variants matching the 9 SF Pro weights. Export from SF Symbols app handles this
2. **Check `.font()` alignment** — The symbol's weight follows the applied font weight. If using `.font(.title)`, ensure your custom symbol has appropriate weight variants
3. **Check scale** — `.imageScale(.small/.medium/.large)` affects overall size. Use `.font()` for weight matching

### Draw Animation Not Working on Custom Symbol

**Symptom**: `.symbolEffect(.drawOn)` applied to custom symbol but no draw animation occurs.

1. **Check guide points** — Custom symbols need Draw annotation with at least 2 guide points per path (start + end)
2. **Check SF Symbols app version** — Draw annotation requires SF Symbols 7+
3. **Check path structure** — Guide points must be placed on stroked paths, not fills. Convert fills to strokes where draw animation is desired
4. **Check layer structure** — Each annotatable layer needs its own guide points

---

## Part 6: Pressure Scenarios

### Scenario 1: "Just use a static image, symbols are overkill"

**Setup**: Designer provides PNG icons. Developer considers using them instead of SF Symbols.

**Why this matters**: Static PNGs don't adapt to Dynamic Type, Bold Text, Dark Mode, or accessibility settings. They also don't support symbol effects.

**Professional response**: "SF Symbols scale with text, support 9 weights, adapt to Dark Mode and Bold Text automatically, and enable animations without custom code. A PNG requires @1x/@2x/@3x variants, manual Dark Mode handling, manual Dynamic Type scaling, and custom animation code. The 10 minutes to find the right SF Symbol saves hours of asset management."

**Time cost of skipping**: 2-4 hours managing assets + ongoing maintenance vs 10 minutes finding the right symbol.

### Scenario 2: "We'll add animations later"

**Setup**: Sprint deadline. PM says animations are polish and can wait.

**Why this matters**: Retrofitting symbol effects requires restructuring state management. Effects triggered by `value:` changes need the right state architecture from the start.

**Professional response**: "Adding `.symbolEffect(.bounce, value: count)` takes one line. Retrofitting the state to support it later takes a refactor. Let me add the effect now — it's literally one modifier."

### Scenario 3: "Draw animations look janky on our custom symbols"

**Setup**: Custom symbols have Draw animations that look wrong — paths draw in unexpected order or direction.

**Why this matters**: Draw annotation requires intentional guide point placement. Without it, the system guesses and often gets it wrong.

**Fix**: Open custom symbols in SF Symbols 7 app, add guide points explicitly to each path defining start/end/direction. Test each weight variant. See Custom Symbol Draw Annotation section above.

---

## Resources

**WWDC**: 2023-10257, 2023-10258, 2024-10188, 2025-337

**Docs**: /symbols, /symbols/symboleffect, /symbols/symbolrenderingmode, /swiftui/image/symboleffect(_:options:value:), /swiftui/image/symbolrenderingmode(_:)

**Skills**: axiom-sf-symbols-ref, axiom-hig-ref, axiom-swiftui-animation-ref

---

**Last Updated** Based on WWDC 2023/10257-10258, WWDC 2024/10188, WWDC 2025/337
**Version** iOS 17+ (effects), iOS 18+ (Wiggle/Rotate/Breathe), iOS 26+ (Draw On/Off, Variable Draw, Gradients)
