---
name: axiom-sf-symbols-ref
description: Use when you need complete SF Symbols API reference including every rendering mode, symbol effect, configuration option, UIKit equivalent, and platform availability - comprehensive code examples for iOS 17 through iOS 26
license: MIT
compatibility: iOS 17+, iOS 18+, iOS 26+
metadata:
  version: "1.0.0"
---

# SF Symbols — API Reference

## When to Use This Skill

Use when:
- You need exact API signatures for rendering modes or symbol effects
- You need UIKit/AppKit equivalents for SwiftUI symbol APIs
- You need to check platform availability for a specific effect
- You need configuration options (weight, scale, variable values)
- You need to create custom symbols with proper template structure

#### Related Skills
- Use `axiom-sf-symbols` for decision trees, anti-patterns, troubleshooting, and when to use which effect
- Use `axiom-swiftui-animation-ref` for general SwiftUI animation (non-symbol)

---

## Part 1: Symbol Display

### SwiftUI

```swift
// Basic display
Image(systemName: "star.fill")

// With Label (icon + text)
Label("Favorites", systemImage: "star.fill")

// Font sizing — symbol scales with text
Image(systemName: "star.fill")
    .font(.title)

// Image scale — relative sizing without changing font
Image(systemName: "star.fill")
    .imageScale(.large) // .small, .medium, .large

// Explicit point size
Image(systemName: "star.fill")
    .font(.system(size: 24))

// Weight — matches SF Pro font weights
Image(systemName: "star.fill")
    .fontWeight(.bold) // .ultraLight through .black

// Symbol variant — programmatic .fill, .circle, .square, .slash
Image(systemName: "person")
    .symbolVariant(.circle.fill) // Renders person.circle.fill

// Variable value — 0.0 to 1.0, controls symbol fill level
Image(systemName: "speaker.wave.3.fill", variableValue: 0.5)
```

### UIKit

```swift
// Basic display
let image = UIImage(systemName: "star.fill")
imageView.image = image

// Configuration — point size and weight
let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .bold)
let image = UIImage(systemName: "star.fill", withConfiguration: config)

// Configuration — text style (scales with Dynamic Type)
let config = UIImage.SymbolConfiguration(textStyle: .title1)
let image = UIImage(systemName: "star.fill", withConfiguration: config)

// Configuration — scale
let config = UIImage.SymbolConfiguration(scale: .large) // .small, .medium, .large

// Combine configurations
let sizeConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .bold, scale: .large)

// Variable value
let image = UIImage(systemName: "speaker.wave.3.fill", variableValue: 0.5)
```

### AppKit

```swift
// Basic display
let image = NSImage(systemSymbolName: "star.fill", accessibilityDescription: "Favorite")

// Configuration
let config = NSImage.SymbolConfiguration(pointSize: 24, weight: .bold)
let configured = image?.withSymbolConfiguration(config)
```

---

## Part 2: Rendering Modes

### SwiftUI

```swift
// Monochrome (default)
Image(systemName: "cloud.rain.fill")
    .foregroundStyle(.blue)

// Hierarchical — depth from single color
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(.blue)

// Palette — explicit color per layer
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.palette)
    .foregroundStyle(.white, .blue)
// For 3-layer symbols:
    .foregroundStyle(.red, .white, .blue)

// Multicolor — Apple's curated colors
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.multicolor)

// Preferred rendering mode — uses symbol's preferred mode
// Falls back gracefully if the symbol doesn't support it
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.monochrome) // explicit monochrome
```

#### SymbolRenderingMode Enum

| Value | Description |
|-------|-------------|
| `.monochrome` | Single color for all layers (default) |
| `.hierarchical` | Single color with automatic opacity per layer |
| `.palette` | Explicit color per layer via `.foregroundStyle()` |
| `.multicolor` | Apple's fixed curated colors |

### UIKit

```swift
// Hierarchical
let config = UIImage.SymbolConfiguration(hierarchicalColor: .systemBlue)
imageView.preferredSymbolConfiguration = config

// Palette
let config = UIImage.SymbolConfiguration(paletteColors: [.white, .systemBlue])
imageView.preferredSymbolConfiguration = config

// Multicolor
let config = UIImage.SymbolConfiguration.preferringMulticolor()
imageView.preferredSymbolConfiguration = config

// Monochrome — just set tintColor
imageView.tintColor = .systemBlue
```

### Combining Configurations (UIKit)

```swift
let sizeConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .bold)
let colorConfig = UIImage.SymbolConfiguration(paletteColors: [.white, .blue, .gray])
let combined = sizeConfig.applying(colorConfig)
imageView.preferredSymbolConfiguration = combined
```

---

## Part 3: Symbol Effects — Complete API

### Effect Protocol Hierarchy

All symbol effects conform to `SymbolEffect`. Sub-protocols define behavior:

| Protocol | Trigger | Modifier | Loop |
|----------|---------|----------|------|
| `DiscreteSymbolEffect` | `value:` (Equatable) | `.symbolEffect(_:options:value:)` | No |
| `IndefiniteSymbolEffect` | `isActive:` (Bool) | `.symbolEffect(_:options:isActive:)` | Yes |
| `TransitionSymbolEffect` | View lifecycle | `.transition(.symbolEffect(_:))` | No |
| `ContentTransitionSymbolEffect` | Symbol change | `.contentTransition(.symbolEffect(_:))` | No |

### Remove All Effects (SwiftUI)

```swift
// Strip all symbol effects from a view hierarchy
Image(systemName: "star.fill")
    .symbolEffectsRemoved() // Removes all effects
    .symbolEffectsRemoved(false) // Re-enables effects
```

### SymbolEffectOptions

```swift
// Speed multiplier
.symbolEffect(.bounce, options: .speed(2.0), value: count)

// Repeat count
.symbolEffect(.bounce, options: .repeat(3), value: count)

// Continuous repeat
.symbolEffect(.pulse, options: .repeat(.continuous), isActive: true)

// Non-repeating (for indefinite effects, run once then hold)
.symbolEffect(.breathe, options: .nonRepeating, isActive: true)

// Combined
.symbolEffect(.wiggle, options: .repeat(5).speed(1.5), value: count)
```

---

### Bounce

**Protocols**: `DiscreteSymbolEffect`

```swift
// Discrete — triggers on value change
Image(systemName: "arrow.down.circle")
    .symbolEffect(.bounce, value: downloadCount)

// Directional
    .symbolEffect(.bounce.up, value: count)
    .symbolEffect(.bounce.down, value: count)

// By Layer — different layers bounce at different times
    .symbolEffect(.bounce.byLayer, value: count)

// Whole Symbol — entire symbol bounces together
    .symbolEffect(.bounce.wholeSymbol, value: count)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.bounce)
// With options:
imageView.addSymbolEffect(.bounce, options: .repeat(3))
```

---

### Pulse

**Protocols**: `DiscreteSymbolEffect`, `IndefiniteSymbolEffect`

```swift
// Indefinite — continuous while active
Image(systemName: "network")
    .symbolEffect(.pulse, isActive: isConnecting)

// Discrete — triggers once on value change
    .symbolEffect(.pulse, value: errorCount)

// By Layer
    .symbolEffect(.pulse.byLayer, isActive: true)

// Whole Symbol
    .symbolEffect(.pulse.wholeSymbol, isActive: true)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.pulse)
imageView.removeSymbolEffect(ofType: PulseSymbolEffect.self)
```

---

### Variable Color

**Protocols**: `DiscreteSymbolEffect`, `IndefiniteSymbolEffect`

```swift
// Iterative — highlights one layer at a time
Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative, isActive: isSearching)

// Cumulative — progressively fills layers
    .symbolEffect(.variableColor.cumulative, isActive: true)

// Reversing — cycles back and forth
    .symbolEffect(.variableColor.iterative.reversing, isActive: true)

// Hide inactive layers (dims non-highlighted layers)
    .symbolEffect(.variableColor.iterative.hideInactiveLayers, isActive: true)

// Dim inactive layers (slightly reduces opacity of non-highlighted)
    .symbolEffect(.variableColor.iterative.dimInactiveLayers, isActive: true)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.variableColor.iterative)
imageView.removeSymbolEffect(ofType: VariableColorSymbolEffect.self)
```

---

### Scale

**Protocols**: `IndefiniteSymbolEffect`

```swift
// Scale up
Image(systemName: "mic.fill")
    .symbolEffect(.scale.up, isActive: isRecording)

// Scale down
    .symbolEffect(.scale.down, isActive: isMuted)

// By Layer
    .symbolEffect(.scale.up.byLayer, isActive: true)

// Whole Symbol
    .symbolEffect(.scale.up.wholeSymbol, isActive: true)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.scale.up)
imageView.removeSymbolEffect(ofType: ScaleSymbolEffect.self)
```

---

### Wiggle (iOS 18+)

**Protocols**: `DiscreteSymbolEffect`, `IndefiniteSymbolEffect`

```swift
// Discrete
Image(systemName: "bell.fill")
    .symbolEffect(.wiggle, value: notificationCount)

// Directional
    .symbolEffect(.wiggle.left, value: count)
    .symbolEffect(.wiggle.right, value: count)
    .symbolEffect(.wiggle.forward, value: count)  // RTL-aware
    .symbolEffect(.wiggle.backward, value: count)  // RTL-aware
    .symbolEffect(.wiggle.up, value: count)
    .symbolEffect(.wiggle.down, value: count)
    .symbolEffect(.wiggle.clockwise, value: count)
    .symbolEffect(.wiggle.counterClockwise, value: count)

// Custom angle
    .symbolEffect(.wiggle.custom(angle: .degrees(15)), value: count)

// By Layer
    .symbolEffect(.wiggle.byLayer, value: count)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.wiggle)
```

---

### Rotate (iOS 18+)

**Protocols**: `DiscreteSymbolEffect`, `IndefiniteSymbolEffect`

```swift
// Indefinite rotation
Image(systemName: "gear")
    .symbolEffect(.rotate, isActive: isProcessing)

// Direction
    .symbolEffect(.rotate.clockwise, isActive: true)
    .symbolEffect(.rotate.counterClockwise, isActive: true)

// By Layer — only specific layers rotate (e.g., fan blades)
    .symbolEffect(.rotate.byLayer, isActive: true)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.rotate)
imageView.removeSymbolEffect(ofType: RotateSymbolEffect.self)
```

---

### Breathe (iOS 18+)

**Protocols**: `DiscreteSymbolEffect`, `IndefiniteSymbolEffect`

```swift
// Basic breathe
Image(systemName: "heart.fill")
    .symbolEffect(.breathe, isActive: isMonitoring)

// Plain — scale only
    .symbolEffect(.breathe.plain, isActive: true)

// Pulse — scale + opacity variation
    .symbolEffect(.breathe.pulse, isActive: true)

// By Layer
    .symbolEffect(.breathe.byLayer, isActive: true)
```

**UIKit**:
```swift
imageView.addSymbolEffect(.breathe)
imageView.removeSymbolEffect(ofType: BreatheSymbolEffect.self)
```

---

### Appear and Disappear

**Protocols**: `TransitionSymbolEffect`

```swift
// SwiftUI transition
if showSymbol {
    Image(systemName: "checkmark.circle.fill")
        .transition(.symbolEffect(.appear))
}

if showSymbol {
    Image(systemName: "xmark.circle.fill")
        .transition(.symbolEffect(.disappear))
}

// Directional
    .transition(.symbolEffect(.appear.up))
    .transition(.symbolEffect(.appear.down))
    .transition(.symbolEffect(.disappear.up))
    .transition(.symbolEffect(.disappear.down))

// By Layer
    .transition(.symbolEffect(.appear.byLayer))

// Whole Symbol
    .transition(.symbolEffect(.appear.wholeSymbol))
```

**UIKit** (as effect, not transition):
```swift
// Make symbol appear
imageView.addSymbolEffect(.appear)

// Make symbol disappear
imageView.addSymbolEffect(.disappear)

// Appear after disappear
imageView.addSymbolEffect(.appear) // re-shows hidden symbol
```

---

### Replace

**Protocols**: `ContentTransitionSymbolEffect`

```swift
// SwiftUI content transition
Image(systemName: isFavorite ? "star.fill" : "star")
    .contentTransition(.symbolEffect(.replace))

// Directional variants
    .contentTransition(.symbolEffect(.replace.downUp))
    .contentTransition(.symbolEffect(.replace.upUp))
    .contentTransition(.symbolEffect(.replace.offUp))

// By Layer
    .contentTransition(.symbolEffect(.replace.byLayer))

// Whole Symbol
    .contentTransition(.symbolEffect(.replace.wholeSymbol))

// Magic Replace — default in iOS 18+, morphs shared elements
// Automatic for structurally related pairs: star ↔ star.fill, pause.fill ↔ play.fill
    .contentTransition(.symbolEffect(.replace))

// Explicit Magic Replace with fallback for unrelated symbols
    .contentTransition(.symbolEffect(.replace.magic(fallback: .replace.downUp)))
```

**UIKit**:
```swift
// Change symbol with Replace transition
let newImage = UIImage(systemName: "star.fill")
imageView.setSymbolImage(newImage!, contentTransition: .replace)

// Directional
imageView.setSymbolImage(newImage!, contentTransition: .replace.downUp)
```

---

## Part 4: Draw Effects (iOS 26+)

### Draw On

```swift
// Indefinite — draws in while active
Image(systemName: "checkmark.circle")
    .symbolEffect(.drawOn, isActive: isComplete)

// Playback modes
    .symbolEffect(.drawOn.byLayer, isActive: isActive)
    .symbolEffect(.drawOn.wholeSymbol, isActive: isActive)
    .symbolEffect(.drawOn.individually, isActive: isActive)

// With options
    .symbolEffect(.drawOn, options: .speed(2.0), isActive: isActive)
    .symbolEffect(.drawOn, options: .nonRepeating, isActive: isActive)
```

### Draw Off

```swift
// Indefinite — draws out while active
Image(systemName: "star.fill")
    .symbolEffect(.drawOff, isActive: isHidden)

// Playback modes
    .symbolEffect(.drawOff.byLayer, isActive: isActive)
    .symbolEffect(.drawOff.wholeSymbol, isActive: isActive)
    .symbolEffect(.drawOff.individually, isActive: isActive)

// Direction control
    .symbolEffect(.drawOff.nonReversed, isActive: isActive) // follows draw path forward
    .symbolEffect(.drawOff.reversed, isActive: isActive)    // erases in reverse order
```

### UIKit Draw Effects

```swift
// Draw On
imageView.addSymbolEffect(.drawOn)

// Draw Off
imageView.addSymbolEffect(.drawOff)

// Remove
imageView.removeSymbolEffect(ofType: DrawOnSymbolEffect.self)
```

### Variable Draw

Uses `SymbolVariableValueMode` to control how variable values are rendered.

```swift
// Variable Draw — draws stroke proportional to value (iOS 26+)
Image(systemName: "thermometer.high", variableValue: temperature)
    .symbolVariableValueMode(.draw)

// Variable Color — sets layer opacity based on threshold (iOS 17+, default)
Image(systemName: "wifi", variableValue: signalStrength)
    .symbolVariableValueMode(.color)
```

#### SymbolVariableValueMode Enum (iOS 26+)

| Case | Description |
|------|-------------|
| `.color` | Sets opacity of each variable layer on/off based on threshold (existing behavior) |
| `.draw` | Changes drawn length of each variable layer based on range |

**Constraint**: Some symbols support only one mode. Setting an unsupported mode has no visible effect. A symbol cannot use both Variable Color and Variable Draw simultaneously.

### Gradient Rendering (iOS 26+)

Uses `SymbolColorRenderingMode` for automatic gradient generation from a single color.

```swift
// Gradient fill — system generates axial gradient from source color
Image(systemName: "heart.fill")
    .symbolColorRenderingMode(.gradient)
    .foregroundStyle(.red)

// Works with any rendering mode
Image(systemName: "cloud.rain.fill")
    .symbolRenderingMode(.hierarchical)
    .symbolColorRenderingMode(.gradient)
    .foregroundStyle(.blue)
```

#### SymbolColorRenderingMode Enum (iOS 26+)

| Case | Description |
|------|-------------|
| `.flat` | Solid color fill (default) |
| `.gradient` | Axial gradient generated from source color |

Gradients are most effective at larger symbol sizes and work across all rendering modes.

---

## Part 5: Content Transition Patterns

### Symbol Swap with Replace

```swift
struct PlayPauseButton: View {
    @State private var isPlaying = false

    var body: some View {
        Button {
            isPlaying.toggle()
        } label: {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .contentTransition(.symbolEffect(.replace))
        }
        .accessibilityLabel(isPlaying ? "Pause" : "Play")
    }
}
```

### Download Progress Pattern

```swift
struct DownloadButton: View {
    @State private var state: DownloadState = .idle

    var symbolName: String {
        switch state {
        case .idle: "arrow.down.circle"
        case .downloading: "stop.circle"
        case .complete: "checkmark.circle.fill"
        }
    }

    var body: some View {
        Button {
            advanceState()
        } label: {
            Image(systemName: symbolName)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.pulse, isActive: state == .downloading)
        }
    }
}
```

### Toggle with Effect Feedback

```swift
struct FavoriteButton: View {
    @Binding var isFavorite: Bool
    @State private var bounceValue = 0

    var body: some View {
        Button {
            isFavorite.toggle()
            bounceValue += 1
        } label: {
            Image(systemName: isFavorite ? "star.fill" : "star")
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: bounceValue)
                .foregroundStyle(isFavorite ? .yellow : .gray)
        }
    }
}
```

---

## Part 6: Custom Symbols

### Template Structure

Custom symbols are SVG files with specific layer annotations:

1. **Export from design tool** as SVG
2. **Import into SF Symbols app** (File > Import)
3. **Set template type**: Monochrome, Hierarchical, Multicolor, or Variable Color
4. **Annotate layers** for rendering modes:
   - **Primary** layer: Full opacity in Hierarchical
   - **Secondary** layer: Reduced opacity in Hierarchical
   - **Tertiary** layer: Most reduced opacity in Hierarchical
5. **Set Palette colors** per layer if supporting Palette mode
6. **Export** as `.svg` template for Xcode

### Draw Annotation (SF Symbols 7)

To enable Draw animations on custom symbols:

1. Select a path in SF Symbols 7 app
2. Open the Draw annotation panel
3. Place guide points on the path:

| Point Type | Visual | Purpose |
|------------|--------|---------|
| Start | Open circle | Where drawing begins |
| End | Closed circle | Where drawing ends |
| Corner | Diamond | Sharp direction change |
| Bidirectional | Double arrow | Center-outward drawing |
| Attachment | Link icon | Non-drawing decorative connection |

4. **Minimum**: 2 guide points per path (start + end)
5. **Option-drag** for precise placement
6. Test in Preview panel across all weights

### Weight Interpolation

Custom symbols should include designs for at least 3 weight variants:
- **Ultralight** (thinnest)
- **Regular** (middle)
- **Black** (thickest)

The system interpolates between these for intermediate weights (Thin, Light, Medium, Semibold, Bold, Heavy).

### Importing to Xcode

1. In Xcode, open Asset Catalog
2. Click **+** > **Symbol Image Set**
3. Drag exported `.svg` from SF Symbols app
4. Asset catalog symbols: `Image("custom.symbol.name")`. For symbols loaded from a bundle: `Image(systemName: "custom.symbol.name", bundle: .module)`

---

## Part 7: Platform Availability Matrix

### Rendering Modes

| Feature | iOS | macOS | watchOS | tvOS | visionOS |
|---------|-----|-------|---------|------|----------|
| Monochrome | 13+ | 11+ | 6+ | 13+ | 1+ |
| Hierarchical | 15+ | 12+ | 8+ | 15+ | 1+ |
| Palette | 15+ | 12+ | 8+ | 15+ | 1+ |
| Multicolor | 15+ | 12+ | 8+ | 15+ | 1+ |
| Variable Value | 16+ | 13+ | 9+ | 16+ | 1+ |

### Symbol Effects

| Effect | Category | iOS | macOS | watchOS | tvOS | visionOS |
|--------|----------|-----|-------|---------|------|----------|
| Bounce | Discrete | 17+ | 14+ | 10+ | 17+ | 1+ |
| Pulse | Discrete/Indefinite | 17+ | 14+ | 10+ | 17+ | 1+ |
| Variable Color | Discrete/Indefinite | 17+ | 14+ | 10+ | 17+ | 1+ |
| Scale | Indefinite | 17+ | 14+ | 10+ | 17+ | 1+ |
| Appear | Transition | 17+ | 14+ | 10+ | 17+ | 1+ |
| Disappear | Transition | 17+ | 14+ | 10+ | 17+ | 1+ |
| Replace | Content Transition | 17+ | 14+ | 10+ | 17+ | 1+ |
| Wiggle | Discrete/Indefinite | 18+ | 15+ | 11+ | 18+ | 2+ |
| Rotate | Discrete/Indefinite | 18+ | 15+ | 11+ | 18+ | 2+ |
| Breathe | Discrete/Indefinite | 18+ | 15+ | 11+ | 18+ | 2+ |
| Draw On | Indefinite | 26+ | Tahoe+ | 26+ | 26+ | 26+ |
| Draw Off | Indefinite | 26+ | Tahoe+ | 26+ | 26+ | 26+ |
| Variable Draw | Value-based | 26+ | Tahoe+ | 26+ | 26+ | 26+ |
| Gradient Fill | Rendering | 26+ | Tahoe+ | 26+ | 26+ | 26+ |

### Effect Behavior Categories

| Category | What It Does | How to Trigger |
|----------|-------------|----------------|
| Discrete | One-shot animation, returns to rest | `.symbolEffect(_:value:)` — fires when value changes |
| Indefinite | Loops while active | `.symbolEffect(_:isActive:)` — loops while `true` |
| Transition | Plays on view insert/remove | `.transition(.symbolEffect(_:))` |
| Content Transition | Plays when symbol changes | `.contentTransition(.symbolEffect(_:))` |

---

## Part 8: UIKit Complete Reference

### Adding Effects

```swift
// Add indefinite effect
imageView.addSymbolEffect(.pulse)
imageView.addSymbolEffect(.breathe)
imageView.addSymbolEffect(.rotate)
imageView.addSymbolEffect(.variableColor.iterative)
imageView.addSymbolEffect(.scale.up)

// Add with options
imageView.addSymbolEffect(.bounce, options: .repeat(3))
imageView.addSymbolEffect(.pulse, options: .speed(2.0))

// Add with completion handler
imageView.addSymbolEffect(.bounce, options: .default) { context in
    // Called when effect finishes
    print("Bounce complete")
}
```

### Removing Effects

```swift
// Remove specific effect type
imageView.removeSymbolEffect(ofType: PulseSymbolEffect.self)
imageView.removeSymbolEffect(ofType: ScaleSymbolEffect.self)
imageView.removeSymbolEffect(ofType: RotateSymbolEffect.self)

// Remove all effects
imageView.removeAllSymbolEffects()

// Remove with options
imageView.removeSymbolEffect(ofType: PulseSymbolEffect.self, options: .default)

// Remove with completion
imageView.removeSymbolEffect(ofType: PulseSymbolEffect.self) { context in
    print("Pulse removed")
}
```

### Setting Symbol Images with Transitions

```swift
// Replace with content transition
let newImage = UIImage(systemName: "pause.fill")!
imageView.setSymbolImage(newImage, contentTransition: .replace)

// Directional replace
imageView.setSymbolImage(newImage, contentTransition: .replace.downUp)
imageView.setSymbolImage(newImage, contentTransition: .replace.upUp)
imageView.setSymbolImage(newImage, contentTransition: .replace.offUp)

// With options
imageView.setSymbolImage(newImage, contentTransition: .replace, options: .speed(2.0))
```

### UIBarButtonItem Effects

```swift
// Effects also work on UIBarButtonItem
barButtonItem.addSymbolEffect(.bounce)
barButtonItem.addSymbolEffect(.pulse, isActive: isLoading)
barButtonItem.removeSymbolEffect(ofType: PulseSymbolEffect.self)
```

---

## Part 9: Accessibility

### Labels

```swift
// SwiftUI
Image(systemName: "star.fill")
    .accessibilityLabel("Favorite")

// UIKit
let image = UIImage(systemName: "star.fill")
imageView.accessibilityLabel = "Favorite"
imageView.isAccessibilityElement = true

// Label automatically provides accessibility
Label("Settings", systemImage: "gear")
// VoiceOver reads: "Settings"
```

### Reduce Motion

Symbol effects automatically respect `UIAccessibility.isReduceMotionEnabled`. When Reduce Motion is on:
- Most effects are simplified or suppressed
- Replace transitions use crossfade instead of directional movement
- Indefinite effects may be simplified to static appearance changes

**Do not** attempt to override or check this yourself for effects. The system handles it. Only intervene if effects carry semantic meaning:

```swift
// If the pulsing conveys connection status, provide a text label
Image(systemName: "wifi")
    .symbolEffect(.pulse, isActive: isConnecting)
    .accessibilityLabel(isConnecting ? "Connecting to WiFi" : "WiFi connected")
```

### Bold Text

SF Symbols automatically adapt when Bold Text is enabled in Accessibility settings. Custom symbols need weight variants to support this properly.

### Dynamic Type

Symbols sized with `.font()` scale automatically with Dynamic Type. Symbols sized with explicit point sizes (`.font(.system(size: 24))`) do **not** scale.

```swift
// ✅ Scales with Dynamic Type
Image(systemName: "star.fill")
    .font(.title)

// ❌ Fixed size, does not scale
Image(systemName: "star.fill")
    .font(.system(size: 24))
```

---

## Part 10: Common Patterns

### Notification Badge with Effect

```swift
struct NotificationBell: View {
    let count: Int

    var body: some View {
        Image(systemName: count > 0 ? "bell.badge.fill" : "bell.fill")
            .contentTransition(.symbolEffect(.replace))
            .symbolEffect(.wiggle, value: count)
            .symbolRenderingMode(.palette)
            .foregroundStyle(count > 0 ? .red : .primary, .primary)
    }
}
```

### WiFi Strength Indicator

```swift
struct WiFiIndicator: View {
    let strength: Double // 0.0 to 1.0
    let isSearching: Bool

    var body: some View {
        Image(systemName: "wifi", variableValue: strength)
            .symbolEffect(.variableColor.iterative, isActive: isSearching)
            .symbolRenderingMode(.hierarchical)
            .accessibilityLabel(
                isSearching ? "Searching for WiFi" :
                "WiFi strength: \(Int(strength * 100))%"
            )
    }
}
```

### Animated Toggle

```swift
struct RecordButton: View {
    @State private var isRecording = false

    var body: some View {
        Button {
            isRecording.toggle()
        } label: {
            Image(systemName: isRecording ? "stop.circle.fill" : "record.circle")
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.breathe.pulse, isActive: isRecording)
                .font(.largeTitle)
                .foregroundStyle(isRecording ? .red : .primary)
        }
        .accessibilityLabel(isRecording ? "Stop recording" : "Start recording")
    }
}
```

### Multi-State Symbol with Draw (iOS 26+)

```swift
struct TaskCheckbox: View {
    @State private var isComplete = false

    var body: some View {
        Button {
            isComplete.toggle()
        } label: {
            Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.drawOn, isActive: isComplete)
                .font(.title2)
                .foregroundStyle(isComplete ? .green : .secondary)
        }
        .accessibilityLabel(isComplete ? "Completed" : "Not completed")
    }
}
```

---

## Resources

**WWDC**: 2023-10257, 2023-10258, 2024-10188, 2025-337

**Docs**: /symbols, /symbols/symboleffect, /symbols/bouncesymboleffect, /symbols/pulsesymboleffect, /symbols/variablecolorsymboleffect, /symbols/scalesymboleffect, /symbols/wigglesymboleffect, /symbols/rotatesymboleffect, /symbols/breathesymboleffect, /symbols/appearsymboleffect, /symbols/disappearsymboleffect, /symbols/replacesymboleffect, /symbols/drawonsymboleffect, /symbols/drawoffsymboleffect, /swiftui/image/symbolrenderingmode(_:), /uikit/uiimage/symbolconfiguration

**Skills**: axiom-sf-symbols, axiom-hig-ref, axiom-swiftui-animation-ref

---

**Last Updated** Based on WWDC 2023/10257-10258, WWDC 2024/10188, WWDC 2025/337
**Version** iOS 13+ (display), iOS 15+ (rendering modes), iOS 17+ (effects), iOS 18+ (Wiggle/Rotate/Breathe), iOS 26+ (Draw, Gradients)
