---
name: accessibility-debugging
description: Use when fixing VoiceOver issues, Dynamic Type violations, color contrast failures, touch target problems, keyboard navigation gaps, or Reduce Motion support - comprehensive accessibility diagnostics with WCAG compliance, Accessibility Inspector workflows, and App Store Review preparation for iOS/macOS
---

# Accessibility Debugging

## Overview

Systematic accessibility diagnosis and remediation for iOS/macOS apps. Covers the 7 most common accessibility issues that cause App Store rejections and user complaints.

**Core principle** Accessibility is not optional. iOS apps must support VoiceOver, Dynamic Type, and sufficient color contrast to pass App Store Review. Users with disabilities depend on these features.

## When to Use This Skill

- Fixing VoiceOver navigation issues (missing labels, wrong element order)
- Supporting Dynamic Type (text scaling for vision disabilities)
- Meeting color contrast requirements (WCAG AA/AAA)
- Fixing touch target size violations (< 44x44pt)
- Adding keyboard navigation (iPadOS/macOS)
- Supporting Reduce Motion (vestibular disorders)
- Preparing for App Store Review accessibility requirements
- Responding to user complaints about accessibility

## The 7 Critical Accessibility Issues

### 1. VoiceOver Labels & Hints (CRITICAL - App Store Rejection)

**Problem** Missing or generic accessibility labels prevent VoiceOver users from understanding UI purpose.

**WCAG** 4.1.2 Name, Role, Value (Level A)

**Common violations**
```swift
// ❌ WRONG - No label (VoiceOver says "Button")
Button(action: addToCart) {
  Image(systemName: "cart.badge.plus")
}

// ❌ WRONG - Generic label
.accessibilityLabel("Button")

// ❌ WRONG - Reads implementation details
.accessibilityLabel("cart.badge.plus") // VoiceOver: "cart dot badge dot plus"

// ✅ CORRECT - Descriptive label
Button(action: addToCart) {
  Image(systemName: "cart.badge.plus")
}
.accessibilityLabel("Add to cart")

// ✅ CORRECT - With hint for complex actions
.accessibilityLabel("Add to cart")
.accessibilityHint("Double-tap to add this item to your shopping cart")
```

**When to use hints**
- Action is not obvious from label ("Add to cart" is obvious, no hint needed)
- Multi-step interaction ("Swipe right to confirm, left to cancel")
- State change ("Double-tap to toggle notifications on or off")

**Decorative elements**
```swift
// ✅ CORRECT - Hide decorative images from VoiceOver
Image("decorative-pattern")
  .accessibilityHidden(true)

// ✅ CORRECT - Combine multiple elements into one label
HStack {
  Image(systemName: "star.fill")
  Text("4.5")
  Text("(234 reviews)")
}
.accessibilityElement(children: .combine)
.accessibilityLabel("Rating: 4.5 stars from 234 reviews")
```

**Testing**
- Enable VoiceOver: Cmd+F5 (simulator) or triple-click side button (device)
- Navigate: Swipe right/left to move between elements
- Listen: Does VoiceOver announce purpose clearly?
- Check order: Does navigation order match visual layout?

---

### 2. Dynamic Type Support (HIGH - User Experience)

**Problem** Fixed font sizes prevent users with vision disabilities from reading text.

**WCAG** 1.4.4 Resize Text (Level AA - support 200% scaling without loss of content/functionality)

**Common violations**
```swift
// ❌ WRONG - Fixed size, won't scale
Text("Price: $19.99")
  .font(.system(size: 17))

UILabel().font = UIFont.systemFont(ofSize: 17)

// ❌ WRONG - Custom font without scaling
Text("Headline")
  .font(Font.custom("CustomFont", size: 24))

// ✅ CORRECT - SwiftUI semantic styles (auto-scales)
Text("Price: $19.99")
  .font(.body)

Text("Headline")
  .font(.headline)

// ✅ CORRECT - UIKit semantic styles
label.font = UIFont.preferredFont(forTextStyle: .body)

// ✅ CORRECT - Custom font with scaling
let customFont = UIFont(name: "CustomFont", size: 24)!
label.font = UIFontMetrics.default.scaledFont(for: customFont)
label.adjustsFontForContentSizeCategory = true
```

**SwiftUI text styles**
- `.largeTitle` - 34pt (scales to 44pt at accessibility sizes)
- `.title` - 28pt
- `.title2` - 22pt
- `.title3` - 20pt
- `.headline` - 17pt semibold
- `.body` - 17pt (default)
- `.callout` - 16pt
- `.subheadline` - 15pt
- `.footnote` - 13pt
- `.caption` - 12pt
- `.caption2` - 11pt

**Layout considerations**
```swift
// ❌ WRONG - Fixed frame breaks with large text
Text("Long product description...")
  .font(.body)
  .frame(height: 50) // Clips at large text sizes

// ✅ CORRECT - Flexible frame
Text("Long product description...")
  .font(.body)
  .lineLimit(nil) // Allow multiple lines
  .fixedSize(horizontal: false, vertical: true)

// ✅ CORRECT - Stack rearranges at large sizes
HStack {
  Text("Label:")
  Text("Value")
}
.dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Limit maximum size if needed
```

**Testing**
1. Xcode Preview: Environment override
   ```swift
   .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
   ```

2. Simulator: Settings → Accessibility → Display & Text Size → Larger Text → Drag to maximum

3. Device: Settings → Accessibility → Display & Text Size → Larger Text

4. Check: Does text remain readable? Does layout adapt? Is any text clipped?

---

### 3. Color Contrast (HIGH - Vision Disabilities)

**Problem** Low contrast text is unreadable for users with vision disabilities or in bright sunlight.

**WCAG**
- **1.4.3 Contrast (Minimum)** — Level AA
  - Normal text (< 18pt): 4.5:1 contrast ratio
  - Large text (≥ 18pt or ≥ 14pt bold): 3:1 contrast ratio
- **1.4.6 Contrast (Enhanced)** — Level AAA
  - Normal text: 7:1 contrast ratio
  - Large text: 4.5:1 contrast ratio

**Common violations**
```swift
// ❌ WRONG - Low contrast (1.8:1 - fails WCAG)
Text("Warning")
  .foregroundColor(.yellow) // on white background

// ❌ WRONG - Low contrast in dark mode
Text("Info")
  .foregroundColor(.gray) // on black background

// ✅ CORRECT - High contrast (7:1+ passes AAA)
Text("Warning")
  .foregroundColor(.orange) // or .red

// ✅ CORRECT - System colors adapt to light/dark mode
Text("Info")
  .foregroundColor(.primary) // Black in light mode, white in dark

Text("Secondary")
  .foregroundColor(.secondary) // Automatic high contrast
```

**Differentiate Without Color**
```swift
// ❌ WRONG - Color alone indicates status
Circle()
  .fill(isAvailable ? .green : .red)

// ✅ CORRECT - Color + icon/text
HStack {
  Image(systemName: isAvailable ? "checkmark.circle.fill" : "xmark.circle.fill")
  Text(isAvailable ? "Available" : "Unavailable")
}
.foregroundColor(isAvailable ? .green : .red)

// ✅ CORRECT - Respect system preference
if UIAccessibility.shouldDifferentiateWithoutColor {
  // Use patterns, icons, or text instead of color alone
}
```

**Testing**
1. Use Color Contrast Analyzer tool (free download)
2. Screenshot your UI, measure text vs background
3. Check both light and dark mode
4. Settings → Accessibility → Display & Text Size → Increase Contrast (test with this ON)

**Quick reference**
- Black (#000000) on White (#FFFFFF): 21:1 ✅ AAA
- Dark Gray (#595959) on White: 7:1 ✅ AAA
- Medium Gray (#767676) on White: 4.5:1 ✅ AA
- Light Gray (#959595) on White: 2.8:1 ❌ Fails

---

### 4. Touch Target Sizes (MEDIUM - Motor Disabilities)

**Problem** Small tap targets are difficult or impossible for users with motor disabilities.

**WCAG** 2.5.5 Target Size (Level AAA - 44x44pt minimum)

**Apple HIG** 44x44pt minimum for all tappable elements

**Common violations**
```swift
// ❌ WRONG - Too small (24x24pt)
Button("×") {
  dismiss()
}
.frame(width: 24, height: 24)

// ❌ WRONG - Small icon without padding
Image(systemName: "heart")
  .font(.system(size: 16))
  .onTapGesture { }

// ✅ CORRECT - Minimum 44x44pt
Button("×") {
  dismiss()
}
.frame(minWidth: 44, minHeight: 44)

// ✅ CORRECT - Larger icon or padding
Image(systemName: "heart")
  .font(.system(size: 24))
  .frame(minWidth: 44, minHeight: 44)
  .contentShape(Rectangle()) // Expand tap area
  .onTapGesture { }

// ✅ CORRECT - UIKit button with edge insets
button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
// Total size: icon size + insets ≥ 44x44pt
```

**Spacing between targets**
```swift
// ❌ WRONG - Targets too close (hard to tap accurately)
HStack(spacing: 4) {
  Button("Edit") { }
  Button("Delete") { }
}

// ✅ CORRECT - Adequate spacing (8pt minimum, 12pt better)
HStack(spacing: 12) {
  Button("Edit") { }
  Button("Delete") { }
}
```

**Testing**
1. Accessibility Inspector: Xcode → Open Developer Tool → Accessibility Inspector
2. Select "Audit" tab → Run audit → Check for "Small Text" and "Hit Region" warnings
3. Manual: Tap with one finger (not stylus) — can you hit it reliably without mistakes?

---

### 5. Keyboard Navigation (MEDIUM - iPadOS/macOS)

**Problem** Users who cannot use touch/mouse cannot navigate app.

**WCAG** 2.1.1 Keyboard (Level A - all functionality available via keyboard)

**Common violations**
```swift
// ❌ WRONG - Custom gesture without keyboard alternative
.onTapGesture {
  showDetails()
}
// No way to trigger with keyboard

// ✅ CORRECT - Button provides keyboard support automatically
Button("Show Details") {
  showDetails()
}
.keyboardShortcut("d", modifiers: .command) // Optional shortcut

// ✅ CORRECT - Custom control with focus support
struct CustomButton: View {
  @FocusState private var isFocused: Bool

  var body: some View {
    Text("Custom")
      .focusable()
      .focused($isFocused)
      .onKeyPress(.return) {
        action()
        return .handled
      }
  }
}
```

**Focus management**
```swift
// ✅ CORRECT - Set initial focus
.focusSection() // Group related controls
.defaultFocus($focus, .constant(true)) // Set default

// ✅ CORRECT - Move focus after action
@FocusState private var focusedField: Field?

Button("Next") {
  focusedField = .next
}
```

**Testing (iPadOS/macOS)**
1. Connect keyboard to iPad or use Mac
2. Press Tab - does focus move to interactive elements?
3. Press Space/Return - does focused element activate?
4. Check custom controls have visible focus indicator
5. Can you reach all functionality without mouse/touch?

---

### 6. Reduce Motion Support (MEDIUM - Vestibular Disorders)

**Problem** Animations cause discomfort, nausea, or seizures for users with vestibular disorders.

**WCAG** 2.3.3 Animation from Interactions (Level AAA - motion animation can be disabled)

**Common violations**
```swift
// ❌ WRONG - Always animates (can cause nausea)
.onAppear {
  withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
    scale = 1.0
  }
}

// ❌ WRONG - Parallax scrolling without opt-out
ScrollView {
  GeometryReader { geo in
    Image("hero")
      .offset(y: geo.frame(in: .global).minY * 0.5) // Parallax
  }
}

// ✅ CORRECT - Respect Reduce Motion preference
.onAppear {
  if UIAccessibility.isReduceMotionEnabled {
    scale = 1.0 // Instant
  } else {
    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
      scale = 1.0
    }
  }
}

// ✅ CORRECT - Simpler animation or cross-fade
if UIAccessibility.isReduceMotionEnabled {
  // Cross-fade or instant change
  withAnimation(.linear(duration: 0.2)) {
    showView = true
  }
} else {
  // Complex spring animation
  withAnimation(.spring()) {
    showView = true
  }
}
```

**SwiftUI modifier**
```swift
// ✅ CORRECT - Automatic support
.animation(.spring(), value: isExpanded)
.transaction { transaction in
  if UIAccessibility.isReduceMotionEnabled {
    transaction.animation = nil // Disable animation
  }
}
```

**Testing**
1. Settings → Accessibility → Motion → Reduce Motion (toggle ON)
2. Navigate app - are animations reduced or eliminated?
3. Test: Transitions, scrolling effects, parallax, particle effects
4. Video autoplay should also respect this preference

---

### 7. Common Violations (HIGH - App Store Review)

#### Images Without Labels

```swift
// ❌ WRONG - Informative image without label
Image("product-photo")

// ✅ CORRECT - Informative image with label
Image("product-photo")
  .accessibilityLabel("Red sneakers with white laces")

// ✅ CORRECT - Decorative image hidden
Image("background-pattern")
  .accessibilityHidden(true)
```

#### Buttons With Wrong Traits

```swift
// ❌ WRONG - Custom button without button trait
Text("Submit")
  .onTapGesture {
    submit()
  }
// VoiceOver announces as "Submit, text" not "Submit, button"

// ✅ CORRECT - Use Button for button-like controls
Button("Submit") {
  submit()
}
// VoiceOver announces as "Submit, button"

// ✅ CORRECT - Custom control with correct trait
Text("Submit")
  .accessibilityAddTraits(.isButton)
  .onTapGesture {
    submit()
  }
```

#### Inaccessible Custom Controls

```swift
// ❌ WRONG - Custom slider without accessibility support
struct CustomSlider: View {
  @Binding var value: Double

  var body: some View {
    // Drag gesture only, no VoiceOver support
    GeometryReader { geo in
      // ...
    }
    .gesture(DragGesture()...)
  }
}

// ✅ CORRECT - Custom slider with accessibility actions
struct CustomSlider: View {
  @Binding var value: Double

  var body: some View {
    GeometryReader { geo in
      // ...
    }
    .gesture(DragGesture()...)
    .accessibilityElement()
    .accessibilityLabel("Volume")
    .accessibilityValue("\(Int(value))%")
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        value = min(value + 10, 100)
      case .decrement:
        value = max(value - 10, 0)
      @unknown default:
        break
      }
    }
  }
}
```

#### Missing State Announcements

```swift
// ❌ WRONG - State change without announcement
Button("Toggle") {
  isOn.toggle()
}

// ✅ CORRECT - State change with announcement
Button("Toggle") {
  isOn.toggle()
  UIAccessibility.post(
    notification: .announcement,
    argument: isOn ? "Enabled" : "Disabled"
  )
}

// ✅ CORRECT - Automatic state with accessibilityValue
Button("Toggle") {
  isOn.toggle()
}
.accessibilityValue(isOn ? "Enabled" : "Disabled")
```

## Accessibility Inspector Workflow

### 1. Launch Accessibility Inspector

Xcode → Open Developer Tool → Accessibility Inspector

### 2. Select Target

- Dropdown: Choose running simulator or connected device
- Target: Select your app

### 3. Inspection Mode

- Click "Inspection Pointer" button (crosshair icon)
- Hover over UI elements to see:
  - Label, Value, Hint, Traits
  - Frame, Path
  - Actions available
  - Parent/child hierarchy

### 4. Run Audit

- Click "Audit" tab
- Click "Run Audit" button
- Review findings:
  - **Contrast** — Color contrast issues
  - **Hit Region** — Touch target size issues
  - **Clipped Text** — Text truncation with Dynamic Type
  - **Element Description** — Missing labels/hints
  - **Traits** — Wrong accessibility traits

### 5. Fix and Re-Test

- Click each finding for details
- Fix in code
- Re-run audit to verify

## VoiceOver Testing Checklist

### Enable VoiceOver
- **Simulator** Cmd+F5 or Settings → Accessibility → VoiceOver
- **Device** Triple-click side button (if enabled in Settings)

### Navigation Testing
1. ☐ Swipe right/left - moves logically through UI elements
2. ☐ Each element announces purpose clearly
3. ☐ No unlabeled elements (except decorative)
4. ☐ Heading navigation works (swipe up/down with 2 fingers)
5. ☐ Container navigation works (swipe left/right with 3 fingers)

### Interaction Testing
1. ☐ Double-tap activates buttons
2. ☐ Swipe up/down adjusts sliders/pickers (with `.accessibilityAdjustableAction`)
3. ☐ Custom gestures have VoiceOver equivalents
4. ☐ Text fields announce keyboard type
5. ☐ State changes are announced

### Content Testing
1. ☐ Images have descriptive labels or are hidden
2. ☐ Error messages are announced
3. ☐ Loading states are announced
4. ☐ Modal sheets announce role
5. ☐ Alerts announce automatically

## App Store Review Preparation

### Required Accessibility Features (iOS)

1. **VoiceOver Support**
   - All UI elements must have labels
   - Navigation must be logical
   - All actions must be performable

2. **Dynamic Type**
   - Text must scale from -3 to +12 sizes
   - Layout must adapt without clipping

3. **Sufficient Contrast**
   - Minimum 4.5:1 for normal text
   - Minimum 3:1 for large text (≥18pt)

### App Store Connect Metadata

When submitting:
1. Accessibility → Select features your app supports:
   - ☑ VoiceOver
   - ☑ Dynamic Type
   - ☑ Increased Contrast
   - ☑ Reduce Motion (if supported)

2. Test Notes: Document accessibility testing
   ```
   Accessibility Testing Completed:
   - VoiceOver: All screens tested with VoiceOver enabled
   - Dynamic Type: Tested at all size categories
   - Color Contrast: Verified 4.5:1 minimum contrast
   - Touch Targets: All buttons minimum 44x44pt
   - Reduce Motion: Animations respect user preference
   ```

### Common Rejection Reasons

1. **"App is not fully functional with VoiceOver"**
   - Missing labels on images/buttons
   - Unlabeled custom controls
   - Actions not performable with VoiceOver

2. **"Text is not readable at all Dynamic Type sizes"**
   - Fixed font sizes
   - Text clipping at large sizes
   - Layout breaks at accessibility sizes

3. **"Insufficient color contrast"**
   - Text fails 4.5:1 ratio
   - UI elements fail 3:1 ratio
   - Color-only indicators

## WCAG Compliance Levels

### Level A (Minimum — Required for App Store)
- 1.1.1 Non-text Content — Images have text alternatives
- 2.1.1 Keyboard — All functionality via keyboard (iPadOS/macOS)
- 4.1.2 Name, Role, Value — Elements have accessible names

### Level AA (Standard — Recommended)
- 1.4.3 Contrast (Minimum) — 4.5:1 text, 3:1 UI
- 1.4.4 Resize Text — Support 200% text scaling
- 1.4.5 Images of Text — Use real text when possible

### Level AAA (Enhanced — Best Practice)
- 1.4.6 Contrast (Enhanced) — 7:1 text, 4.5:1 UI
- 2.3.3 Animation from Interactions — Reduce Motion support
- 2.5.5 Target Size - 44x44pt minimum targets

**Goal** Meet Level AA for all content, Level AAA where feasible.

## Quick Command Reference

After making fixes:

```bash
# Quick scan for new issues
/axiom:audit-accessibility

# Deep diagnosis for specific issues
/skill axiom:accessibility-debugging
```

## Resources

### Apple Documentation
- [Accessibility — Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Supporting VoiceOver](https://developer.apple.com/documentation/accessibility/voiceover)
- [Supporting Dynamic Type](https://developer.apple.com/documentation/uikit/uifont/scaling_fonts_automatically)

### WCAG Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)

### Testing Tools
- Accessibility Inspector (Xcode)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)
- VoiceOver (built into iOS/macOS)

---

**Remember** Accessibility is not a feature, it's a requirement. 15% of users have some form of disability. Making your app accessible isn't just the right thing to do - it expands your user base and improves the experience for everyone.
