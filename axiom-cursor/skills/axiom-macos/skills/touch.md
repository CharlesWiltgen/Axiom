
# Touch on Mac

Making a Mac app work well on a Mac with a touch display or an iPad (iPadOS 27) connected over Sidecar. Touch is a **secondary** input on macOS — keyboard and pointer stay primary — so the goal is polish, not a redesign. Standard AppKit, SwiftUI, and Mac Catalyst controls are touch-native already; custom mouse handling is where apps break.

## When to Use This Skill

Use when:
- Preparing a Mac app for touch, or checking how it behaves when someone touches the screen
- A custom view overrides `mouseDown(with:)`, runs a `nextEvent(matching:…)` tracking loop, or subclasses a control to observe clicks
- Hit targets are small (resize grips, canvas handles, wiring nodes) or controls appear only on hover
- Several controls should move at once (mixers, color sliders), or a three-finger gesture fights with your UI
- An app built on a non-Apple UI framework (game engine, cross-platform toolkit) needs touch
- The app goes unresponsive after a gesture, or a control stops responding under an overlay view

#### Related Skills

- `skills/appkit-modernization.md` — the mouseDown-replacement table, control events, and hit-testing basics this skill builds on
- `axiom-swiftui (skills/gestures.md)` — SwiftUI gestures and `inputKinds:` filtering
- `axiom-games (skills/game-input.md)` — touch for games: mouse emulation, `GCMouse`, routing gestures to the engine
- `axiom-integration (skills/live-activities.md)` — Live Activities in the Mac's Dynamic Island
- Automated scan: `touch-auditor` agent, or `/axiom-audit` touch

## Red Flags

- ❌ Subclassing `NSButton`/`NSSlider` and overriding `mouseDown` "just to observe" — AppKit treats ANY override as replacing its click handling and falls back to a tracking loop, even when you call `super`
- ❌ A gesture action method with no `.cancelled` case — a system gesture (Mission Control, scroll) cancels mid-interaction and your half-applied change sticks
- ❌ A custom `NSGestureRecognizer` that can miss a terminal state — its exclusive view holds and the rest of the app looks frozen
- ❌ Reading `NSApp.currentEvent` in an action method — it no longer reliably holds the initiating event
- ❌ An essential action reachable only by hovering — touch has no hover
- ❌ Making controls bigger, or switching layouts, when `touchCapabilities` reports touch — the app should look identical on every Mac
- ❌ A touch-only gesture with no trackpad or menu equivalent
- ❌ Shipping with `NSCrashOnStuckGestureTimeout` or `NSGestureRecognizerCrashOnMissingOverrides` still set

## How Touch Reaches Your Code

AppKit uses gesture recognizers for both mouse and touch from macOS 27 on, and **gesture recognizers are the only way to receive direct touches**. AppKit never delivers `NSTouch` objects for direct touches through the responder chain or event monitors; `NSResponder.touchesBegan(with:)` and its siblings carry trackpad and Touch Bar touches, never touches from a touch display or Sidecar.

| Your input handling | What happens with touch | Next step |
|---|---|---|
| Standard AppKit controls, tables, collections, split views, tabs, scroll views | Touch-native, no changes | Test it |
| SwiftUI gestures, Mac Catalyst gestures | Work as-is | Filter by input kind only if you must (below) |
| `mouseDown` overrides and tracking loops | AppKit emulates the mouse from a single-finger tap or drag; no multi-finger gestures or individual touches | Replace with recognizers, or add a touch-only recognizer beside the loop |
| Subclass of `NSButton`, `NSSlider`, or another control that overrides `mouseDown`/`mouseDragged`/`mouseUp` | Falls back to a tracking loop | Control events (Recipe 1) |
| Container (`NSTableView`, `NSCollectionView`, `NSOutlineView`, `NSBrowser`) starting a drag from `mouseDragged` | Falls back to a tracking loop | The container's dragging data-source/delegate methods |
| Custom `NSGestureRecognizer` subclass | Fine, if it always reaches a terminal state | Recipe 6 |
| Non-Apple UI framework | Generic per-window mouse emulation | Adopt recognizers, then set `NSIsTouchNative` (Recipe 10) |

## Design Rules

From Apple's "Design for touch on Mac" (tech talk 111456).

**The UI does not change.** Same resolution, window sizes, text and control sizes on a touch Mac as on any other. Don't redesign for touch, and don't branch layout on touch capability.

**The touch target is 36 pt** — the same physical size as 44 pt on iOS — and it's invisible: framework controls got the larger target without changing size, so no relayout is needed. For non-Apple or custom controls, enlarge the hit area, not the control (Recipe 4). Small and mini controls stay valid in dense apps; every touch must still produce a response.

**Control sizes**: medium remains the default in inspectors; toolbars use extra-large by default. Don't use large or extra-large outside the toolbar, except sparingly for a key moment or in content-consumption apps (the TV app's play button). Use `Form` styling for list- and settings-style views — rows measure 36 pt by default.

| Action | Trackpad | Touch |
|---|---|---|
| Select | Click | Tap |
| Open | Double-click | Double-tap |
| Scroll | Two-finger swipe | One-finger drag |
| Zoom, rotate | Pinch, rotate (object under the cursor) | Pinch, rotate (object under the fingers) |
| Drag | Click and drag | Touch and hold, then drag |
| Context menu | Two-finger click | Touch and hold |

- Keep selection modeless (tap selects, as a click does) — no iOS-style selection mode.
- Touch and hold lifts the item and shows its context menu at the same time; dragging dismisses the menu. Modifier keys (Shift, Option) still apply during a touch drag.
- Several fingers can work several controls at once (two faders in Logic). Support it where it adds something (Recipe 7).
- **Placement**: the left and right edges are easy to reach with a hand anchored on the display's side — good for precise, dense UI (sidebars, inspectors). The center is reached with an unsupported arm — keep it for coarse gestures (pan, pinch, rotate).
- **Custom gestures** must also work with a trackpad and ideally Magic Mouse, using a modifier key where needed (Maps: two-finger drag up tilts to 3D on touch; Option-drag on trackpad). Duplicate the action elsewhere, such as a menu. When the iOS gesture and the trackpad gesture differ, consistency between the Mac's own inputs beats parity with iOS.
- **Expanding controls**: steppers, dials, and short sliders can expand in place when touched, and a tap expands without changing the value. Touch and hold on a dial or slider expands it with the knob under the finger, while holding a stepper button changes the value continuously. Steppers and dials expand automatically; sliders have the option to expand when they're drawn small.
- **Menus and transient views** adapt to the input that opened them — menus opened by touch get slightly taller rows; popovers and custom menus may also adjust their layout.

#### Hover

- Purely informational hover (tooltips) doesn't need to work with touch.
- Hover buttons for actions touch already does (carousel scroll arrows — touch can swipe) stay hidden during touch.
- Only the most important hover actions should reveal on touch, and they hide again when used, when the mouse moves, or on a touch outside their area. Safari shows only the current tab's close button and the address bar's plus button.
- Duplicate every hover action elsewhere, typically the item's context menu (Reminders shares a list from the context menu; no hover button appears on touch).

#### System Gestures (reserved)

| Gesture | Result |
|---|---|
| Three fingers up / down | Mission Control / App Exposé |
| Thumb and three fingers pinch in / spread out | Show apps / show desktop |
| Three fingers left or right | Switch spaces |
| Swipe down from the top edge / up from the bottom edge | Hidden menu bar / hidden Dock |
| Swipe left from the right edge | Notification Center |
| Swipe down from the top-right edge | Control Center |
| Swipe over the Dynamic Island | Siri |

Apps never receive these. The opt-outs in Recipe 8 cover the multi-finger gestures; Apple shows no way to opt out of the edge swipes.

## Behavior Changes in macOS 27

These change how existing mouse code behaves, not just touch.

**Gathering, not the responder chain.** On mouse-down or touch-began, AppKit hit-tests to the innermost view and gathers the recognizers on that view and its superviews; that set gets the whole event stream. A covering view — often transparent — blocks recognizers beneath it, including a standard control's own. Move the control in front, or return `nil` from the covering view's `hitTest(_:)` *for points over the control only* (unconditional `nil` disables the overlay's own recognizers). You can't attach a recognizer to a view controller; attach it to the controller's view and make the controller its target and delegate.

**Exclusive views.** The view a touch or click first hit-tests to becomes exclusive: until its gathered recognizers finish, no other part of the hierarchy can start one. This emulates the single pointer that tracking loops assumed. Scrolling is the exception and still works alongside an active exclusive view. It's on when the Info.plist key `NSViewGestureRecognizerIsExclusive` is absent or `YES`; **new AppKit app projects (Xcode 27.2's Cocoa App and Document App templates) set it to `NO`**, while SwiftUI app templates leave it absent. `NSView.exclusiveGestureBehavior` (`.inherit` default, `.exclusive`, `.notExclusive`) overrides it for a view and its subviews.

**Stuck recognizers.** A recognizer that hasn't reached a terminal state 2 seconds after the person stops interacting is stuck; it holds its exclusive view and the app appears frozen. The system cancels it automatically. To find the bug instead:
- `-NSGestureRecognizerCrashOnMissingOverrides YES` — crash when a custom recognizer lacks a required override
- `-NSCrashOnStuckGestureTimeout 2` — crash with a stack trace instead of silently cancelling

Pass them as launch arguments or set them as `UserDefaults`; they take effect on relaunch. Remove both before shipping — otherwise the shipped app crashes where it would have recovered.

**`currentEvent` in action methods.** Control actions arrive through recognizers, so `NSApp.currentEvent` may not be the event that triggered them. Read `NSEvent.modifierFlags` and `NSEvent.pressedMouseButtons` (current state, not event state) instead. In a recognizer's action method, read `recognizer.modifierFlags` (macOS 26), the flags in effect for that gesture. A touch never appears in `pressedMouseButtons`.

**Swipes.** AppKit doesn't translate touch into `trackSwipeEvent(options:dampenAmountThresholdMin:max:usingHandler:)` swipes — implement your own. For back/forward page swipes, check `NSEvent.isTouchSwipeNavigationEnabled` first; people can turn touch swipe navigation off.

**Unchanged.** Keyboard and scroll-wheel events still use the responder chain. Hover (`mouseMoved`, `NSTrackingArea`) is pointer-only.

**Feature detection.** Write input-agnostic code and adapt to the *interaction*, not the device. Check `NSScreen.touchCapabilities` only to offer a genuinely touch-specific feature, such as capturing a signature. In macOS 27 it reports `.multiTouch` for **every** display while a touch-capable Sidecar iPad is connected, so it can't tell you which screen accepts touch:

```swift
if let screen = NSScreen.main, screen.touchCapabilities.contains(.multiTouch) {
    // Offer the touch-only affordance
}
```

## Recipes

### 1. Observe Control Tracking With Control Events

Instead of an `NSButton` subclass that overrides `mouseDown`, add targets for tracking events. `.trackingCancelled` is the case the subclass never saw: a system gesture or scroll took over, so revert.

```swift
ignitionButton.addTarget(self, action: #selector(buttonDidStartTracking),
                         for: [.trackingBegan, .trackingEntered])
ignitionButton.addTarget(self, action: #selector(buttonDidEndTracking),
                         for: [.trackingExited, .trackingEndedInside, .trackingEndedOutside])
ignitionButton.addTarget(self, action: #selector(buttonCancelledTracking),
                         for: .trackingCancelled)

// Only care that it fired, whatever the input?
openButton.addTarget(self, action: #selector(openDocument), for: .primaryActionTriggered)
```

Action methods need `@objc`. Most tracking cases date to macOS 11; `.trackingRepeated`, `.primaryActionTriggered`, and the other semantic cases are new in the 27 SDK — see `skills/appkit-modernization.md` (Control Events).

### 2. Replace a Tracking Loop With a Pan Recognizer

Events a tracking loop pulls with `nextEvent(matching:until:inMode:dequeue:)` or `trackEvents(matching:timeout:mode:handler:)` never reach gathered recognizers. Replace the loop:

```swift
let pan = NSPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
canvasView.addGestureRecognizer(pan)

@objc func handlePan(_ recognizer: NSPanGestureRecognizer) {
    switch recognizer.state {
    case .began, .changed:
        moveCaption(by: recognizer.translation(in: recognizer.view))
    case .ended:
        commitCaptionMove()
    case .cancelled:
        revertCaptionMove()   // The system took the touches (e.g. a system gesture)
    default:
        break
    }
}
```

If the loop started a drag-and-drop session, pass the recognizer to `beginDraggingSession(items:gesture:source:)` instead of the event. If the app set `NSViewGestureRecognizerIsExclusive` to `NO`, set `exclusiveGestureBehavior = .exclusive` on the migrated view to keep the one-interaction-at-a-time behavior the loop gave you implicitly.

### 3. Keep the Loop, Add a Touch-Only Recognizer

The fastest, lowest-risk path for a point release. Split the loop into start/continue/end/cancel functions, keep calling them from the loop for the mouse, and add a recognizer that sees only touch:

```swift
func startTracking(at location: NSPoint, expandHitRect: Bool = false) { /* … */ }
func continueTracking(at location: NSPoint) { /* … */ }
func endTracking(at location: NSPoint) { /* … */ }
func cancelTracking() { /* … */ }

let touchPan = NSPanGestureRecognizer(target: self, action: #selector(touchPan(_:)))
touchPan.buttonMask = 0               // No mouse buttons: the loop keeps the mouse
touchPan.allowedTouchTypes = .direct  // Already the default; states the intent
wiringPanelView.addGestureRecognizer(touchPan)

@objc func touchPan(_ recognizer: NSPanGestureRecognizer) {
    let location = recognizer.location(in: wiringPanelView)
    switch recognizer.state {
    case .began: startTracking(at: location, expandHitRect: true)
    case .changed: continueTracking(at: location)
    case .ended: endTracking(at: location)
    case .cancelled: cancelTracking()
    default: break
    }
}
```

Leave `buttonMask` at its default and a mouse *drag* begins the recognizer instead of reaching your `mouseDown` override, so the loop never runs (a click without movement still reaches it).

### 4. Enlarge Small Targets for Touch Only

Expand the hit rect to 36 pt per axis on the touch path; the mouse keeps its precision and the layout doesn't change. Most useful for resize grips and grab handles on selected canvas objects.

```swift
let minimumTouchTarget: CGFloat = 36

func hitRect(for frame: NSRect, expandForTouch: Bool) -> NSRect {
    guard expandForTouch else { return frame }
    let dx = max(0, (minimumTouchTarget - frame.width) / 2)
    let dy = max(0, (minimumTouchTarget - frame.height) / 2)
    return frame.insetBy(dx: -dx, dy: -dy)
}
```

A finger aiming at a small control often lands just outside its visible frame — custom controls must accept that touch.

### 5. Filter Which Recognizers Attempt a Gesture

Put one recognizer on a whole view and decide per interaction, instead of creating tiny views. Filter pointer input with `gestureRecognizer(_:shouldAttemptToRecognizeWith:)` and direct touches with `gestureRecognizer(_:shouldReceive:)` — direct touches never call the first one.

```swift
func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer,
                       shouldAttemptToRecognizeWith event: NSEvent) -> Bool {
    guard let view = gestureRecognizer.view else { return false }
    return resizeGripFrame.contains(view.convert(event.locationInWindow, from: nil))
}

func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer,
                       shouldReceive touch: NSTouch) -> Bool {
    guard let view = gestureRecognizer.view else { return false }
    return resizeGripFrame.contains(touch.location(in: view))
}
```

The recognizer's `location(in:)` isn't valid inside either method, so read the event or the touch. For a timeline of clips, hit-test the clip there, store it for the action method, and return `false` when there's none.

When a recognizer shares a view with a `mouseDown` override, the mouse events should wait until the recognizer fails and be dropped if it recognizes. The standard recognizers already do this while their `buttonMask` includes the primary button; a custom `NSGestureRecognizer` subclass that recognizes the mouse needs `delaysPrimaryMouseButtonEvents = true` (one that can't, such as a two-finger gesture, should fail on `mouseDown` instead of delaying). A touch-only recognizer (`buttonMask = 0`) defaults to not delaying, which is what lets a mouse path beside it run undelayed (Recipe 3).

Prioritize sparingly: a failure requirement (`gestureRecognizer(_:shouldRequireFailureOf:)`) makes the waiting recognizer slower — a single click that waits for a double click feels sluggish. Simultaneous recognition is off by default; enable it per pair with `gestureRecognizer(_:shouldRecognizeSimultaneouslyWith:)`. A custom text engine using `NSTextSelectionManager` can't reference the manager's recognizers directly — require failure against `selectionManager.gesturesForFailureRequirements`.

### 6. Write a Custom Recognizer That Always Finishes

Prefer the standard recognizers (`NSClickGestureRecognizer`, `NSPressGestureRecognizer`, `NSPanGestureRecognizer`, `NSMagnificationGestureRecognizer`, `NSRotationGestureRecognizer`) — they already handle cancellation and multi-touch edge cases. AppKit has no swipe recognizer; that's a legitimate subclass.

```swift
final class DragTrackingRecognizer: NSGestureRecognizer {
    private(set) var trackedLocation: NSPoint = .zero   // Window coordinates
    private(set) var lastEvent: NSEvent?

    override func mouseDown(with event: NSEvent) { track(event, .began) }
    override func mouseDragged(with event: NSEvent) { track(event, .changed) }
    override func mouseUp(with event: NSEvent) { track(event, .ended) }
    override func mouseCancelled(with event: NSEvent) { state = .cancelled }
    // touchesBegan/Moved/Ended/Cancelled: same shape, caching NSTouch instead

    override func reset() {
        super.reset()
        trackedLocation = .zero
        lastEvent = nil
    }

    override func location(in view: NSView?) -> NSPoint {
        guard let view else { return trackedLocation }
        return view.convert(trackedLocation, from: nil)
    }

    private func track(_ event: NSEvent, _ newState: State) {
        trackedLocation = event.locationInWindow
        lastEvent = event
        state = newState
    }
}
```

- Override every method in a family: `touchesBegan` needs `touchesMoved`, `touchesEnded`, and `touchesCancelled`; mouse handling needs `mouseCancelled(with:)`.
- When the system takes the touches (for example `smartMagnify(with:)`), move to `.cancelled` specifically.
- Event methods only update private state and `state`; respond in the action method, reading `recognizer.modifierFlags` for modifiers and the cached event for anything else.
- Override `location(in:)`. Built with the macOS 27 SDK, a subclass that doesn't returns `NSZeroPoint` and logs a console error.

### 7. Let Several Controls Move at Once

```swift
stoveControlsView.exclusiveGestureBehavior = .notExclusive   // Subviews inherit it
```

Opt in region by region as code becomes safe for simultaneous input — code written for tracking loops often assumes one active control. AppKit's Color panel does this for its RGB sliders. An exclusive view that is already active still blocks gathering outside its hierarchy until its interaction ends.

### 8. Scroll Views and Your Gestures

```swift
// Drawing canvas: one finger draws, two fingers scroll
decoratingView.enclosingScrollView?.minimumNumberOfTouchesForScrolling = 2

// A control inside a scroll view yields once the scroll view's pan or magnify starts
controlRecognizer.isCancellableByScrollGesture = true
```

- `isTouchScrollingEnabled` turns touch scrolling off; `maximumNumberOfTouchesForScrolling = 0` requires exactly the minimum.
- `scrollGestureForRelationships` is the scroll view's recognizer for failure or exclusion relationships with yours.
- `isCancellableByScrollGesture` works per recognizer and is independent of exclusivity: a button in a non-exclusive container still yields to scrolling.
- Pull to refresh: `NSScrollView.refreshController` (`NSRefreshController`); `WKWebView` exposes the same `refreshController` on macOS 27.

#### Disabling System Gestures

From tech talk 111468 (8:25). **None of these compiles against the macOS 27.2 SDK in Xcode 27.2**, for Mac or Mac Catalyst builds. Take the spellings as given, gate on the release that ships them, and don't invent parameters:

- AppKit: `NSWindow.disablesDirectTouchSystemGestures` (settable `Bool`)
- Mac Catalyst: override `UIViewController.prefersDirectTouchSystemGesturesDisabled`
- SwiftUI: `directTouchSystemGesturesDisabled(_ prefersDisabled: Bool = true)`. The iOS 27.2 SDK's SwiftUI interface declares it `@available(macOS 27.2, macCatalyst 27.2, *)` (unavailable on iOS, tvOS, watchOS, and visionOS), but the macOS 27.2 SDK doesn't include it.

Use them only when an interaction the system gestures block is critical — the talk's game disables them only while the burners are on screen, because three fingers on three sliders would otherwise open Mission Control mid-crisis.

### 9. Drag, Context Menus, and Hover

- **Drag lift**: implement the container's drag APIs (`tableView(_:pasteboardWriterForRow:)` and the `NSCollectionView`/`NSOutlineView` equivalents) — the touch-and-hold lift preview comes free.
- **Context menus**: set `NSView.menu` or override `menu(for:)`. AppKit installs the long-press recognizer and a Control-tap accelerator, and coordinates with container drag so a hold can turn into a drag or a menu and switch between them. A `mouseDown` that pops a menu gets none of this.
- **Hover-only essential controls**: don't make them permanently visible. Add a touch-only `NSClickGestureRecognizer` (`buttonMask = 0`) that reveals the control temporarily. Tooltips stay pointer-only.

### 10. Non-Apple UI Frameworks

When AppKit detects a non-Apple UI framework, it emulates per window, since it can't know what each region accepts:

| Touch | Emulated as |
|---|---|
| Tap | Mouse down + up |
| Touch, then pan at once | Trackpad scroll, with momentum |
| Touch, brief hold, then move | `mouseDown`, `mouseDragged`…, `mouseUp` |
| Touch and hold, no movement | `rightMouseDown` / `rightMouseUp` |
| Two-finger pinch or rotate | Trackpad magnify / rotate |

One and two fingers only — a third finger during a pinch is ignored. Once the framework handles touch through recognizers, add `NSIsTouchNative` = `YES` to the Info.plist to switch the extra emulation off. Views that still override `mouseDown` keep receiving emulated mouse events; to get real touches there, add a recognizer that allows direct touch to that view. Games get their own emulation — see `axiom-games (skills/game-input.md)`.

## Mac Catalyst and SwiftUI

Existing gestures work as-is in both. Filter by input only for a genuine need:

- **SwiftUI** (27): `TapGesture`, `SpatialTapGesture`, `DragGesture`, `LongPressGesture`, `MagnifyGesture`, `RotateGesture`, `onTapGesture` (the location-passing form), and `onLongPressGesture` take `inputKinds:` (`GestureInputKinds`: `.directTouch`, `.indirectTouch`, `.pencil`, `.pointer`, `.all`) — see `axiom-swiftui (skills/gestures.md)`.
- **Mac Catalyst**: the existing `UITouch.touchType` and `UIGestureRecognizer.allowedTouchTypes`.

## Testing

No touch Mac needed: on macOS 27 with current developer tools, an iPad running **iPadOS 27** connected over **Sidecar** delivers the same direct touches. An iPad on an earlier iPadOS delivers none.

Use touch in every window, sheet, and popover, and confirm:
- Controls respond to a tap; buttons highlight and activate
- One finger drags views, selects text, and scrolls
- Pinch and rotate work where the app supports them
- Small targets (resize grips, grab handles) are easy to hit
- The app stays responsive after every touch interaction ends

Find the code to change by searching for `nextEvent(matching:`, `trackEvents(matching:`, `override func mouseDown`, `override func mouseDragged`, and `currentEvent` in action methods — or run `/axiom-audit` touch.

## SDK Reference

| API | What it is |
|---|---|
| `NSScreen.touchCapabilities` (`.multiTouch`) | Whether the screen reports touch |
| `NSView.exclusiveGestureBehavior` (`.inherit`, `.exclusive`, `.notExclusive`) | Exclusivity for a view and its subviews |
| `NSScrollView.isTouchScrollingEnabled`, `minimumNumberOfTouchesForScrolling`, `maximumNumberOfTouchesForScrolling` | Touch scrolling and finger counts |
| `NSScrollView.scrollGestureForRelationships` | The scroll recognizer, for relationships with yours |
| `NSScrollView.refreshController` (`NSRefreshController`) | Pull to refresh |
| `NSGestureRecognizer.isCancellableByScrollGesture` | Lets scrolling cancel this recognizer after it began |
| `NSPanGestureRecognizer.minimumNumberOfTouches` / `maximumNumberOfTouches` | Finger counts for pans; replace `numberOfTouchesRequired`, deprecated at 27 |
| `NSView.beginDraggingSession(items:gesture:source:)` | Start a drag from a recognizer |
| `NSEvent.isTouchSwipeNavigationEnabled` | The user's touch swipe-navigation setting |
| `NSTextSelectionManager.gesturesForFailureRequirements` | Selection recognizers, for failure requirements |
| `NSIsTouchNative`, `NSViewGestureRecognizerIsExclusive` | Info.plist keys (above) |

Older, still central: `NSGestureRecognizer.allowedTouchTypes` and `NSPanGestureRecognizer.buttonMask` (macOS 10.12.2 / 10.10).

With a deployment target below macOS 27, wrap the 27 APIs in `if #available(macOS 27, *)`. Nothing is lost below it: earlier systems deliver no direct touches, from a touch display or from Sidecar.

## Checklist

- ☑ No control subclass overrides `mouseDown`/`mouseDragged`/`mouseUp`; tracking is observed with control events
- ☑ Every tracking loop is replaced, or paired with a touch-only recognizer (`buttonMask = 0`)
- ☑ Every gesture action handles `.cancelled` and reverts
- ☑ Custom recognizers override every method in each family, plus `reset()` and `location(in:)`
- ☑ Small targets accept touches within 36 pt; layout unchanged
- ☑ No essential action is hover-only; hover actions are duplicated in a context menu
- ☑ Context menus come from `menu`/`menu(for:)`; container drags from the data-source/delegate APIs
- ☑ No `currentEvent` reads in action methods
- ☑ Overlays don't cover controls, or pass hit-testing through for the control's area
- ☑ Exclusivity is a deliberate choice (Info.plist key, `exclusiveGestureBehavior`)
- ☑ Debug defaults (`NSCrashOnStuckGestureTimeout`, `NSGestureRecognizerCrashOnMissingOverrides`) are off in release
- ☑ Tested with touch over Sidecar in every window, sheet, and popover

## Resources

**Tech Talks**: 111456, 111468

**WWDC**: 2026-289

**Docs**: /appkit/handling-appkit-gestures, /appkit/adopting-gesture-recognizers-in-your-app, /technotes/tn3212-adopting-gesture-recognizers-for-sidecar-touch-support, /technotes/tn3216-supporting-touch-input-for-games-on-macos

**Skills**: skills/appkit-modernization.md, axiom-swiftui (skills/gestures.md), axiom-games (skills/game-input.md), axiom-integration (skills/live-activities.md)
