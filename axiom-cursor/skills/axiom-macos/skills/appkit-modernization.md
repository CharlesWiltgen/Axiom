
# AppKit Modernization

Modernizing an existing AppKit app: replacing mouseDown tracking with modern input APIs, keyboard navigation, graceful termination and state restoration, and the macOS 27 look-and-feel (concentric corners, interactive glass, touch input). Based on WWDC 2026-289 plus the macOS 27 SDK delta.

## When to Use This Skill

Use when:
- An AppKit app overrides `mouseDown` for selection, context menus, drag-and-drop, or text selection
- Reacting to control interactions (buttons, sliders) without subclassing — control events
- Full Keyboard Navigation skips views, or the key view loop is stale
- A status item shows custom windows or transient UI (expanded interface sessions)
- The app blocks quit, or loses window state across relaunch (state restoration)
- Adopting the macOS 27 look: concentric corners, interactive Liquid Glass
- Handling touch input on the Mac (touch scrolling, pull-to-refresh)

#### Related Skills

- `skills/appkit-interop.md` — hosting SwiftUI in AppKit (NSHostingView/Menu/SceneRepresentation, observation tracking, gesture representables)
- `axiom-uikit (skills/uikit-modernization.md)` — the UIKit sibling (scene lifecycle, 27 tab/nav APIs)
- `axiom-uikit (skills/textkit-ref.md)` — TextKit 2 surfaces (NSTextViewportRenderingSurface is documented there, cross-platform)

## Red Flags

- ❌ Overriding `mouseDown` to track selection (observe `selected` / use delegate callbacks instead)
- ❌ Implementing custom mouse-tracking loops for behaviors gesture recognizers already provide
- ❌ Toggling a status-item window manually from target/action (breaks keyboard navigation — use expanded interface sessions)
- ❌ Leaving `preventsApplicationTerminationWhenModal` at its default for sheets that don't need intervention (blocks overnight-update restarts)
- ❌ Encoding document/database data in `encodeRestorableState` (restore the UI, not the model)
- ❌ Hand-rolled corner radii on views near container corners (use `cornerConfiguration` concentricity)

## Modern Input (Replace mouseDown Overrides)

Gesture recognizers are the common event-handling language across AppKit, SwiftUI, and Mac Catalyst. Three solutions interface well with them — reach for the dedicated API before a `mouseDown` override:

| You override mouseDown for | Use instead |
|----------------------------|-------------|
| Tracking selection | Observe `selected` on `NSCollectionViewItem`/`NSTableRowView`, or `NSTableViewDelegate`/`NSOutlineViewDelegate` callbacks |
| Context menus | `NSView.defaultMenu` (class-wide), `NSResponder.menu` (per responder), or `menu(for:)` (per event) |
| Drag-and-drop from containers | Modern dragging delegate: `tableView(_:pasteboardWriterForRow:)` — return an `NSPasteboardItem`; equivalents on `NSCollectionView`, `NSOutlineView`, `NSBrowser` |
| Text selection outside NSTextView | `NSTextSelectionManager` `OS27` — attach to a view + set a text-selection data source for bidirectional selection, drag-and-drop with text, toggling |
| Custom interactions | Standard `NSGestureRecognizer`s, or your own subclass |

### Control Events (UIKit-Style, Now in AppKit)

React to tracking-state changes on standard controls without subclassing. `addTarget(_:action:for:)` / `removeTarget(_:action:for:)` are available from macOS 11 (and per WWDC 2026-289, most tracking events carry behavior dating back to OS X 10.11); the semantic cases are new in the 27 SDK:

```swift
let button = NSButton()
button.addTarget(self, action: #selector(trackingEndedOutsideHandler),
                 for: .trackingEndedOutside)
```

| `NSControl.Events` case | Availability |
|-------------------------|--------------|
| down/up/tracking cases (`.trackingBegan`, `.trackingEndedInside`, `.trackingEndedOutside`, …) | macOS 11 (with `addTarget`) |
| `.trackingRepeated` (click count > 1) | `OS27` |
| `.valueChanged` (sliders, etc.) | `OS27` |
| `.primaryActionTriggered` (semantic action for buttons) | `OS27` |
| `.menuActionTriggered` (menu gesture fired, before the menu presents) | `OS27` |
| `.applicationReserved` (range for app-defined events) | `OS27` |

### Hit-Testing Gotcha

Gesture recognizers operate on a view and its subviews, so an overlapping **sibling** view silently swallows clicks. If a control doesn't respond: resize the sibling so it doesn't overlap, or — if it's a deliberate overlay — let events fall through:

```swift
override func hitTest(_ point: NSPoint) -> NSView? {
    return nil  // fall through to content underneath
}
```

## Keyboard Navigation

- Full Keyboard Navigation (System Settings > Keyboard) moves focus with Tab/Shift-Tab through the key view loop. Set `window.autorecalculatesKeyViewLoop = true` to recalculate it automatically as views come and go — otherwise you own loop maintenance.
- Status items that trigger actions: give the status item's `button` a target and action — Return fires it during keyboard navigation.

### Status Item Expanded Interface Sessions `OS27`

Status items that show custom windows ("expanded interface") must tell AppKit when that UI is active so keyboard focus and menu tracking behave. Don't toggle the window from a plain target/action:

```swift
// 1. Set the delegate when the item is created
lightStatusItem.expandedInterfaceDelegate = self

// 2. Show/hide the window in the delegate callbacks
// (@MainActor on the conformance: the protocol isn't actor-annotated, so a
// main-actor delegate needs it to satisfy the requirements in Swift 6 mode)
extension LightAppDelegate: @MainActor NSStatusItemExpandedInterfaceDelegate {
    func statusItem(_ statusItem: NSStatusItem,
                    didBegin session: NSStatusItemExpandedInterfaceSession) {
        // Show the window
    }
    func statusItemDidEndExpandedInterfaceSession(_ statusItem: NSStatusItem,
                                                  animated: Bool) {
        // Order the window out
    }
}

// 3. Dismiss programmatically (e.g. after an action) — the session may also be
//    cancelled for you when focus moves elsewhere
lightStatusItem.expandedInterfaceSession?.cancel()
```

Items that assign an `NSMenu` to their button don't get these callouts — menu tracking is automatic. SwiftUI's `MenuBarExtra` does this work for you: see `skills/appkit-interop.md` (SwiftUI Scenes from AppKit).

## Graceful Termination and State Restoration

A modern Mac app quits without pushback (overnight software updates need to reboot) and relaunches as if it never quit.

**Termination**: `NSWindow.preventsApplicationTerminationWhenModal` defaults to `true` — a presented sheet blocks quit. Set it to `false` for every modal/sheet that doesn't strictly require intervention.

**Restoration** (`NSWindowRestoration`, three steps):

```swift
// 1. Opt in — identifier, autosave name (skip for document windows), restorable, class
window.identifier = NSUserInterfaceItemIdentifier(WindowIdentifiers.mainWindow)
window.setFrameAutosaveName(WindowIdentifiers.mainWindow)
window.isRestorable = true                       // AppKit also restores minimized/frontmost/full-screen
window.restorationClass = WindowRestorationHandler.self

// 2. Encode UI state (any NSResponder can override this)
override func encodeRestorableState(with coder: NSCoder) {
    super.encodeRestorableState(with: coder)     // always call super
    coder.encode(selectedProduct?.identifier.uuid, forKey: RestorationKeys.productIdentifier)
}
// Encoding only happens for invalidated objects — signal UI changes:
invalidateRestorableState()

// 3. On relaunch: recreate windows, then decode
class WindowRestorationHandler: NSObject, NSWindowRestoration {
    static func restoreWindow(withIdentifier identifier: NSUserInterfaceItemIdentifier,
                              state: NSCoder,
                              completionHandler: @escaping (NSWindow?, Error?) -> Void) {
        // Recreate the window controller for this identifier…
        // ALWAYS call completionHandler — AppKit waits on every restorable window;
        // on failure call it with the error
    }
}
override func restoreState(with coder: NSCoder) {
    super.restoreState(with: coder)
    // Decode keys, hand values to view controllers
}
```

**Encode UI state, not data**: restoration reconstructs the UI (selection, frontmost window), never re-serializes documents or databases. Sample code: "Restoring your app's state with AppKit".

## macOS 27 Look and Feel `OS27`

**System-wide on macOS 27, no rebuild** — apps that adopted Liquid Glass on macOS 26 pick these up just by running on 27: the automatic `NSScrollEdgeEffectStyle` resolves to a hard edge under free-floating text (e.g. window titles), sidebars extend to the window edges with semibold selection text, content flows behind them, and bordered toolbar items over the sidebar adopt Liquid Glass.

**New API in the 27 SDK** — interactive glass and concentric corners:

**Interactive glass**: `NSGlassEffectView.effectIsInteractive = true` makes glass subtly bounce when clicked. Use it on controls, buttons, or glass containers of interactive controls only — a little goes a long way.

**Concentric corners**: content near a container's corner should follow the container's curve.

```swift
class LocalWeatherView: NSView {
    // cornerConfiguration is a readonly property — override the getter
    override var cornerConfiguration: NSViewCornerConfiguration? {
        let radius: NSViewCornerRadius = .containerConcentric(8)  // 8pt minimum, always rounded
        return .uniformCorners(radius: radius)   // same radii on all 4 corners
    }
}
```

| API | Notes |
|-----|-------|
| `NSViewCornerRadius` | `.containerConcentric` / `.containerConcentric(_ minimum:)` (always-rounded floor) / `.fixed(_:)` |
| `NSViewCornerConfiguration` factories | `.uniformCorners(radius:)`, `.corners(radius:)`, per-corner `.corners(topLeftRadius:…)`, `.capsule`, `.capsule(maximumRadius:)`, `.uniformEdges(topRadius:bottomRadius:)` |
| `NSView.effectiveCornerRadii` / `viewDidChangeEffectiveCornerRadii()` / `invalidateCornerConfiguration()` | Read back resolved radii; react to changes; force re-resolution |

**Semantic roles** (also new in the 27 SDK): `NSSegmentedControl.role` (`.automatic` / `.tabs` / `.valueSelection`) and `NSToolbarItemGroup.role` declare what a segmented control or toolbar item group means, so the system can style it appropriately.

## Touch and Gesture Additions `OS27` (SDK)

SDK additions in the 27 AppKit headers (not covered in WWDC 2026-289):

| API | What it is |
|-----|------------|
| `NSScreen.touchCapabilities` | Whether the current screen reports touch input |
| `NSScrollView.isTouchScrollingEnabled` + `minimumNumberOfTouchesForScrolling` / `maximumNumberOfTouchesForScrolling` | Touch-driven scrolling with finger-count thresholds |
| `NSScrollView.refreshController` (`NSRefreshController`) | Pull-to-refresh for scroll views on the Mac |
| `NSScrollView.scrollGestureForRelationships` | The scroll gesture, exposed for gesture-relationship setup |
| `NSView.beginDraggingSession(items:gesture:source:)` | Start a dragging session from a gesture recognizer |
| `NSView.exclusiveGestureBehavior` | Exclusivity policy between a view's gestures and others |
| `NSEvent.isTouchSwipeNavigationEnabled` | Class property — the user's touch swipe-navigation preference |
| `NSGestureRecognizer.isCancellableByScrollGesture` | Whether a scroll gesture can cancel this recognizer |
| `NSPanGestureRecognizer.minimumNumberOfTouches` / `maximumNumberOfTouches` | Finger-count thresholds for pans |

`WKWebView` (WebKit) hosts the same `NSRefreshController` through its own `refreshController` property on macOS 27 — first-class pull-to-refresh for web content, macOS-only (on iOS you wire it up yourself by attaching a `UIRefreshControl` to `WKWebView.scrollView`).

## Checklist

- ☑ No `mouseDown` overrides where a dedicated API exists (selection, menus, dragging, text selection)
- ☑ Control interactions via control events or gesture recognizers, not tracking loops
- ☑ `hitTest` fall-through (or resized siblings) for overlay views that block clicks
- ☑ `autorecalculatesKeyViewLoop` enabled, or the key view loop maintained manually
- ☑ Status-item custom UI tracked with expanded interface sessions
- ☑ `preventsApplicationTerminationWhenModal = false` on every sheet that doesn't need intervention
- ☑ Windows restorable: identifier + `isRestorable` + `restorationClass`; `restoreWindow` always calls its completion handler
- ☑ `invalidateRestorableState()` called on UI changes that should persist
- ☑ Corner-adjacent views adopt `cornerConfiguration` concentricity

## Resources

**WWDC**: 2026-289

**Docs**: /appkit/nscontrol/events, /appkit/nstextselectionmanager, /appkit/nsstatusitem, /appkit/nswindowrestoration, /appkit/nsviewcornerconfiguration

**Skills**: skills/appkit-interop.md, skills/windows.md, skills/menus-and-commands.md, axiom-uikit (skills/uikit-modernization.md)
