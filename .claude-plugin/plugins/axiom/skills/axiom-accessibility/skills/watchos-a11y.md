# Accessibility on watchOS

## When to Use This Skill

Use when:
- Auditing a watchOS app for VoiceOver, AssistiveTouch, or Double Tap support
- Implementing Dynamic Type on watch faces, watch UI, complications, or notifications
- Making a custom watch control (counter, scrubber, picker) VoiceOver-adjustable
- Fixing AssistiveTouch cursor frames that clip or miss tappable elements
- Supporting the large accessibility text sizes introduced in watchOS 8
- Debugging why a view element isn't focusable via AssistiveTouch

#### Related Skills

- Use the rest of `axiom-accessibility` for general (cross-platform) VoiceOver, Dynamic Type, and contrast guidance — this skill covers watchOS-specific additions
- Use `axiom-watchos/skills/design-for-watchos.md` for the watchOS 10 navigation model and Always-On design
- Use `axiom-watchos/skills/smart-stack-and-complications.md` for complication surfaces that need accessibility labels
- Use `axiom-watchos/skills/controls-and-live-activities.md` for control surfaces and the Double Tap primary action

## Core Principle

**Three assistive technologies ship on Apple Watch: VoiceOver, AssistiveTouch, and Double Tap.** Each has a distinct input model and SwiftUI support surface. An accessible watchOS app addresses all three, plus Dynamic Type at the large accessibility sizes that watchOS 8 introduced. Most of what works on iOS carries over — what follows is the watchOS-specific additions and pressure points.

> "Accessibility is about people using their devices in the way that's best for them. And that means, to give your app the best user experience, accessibility must be considered." — Daniel Sykes-Turner, Apple Accessibility, WWDC 2021-10223

## Watch-Specific Assistive Technologies

| Technology | What it does | Primary API surface |
|---|---|---|
| VoiceOver | Reads UI aloud; gestures navigate | `accessibilityLabel`, `accessibilityValue`, `accessibilityAdjustableAction`, `accessibilityElement(children:)` |
| AssistiveTouch (watchOS 8+) | Hand-gesture and wrist-motion control; on-screen cursor; action menu | `accessibilityRespondsToUserInteraction`, `contentShape`, `accessibilityAction` |
| Double Tap (watchOS 11+) | Pinch-fingers gesture triggers primary action | `handGestureShortcut(.primaryAction)` |

Design for any combination — a user may have VoiceOver on **and** AssistiveTouch enabled. Neither should step on the other.

## Dynamic Type — Three Rules

The watchOS 8 accessibility large text sizes put more pressure on Dynamic Type than any earlier release. First-run setup now asks every user to pick a text size; if they don't, watchOS picks the closest size to their iPhone's.

### Rule 1 — Always use a text style, never a fixed font size

```swift
// Wrong — stays the same at any user-chosen size
Text(plant.name).font(.system(size: 18))

// Right — grows with the system text size
Text(plant.name).font(.title3)
```

SwiftUI ships 11 text styles. Each one scales automatically across the full range, including the large accessibility sizes.

### Rule 2 — Allow text to wrap; don't cap `lineLimit` at 1

```swift
// Wrong — truncates on larger sizes
Text(task.description).lineLimit(1)

// Right — wraps onto as many lines as needed
Text(task.description)
// Or: Text(...).lineLimit(3)
```

A one-line limit on watch UI truncates by design. Accept wrapping by default; cap `lineLimit` only when the layout cannot tolerate reflow.

### Rule 3 — Switch layout for very large sizes

Once text is wrapping three times and icons are crowding, give up on the horizontal layout and stack vertically:

```swift
struct PlantCardView: View {
    @Environment(\.sizeCategory) private var sizeCategory
    let plant: Plant

    var body: some View {
        if sizeCategory >= .extraExtraLarge {
            VerticalPlantView(plant: plant)
        } else {
            HorizontalPlantView(plant: plant)
        }
    }
}
```

Read `@Environment(\.sizeCategory)` and branch at the threshold where the horizontal layout breaks. Don't try to make a single layout work across the full range — the vertical fallback is the right tool for accessibility sizes.

### Complications and notifications count

Two surfaces people forget:

- **Complication text with abbreviations** needs `accessibilityLabel` with the spoken form. "Wed Mar 9" → `accessibilityLabel("Wednesday, March 9th")`.
- **Complication images** need a label too, or VoiceOver falls back to the image asset name. "Moon" becomes `accessibilityLabel("A real-time view of the moon. Third quarter.")`.
- **SF Symbols** come with default labels (`"Drop, fill"`) that may not match your context — override with `accessibilityLabel` when the context warrants.
- **Dynamic notifications** need the same accessibility treatment as main-app views — labels, hierarchy, action labels.

## VoiceOver on watchOS

### Let `NavigationLink` combine children

A list row with four labels, four images, and two buttons forces VoiceOver to stop at every element. Grouping is usually what you want:

```swift
// If you're using accessibilityElement(children: .contain) to inspect the row, remove it:
NavigationLink(destination: PlantDetail(plant: plant)) {
    PlantRowContents(plant: plant)
}
// NavigationLink will combine children into a single accessible element automatically.
```

### Context in the label, not just the value

VoiceOver without context is unusable. A task row reading "5 days. 7 days. Medium." tells the user nothing:

```swift
// Wrong — VoiceOver reads "5 days"
Text("5 days")

// Right — reads "Watering in 5 days"
struct PlantTaskLabel: View {
    let task: PlantTask

    var body: some View {
        Label(task.displayText, systemImage: task.iconName)
            .accessibilityLabel(task.voiceOverDescription)
    }
}

extension PlantTask {
    var voiceOverDescription: String {
        switch self {
        case .water(let days): "Watering in \(days) days"
        case .fertilize(let days): "Fertilizing in \(days) days"
        case .sunlight(let level): "Keep in \(level) sunlight"
        }
    }
}
```

### Buttons need explicit labels when using system symbols

A button that's just `Image(systemName: "drop.fill")` reads as "Drop fill, button". Override:

```swift
Button { log(.water) } label: {
    Image(systemName: "drop.fill")
}
.accessibilityLabel("Log watering")
```

## Custom Adjustable Controls

A stepper built from two buttons and a label reads terribly: "Watering frequency. Remove, button. 8. Add, button." The user can't tell the three elements belong together.

Collapse them into one adjustable element:

```swift
struct FrequencyCounter: View {
    let task: PlantTask
    @Binding var days: Int

    var body: some View {
        HStack {
            Button { days -= 1 } label: { Image(systemName: "minus.circle") }
            Text("\(days)").font(.title)
            Button { days += 1 } label: { Image(systemName: "plus.circle") }
        }
        .accessibilityElement()                            // Ignore children
        .accessibilityLabel(task.frequencyLabel)           // Read once on focus
        .accessibilityValue("\(days) days")                // Read on every change
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: days += 1
            case .decrement: days -= 1
            @unknown default: break
            }
        }
    }
}
```

The result: VoiceOver says "Watering frequency. 8 days. Adjustable." — and a swipe up/down adjusts it. One element, one label, one value, one action. That is the shape VoiceOver users expect for every custom control.

## AssistiveTouch Support (watchOS 8+)

AssistiveTouch gives users with motor impairments full control via hand gestures (clench, double-clench, pinch, double-pinch) or wrist-motion cursor steering. Two concepts shape what the framework expects from your UI: focusable elements and cursor frames.

### Focusable elements

AssistiveTouch cursor steps only through elements the system considers **interactive**. Default interactive elements:

| Interactive | Non-interactive |
|---|---|
| `Button`, `Toggle` | `Text` (static) |
| `NavigationLink` | `Label` (static) |
| Elements with `.onTapGesture` | Elements with `.accessibilityHidden(true)` |
| Elements with `.accessibilityAction` | Any element with `.disabled(true)` |
| Elements with an actionable a11y trait | |

The trap is a `VStack` with an `.onTapGesture` on the whole stack — the stack is interactive, but the `Text` children inside aren't. AssistiveTouch focus skips the text:

```swift
// Problem — tap works, but AssistiveTouch never highlights the text
VStack {
    Text("Double Americano").font(.headline)
    Text("with oat milk").font(.caption)
}
.onTapGesture { showDrinkDetail() }

// Fix — opt the text into interactive treatment
VStack {
    Text("Double Americano")
        .font(.headline)
        .accessibilityRespondsToUserInteraction(true)
    Text("with oat milk").font(.caption)
}
.onTapGesture { showDrinkDetail() }
```

`accessibilityRespondsToUserInteraction(true)` tells AssistiveTouch the element is part of the tap target.

### Cursor frame

The AssistiveTouch cursor draws around the element's **tappable area**, not its visual bounds. A small glyph button has a small cursor that clips or hides the content. Expand the tap target with `contentShape`:

```swift
// Small visual element; tiny cursor frame; clips the icon
NavigationLink(destination: SettingsView()) {
    Image(systemName: "ellipsis")
}

// Generous tappable area; readable cursor
NavigationLink(destination: SettingsView()) {
    Image(systemName: "ellipsis")
        .frame(width: 44, height: 44)
        .contentShape(Circle())
}
```

Minimum tappable region is 44×44pt regardless of visual size. `contentShape(Circle())` makes the AssistiveTouch cursor trace a circle that matches the visual icon shape.

### Action menu

AssistiveTouch's action menu (double-clench opens it) surfaces custom actions ahead of system actions for the focused element. Any `accessibilityAction` you already added for VoiceOver appears here automatically:

```swift
TaskRow(task: task)
    .accessibilityAction(named: "Complete") { task.complete() }
    .accessibilityAction(named: "Reschedule") { showReschedule() }
```

Adjustable elements surface increment/decrement. Custom actions without an explicit image use the first letter of the action name as the menu icon — provide a `Label` to override:

```swift
.accessibilityAction {
    Label("Complete", systemImage: "checkmark.circle.fill")
} action: {
    task.complete()
}
```

## Double Tap (watchOS 11+)

Double Tap is a pinch-fingers gesture bound globally to the primary action of the frontmost view. For most UI, the primary action is the obvious "default" button: "Start" in a workout app, "Reply" on an incoming message.

### Opt a button into Double Tap

```swift
Button("Start Workout") {
    session.start()
}
.handGestureShortcut(.primaryAction)
```

### Rules

- Only one primary action per screen — Double Tap becomes ambiguous otherwise
- Double Tap is an accelerator, not a replacement — every primary-action button must remain tappable
- The user can disable Double Tap globally; don't make it the only path to any action
- Controls (see `axiom-watchos/skills/controls-and-live-activities.md`) bind to Double Tap automatically when the control widget is frontmost

## Testing Checklist

| Test | How |
|---|---|
| VoiceOver reads every row with context | Settings → Accessibility → VoiceOver; swipe through a list and listen |
| Dynamic Type reflows at `accessibility5` | Settings → Accessibility → Display & Text Size → Larger Text → All the way up |
| Custom adjustable controls speak label + value separately | Focus and listen; swipe up/down to increment |
| AssistiveTouch highlights every tappable element | Settings → Accessibility → AssistiveTouch → on; pinch-step through the screen |
| AssistiveTouch cursor doesn't clip icons | Visual check with cursor visible |
| Double Tap fires the intended action | Pinch with the same hand as the watch |
| Complication text has spoken-form label | VoiceOver focus on the watch face with your complication |
| Notification long-look is navigable | VoiceOver on a delivered notification |

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Fixed font size on labels | Text stays small at accessibility sizes | Use a text style (`.title3`, `.body`, `.caption`); never `Font.system(size:)` for user-facing text |
| `lineLimit(1)` on text that can vary in length | Truncation at large Dynamic Type; no way for users to read the content | Remove or raise `lineLimit`; switch layout vertically at accessibility sizes |
| `accessibilityElement(children: .contain)` on a `NavigationLink` row | VoiceOver navigates past every inner element instead of grouping the row | Remove the modifier; `NavigationLink` combines children automatically |
| System symbol button without `accessibilityLabel` | VoiceOver reads "Drop fill, button" | Add `.accessibilityLabel("Log watering")` |
| Custom stepper built from buttons without `accessibilityAdjustableAction` | VoiceOver reads two separate button labels and the value; no swipe-to-adjust | `accessibilityElement()` + `accessibilityLabel` + `accessibilityValue` + `accessibilityAdjustableAction` |
| Static `Text` inside a tappable `VStack` isn't AssistiveTouch-focusable | Cursor skips rows; users can't reach the tap target | Add `.accessibilityRespondsToUserInteraction(true)` on the text elements |
| Small glyph button without `contentShape` | AssistiveTouch cursor clips the icon; tap area smaller than 44×44 | `.frame(width: 44, height: 44).contentShape(...)` |
| Custom accessibility actions with no image | Menu shows one-letter placeholders | Attach a `Label(_:systemImage:)` to each `accessibilityAction` |
| Binding Double Tap to multiple primary actions | Double Tap becomes unpredictable on the screen | Use exactly one `.handGestureShortcut(.primaryAction)` per surface |
| Using `handGestureShortcut(.primaryAction)` as the only path | Users who disable Double Tap can't reach the action | Keep the button tappable; Double Tap is an accelerator only |
| Abbreviated complication text without an unabridged `accessibilityLabel` | VoiceOver reads "Wed Mar 9" instead of "Wednesday, March 9th" | Provide `accessibilityLabel` for every abbreviated string in complications and notifications |

## Resources

**WWDC**: 2021-10223, 2021-10308, 2024-10205

**Docs**: /watchos-apps/create-accessible-experiences-for-watchos, /swiftui/environmentvalues/sizecategory, /swiftui/view/accessibilityelement(children:), /swiftui/view/accessibilityrespondstouserinteraction(_:), /swiftui/view/accessibilityadjustableaction(_:), /swiftui/view/accessibilityaction(_:_:), /swiftui/view/contentshape(_:eofill:), /swiftui/view/handgestureshortcut(_:isenabled:)

**Skills**: axiom-accessibility (accessibility-diag, ux-flow-audit), axiom-watchos (design-for-watchos, smart-stack-and-complications, controls-and-live-activities)
