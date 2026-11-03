
# Accessibility Diagnostics

## Overview

Systematic accessibility diagnosis and remediation for Apple platform apps. Covers the most common accessibility issues users hit, and what must work before you declare support in Accessibility Nutrition Labels.

**Core principle** Accessibility is not optional. No App Store guideline requires it, but people who depend on VoiceOver, Dynamic Type, and sufficient contrast can't use an app without them, Accessibility Nutrition Labels put your support on the product page, and accessibility laws apply to many apps.

## When to Use This Skill

- Fixing VoiceOver navigation issues (missing labels, wrong element order)
- Supporting Dynamic Type (text scaling for vision disabilities), including tvOS Large Text
- Meeting color contrast requirements (WCAG AA/AAA)
- Fixing touch target size violations (< 44x44pt)
- Adding keyboard navigation (iPadOS/macOS)
- Supporting Reduce Motion (vestibular disorders)
- Supporting Assistive Access (cognitive disabilities)
- Making long-form reading apps work with VoiceOver continuous reading and Speak Screen
- Adding captions to a video player — generated subtitles (new in the 27 releases) and live subtitle style preview (iOS 26.4+)
- Preparing Accessibility Nutrition Labels for App Store Connect
- Responding to user complaints about accessibility

## The 7 Critical Accessibility Issues

### 1. VoiceOver Labels & Hints (CRITICAL)

**Problem** Missing or generic accessibility labels prevent VoiceOver users from understanding UI purpose.

**WCAG** 4.1.2 Name, Role, Value (Level A)

#### Common violations
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

// ✅ CORRECT - Hint when the result isn't obvious from the label
.accessibilityLabel("Archive")
.accessibilityHint("Moves the conversation to the Archive folder")
```

#### When to use hints
- The result is not obvious from the label ("Add to cart" is obvious, no hint needed)
- Write the result, not the gesture: Apple's examples are "Purchases the item." and "Downloads the attachment.", never "Double-tap to…"
- For a custom gesture, add an accessibility action (`.accessibilityAction(named:)`) rather than a hint that describes the gesture

#### Decorative elements
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

#### Testing
- Enable VoiceOver on a physical device: Settings → Accessibility → VoiceOver, or triple-click the side button (Home button on older devices) once the Accessibility Shortcut is set to VoiceOver. VoiceOver isn't available in Simulator; use Accessibility Inspector there
- Navigate: Swipe right/left to move between elements
- Listen: Does VoiceOver announce purpose clearly?
- Check order: Does navigation order match visual layout?

---

### 2. Dynamic Type Support (HIGH - User Experience)

**Problem** Fixed font sizes prevent users with vision disabilities from reading text.

**WCAG** 1.4.4 Resize Text (Level AA - support 200% scaling without loss of content/functionality)

#### Common violations
```swift
// ❌ WRONG - Fixed size, won't scale
Text("Price: $19.99")
  .font(.system(size: 17))

UILabel().font = UIFont.systemFont(ofSize: 17)

// ❌ WRONG - Custom font at a fixed size, won't scale
Text("Headline")
  .font(.custom("CustomFont", fixedSize: 24))

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

#### Custom sizes that scale with Dynamic Type
```swift
// ❌ WRONG - Fixed size, won't scale
Text("Price: $19.99")
  .font(.system(size: 17))

// ⚠️ ACCEPTABLE - Scales, but relative to body; a headline should track its own style
Text("Headline")
  .font(.custom("CustomFont", size: 24))

// ✅ GOOD - Custom-named font that scales relative to a text style
Text("Large Title")
  .font(.custom("CustomFont", size: 60, relativeTo: .largeTitle))

Text("Custom Headline")
  .font(.custom("CustomFont", size: 24, relativeTo: .title2))

// ✅ GOOD - System font at a custom size that scales with Dynamic Type
@ScaledMetric(relativeTo: .title2) private var headlineSize: CGFloat = 24

Text("Custom Headline")
  .font(.system(size: headlineSize))

// ✅ BEST - Use semantic styles when possible
Text("Headline")
  .font(.headline)
```

**How `relativeTo:` works**
- Base size: Your exact point size (24pt, 60pt, etc.)
- Scales with: The text style you specify (`.title2`, `.largeTitle`, etc.)
- Result: When user increases text size in Settings, your custom size grows proportionally

There is no `Font.system(size:).relativeTo(_:)` — the only `relativeTo:` Font factory is the static `Font.custom(_:size:relativeTo:)`. To scale a *system* font at a custom size, drive it with `@ScaledMetric(relativeTo:)` (or `UIFontMetrics(forTextStyle:).scaledValue(for:)` in UIKit).

**Example**
- `.title2` base: ~22pt → Your custom: 24pt (1.09x larger)
- User increases to "Extra Large" text
- `.title2` grows to ~28pt → Your custom grows to ~30.5pt (maintains 1.09x ratio)

**Fix hierarchy (best to worst)**
1. **Best**: Use semantic styles (`.title`, `.body`, `.caption`)
2. **Good**: `Font.custom(_:size:relativeTo:)` or `@ScaledMetric(relativeTo:)` for required custom sizes
3. **Acceptable**: Custom font with `.dynamicTypeSize()` modifier
4. **Unacceptable**: Fixed sizes that never scale

#### SwiftUI text styles
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

#### Layout considerations

The font scaling is the easy half. **Clipping is almost always a fixed *frame*, not a fixed font** — text that scales correctly still gets cut off when it grows inside a hardcoded `height`, a single-line cap, or a horizontal stack that runs out of width. Switch the font to a semantic style AND free the container.

```swift
// ❌ WRONG - Fixed frame clips, single line truncates
Text("Long product description...")
  .font(.body)
  .frame(height: 50)
  .lineLimit(1)

// ✅ CORRECT - Let the text grow vertically
Text("Long product description...")
  .font(.body)
  .lineLimit(nil)
  .fixedSize(horizontal: false, vertical: true)
```

At accessibility sizes a horizontal row of label + control overflows. Reflow to vertical instead of capping the type size — capping defeats the user's setting, and a cap below AX3, the first iOS size past 200%, also rules out declaring Larger Text.

```swift
// ❌ WRONG - capping the size hides text the user asked for
HStack {
  Text("Label:")
  Text("Value")
}
.dynamicTypeSize(...DynamicTypeSize.accessibility1)

// ✅ CORRECT - reflow HStack → VStack at accessibility sizes
@Environment(\.dynamicTypeSize) private var typeSize

var body: some View {
  let layout = typeSize.isAccessibilitySize
    ? AnyLayout(VStackLayout(alignment: .leading))
    : AnyLayout(HStackLayout())
  layout {
    Text("Label:")
    Text("Value")
  }
}
```

#### Dynamic Type Comes to tvOS `tvOS27`

Large Text support arrives on tvOS 27, bringing system-wide text scaling to every app on the platform (WWDC 2026-221). Users enable it in Settings → Accessibility → Display → Text Size. Apps that hardcode sizes now break on Apple TV the same way they would on iPhone.

Everything above applies unchanged — the APIs have existed on tvOS all along; what's new is that the system setting now drives them:
- SwiftUI semantic styles and `Font.custom(_:size:relativeTo:)` scale automatically
- UIKit needs `UIFont.preferredFont(forTextStyle:)` + `adjustsFontForContentSizeCategory = true`
- Free the containers: flexible constraints (`maxWidth: .infinity`), no fixed frames

tvOS shelf layouts need count adaptation, not just font scaling — six posters per row won't fit when titles grow:

```swift
struct MovieShelf: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    ScrollView(.horizontal) {
      LazyHStack(spacing: 40) {
        ForEach(movies) { movie in
          MovieCell(movie: movie)
            .containerRelativeFrame(
              .horizontal,
              count: dynamicTypeSize.isAccessibilitySize ? 4 : 6,
              spacing: 40)
        }
      }
    }
  }
}
```

Card cells reflow image-beside-text to a vertical stack at accessibility sizes (same `AnyLayout` pattern as above). In UIKit, drive a `UIStackView` axis flip from the content size category and re-evaluate on trait changes:

```swift
final class CardCell: UICollectionViewCell {
    let stack = UIStackView()

    // Call ONCE after init — not on every dequeue, or handlers stack up
    func setUpAdaptiveLayout() {
        updateAxis()
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) {
            (cell: Self, _: UITraitCollection) in
            cell.updateAxis()
        }
    }

    private func updateAxis() {
        stack.axis = traitCollection.preferredContentSizeCategory.isAccessibilityCategory
            ? .vertical : .horizontal
    }
}
```

tvOS text sizes range from the Large default up through the accessibility categories, so plan for the same extremes as iPhone. For titles that still overflow at fewer columns, WWDC 2026-221 suggests a custom marquee strategy — gate the scrolling on Reduce Motion (Section 6). Test systematically with Large Text enabled, then declare Larger Text support in your app's Accessibility Nutrition Labels for tvOS in App Store Connect.

#### Testing
1. Xcode Preview: Environment override
   ```swift
   .environment(\.dynamicTypeSize, .accessibility3)
   ```

2. Simulator: Settings → Accessibility → Display & Text Size → Larger Text → Drag to maximum

3. Device: Settings → Accessibility → Display & Text Size → Larger Text

4. tvOS: Settings → Accessibility → Display → Text Size

5. Check: Does text remain readable? Does layout adapt? Is any text clipped?

---

### 3. Color Contrast (HIGH - Vision Disabilities)

**Problem** Low contrast text is unreadable for users with vision disabilities or in bright sunlight.

#### WCAG
- **1.4.3 Contrast (Minimum)** — Level AA
  - Normal text (< 18pt): 4.5:1 contrast ratio
  - Large text (≥ 18pt or ≥ 14pt bold): 3:1 contrast ratio
- **1.4.6 Contrast (Enhanced)** — Level AAA
  - Normal text: 7:1 contrast ratio
  - Large text: 4.5:1 contrast ratio

#### Common violations
```swift
// ❌ WRONG - Low contrast (1.8:1 - fails WCAG)
Text("Warning")
  .foregroundColor(.yellow) // on white background

// ❌ WRONG - Low contrast in dark mode
Text("Info")
  .foregroundColor(.gray) // on black background

// ✅ CORRECT - High contrast (7:1+ passes AAA)
Text("Warning")
  .foregroundStyle(.orange) // or .red

// ✅ CORRECT - System colors adapt to light/dark mode
Text("Info")
  .foregroundStyle(.primary) // Black in light mode, white in dark

Text("Secondary")
  .foregroundStyle(.secondary) // Automatic high contrast
```

#### Differentiate Without Color
```swift
// ❌ WRONG - Color alone indicates status
Circle()
  .fill(isAvailable ? .green : .red)

// ✅ CORRECT - Color + icon/text
HStack {
  Image(systemName: isAvailable ? "checkmark.circle.fill" : "xmark.circle.fill")
  Text(isAvailable ? "Available" : "Unavailable")
}
.foregroundStyle(isAvailable ? .green : .red)

// ✅ CORRECT - Respect system preference
if UIAccessibility.shouldDifferentiateWithoutColor {
  // Use patterns, icons, or text instead of color alone
}
```

#### Contrast Reference (Measure, Don't Eyeball)

Light gray on white is the classic failure — it looks "subtle" to a designer but is unreadable for low-vision users and in sunlight. Never judge by eye. Run the Accessibility Inspector **Audit** tab (flags every failing pair automatically) or sample exact hex with the Digital Color Meter, then compare against this table.

| Foreground on white | Ratio | Verdict |
|---------------------|-------|---------|
| Black `#000000` | 21:1 | AAA (any size) |
| Dark gray `#595959` | ~7:1 | AAA normal text |
| Medium gray `#767676` | ~4.5:1 | AA floor — normal text |
| Gray `#8E8E8E` | ~3:1 | Large text / UI components only |
| Light gray `#9A9A9A` | ~2.8:1 | FAILS all text |

`#767676` is the lightest gray that still passes AA for body text — anything lighter needs to be ≥18pt (or ≥14pt bold) to qualify as "large text" at 3:1.

#### Testing
1. Accessibility Inspector → Audit tab → Run Audit — surfaces every contrast failure with the measured ratio
2. Digital Color Meter (or Color Contrast Analyzer) to sample exact hex when iterating on brand colors
3. Check both light and dark mode — a pair that passes in one can fail in the other
4. Settings → Accessibility → Display & Text Size → Increase Contrast (verify it still passes with this ON)

---

### 4. Touch Target Sizes (MEDIUM - Motor Disabilities)

**Problem** Small tap targets are difficult or impossible for users with motor disabilities.

**WCAG** 2.5.5 Target Size (Level AAA - 44x44 CSS px); 2.5.8 Target Size Minimum (Level AA in WCAG 2.2 - 24x24)

**Apple HIG** a button's hit region should be at least 44x44pt (60x60pt on visionOS); a control may be drawn as small as 28x28pt only if its hit region stays 44x44

#### Common violations
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

// ✅ CORRECT - 44x44pt hit region
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

// ❌ WRONG - contentEdgeInsets is deprecated since iOS 15 and ignored under UIButton.Configuration
button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)

// ✅ CORRECT - UIKit button with content insets via UIButton.Configuration (iOS 15+)
var config = UIButton.Configuration.plain()
config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
button.configuration = config
// Total size: icon size + insets ≥ 44x44pt
```

#### Spacing between targets
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

#### Testing
1. Accessibility Inspector: Xcode → Open Developer Tool → Accessibility Inspector
2. Select "Audit" tab → Run audit → Check for "Small Text" and "Hit Region" warnings
3. Manual: Tap with one finger (not stylus) — can you hit it reliably without mistakes?

---

### 5. Keyboard Navigation (MEDIUM - iPadOS/macOS)

**Problem** Users who cannot use touch/mouse cannot navigate app.

**WCAG** 2.1.1 Keyboard (Level A - all functionality available via keyboard)

#### Common violations
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

#### Focus management
```swift
// ✅ CORRECT - Set initial focus
.focusSection() // Group related controls
.defaultFocus($focusedField, .email) // Set default

// ✅ CORRECT - Move focus after action
@FocusState private var focusedField: Field?

Button("Next") {
  focusedField = .next
}
```

#### Testing (iPadOS/macOS)
1. Connect keyboard to iPad or use Mac
2. Press Tab - does focus move to interactive elements?
3. Press Space/Return - does focused element activate?
4. Check custom controls have visible focus indicator
5. Can you reach all functionality without mouse/touch?

---

### 6. Reduce Motion Support (MEDIUM - Vestibular Disorders)

**Problem** Animations cause discomfort, nausea, or seizures for users with vestibular disorders.

**WCAG** 2.3.3 Animation from Interactions (Level AAA - motion animation can be disabled)

#### Common violations
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

#### SwiftUI modifier
```swift
// ✅ CORRECT - Automatic support
.animation(.spring(), value: isExpanded)
.transaction { transaction in
  if UIAccessibility.isReduceMotionEnabled {
    transaction.animation = nil // Disable animation
  }
}
```

#### Testing
1. Settings → Accessibility → Motion → Reduce Motion (toggle ON)
2. Navigate app - are animations reduced or eliminated?
3. Test: Transitions, scrolling effects, parallax, particle effects
4. Video autoplay should also respect this preference

---

### 7. Common Violations (HIGH)

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

`accessibilityAdjustableAction` makes VoiceOver read the control as "adjustable" and wires single-finger swipe up/down — do NOT also reach for an `.adjustable` trait; SwiftUI's `AccessibilityTraits` has no such member (the adjustable action confers it).

#### Pick the Right Interaction Technique for the Control

One mechanism doesn't fit every custom control (WWDC 2026-220). Choose by shape of input, and always provide custom actions as the fallback — Switch Control and Voice Control users may not be able to perform passthrough or direct-touch gestures. (UIKit equivalents: the `.allowsDirectInteraction` trait plus `accessibilityDirectTouchOptions` (iOS 17+).)

| Control shape | Technique | API |
|---------------|-----------|-----|
| Single-axis value (slider, stepper) | Adjustable action (swipe up/down) | `accessibilityAdjustableAction` |
| Fine-grained one-shot drag | Passthrough gesture (double-tap-and-hold, ends on release) | `accessibilityActivationPoint` to anchor where touches land |
| Multi-axis or named operations (2D pad) | Custom actions | `accessibilityAction(named:)` per direction |
| Free-form repeated gestures (drawing, virtual pet) | Direct touch (persists until focus moves) | `accessibilityDirectTouch(options:)` |

```swift
// Passthrough: anchor the gesture at the control's live position,
// not the default center
CoffeeSlider(value: fillLevel)
  .accessibilityActivationPoint(UnitPoint(x: 0.5, y: 1 - fillLevel))

// 2D control: one named action per direction (adjustable covers only one axis)
EqualizerPad()
  .accessibilityAction(named: "Move up") { increaseY(by: 10) }
  .accessibilityAction(named: "Move right") { increaseX(by: 10) }

// Direct touch: raw touches go to the control, not VoiceOver.
// .requiresActivation gates it behind a double-tap;
// .silentOnTouch mutes VoiceOver for controls with their own audio
GestureSurface()
  .accessibilityDirectTouch(options: [.requiresActivation])
```

During a passthrough drag the value changes continuously, and posting an `AccessibilityNotification.Announcement` on every change makes VoiceOver stutter over itself. Announce only when the value actually changed AND at least 0.3 seconds have passed since the last announcement (WWDC 2026-220 uses exactly this gate).

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

#### Choose the Right Notification (Don't Use `.announcement` for Everything)

VoiceOver has three distinct notifications. Using `.announcement` for new content that arrives on screen leaves focus stranded on the old element — the new content is announced but the user can't navigate to it. Match the notification to what changed.

| Notification | Use when | Argument | Effect |
|--------------|----------|----------|--------|
| `.announcement` | Discrete event with no new focusable target (score update, save complete, error toast) | The string to speak | Speaks, focus unchanged |
| `.layoutChanged` | New content appeared in place (search results, expanded section, validation error) | The element to focus (or `nil`) | Speaks + moves focus to the passed element |
| `.screenChanged` | Whole screen replaced (push/pop, sheet, tab switch) | The element to focus first (or `nil`) | Plays screen-change tone, refocuses, re-reads layout |

```swift
// ❌ WRONG - new results announced but focus stuck on the search field
UIAccessibility.post(notification: .announcement, argument: "12 results found")

// ✅ CORRECT - SwiftUI: discrete event, focus unchanged
AccessibilityNotification.Announcement("Saved").post()

// ✅ CORRECT - SwiftUI: new content arrived, move focus to it
// (@AccessibilityFocusState binding + LayoutChanged)
resultsFocused = true
AccessibilityNotification.LayoutChanged().post()

// ✅ CORRECT - UIKit: new content arrived, move focus to it
UIAccessibility.post(notification: .layoutChanged, argument: firstResultCell)

// ✅ CORRECT - whole-screen replacement
UIAccessibility.post(notification: .screenChanged, argument: detailTitleLabel)
```

For announcements that must not be interrupted, set priority on the announcement *string* — there is no view modifier for this. In SwiftUI set the `accessibilitySpeechAnnouncementPriority` `AttributedString` attribute and post that string; in UIKit post an `NSAttributedString` carrying the same attribute (`.high` cannot be interrupted, `.low` is queued) so the message isn't dropped by VoiceOver's queue.

```swift
var message = AttributedString("Connection lost")
message.accessibilitySpeechAnnouncementPriority = .high
AccessibilityNotification.Announcement(message).post()
```

## 8. Assistive Access Support (Cognitive Disabilities)

**Problem** App is unavailable or broken in Assistive Access mode, excluding users with cognitive disabilities who rely on a simplified system experience.

Assistive Access is a system-wide mode (Settings > Accessibility > Assistive Access) that replaces the standard iOS UI with large controls, simplified navigation, and reduced cognitive load. Apps that don't opt in are hidden from users in this mode.

**Availability splits by API** The Assistive Access *mode* and its Info.plist opt-in keys (`UISupportsAssistiveAccess`, `UISupportsFullScreenInAssistiveAccess`) are iOS 17+. The newer programmatic APIs arrived later: `@Environment(\.accessibilityAssistiveAccessEnabled)` is iOS 18.0+ (macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0), and the SwiftUI `AssistiveAccess` scene, `assistiveAccessNavigationIcon(_:)`, and the UIKit `.windowAssistiveAccessApplication` scene-session-role are all iOS 26.0+.

#### Symptom: App missing from Assistive Access home screen

Your app doesn't appear under "Optimized Apps" in Assistive Access settings.

```xml
<!-- ✅ FIX - Add to Info.plist -->
<key>UISupportsAssistiveAccess</key>
<true/>
```

This makes the app available and launches it full screen in Assistive Access mode. Without this key, users in Assistive Access mode cannot access your app at all.

#### Symptom: Standard UI too complex for Assistive Access users

Your app launches in Assistive Access but shows the full standard interface, overwhelming users who need simplified controls.

```swift
// ✅ FIX - Provide a dedicated Assistive Access scene (iOS 26.0+)
@main
struct MyApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView() // Standard UI
    }

    // AssistiveAccess scene is @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
    AssistiveAccess {
      AssistiveAccessContentView() // Simplified UI
    }
  }
}
```

The `AssistiveAccess` scene type (iOS 26.0+) provides a separate entry point. When the system is in Assistive Access mode, it uses this scene instead of the standard `WindowGroup`. Native SwiftUI controls inside this scene automatically adopt the Assistive Access visual style (large buttons, prominent navigation, grid/row layout).

#### Symptom: App already designed for cognitive accessibility but displays in reduced frame

If your app is already purpose-built for users with cognitive disabilities (e.g., AAC apps), it may appear in a reduced frame rather than full screen.

```xml
<!-- ✅ FIX - Add to Info.plist for apps already designed for cognitive accessibility -->
<key>UISupportsFullScreenInAssistiveAccess</key>
<true/>
```

This displays your app identically to its standard appearance, bypassing the Assistive Access frame.

#### Detecting Assistive Access at runtime (iOS 18.0+)

Runtime detection via this environment value requires iOS 18.0+ (macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0) — it is unavailable on iOS 17, where the Assistive Access mode itself first shipped.

```swift
struct MyView: View {
  // @Environment(\.accessibilityAssistiveAccessEnabled) is iOS 18.0+
  @Environment(\.accessibilityAssistiveAccessEnabled) var assistiveAccessEnabled

  var body: some View {
    if assistiveAccessEnabled {
      // Simplified content
    } else {
      // Standard content
    }
  }
}
```

#### UIKit implementation (iOS 26.0+)

For UIKit apps, use the `.windowAssistiveAccessApplication` scene session role (`UIWindowSceneSessionRoleAssistiveAccessApplication`, iOS 26.0+ / tvOS 26.0+ / visionOS 26.0+, unavailable on watchOS and macOS) in your `UISceneConfiguration` to route to a dedicated scene delegate for the Assistive Access experience.

#### Design principles for Assistive Access scenes

- **Distill to core functionality** — One or two essential features, not the full app
- **Large, prominent controls** — Ample spacing, no hidden gestures or timed interactions
- **Multiple representations** — Pair text with icons; use visual alternatives
- **Step-by-step navigation** — Clear back buttons, consistent patterns
- **Safe interactions** — Remove irreversible actions; confirm destructive ones

#### Adding navigation icons (iOS 26.0+)

```swift
NavigationStack {
  MyView()
    .navigationTitle("My Feature")
    // assistiveAccessNavigationIcon is iOS 26.0+ (macOS/tvOS/watchOS/visionOS 26.0+)
    .assistiveAccessNavigationIcon(systemImage: "star.fill")
}
```

#### Testing

1. **Device** — Enable Assistive Access in Settings > Accessibility > Assistive Access, verify app appears in "Optimized Apps", test the full user flow
2. **Accessibility Inspector** — Run audit on the Assistive Access scene for label, contrast, and hit region issues

---

## 9. Continuous Reading & Text Navigation (Long-Form Reading Apps)

**Problem** In reading apps (books, articles, scanned documents), VoiceOver text navigation stops dead at paragraph or page boundaries, and Speak Screen's read-all halts at the bottom of each page — users must swipe manually mid-chapter.

Techniques from WWDC 2026-219. Properly structured text content also makes the system Accessibility Reader experience better (iOS 26).

#### Symptom: VoiceOver can't move past the end of a paragraph

Separate text elements read as islands. Link them so character/word/line navigation continues seamlessly across the gap.

```swift
// UIKit (iOS 18+): chain elements in both directions
func configureNavigationElements() {
    for (index, paragraph) in paragraphs.enumerated() {
        if index + 1 < paragraphs.count {
            paragraph.accessibilityNextTextNavigationElement = paragraphs[index + 1]
        }
        if index > 0 {
            paragraph.accessibilityPreviousTextNavigationElement = paragraphs[index - 1]
        }
    }
}
```

```swift
// SwiftUI: link selectable text elements with a shared id + namespace
struct PageView: View {
    @Namespace private var pageNamespace
    let paragraphs: [String]
    let pageNumber: Int

    var body: some View {
        Text(paragraphs[0])
            .textSelection(.enabled)
            .accessibilityLinkedGroup(id: pageNumber, in: pageNamespace)
        Text(paragraphs[1])
            .textSelection(.enabled)
            .accessibilityLinkedGroup(id: pageNumber, in: pageNamespace)
    }
}
```

The `accessibilityLinkedGroup(id:in:)` modifier itself long predates this — starting in iOS 27, linking selectable text elements this way gives VoiceOver continuous text navigation across them. UIKit also offers block variants (`accessibilityNextTextNavigationElementBlock`/`accessibilityPreviousTextNavigationElementBlock`, iOS 18+) for lazily resolved elements. On macOS, use AppKit's long-standing `accessibilitySharedTextUIElements` property (`NSAccessibility`), which backs the AX attribute `AXSharedTextUIElements`.

#### Symptom: Read-all (Speak Screen / VoiceOver) stops at each page

Mark the last element with `.causesPageTurn` and implement `accessibilityScroll` so assistive technologies advance pages themselves — the audiobook experience:

```swift
override func viewDidLoad() {
    super.viewDidLoad()
    lastParagraphView.accessibilityTraits.insert(.causesPageTurn)
}

override func accessibilityScroll(_ direction: UIAccessibilityScrollDirection) -> Bool {
    moveToPage(direction)
    UIAccessibility.post(notification: .pageScrolled,
                         argument: "Page \(currentPage) of \(pageCount)")
    return true
}
```

#### Symptom: Editing actions buried for VoiceOver users

Put contextual actions (highlight, save, bookmark) on the editor rotor with the edit category (iOS 18+):

```swift
override var accessibilityCustomActions: [UIAccessibilityCustomAction]? {
    get {
        let save = UIAccessibilityCustomAction(name: "Save Recommendation") { _ in
            self.saveRecommendation()
            return true
        }
        save.category = UIAccessibilityCustomAction.editCategory
        return (super.accessibilityCustomActions ?? []) + [save]
    }
    set { }
}
```

#### Symptom: Custom-rendered text (scanned pages, custom engines) is invisible to assistive tech

Adopt `UITextInput` on the view — implement the protocol in its entirety, including tokenizer-driven granularity (`UITextInputStringTokenizer`) and `UITextInputDelegate` selection notifications, and VoiceOver and Speak Screen work without a UITextView. `UITextInteraction(for: .nonEditable)` is optional polish on top: it adds the system selection UI (handles, highlight), not the accessibility behavior.

---

## 10. Captions & Subtitle Styling (Video Playback)

Two accessibility features for video players. **Generated subtitles** are automatic in the 27 cycle — your only job is to expose subtitle selection so users can reach them. **Subtitle style preview** shipped in iOS 26.4 and lets users restyle captions without leaving your app. Both come from WWDC 2026-256.

### Generated Subtitles `OS27`

When content lacks a subtitle language the viewer understands, the system creates subtitles live and on-device during video playback — *speech transcription* (English subtitles from English audio: iOS, macOS, tvOS, visionOS 27) and *language translation* (other languages from English subtitles: iOS, macOS 27). Authored subtitles are always preferred and left unchanged; generated tracks are marked with a sparkle and "Translated."

**You implement nothing to turn this on** — it is automatic during playback for HTTP Live Streaming (live and on-demand) and file-based content. The one thing you must do is give users a way to *select* a subtitle track, or generated subtitles stay invisible to the people who need them most:

- `AVPlayerViewController` (iOS) and `AVPlayerView` (macOS) provide full subtitle selection (and player controls) for free.
- `AVLegibleMediaOptionsMenuController` adds subtitle-selection UI to an *existing* custom player (iOS/macOS/visionOS 26.4 — not tvOS).
- Or build custom media-selection controls that match your player.

#### Symptom: generated subtitles never appear for the user

Almost always a missing or broken subtitle-selection UI. Verify the user can reach a Subtitles menu in your player; a custom player with no media-option selection gives generated tracks nowhere to surface.

### Subtitle Style Preview (iOS 26.4+)

Users have long been able to pick and customize caption styling (font, color, border) in Settings. The style preview lets them do it *live, inside your player, with a real preview* — far more accessible than sending them to Settings mid-video.

`AVPlayerViewController`/`AVPlayerView` implement the whole preview for free. To add it to a custom player UI, use `AVLegibleMediaOptionsMenuController`. To drive it yourself from an `AVPlayerLayer`:

```swift
import AVFoundation
import MediaAccessibility

@available(iOS 26.4, macOS 26.4, tvOS 26.4, visionOS 26.4, *)
final class SubtitleStyleController {
    let playerLayer: AVPlayerLayer
    var profileIDs: [String] = []
    init(playerLayer: AVPlayerLayer) { self.playerLayer = playerLayer }

    // Each system caption style has a MACaptionAppearance profile ID.
    func loadStyleProfiles() {
        profileIDs = MACaptionAppearanceCopyProfileIDs() as? [String] ?? []
    }

    // Preview a style live. New subtitles render in it; any active subtitles are
    // auto-hidden so they don't interfere. text: nil shows localized placeholder
    // text. position is an offset from the default location — pass a non-zero
    // value to keep the preview clear of your playback controls (.zero = default).
    func previewStyle(_ profileID: String, offset: CGPoint = .zero) {
        playerLayer.setCaptionPreviewProfileID(profileID, position: offset, text: nil)
    }

    // ALWAYS stop the preview when the user is done — this removes the placeholder
    // and restores the active subtitles.
    func endPreview() {
        playerLayer.stopShowingCaptionPreview()
    }

    // Commit the chosen style; it applies to all subtitles, system-wide.
    func applyStyle(_ profileID: String) {
        MACaptionAppearanceSetActiveProfileID(profileID as CFString)
    }
}
```

Rendering captions entirely yourself? `AVCaptionRenderer.captionPreview(forProfileID:extendedLanguageTag:renderSize:)` returns a styled `NSAttributedString` for a profile ID — but Apple warns it can block, so generate previews off the main thread. A custom renderer must also honor the user's systemwide caption settings: read them with `MACaptionAppearanceGetDisplayType(.user)` and `MACaptionAppearanceCopy*(.user, …)` (`.default` is for comparison, never rendering), and re-render on `kMACaptionAppearanceSettingsChangedNotification`.

#### Common mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Custom player with no subtitle-selection UI | Generated subtitles (`OS27`) never reach users | Adopt `AVPlayerViewController`/`AVPlayerView`, or add `AVLegibleMediaOptionsMenuController` |
| Forgetting `stopShowingCaptionPreview()` | The placeholder sticks and the real subtitles stay hidden | Always end the preview when selection finishes |
| Calling `captionPreview(forProfileID:…)` on the main thread | UI hitch while it renders | Generate previews off-main |
| Reaching for the menu controller on tvOS | `AVLegibleMediaOptionsMenuController` is unavailable there | Use `AVPlayerViewController`'s built-in subtitle UI on tvOS |

---

## 11. Resizable Windows & Desktop-Class Accessibility

Resizable windows (iPad windowing, iPhone Mirroring, iOS apps on the Mac) change *which* assistive tech drives the app and *when* layout transforms happen. These are the gaps the standard VoiceOver/Dynamic Type passes miss.

### Reading Order Must Survive Layout Changes

VoiceOver reads in layout order. When a resize collapses `NavigationSplitView` columns into a stack, or an `HStack` becomes a `VStack`, the reading order changes with it — an order that made sense side-by-side can interleave nonsensically stacked.

```swift
// Fix order within a container when visual order ≠ reading order
Header().accessibilitySortPriority(2)     // higher reads first
Sidebar().accessibilitySortPriority(1)
Detail().accessibilitySortPriority(0)     // default

// Keep a region's children together across reflows
InspectorPanel()
    .accessibilityElement(children: .contain)
```

Test the reading order **after each layout transform** (resize through your breakpoints in the simulator, swipe through everything), not just at the design size. UIKit peers: `accessibilityElements` (explicit order) on the container.

### Tables and Grids Need Two-Axis Semantics

A VoiceOver user navigates a data table by structure, not by eye. SwiftUI `Table` carries tabular semantics — row context and column headers; a `LazyVGrid` exposes nothing — VoiceOver reads its cells as a flat sequence with no row/column context. When a wide layout upgrades a list into a grid or multi-column table, don't silently downgrade the VoiceOver experience:

- UIKit custom grids: adopt `UIAccessibilityContainerDataTable` + `UIAccessibilityContainerDataTableCell` so VoiceOver exposes row/column navigation and headers.
- SwiftUI: prefer `Table` for genuinely tabular data on wide layouts (see axiom-macos (skills/swiftui-differences.md)); for a `LazyVGrid`, make each cell self-describing ("Track 3 of 12, Blue in Green") because the grid position is invisible to VoiceOver.

### Toolbar Overflow Loses Names

Items that collapse into the toolbar's overflow ("…") menu render as menu rows. An icon-only item becomes a nameless row — unusable visually *and* silent under VoiceOver. Every toolbar item that can overflow needs a `Label` or `accessibilityLabel` (see axiom-swiftui (skills/toolbars.md) Pattern 11).

### Button Shapes

The Button Shapes setting (Accessibility → Display & Text Size) asks controls to show a visible affordance instead of relying on tint alone. System controls comply automatically; **custom controls that look like plain text** must add their own:

```swift
@Environment(\.accessibilityShowButtonShapes) private var showButtonShapes

Button("Details", action: show)
    .background(showButtonShapes ? Color.secondary.opacity(0.2) : .clear,
                in: Capsule())
```

UIKit: `UIAccessibility.buttonShapesEnabled` + `buttonShapesEnabledStatusDidChangeNotification`.

### Large Content Viewer (Enlarged Content)

Bars don't grow at accessibility Dynamic Type sizes — the Large Content Viewer is the system's answer: long-press a bar item and a magnified HUD shows it. System tab bars and navigation bars support it automatically; **custom bottom bars and custom toolbars don't** until you adopt it:

```swift
CustomTabButton(icon: "waveform")
    .accessibilityShowsLargeContentViewer {
        Label("Recordings", systemImage: "waveform")
    }
```

UIKit: set `showsLargeContentViewer = true` and `largeContentTitle`/`largeContentImage` on the item view, and add a `UILargeContentViewerInteraction` to the bar (iOS 13). If a custom bar's items are unlabeled icons at fixed size, this is the difference between usable and not at XXXL text.

### Full Keyboard Access & Switch Control Depth

Section 5 covers focus basics; FKA (Settings → Accessibility → Keyboards) and Switch Control both drive the app through the **accessibility element tree**, which raises the bar beyond Tab order:

- Custom actionable views need `isAccessibilityElement = true` plus a proper trait (`.button`) — without the trait, FKA and Switch Control may not offer them as stops at all. `accessibilityRespondsToUserInteraction` (iOS 13) disambiguates elements that carry a label but shouldn't be focus stops (or vice versa).
- Gesture-only functionality (swipe rows, drag handles, pinch) must also exist as `accessibilityCustomActions` — Switch Control surfaces them in its action menu, which is the supported path for a switch user to reach a swipe action.
- Depth test: with FKA on, complete your app's three core flows end-to-end using only Tab/arrows/Space. Then repeat with Switch Control auto-scanning. Reachable-but-not-activatable elements and unreachable modal content are the two classic failures.

---

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
- **Device** Settings → Accessibility → VoiceOver, or triple-click the side button once the Accessibility Shortcut is set to VoiceOver
- **Simulator** VoiceOver isn't available; use Accessibility Inspector or `xcui voiceover traverse` to check labels, traits and order. `xcui a11y set --toggle voiceover` only sets `isVoiceOverRunning` for code that branches on it; no screen reader runs

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

## App Store & Accessibility Nutrition Labels

- NO App Review Guideline requires VoiceOver, Dynamic Type, a contrast ratio, or any a11y support. Never cite one (2.5.1 = public APIs).
- Apple's lever: **Accessibility Nutrition Labels** (App Store Connect → product page). Declarable: VoiceOver, Voice Control, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, Audio Descriptions.
- Criterion: declare a feature only if ALL common tasks are completable with it.
- Answering is voluntary now; Apple says sharing support details will become required for new apps + updates (notice + eval resources first). Answers become mandatory, features don't — "supports none" is a valid product page.
- Accuracy = Guideline 2.3 (accurate metadata); misleading/harmful labels → App Review may contact you to update them.
- tvOS Larger Text: largest Dynamic Type size (tvOS 27 Large Text, Section 2) or an equivalent size of your own.

| Declare | Every common task must work with |
|---|---|
| VoiceOver | labels on all interactive elements, logical order, every action performable |
| Larger Text | ≥200% (AX3 on iOS) or system max, via Dynamic Type or in-app control, no overlap or unreadable truncation; watchOS/tvOS: largest size; Zoom/Hover Text don't count |
| Sufficient Contrast | 4.5:1 normal text; 3:1 large text (≥18pt) + UI components |
| Differentiate Without Color Alone | no state conveyed by color alone |
| Reduced Motion | motion-heavy animation replaced when on |

Stakes: users (~1 in 6 live with a significant disability, WHO; labels let them rule you out pre-install); law (US: apps named in ADA suits; EU: European Accessibility Act since 2025-06-28 — e-commerce, banking, passenger transport, e-books). App Review checks neither → passing review ≠ compliance.

---

## Design Review Pressure

Typical asks: skip VoiceOver labels ("messy"), lock font sizes, lower contrast for brand, shrink 44pt targets. Each locks out users, blocks a truthful label, adds legal exposure. Defend with the label criterion + WCAG + law, never an invented guideline. **STOP and reference this skill** on any row below.

| Request | Consequence |
|---|---|
| Skip labels on icon-only buttons | VoiceOver users can't complete the task → no VoiceOver claim |
| Fixed 14pt font | breaks Larger Text; excludes low vision |
| "3:1 contrast is fine" | fails WCAG AA normal text (4.5:1) → no Sufficient Contrast |
| 36x36pt buttons | below HIG 44x44pt hit region + WCAG 2.5.5 |
| Disable Dynamic Type on a screen | if a common task passes through it → no Larger Text |
| Color-only status (red=error) | excludes colorblind users (~8% of men) → no Differentiate Without Color Alone |

#### Implementation Traps (own code)
- `.announcement` for content that appeared → speaks but strands focus. Use `.layoutChanged`/`.screenChanged` with the new element (taxonomy above).
- Eyeballed contrast → light gray ~2.8:1 fails. Measure (Accessibility Inspector audit); `#767676` = lightest gray passing AA body text.
- Fonts fixed but frame clips → `lineLimit(nil)` + `.fixedSize(horizontal: false, vertical: true)`; reflow HStack → VStack on `dynamicTypeSize.isAccessibilitySize`.

#### Push-back sequence
1. **Stakes**: forfeited label claims (VoiceOver, Larger Text…); WCAG 2.1 AA failure (basis of the EAA via EN 301 549; what US courts and DOJ look to under the ADA). Asks: labels on all interactive elements, Dynamic Type unlocked, 4.5:1 text / 3:1 UI, 44x44pt button hit regions.
2. **Demo**: VoiceOver on device ("Button" announcements), largest text size (clipping), Accessibility Inspector audit (contrast), targets <44pt.
3. **Compromise, no visual change**: programmatic labels; adaptive layouts (HIG); small color shifts to 4.5:1 that keep the brand; larger hit areas at the same visual size.
4. **If overruled, record in writing**: the violations decided (e.g. fixed fonts, 38pt buttons, 3.8:1 text), the WCAG AA failure, label claims forfeited (Apple plans to require answers on every submission), legal exposure per market, users/tasks blocked.

#### Example: label claim under deadline
Ships in 48h; marketing wants a VoiceOver claim; checkout icon buttons read "Button"; designer: "generic labels, quickly".

```swift
// ❌ generic label: the task still can't be completed
Button(action: addToCart) { Image(systemName: "cart.badge.plus") }
    .accessibilityLabel("Button")

// ✅ descriptive label
Button(action: addToCart) { Image(systemName: "cart.badge.plus") }
    .accessibilityLabel("Add to cart")
```

Demo checkout with VoiceOver before/after; cite the all-common-tasks criterion. ~2-4 h to audit and label the common tasks. Outcome: claim true at launch, or ship without it and add it once checkout passes.

#### Accepting an override
Only if: they know which label claims are forfeited; legal/compliance signed off for your markets; decision documented; fix date committed. Record: violations, forfeited claims, blocked users/tasks, fix release.

---

## WCAG Compliance Levels

### Level A (Minimum)
- 1.1.1 Non-text Content — Images have text alternatives
- 2.1.1 Keyboard — All functionality via keyboard (iPadOS/macOS)
- 4.1.2 Name, Role, Value — Elements have accessible names

### Level AA (Standard — the level accessibility laws usually reference)
- 1.4.3 Contrast (Minimum) — 4.5:1 text, 3:1 large text
- 1.4.11 Non-text Contrast — 3:1 for UI components and meaningful graphics
- 1.4.4 Resize Text — Support 200% text scaling
- 1.4.5 Images of Text — Use real text when possible

### Level AAA (Enhanced — Best Practice)
- 1.4.6 Contrast (Enhanced) — 7:1 text, 4.5:1 large text
- 2.3.3 Animation from Interactions — Reduce Motion support
- 2.5.5 Target Size - 44x44 CSS px targets

**Goal** Meet Level AA for all content, Level AAA where feasible.

## Quick Command Reference

After making fixes:

```bash
# Quick scan for new issues
/axiom:audit accessibility
```

## Resources

**WWDC**: 2026-219, 2026-220, 2026-221, 2026-256

**Docs**: /accessibility/voiceover, /uikit/uifont/scaling_fonts_automatically, /uikit/uiaccessibilityreadingcontent, /swiftui/view/accessibilitylinkedgroup(id:in:), /avfoundation/avplayerlayer, /avkit/avlegiblemediaoptionsmenucontroller, /mediaaccessibility, /uikit/uilargecontentviewerinteraction, /uikit/uiaccessibilitycontainerdatatable, /swiftui/view/accessibilitysortpriority(_:), /swiftui/view/accessibilityshowslargecontentviewer(_:)

---

**Remember** Accessibility is not a feature, it's a requirement. About 1 in 6 people live with a significant disability (WHO). Making your app accessible isn't just the right thing to do - it expands your user base and improves the experience for everyone.
