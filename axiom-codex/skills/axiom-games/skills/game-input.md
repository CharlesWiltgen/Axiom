# Game Input: Touch Controls and Game Controllers

Guide to player input for games on Apple platforms: on-screen touch controls with the TouchController framework (iOS/iPadOS), unified GCController handling, and the GameController framework's 27-cycle additions.

## When to Use This Skill

- Adding touch controls to a controller-based game (including Mac/console ports)
- Designing on-screen control layouts that adapt across iPhone and iPad
- Handling game controller input (polling vs change handlers)
- Letting players customize the controller Home button action `OS27`
- Reading spatial accessory input `visionOS27`

**Do NOT use this skill for**
- Touch handling inside SpriteKit scenes (`touchesBegan` gameplay logic) → `skills/spritekit.md` Section 5
- General app gestures, SwiftUI gesture recognizers → axiom-swiftui
- Porting the game itself (rendering, shaders) → axiom-graphics (skills/metal-migration.md)

## 1. Mental Model: One GCController Pipeline

The TouchController framework (iOS 26+, iPhone/iPad only — not macCatalyst, visionOS, tvOS, or macOS) builds on top of the GameController framework. When you enable a touch controller, it **shows up as a `GCController` object**: you poll its state or set value-changed handlers exactly like a physical controller. Game logic written against `GCController` needs no changes — touch controls are an input source, not a second input system.

```
UIKit touches → TCTouchController → GCController profile → your existing game logic
                       ↓
              Metal render pass (controls drawn by render(using:))
```

The touch controller identifies itself with the product category constant `TCGameControllerProductCategoryTouchController` on its `GCController`.

| Layer | Role |
|-------|------|
| `GCController` | Unified input: physical controllers AND touch controller |
| `TCTouchController` | Owns on-screen controls, converts touches to controller input |
| `TC*Descriptor` | Configures a control before creation (label, anchor, collider, contents) |
| Your Metal renderer | Draws the controls each frame via `render(using:)` |

## 2. Setup

Three integration points: create + connect the controller, route UIKit touches to it, and render its controls in your Metal pass.

```swift
import TouchController
import GameController

final class GameView: MTKView {
    private(set) var touchController: TCTouchController?

    func setUpTouchControls() {
        guard TCTouchController.isSupported else { return }
        let descriptor = TCTouchControllerDescriptor(mtkView: self)
        let controller = TCTouchController(descriptor: descriptor)
        controller.connect()   // surfaces as a GCController; disconnect() removes it
        touchController = controller
    }

    // Route UIKit touches; do the same in touchesMoved/touchesEnded
    // with handleTouchMoved(at:index:) / handleTouchEnded(at:index:)
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            touchController?.handleTouchBegan(at: touch.location(in: self),
                                              index: touch.hash)
        }
    }

    // In your draw loop, after game rendering
    func drawControls(using encoder: MTLRenderCommandEncoder) {
        touchController?.render(using: encoder)
    }
}
```

### Where the GCController Comes From

Touch and physical controllers arrive through the same discovery path. Observe connects, sweep already-connected controllers, and bind handlers once:

```swift
private var gameController: GCController?

func observeControllers() {
    NotificationCenter.default.addObserver(
        self, selector: #selector(controllerDidConnect(_:)),
        name: .GCControllerDidConnect, object: nil)
    for controller in GCController.controllers() {
        configure(controller)
    }
}

@objc private func controllerDidConnect(_ note: Notification) {
    guard let controller = note.object as? GCController else { return }
    configure(controller)
}

private func configure(_ controller: GCController) {
    // Distinguish the touch controller from physical hardware if needed
    let isTouch = controller.productCategory ==
        TCGameControllerProductCategoryTouchController
    gameController = controller
    guard let gamepad = controller.extendedGamepad else { return }
    gamepad.buttonA.valueChangedHandler = { (button: GCControllerButtonInput,
                                             value: Float, pressed: Bool) in
        // same handler for touch and physical input
    }
}
```

Input then arrives through standard GameController patterns — polling (`button.isPressed`) or change handlers as above. For a quick start without manual placement, `automaticallyLayoutControls(for:)` lays out a set of labeled controls with system defaults.

Later snippets assume an unwrapped `touchController` for brevity — guard the optional as in `setUpTouchControls()`.

## 3. Control Catalog

Every control follows the same pattern: configure a descriptor → `add*(descriptor:)` → the returned control is live. Remove with `removeControl(_:)` or `removeAllControls()`.

| Control | Descriptor | Typical use |
|---------|-----------|-------------|
| `TCButton` | `TCButtonDescriptor` | Actions, QTEs |
| `TCSwitch` | `TCSwitchDescriptor` | Toggles (sticky pressed state) |
| `TCThumbstick` | `TCThumbstickDescriptor` | Movement, camera |
| `TCDirectionPad` | `TCDirectionPadDescriptor` | Discrete 4/8-way input |
| `TCThrottle` | `TCThrottleDescriptor` | Analog 1-axis (vehicles, flight) |
| `TCTouchpad` | `TCTouchpadDescriptor` | Absolute or relative pointer-style input |

**Labels map controls to controller elements.** `TCControlLabel` provides statics for the standard gamepad: `.buttonA/.buttonB/.buttonX/.buttonY`, `.buttonMenu`, `.buttonOptions`, `.buttonLeftShoulder/.buttonLeftTrigger` (and right), `.leftThumbstick/.leftThumbstickButton` (and right), `.directionPad`. A control labeled `.buttonB` delivers input as physical button B — existing handler code just works. For game-specific controls, create a custom label: `TCControlLabel(name: "escape_button", role: .button)` (roles: `.button`, `.directionPad`).

```swift
let buttonBDesc = TCButtonDescriptor()
buttonBDesc.label = .buttonB
buttonBDesc.anchor = .bottomRight
buttonBDesc.offset = CGPoint(x: -35, y: -106)
buttonBDesc.contents = .buttonContents(forSystemImageNamed: "b.circle",
                                       size: buttonBDesc.size, shape: .circle,
                                       controller: touchController)
touchController.addButton(descriptor: buttonBDesc)
```

Descriptors also carry `size`, `zIndex`, `colliderShape`, `highlightDuration`, and `anchorCoordinateSystem`.

## 4. Flexible Layout

`TCControlLayoutAnchor` provides nine anchor points — `.topLeft`, `.topCenter`, `.topRight`, `.centerLeft`, `.center`, `.centerRight`, `.bottomLeft`, `.bottomCenter`, `.bottomRight` — and each control's `offset` is relative to its anchor. Group related controls on the same anchor so sections keep consistent size and spacing as the device shape changes. `anchorCoordinateSystem` chooses `.relative` (scales with screen size; equals absolute on small devices) or `.absolute` (fixed distance from edges).

**Respect safe areas.** Rounded corners, the home indicator, and the Dynamic Island can obscure tap targets. Fold `safeAreaInsets` from your view into each offset:

```swift
func adjustedOffset(_ offset: CGPoint, for anchor: TCControlLayoutAnchor) -> CGPoint {
    var (x, y) = (offset.x, offset.y)
    switch anchor {
    case .bottomRight:
        x -= safeAreaInsets.right
        y -= safeAreaInsets.bottom
    default:
        break // adjust the other anchors you use
    }
    return CGPoint(x: x, y: y)
}
```

**Placement guidance** (WWDC 2026-358): keep the screen center clear of controls (that's the play area); thumb-reach regions near the bottom corners get frequent actions; the top edge gets infrequent controls like menus; avoid regions where movement or camera gestures happen.

## 5. Fluid Interaction Patterns

A one-to-one copy of the physical controller clutters the screen. These patterns, from WWDC 2026-358, make touch controls feel native.

### Context-Sensitive Icons

On-screen buttons can change appearance to show their current function — swap `contents` when the action changes:

```swift
func setButtonBContents(symbolName: String) {
    for button in touchController.buttons where button.label == .buttonB {
        button.contents = .buttonContents(forSystemImageNamed: symbolName,
                                          size: buttonSize, shape: .circle,
                                          controller: touchController)
    }
}
```

### Hide What Players Can't Use

| Situation | Mechanism |
|-----------|-----------|
| Thumbstick idle | `hidesWhenNotPressed = true` on the descriptor |
| Control temporarily irrelevant (fixed position) | `isEnabled = false` to hide, `true` to show |
| Control appears at varying positions (pick-up prompt) | `addButton(descriptor:)` at the projected position, `removeControl(_:)` to dismiss |

Transient control sets (a power wheel opened by a button press) can auto-dismiss with structured concurrency:

```swift
func openPowerWheel() {
    showPowerWheelButtons()
    dismissTask = Task { [weak self] in
        try? await Task.sleep(for: .seconds(3))
        guard let self, self.powerWheelActive, !Task.isCancelled else { return }
        self.closePowerWheel()
    }
}
```

### Half-Screen Input Regions

Players can't feel where a virtual stick is, so expand its hit area. `colliderShape` accepts `.circle`, `.rect`, `.leftSide`, or `.rightSide`:

```swift
let leftStickDesc = TCThumbstickDescriptor()
leftStickDesc.label = .leftThumbstick
leftStickDesc.colliderShape = .leftSide   // entire left half responds
leftStickDesc.hidesWhenNotPressed = true
touchController.addThumbstick(descriptor: leftStickDesc)
```

### Sprint from Tilt Magnitude

Hold-stick-button-while-moving needs two fingers on glass. Fold the modifier into the stick itself — read tilt magnitude from the unified `GCController`:

```swift
func pollInput() {
    guard let gamePad = gameController?.extendedGamepad else { return }
    let stick = gamePad.leftThumbstick
    let move = simd_make_float2(stick.xAxis.value, -stick.yAxis.value)
    runModifier = simd_length(move) > 0.8 ? 1.3 : 1.0
    characterDirection = move
}
```

### Touchpad Camera

Mapping the right thumbstick directly to camera rotation over-rotates and feels sluggish on touch. A touchpad with relative values moves the camera exactly as far as the finger moves:

```swift
let touchpadDesc = TCTouchpadDescriptor()
touchpadDesc.label = .rightThumbstick      // reuses existing camera logic
touchpadDesc.colliderShape = .rightSide
touchpadDesc.reportsRelativeValues = true  // position-independent
touchController.addTouchpad(descriptor: touchpadDesc)
```

### Collapse Multi-Finger Combos

- **Quick-time events**: replace "hold L1+R1" with a single custom-label button shown only during the event (`isEnabled` toggle).
- **Aim and release**: one button does both — fire on release in its `valueChangedHandler`, and accumulate aim from raw touch deltas in `touchesMoved` while held (touch deltas are tracked independently of the button's pressed state).

## 6. Feedback

Every touch control needs a visible pressed state. The framework provides this by default — thumbsticks animate, buttons highlight (`highlightDuration` tunes it). For stronger feedback, build `TCControlContents` manually — it is an array of `TCControlImage` layers:

```swift
let haloLayer = TCControlImage(texture: haloTexture, size: haloSize,
                               highlight: nil, offset: .zero,
                               tintColor: tint)
let normalContents = TCControlContents.thumbstickStickBackgroundContents(
    size: bgSize, controller: touchController)
let haloContents = TCControlContents(images: [haloLayer] + normalContents.images)
thumbstick.backgroundContents = isSprinting ? haloContents : normalContents
```

`TCControlImage` also has conveniences `init(cgImage:size:device:)` and `init(uiImage:size:device:)` (failable) when you don't already have an `MTLTexture`.

## 7. GameController Additions `OS27`

### Controller Home Button Settings (not tvOS)

The system lets players assign an action to a long press of the controller Home button (the logo button on PlayStation/Xbox controllers). `GCControllerHomeButtonSettingsManager` lets your game partially inspect the configured action (the `.other` case masks anything beyond "opens this app") and open the Settings screen where players change it — useful for an in-game "customize controller shortcut" entry point.

```swift
@available(iOS 27, macOS 27, visionOS 27, *)
func reviewHomeButtonAction() throws {
    guard let manager = GCControllerHomeButtonSettingsManager() else { return }
    manager.settingsDidChangeHandler = { /* re-read on change */ }

    let action = try manager.readControllerHomeButtonAction()
    if action != .openCurrentApplication {
        // Opens the Settings screen where the player edits the long-press
        // action (.customizeAction) or disables system actions while your
        // app has focus (.customizeOverrides)
        try manager.openControllerHomeButtonSettings(for: .customizeAction)
    }
}
```

`Action` cases: `.unavailable`, `.openCurrentApplication`, `.other`, and `.disabled` (macOS only). Operations are only permitted while a game controller is connected.

Also in the 27 SDKs: `GCControllerElement.SystemGestureState.alwaysReceive` is deprecated — prefer `.disabled` (via `preferredSystemGestureState`) when your game needs full control of an element bound to a system gesture, such as the Options-button screenshot long press.

### Spatial Accessories `visionOS27`

visionOS 27 generalizes tracked game accessories behind `GCSpatialAccessory` (a `GCDevice`). Enumerate with `GCSpatialAccessory.spatialAccessories` and observe connects/disconnects with typed NotificationCenter messages — keep the observation token alive in a property:

```swift
@available(visionOS 27, *)
@MainActor
final class AccessoryCoordinator {
    private var connectToken: NotificationCenter.ObservationToken?

    func start() {
        for accessory in GCSpatialAccessory.spatialAccessories {
            configure(accessory)
        }
        connectToken = NotificationCenter.default.addObserver(
            of: GCSpatialAccessory.self, for: .didConnect) { [weak self] message in
            self?.configure(message.spatialAccessory)
        }
    }

    private func configure(_ accessory: GCSpatialAccessory) {
        _ = accessory.input    // GCDevicePhysicalInput profile
        _ = accessory.haptics  // CHHapticEngine creation, if supported
    }
}
```

When you hold a generic `GCDevice` rather than the enumeration above, test capabilities with `conforms(to:)` against a `GCDeviceType` such as `.spatialAccessory`.

To align buffered input with the accessory's tracked pose, pass an ARKit accessory anchor timestamp (`ar_accessory_anchor_get_timestamp`) to `inputState(forSpatialAccessoryAnchorTimestamp:)` — it returns the buffered input state closest to that anchor sample. This requires a running ARKit session with accessory tracking; the timestamp comes from the accessory anchors it delivers.

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Touch controls never appear | You must call `render(using:)` in your Metal pass each frame — the framework draws nothing on its own |
| Controls appear but never respond | UIKit touches aren't routed: override `touchesBegan/Moved/Ended` and call the matching `handleTouch*(at:index:)` |
| Stale touch controller after teardown | Pair every `connect()` with `disconnect()` — the touch controller stays registered as a `GCController` until disconnected |
| Controls clipped by Dynamic Island / home indicator | Fold `safeAreaInsets` into anchor offsets (Section 4) |
| Virtual stick feels cramped | Set `colliderShape = .leftSide`/`.rightSide` — never leave a small `.circle` collider on a movement stick |
| Camera over-rotates on touch | Use `TCTouchpad` with `reportsRelativeValues = true` instead of mapping the right stick directly |
| `GCControllerHomeButtonSettingsManager` calls fail | Only permitted while a game controller is connected; init is failable — guard it |

## Resources

**WWDC**: 2026-358

**Docs**: /touchcontroller, /gamecontroller, /gamecontroller/gccontroller, /gamecontroller/gcspatialaccessory

**Skills**: skills/spritekit.md, axiom-graphics (skills/metal-migration.md), axiom-graphics (skills/display-performance.md)
