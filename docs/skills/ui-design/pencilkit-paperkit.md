---
name: pencilkit-paperkit
description: Drawing canvas with PencilKit, Apple Pencil Pro features, and PaperKit rich markup
skill_type: skill
version: 1.0
apple_platforms: iOS 13+ (PencilKit), iOS 26+ (PaperKit)
---

# PencilKit & PaperKit

PencilKit gives you a system-quality drawing canvas (`PKCanvasView`) and the platform tool picker (`PKToolPicker`) with almost no code. PaperKit — new in the 26 SDKs — adds a full *markup* experience on top: shapes, images, text boxes, and PencilKit drawing in one canvas, the same engine Notes, Markup, and the Journal app use.

Part of the **axiom-uikit** suite (`skills/pencilkit-paperkit.md` and `skills/pencilkit-paperkit-ref.md`).

## When to Use

Use this skill when you're:
- Adding a drawing, handwriting, or annotation canvas with `PKCanvasView` + `PKToolPicker`
- Persisting, loading, or re-rendering `PKDrawing` data
- Building custom tools into the tool picker (iPadOS 18+)
- Wiring Apple Pencil Pro features — double-tap, squeeze, barrel roll, hover pose, haptics
- Adding a rich markup canvas (shapes / images / text + drawing) with PaperKit (26.0+)
- Bridging any of the above into SwiftUI
- Reading handwritten text with `PKStrokeRecognizer` (iOS 27+)
- Programmatically reading or mutating PaperKit markup elements (iOS 27+)

## Example Prompts

- "How do I add an Apple Pencil drawing canvas with the tool picker?"
- "Why won't my PKToolPicker show up?"
- "How do I save and reload a PencilKit drawing?"
- "How do I handle Apple Pencil Pro barrel roll and squeeze?"
- "How do I add a PaperKit markup canvas with shapes and text?"
- "How do I wrap PKCanvasView in SwiftUI?"
- "How do I recognize handwriting from a PencilKit drawing?"
- "How do I lock PaperKit markup elements so users can't edit them?"
- "How do I add an overlay button to a PaperKit canvas without persisting it?"

## Key Concepts

### The tool picker needs a first responder

The single most common bug: the picker only shows for the *active first responder*. Attach it, make it visible for the canvas, then make the canvas first responder.

```swift
toolPicker.addObserver(canvasView)
toolPicker.setVisible(true, forFirstResponder: canvasView)
canvasView.becomeFirstResponder()   // required — without it nothing appears
```

`PKToolPicker.shared(for:)` and `selectedTool` are deprecated; use an owned `PKToolPicker()` instance and `selectedToolItem`.

### Persist the drawing, not the view

Save `drawing.dataRepresentation()` (a versioned binary blob) and restore with `PKDrawing(data:)`. Rendering to an image is one-way — keep the drawing data as the editable source of truth.

### Apple Pencil features are gated by hardware

Double-tap is Apple Pencil 2nd gen; squeeze, barrel roll, and hover-with-roll are Apple Pencil **Pro** only. `UITouch.rollAngle` returns `0` on pencils without the sensor, and a device preference can route squeeze to a system shortcut so your app never sees it. Treat these as enhancements.

### PaperKit is 26.0+ and built from three pieces

`PaperMarkup` (data model), `PaperMarkupViewController` (interactive canvas), and an insertion menu (`MarkupEditViewController` on iOS, `MarkupToolbarViewController` on macOS). Gate every use with `if #available(iOS 26, *)`, and render a thumbnail at save time so newer files degrade gracefully on older OSes.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Forgetting `becomeFirstResponder()` | Tool picker never appears | Call it after `setVisible(_:forFirstResponder:)` |
| `shared(for:)` / `selectedTool` | Deprecated, unreliable | Owned instance + `selectedToolItem` |
| Archiving the view / a screenshot | Strokes become uneditable | Persist `drawing.dataRepresentation()` |
| Leaving `drawingPolicy` at `.default` | Finger / Simulator drawing dead | Set `.anyInput` |
| Gating a feature on squeeze | User may have remapped it | Keep squeeze optional |
| PaperKit without an availability gate | Won't compile on older SDK targets | Wrap in `if #available(iOS 26, *)` |
| `PKStrokeRecognizer` called synchronously (iOS 27+) | Recognition never returns | It's an actor; `await` every call and call `updateDrawing` first |
| Stroke slicing (`erasePath`/`substroke`) on main thread (iOS 27+) | UI freeze on complex drawings | Run off-main |
| Persisting `MarkupAdornment`s (iOS 27+) | Data lost on next open | Overlay-only; store state separately |

## Related

- [UIKit-SwiftUI Bridging](/skills/ui-design/uikit-bridging) — Wrapping `PKCanvasView` in `UIViewRepresentable`
- For persisting the drawing blob in SwiftData/Core Data, see the axiom-data suite
- For pure SwiftUI canvas wrapping patterns, see the axiom-swiftui suite

## Resources

**WWDC**: 2019-221, 2020-10107, 2024-10214, 2025-285, 2026-203, 2026-372

**Docs**: /pencilkit, /pencilkit/pkcanvasview, /pencilkit/pktoolpicker, /pencilkit/pkdrawing, /uikit/uipencilinteraction, /uikit/uitouch/rollangle, /paperkit, /paperkit/papermarkup
