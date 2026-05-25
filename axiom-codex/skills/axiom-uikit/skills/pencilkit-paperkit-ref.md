
# PencilKit + PaperKit — API Reference

Comprehensive API reference for PencilKit (canvas, tool picker, stroke model, Apple Pencil) and PaperKit (markup canvas, data model, feature sets). For the discipline (setup order, persistence, gotchas, decision-making), see `skills/pencilkit-paperkit.md`.

## Key Terminology

- **PKCanvasView** — `UIScrollView` subclass that captures and renders drawing. Owns a `PKDrawing`.
- **PKDrawing** — Vector stroke data. The persistable source of truth (`dataRepresentation()`).
- **PKToolPicker** — Floating palette of tools. Attached to a canvas via `addObserver(_:)`.
- **PKTool** — A tool that draws on the canvas (`PKInkingTool`, `PKEraserTool`, `PKLassoTool`).
- **PKToolPickerItem** — An entry *in the picker* (inking, eraser, lasso, ruler, scribble, custom). iPadOS 18+.
- **PaperMarkup** — PaperKit data model holding markup elements + a PencilKit drawing.
- **PaperMarkupViewController** — PaperKit's interactive canvas. iOS 26+.
- **FeatureSet** — The set of PaperKit tools/elements exposed to a markup/insertion controller.

---

# Part 1: PKCanvasView

```swift
import PencilKit

let canvas = PKCanvasView()
canvas.drawing = PKDrawing()                 // the vector data
canvas.tool = PKInkingTool(.pen, color: .black, width: 5)
canvas.drawingPolicy = .anyInput             // .default | .anyInput | .pencilOnly
canvas.isRulerActive = false
canvas.delegate = coordinator
canvas.backgroundColor = .systemBackground
canvas.isOpaque = false                      // transparent canvas over content
```

## PKCanvasViewDelegate

```swift
func canvasViewDrawingDidChange(_ canvasView: PKCanvasView)        // strokes added/removed
func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView)
func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView)
func canvasViewDidFinishRendering(_ canvasView: PKCanvasView)
```

`drawingPolicy`: `.default` (pencil-only once a pencil is used; finger otherwise), `.anyInput` (finger or pencil — required in the Simulator), `.pencilOnly`.

---

# Part 2: PKDrawing

```swift
let drawing = PKDrawing()                            // empty
let restored = try PKDrawing(data: savedData)        // throwing init from blob
let composed = PKDrawing(strokes: [stroke1, stroke2])

let data = drawing.dataRepresentation()              // versioned binary blob — persist THIS
let image = drawing.image(from: drawing.bounds, scale: 2.0)  // one-way raster export

let bounds = drawing.bounds                          // CGRect of all strokes
let strokes = drawing.strokes                        // [PKStroke]
var moved = drawing
moved.transform(using: CGAffineTransform(translationX: 10, y: 0))
moved.append(otherDrawing)
```

`requiredContentVersion` (`PKContentVersion`) reflects the newest feature used. Newer ink types (monoline, fountainPen, watercolor, crayon — iOS 17; reed — iOS 26) raise it, so a drawing made on a newer OS may not decode on an older one. Check it for forwards compatibility.

---

# Part 3: Tools

```swift
// Inking
let pen = PKInkingTool(.pen, color: .systemBlue, width: 5)
pen.inkType        // PKInkingTool.InkType
pen.color          // UIColor
pen.width          // CGFloat

// InkType cases: .pen .pencil .marker .monoline .fountainPen .watercolor .crayon .reed
//   .pen/.pencil/.marker → iOS 13;  .monoline/.fountainPen/.watercolor/.crayon → iOS 17;  .reed → iOS 26

// Eraser
let eraser = PKEraserTool(.vector)          // .vector (stroke) | .bitmap (pixel) | .fixedWidthBitmap (iOS 16.4+)

// Lasso (selection — no ink)
let lasso = PKLassoTool()
```

---

# Part 4: PKToolPicker

```swift
let picker = PKToolPicker()                  // default tool set (iOS 13+)
let custom = PKToolPicker(toolItems: [...])  // explicit set/order (iPadOS 18+)

picker.addObserver(canvas)                   // canvas mirrors picker selection into its `tool`
picker.setVisible(true, forFirstResponder: canvas)
canvas.becomeFirstResponder()                // required for the picker to appear

picker.selectedToolItem                      // current item (use this — selectedTool is deprecated)
picker.selectedToolItemIdentifier
picker.colorUserInterfaceStyle = .dark
picker.overrideUserInterfaceStyle = .dark
picker.accessoryItem = UIBarButtonItem(...)  // trailing button (iPadOS 18+); hidden when minimized
```

Deprecated: `shared(for:)` (per-window picker), `selectedTool`. Use an owned instance and `selectedToolItem`.

## Tool picker items (iPadOS 18+, visionOS 2+)

```swift
PKToolPickerInkingItem(type: .pen)      // has a matching PKTool; set on observing canvas automatically
PKToolPickerEraserItem(type: .vector)
PKToolPickerLassoItem()
PKToolPickerRulerItem()                 // toggles canvas.isRulerActive; no PKTool, not "selected"
PKToolPickerScribbleItem()             // handwriting → text; auto-hides per Apple Pencil settings
PKToolPickerCustomItem(configuration:)  // your own tool
```

## Custom tools

```swift
var config = PKToolPickerCustomItem.Configuration(identifier: "com.example.stamp", name: "Stamp")
config.allowsColorSelection = true
config.defaultColor = .systemRed
config.defaultWidth = 20
config.imageProvider = { item in renderThumbnail(width: item.width, color: item.color) }

let stamp = PKToolPickerCustomItem(configuration: config)
stamp.color          // current color
stamp.width          // current width
stamp.reloadImage()  // call when a custom attribute changes
```

When a custom item is selected, drawing on observing `PKCanvasView`s is disabled — your app renders the tool's effect.

---

# Part 5: Stroke introspection (iOS 14+)

```swift
for stroke in drawing.strokes {
    let ink: PKInk = stroke.ink            // ink.inkType, ink.color
    let path: PKStrokePath = stroke.path   // interpolated points
    let transform = stroke.transform       // CGAffineTransform
    let mask = stroke.mask                 // optional UIBezierPath

    for point in path {                    // PKStrokePoint
        point.location        // CGPoint
        point.timeOffset      // TimeInterval since stroke start
        point.size            // CGSize (width/height of the contact)
        point.opacity         // CGFloat
        point.force           // CGFloat
        point.azimuth         // CGFloat (radians)
        point.altitude        // CGFloat (radians)
    }
}
```

`PKStrokePath` is sampled over time; index it (it conforms to `RandomAccessCollection`) or call `interpolatedPoints(in:by:)` (a range + a parametric stride) for even spacing.

---

# Part 6: Apple Pencil interactions

## UIKit — UIPencilInteraction

```swift
let interaction = UIPencilInteraction()
interaction.delegate = self
view.addInteraction(interaction)

// iPadOS 12.1+ (Apple Pencil 2nd gen)
func pencilInteraction(_ i: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
    // tap.hoverPose (UIPencilHoverPose?) on supported hardware
}

// iPadOS 17.5+ (Apple Pencil Pro)
func pencilInteraction(_ i: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
    guard squeeze.phase == .ended, let pose = squeeze.hoverPose else { return }
    showPalette(at: pose.location)   // pose: location, zOffset, azimuth, altitude, rollAngle
}
```

If the device-global squeeze preference is set to run a system shortcut, the squeeze event is **not** delivered to your app.

## SwiftUI

```swift
canvas
    .onPencilDoubleTap { value in /* value.hoverPose */ }
    .onPencilSqueeze { phase in
        if case .ended(let value) = phase, let pose = value.hoverPose { show(at: pose.location) }
    }
```

## Barrel roll (iOS 17.5+)

```swift
touch.rollAngle                       // CGFloat; 0 on pencils without the sensor
hoverGestureRecognizer.rollAngle      // also on UIHoverGestureRecognizer
// Refine over Bluetooth:
override func touchesEstimatedPropertiesUpdated(_ touches: Set<UITouch>) { ... }
```

## Drawing haptics (iOS 17.5+)

```swift
// UIKit
let fb = UICanvasFeedbackGenerator(view: canvasView)
fb.alignmentOccurred(at: point)
fb.pathCompleted(at: point)

// SwiftUI — the .sensoryFeedback enum cases are iOS 17.0+ (UICanvasFeedbackGenerator is 17.5+)
canvas
    .sensoryFeedback(.alignment, trigger: alignCount)
    .sensoryFeedback(.pathComplete, trigger: snapCount)
```

`UIFeedbackGenerator` and subclasses now take a `view` on init and a point when generating feedback — update existing uses.

---

# Part 7: PaperKit data model (iOS 26+)

`PaperMarkup` is a **struct** — `append` and the `insertNew…` methods are `mutating`, so hold it in a `var` (a `let` won't compile) and reassign the VC's `markup` after editing.

```swift
import PaperKit

var markup = PaperMarkup(bounds: view.bounds)        // var — mutating methods below
let loaded = try PaperMarkup(dataRepresentation: data)

markup.bounds
markup.featureSet
markup.indexableContent                      // text for Spotlight/search
markup.append(contentsOf: otherMarkup)       // mutating
markup.append(contentsOf: pkDrawing)         // mutating — drops a PKDrawing straight in

markup.insertNewImage(cgImage, frame: rect, rotation: 0)   // takes a CGImage (uiImage.cgImage), not UIImage
markup.insertNewShape(configuration: shapeConfig, frame: rect, rotation: 0)
markup.insertNewTextbox(attributedText: text, frame: rect, rotation: 0)
markup.removeContentUnsupported(by: .version1)  // forwards-compat: strip content newer than a FeatureSet

let data = try await markup.dataRepresentation()                       // async throws
await markup.draw(in: cgContext, frame: rect, options: .init())        // render thumbnail (async)
```

---

# Part 8: PaperKit controllers (iOS 26+)

```swift
// Interactive canvas
let markupVC = PaperMarkupViewController(markup: markup, supportedFeatureSet: .latest)
markupVC.delegate = self
markupVC.isEditable = true
markupVC.drawingTool = PKInkingTool(.pen, color: .black, width: 5)
markupVC.contentVisibleFrame                  // visible canvas region
toolPicker.addObserver(markupVC)              // markup VC observes the PKToolPicker

// PaperMarkupViewController conforms to Observable — observe instead of delegating if preferred

// Insertion menu — iOS / iPadOS / visionOS
let insert = MarkupEditViewController(supportedFeatureSet: .latest, additionalActions: [])
insert.delegate = markupVC
// present as a popover anchored to the tool picker's accessoryItem

// Insertion toolbar — macOS
let toolbar = MarkupToolbarViewController(supportedFeatureSet: .latest)
toolbar.delegate = markupVC
toolbar.selectedDrawingTool
```

`PaperMarkupViewController.Delegate` surfaces markup-change callbacks (use them to auto-save the model). Embed via standard `UIViewController` (iOS) / `NSViewController` (macOS) containment, or wrap in `UIViewControllerRepresentable` for SwiftUI.

---

# Part 9: FeatureSet (iOS 26+)

```swift
var features = FeatureSet.latest          // also: .empty, .version1
features.remove(.someFeature)             // FeatureSet.Feature
features.insert(.someFeature)
features.colorMaximumLinearExposure = 4   // > 1 enables HDR inks; 1 = SDR
features.features                         // Set<FeatureSet.Feature>

markupVC.supportedFeatureSet = features
insert.supportedFeatureSet = features     // keep markup + insertion controllers in sync
toolPicker.colorMaximumLinearExposure = 4 // set on the picker too for HDR inks
```

Use `FeatureSet.latest` to track new framework features automatically. For HDR, tone-map down with the screen's headroom (`UIScreen` / `NSScreen`).

---

## Resources

**WWDC**: 2019-221, 2020-10107, 2024-10214, 2025-285

**Docs**: /pencilkit, /pencilkit/pkcanvasview, /pencilkit/pkdrawing, /pencilkit/pktoolpicker, /pencilkit/pktoolpickercustomitem, /pencilkit/pkstroke, /pencilkit/pkinkingtool, /uikit/uipencilinteraction, /uikit/uitouch/rollangle, /paperkit, /paperkit/papermarkup, /paperkit/papermarkupviewcontroller, /paperkit/featureset

**Skills**: skills/pencilkit-paperkit.md, skills/uikit-bridging.md, axiom-data (drawing persistence), axiom-swiftui (canvas wrapping)
