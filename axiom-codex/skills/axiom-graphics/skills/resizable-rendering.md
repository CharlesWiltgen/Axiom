# Rendering Surfaces Under Window Resizing

At 27 every window resizes continuously — iPhone included (iPhone Mirroring, iPhone-on-iPad) — and a scene can migrate between screens with different sizes *and* display scales (Mirroring, external displays). Any surface that renders pixels must derive its dimensions from the current drawable/view and the trait scale, never from the device screen, and must survive the size changing live under the user's drag.

The rule: **size from the surface, scale from the traits, re-derive both on change.** The scene-geometry side (what changed at 27, `UIScreen.main` migration, `isInteractivelyResizing`) lives in axiom-uikit (skills/uikit-modernization.md); this skill is the rendering side.

## Metal

### MTKView — react in the delegate

```swift
func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
    guard size != lastDrawableSize, size.width > 0 else { return }
    lastDrawableSize = size
    projection = makeProjection(aspect: Float(size.width / size.height))
    depthTexture = makeDepthTexture(size: size)     // size-dependent targets
}
```

- `size` is in **pixels** (drawable size, not points).
- Recompute the projection/viewport here, and reallocate size-dependent render targets (depth, offscreen color, bloom chains). Guard against zero/duplicate sizes — expect repeated calls during a live resize.
- **During an interactive resize**, reallocating full-resolution targets on every change wastes the frame budget. A common pattern: while `UIWindowSceneGeometry.isInteractivelyResizing` is true (see axiom-uikit (skills/uikit-modernization.md)), render at the last settled target size (or a reduced one) and scale to fit; reallocate once when the drag settles.

MTKView setup itself (device, pixel formats, render loop) is in skills/metal-migration-ref.md.

### CAMetalLayer — you own drawableSize

`CAMetalLayer.drawableSize` does not track the layer; per the header, "the most typical value will be the layer size multiplied by the layer contentsScale property" — and you set it:

```swift
override func layoutSubviews() {
    super.layoutSubviews()
    metalLayer.contentsScale = traitCollection.displayScale
    metalLayer.drawableSize = CGSize(width: bounds.width * metalLayer.contentsScale,
                                     height: bounds.height * metalLayer.contentsScale)
}
```

Bounds from `self.bounds`, scale from `traitCollection.displayScale` — never `UIScreen.main`.

### Offscreen SceneKit

`SCNView` is a view and follows its bounds. An offscreen `SCNRenderer` renders into the `viewport` rect you pass to `render(atTime:viewport:commandBuffer:passDescriptor:)` — recompute that rect (and your pass's target textures) when the presentation size changes.

## Every other surface, quickly

| Surface | Resize behavior | Your job |
|---|---|---|
| `VideoPlayer` (SwiftUI) | sizes to its container | nothing — don't wrap it in fixed frames |
| `AVPlayerLayer` | layer — does not lay itself out | set its frame in the layout pass; pick `videoGravity` (`.resizeAspect`/`.resizeAspectFill`/`.resize`) |
| Camera preview layer | same layer rules | see axiom-media (skills/camera-capture.md) for gravity + rotation |
| `Map` / `MKMapView` | view-sized; map content is geo-anchored | don't cache screen-space geometry in custom overlay renderers |
| Swift Charts | SwiftUI proposal-driven | cache the computed *data series*, not per-size geometry; the chart re-lays-out itself |
| `Canvas` | draw closure receives the current `size` | derive everything from that parameter; never capture an initial size |
| `WKWebView` | tracks its bounds; CSS re-evaluates | pages assuming a fixed device-width viewport mis-render — test the HTML at multiple widths |
| `PDFView` | view-sized | `autoScales = true` re-fits the page on bounds changes |
| SpriteKit | `scaleMode` decides fit/fill/resize | see axiom-games (skills/spritekit.md) for the scaleMode table |

The common failure across all of them is the same one: reading a size once (at init, from the screen) and baking it into layout, geometry, or a cache.

## Scale-keyed caches go stale across screens

A mirrored or external-display scene can land on a screen with a different `displayScale` — a thumbnail or pre-rendered asset cache keyed only by point size now returns blurry (or wastefully oversized) images.

- Key raster caches by **(point size, displayScale)**, and render into them at that scale (`UIGraphicsImageRenderer(size:format:)` with the trait's scale).
- Invalidate on scale change: UIKit `registerForTraitChanges([UITraitDisplayScale.self], ...)`; SwiftUI `@Environment(\.displayScale)` re-renders dependents automatically — recompute cached images when it changes.

## Resources

**Docs**: /metalkit/mtkview, /metalkit/mtkviewdelegate/mtkview(_:drawablesizewillchange:), /quartzcore/cametallayer/drawablesize, /avfoundation/avplayerlayer, /pdfkit/pdfview/autoscales, /scenekit/scnrenderer

**Skills**: skills/metal-migration-ref.md, skills/display-performance.md, axiom-uikit (skills/uikit-modernization.md), axiom-swiftui (skills/layout-ref.md), axiom-games (skills/spritekit.md), axiom-media (skills/camera-capture.md)
