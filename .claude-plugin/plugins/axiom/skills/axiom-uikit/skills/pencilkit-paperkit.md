
# PencilKit + PaperKit — Drawing & Markup

PencilKit gives you a system-quality drawing canvas (`PKCanvasView`) and the platform tool picker (`PKToolPicker`) with almost no code. PaperKit — new in the 26 SDKs — layers a full *markup* experience on top: shapes, images, text boxes, and PencilKit drawing in one canvas, powered by the same engine Notes, Markup, QuickLook, and the Journal app use.

## Core mental model

PencilKit is **UIKit**. `PKCanvasView` is a `UIScrollView` subclass; there is no SwiftUI-native canvas, so every SwiftUI integration wraps it in `UIViewRepresentable`. The canvas owns a `PKDrawing` — the vector stroke data. You persist that drawing's `dataRepresentation()`, never the view. The tool picker is a *separate* object you attach to the canvas as an observer and show against a first responder.

PaperKit sits one level up. A `PaperMarkupViewController` renders an interactive canvas backed by a `PaperMarkup` data model that stores **both** the markup elements and a PencilKit drawing. PaperKit is **26.0+ only** — gate every use.

## When to Use This Skill

- Adding a drawing, handwriting, or annotation canvas with `PKCanvasView` + `PKToolPicker`
- Persisting, loading, or re-rendering `PKDrawing` data
- Building custom tools into the tool picker (iPadOS 18+)
- Wiring Apple Pencil Pro features — double-tap, squeeze, barrel roll, hover pose, haptics
- Adding a rich markup canvas (shapes / images / text + drawing) with PaperKit (26.0+)
- Bridging any of the above into SwiftUI

For the full type/property surface, see `skills/pencilkit-paperkit-ref.md`. For wrapping UIKit in SwiftUI, see `skills/uikit-bridging.md`. For persisting the drawing blob in a store, see axiom-data.

## System Requirements

| API | Availability |
|-----|--------------|
| `PKCanvasView`, `PKToolPicker`, `setVisible(_:forFirstResponder:)`, `addObserver(_:)` | iOS 13+, iPadOS 13+, Mac Catalyst 13.1+, visionOS 1+ — **no native macOS** |
| `PKStroke`, `PKStrokePoint`, `PKInk` (stroke introspection) | iOS 14+ |
| `PKToolPicker.init(toolItems:)`, `PKToolPickerCustomItem`, accessory bar button | iPadOS 18+, visionOS 2+ |
| Double-tap (`pencilInteraction(_:didReceiveTap:)`, `.onPencilDoubleTap`) | iPadOS 12.1+ (Apple Pencil 2nd gen) |
| Squeeze + hover pose (`didReceiveSqueeze:`, `.onPencilSqueeze`), `UITouch.rollAngle` | iOS/iPadOS 17.5+ (Apple Pencil Pro) |
| `UICanvasFeedbackGenerator` (canvas haptics) | iOS 17.5+ — SwiftUI `.sensoryFeedback(.alignment / .pathComplete)` itself is iOS 17.0+ |
| PaperKit (`PaperMarkupViewController`, `PaperMarkup`, `MarkupEditViewController`, `MarkupToolbarViewController`, `FeatureSet`) | iOS / iPadOS / Mac Catalyst / macOS / visionOS 26.0+ |

PencilKit runs on Mac Catalyst, but the **tool picker does not display on Catalyst** — provide your own tool UI there. PaperKit *does* run natively on macOS 26 (Tahoe).

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Tool picker never appears | The picker only shows for the *active first responder* | `addObserver(canvas)`, `setVisible(true, forFirstResponder: canvas)`, then `canvas.becomeFirstResponder()` |
| `PKToolPicker.shared(for:)` returns nothing useful | Deprecated — it is no longer the per-window picker | Create your own `PKToolPicker()` and hold a strong reference |
| `selectedTool` is deprecated | Replaced by item-based selection | Read `selectedToolItem` / `selectedToolItemIdentifier` |
| Saved drawing won't reload | You archived the *view* (or a screenshot), not the drawing | Persist `drawing.dataRepresentation()`; restore with `PKDrawing(data:)` |
| Squeeze handler never fires | A device-global preference can route squeeze to a system shortcut — your app then gets no event | Treat squeeze as an enhancement; never gate a core feature on it |
| Finger drawing does nothing | Default `drawingPolicy` becomes pencil-only once a pencil is used | Set `canvas.drawingPolicy = .anyInput` to allow finger / Simulator drawing |
| PaperKit symbols won't compile | PaperKit is 26.0+ only | Wrap in `if #available(iOS 26, *)` with a fallback |

## Part 1 — The canvas + tool picker (the part everyone gets wrong)

The picker is attached to the canvas as an observer, made visible *for a responder*, and the canvas must then become first responder. Miss the last step and the picker silently never shows.

```swift
import PencilKit

final class DrawingViewController: UIViewController {
    private let canvasView = PKCanvasView()
    private let toolPicker = PKToolPicker()   // hold a strong reference

    override func viewDidLoad() {
        super.viewDidLoad()
        canvasView.frame = view.bounds
        canvasView.drawingPolicy = .anyInput  // allow finger + Simulator drawing
        view.addSubview(canvasView)

        toolPicker.addObserver(canvasView)              // canvas reacts to tool changes
        toolPicker.setVisible(true, forFirstResponder: canvasView)
        canvasView.becomeFirstResponder()               // REQUIRED — or the picker won't appear
    }
}
```

`drawingPolicy` options: `.default` (pencil-only after a pencil is detected), `.anyInput` (finger or pencil — needed in the Simulator), `.pencilOnly`.

## Part 2 — Persisting drawings

Persist the **drawing's data**, not the view. `dataRepresentation()` is a versioned binary blob; round-trip it through `PKDrawing(data:)`.

```swift
// Save
let data = canvasView.drawing.dataRepresentation()
try data.write(to: drawingURL)

// Load
let restored = try PKDrawing(data: Data(contentsOf: drawingURL))
canvasView.drawing = restored

// Export a raster image for thumbnails / sharing (does not round-trip)
let image = canvasView.drawing.image(from: canvasView.drawing.bounds, scale: UIScreen.main.scale)
```

Store the `Data` blob in your model (a SwiftData/Core Data attribute, a file). Re-rendering an image is one-way — keep the `PKDrawing` data as the source of truth so strokes stay editable. See axiom-data for storing the blob safely.

## Part 3 — SwiftUI integration

No native SwiftUI canvas exists. Wrap `PKCanvasView` in `UIViewRepresentable` and bridge the drawing with a binding.

```swift
import SwiftUI
import PencilKit

struct CanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    let toolPicker = PKToolPicker()

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawingPolicy = .anyInput
        canvas.delegate = context.coordinator
        canvas.drawing = drawing
        toolPicker.addObserver(canvas)
        toolPicker.setVisible(true, forFirstResponder: canvas)
        DispatchQueue.main.async { canvas.becomeFirstResponder() }
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        if canvas.drawing != drawing { canvas.drawing = drawing }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        let parent: CanvasView
        init(_ parent: CanvasView) { self.parent = parent }
        func canvasViewDrawingDidChange(_ canvas: PKCanvasView) {
            parent.drawing = canvas.drawing   // push edits back to the binding
        }
    }
}
```

See `skills/uikit-bridging.md` for the representable lifecycle and coordinator gotchas.

## Part 4 — Apple Pencil tiers and interactions

Features are gated by *hardware*, not just OS. Check before assuming a gesture exists.

| Apple Pencil | Double-tap | Squeeze | Barrel roll | Hover |
|--------------|-----------|---------|-------------|-------|
| 1st gen / USB-C | No | No | No | No |
| 2nd gen | Yes | No | No | Yes (M2 iPad) |
| Pro | Yes | Yes | Yes | Yes (+ roll) |

UIKit interactions go through `UIPencilInteraction`; SwiftUI has matching view modifiers.

```swift
// SwiftUI — double-tap and squeeze
myCanvas
    .onPencilDoubleTap { value in
        // value.hoverPose has location / azimuth / altitude / rollAngle (if available)
        toggleEraser()
    }
    .onPencilSqueeze { phase in
        // Respect the user's Settings preference; squeeze may be routed to a shortcut
        if case .ended(let value) = phase, let pose = value.hoverPose {
            showToolPalette(at: pose.location)
        }
    }
```

Treat squeeze as a single discrete action. If the device preference is set to run a system shortcut, **your app never receives the squeeze event** — so it must remain an enhancement, not a requirement.

## Part 5 — Apple Pencil Pro: barrel roll, hover, haptics

`PKCanvasView` applies barrel roll to the marker and fountain pen automatically. For a *custom* canvas, read `rollAngle` (iOS 17.5+, returns `0` on pencils without the sensor) from `UITouch` or `UIHoverGestureRecognizer`.

```swift
override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
    guard let touch = touches.first else { return }
    // Combine roll + azimuth so finger / older-pencil input still varies the stroke
    let angle = touch.rollAngle + touch.azimuthAngle(in: view)
    applyStrokeAngle(angle)
}

// Roll is estimated first, then refined over Bluetooth — capture the final value
override func touchesEstimatedPropertiesUpdated(_ touches: Set<UITouch>) {
    for touch in touches { finalizeStrokeAngle(touch.rollAngle, for: touch.estimationUpdateIndex) }
}
```

Use roll for *stroke input*, not for driving UI controls. For drawing haptics, use `UICanvasFeedbackGenerator` (`.alignment` when snapping to a guide, `.pathComplete` when a stroke snaps to a recognized shape), or SwiftUI's `.sensoryFeedback(.alignment, trigger:)` / `.pathComplete`.

## Part 6 — Custom tools in the tool picker (iPadOS 18+)

`init(toolItems:)` lets you choose and order the picker's tools, and `PKToolPickerCustomItem` adds *your* tool (a stamp, a retouch brush) alongside the system tools. When a custom item is selected, drawing on observing canvases is turned off and **your app does the rendering** — PencilKit only does the picking.

```swift
var config = PKToolPickerCustomItem.Configuration(identifier: "com.example.stamp", name: "Stamp")
config.imageProvider = { item in renderStampThumbnail(width: item.width, color: item.color) }
let stamp = PKToolPickerCustomItem(configuration: config)

let picker = PKToolPicker(toolItems: [
    PKToolPickerInkingItem(type: .pen),
    PKToolPickerEraserItem(type: .vector),
    PKToolPickerLassoItem(),
    PKToolPickerRulerItem(),
    stamp,
])
```

Call the item's `reloadImage()` when a custom attribute changes so the picker thumbnail updates.

## Part 7 — PaperKit (26.0+)

PaperKit is built from three pieces:

- **`PaperMarkup`** — the data model container (a **struct** — its `insertNew…`/`append` methods are `mutating`, so hold it in a `var`). Saves/loads markup *and* the PencilKit drawing; renders thumbnails via its `draw` function.
- **`PaperMarkupViewController`** — the interactive canvas. Observes a `PKToolPicker`; conforms to `Observable` (or use its delegate).
- **The insertion menu** — `MarkupEditViewController` on iOS/iPadOS/visionOS, or a `MarkupToolbarViewController` on macOS.

```swift
if #available(iOS 26, *) {
    let markupModel = PaperMarkup(bounds: view.bounds)
    let markupVC = PaperMarkupViewController(markup: markupModel, supportedFeatureSet: .latest)
    addChild(markupVC)
    view.addSubview(markupVC.view)
    markupVC.didMove(toParent: self)

    let toolPicker = PKToolPicker()
    toolPicker.addObserver(markupVC)               // markup VC reacts to tool changes
}
```

**Forwards compatibility is mandatory.** A drawing saved by a newer OS may not load on an older one. On load, verify the content version; on mismatch, show a pre-rendered thumbnail (render it at save time with the model's `draw` into a `CGContext`) rather than failing. This is what Notes does. To proactively drop content an older `FeatureSet` can't render, call `markup.removeContentUnsupported(by: .version1)` before saving or displaying.

**FeatureSet** controls which tools/elements are available. Start from `FeatureSet.latest`, then `remove`/`insert` to customize, and assign the same set to **both** the markup controller and the insertion controller. Enable HDR inks by setting `colorMaximumLinearExposure` > 1 on the feature set *and* the tool picker (use `1` for SDR). Set `contentView` to any `UIView` to render markup over a background template.

PaperKit's `PaperMarkup` interoperates with PencilKit — `append(contentsOf:)` accepts a `PKDrawing`, so existing PencilKit content drops straight in.

## Part 8 — Handwriting recognition & programmatic markup `OS27`

Two big 27 additions (full signatures in `skills/pencilkit-paperkit-ref.md`):

- **On-device handwriting recognition** — `PKStrokeRecognizer`, a Swift **actor** (all `await`). Feed it a `PKDrawing` (`updateDrawing`), then read `recognizedText()`, `indexableContent` (for Spotlight), or `search(_:)` (returns match bounds for highlighting). Offline, 29 languages, on every 27-capable device. Works without a `PKCanvasView` because `PKStrokePath` now round-trips to/from `CGPath` (Bézier).
- **PaperKit opens up** — `PaperMarkup.subelements` (a read/write `MarkupOrderedSet`) lets you read and mutate every element. Each conforms to `Markup` (`frame`/`rotation`/`allowedInteractions`); lock template elements with `allowedInteractions = .readOnly`. `MarkupAdornment`s add interactive overlays that are **not** persisted.

```swift
@available(iOS 27, macOS 27, visionOS 27, *)
func transcribe(_ drawing: PKDrawing) async -> String? {
    let recognizer = PKStrokeRecognizer()
    await recognizer.updateDrawing(drawing)
    return await recognizer.recognizedText()
}
```

## Common Mistakes

- Forgetting `becomeFirstResponder()` — the most common "the tool picker won't show" bug.
- Using `PKToolPicker.shared(for:)` or `selectedTool` — both deprecated; use an instance and `selectedToolItem`.
- Persisting a screenshot or the view instead of `drawing.dataRepresentation()` — strokes become uneditable.
- Leaving `drawingPolicy` at `.default` and wondering why finger/Simulator drawing is dead.
- Gating a core feature on squeeze — the user may have routed it to a system shortcut.
- Assuming barrel roll / squeeze exist — they are Apple Pencil Pro only; `rollAngle` is `0` otherwise.
- Calling PaperKit without an availability gate — it is 26.0+ and will not compile against older SDK targets.
- Skipping PaperKit forwards-compatibility — newer files fail to open with no fallback thumbnail.
- Calling `PKStrokeRecognizer` synchronously (`OS27`) — it's an actor; every call is `await`, and you must `updateDrawing` before reading results.
- Running stroke slicing (`erasePath`/`substroke`, `OS27`) on the main thread — it's expensive on complex drawings; do it off-main.
- Persisting `MarkupAdornment`s (`OS27`) — they're overlay-only, never saved/printed/exported; store their state yourself.

## Resources

**WWDC**: 2019-221, 2020-10107, 2024-10214, 2025-285, 2026-203, 2026-372

**Docs**: /pencilkit, /pencilkit/pkcanvasview, /pencilkit/pktoolpicker, /pencilkit/pkdrawing, /pencilkit/pkstroke, /pencilkit/pkstrokerecognizer, /uikit/uipencilinteraction, /uikit/uitouch/rollangle, /paperkit, /paperkit/papermarkupviewcontroller, /paperkit/papermarkup, /paperkit/markupadornment

**Skills**: skills/pencilkit-paperkit-ref.md, skills/uikit-bridging.md (UIViewRepresentable), axiom-data (persisting drawing data), axiom-swiftui (SwiftUI canvas wrapping)
