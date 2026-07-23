# Resizable Rendering

Guidance for keeping custom rendering surfaces — Metal views, video layers, maps, charts, canvases, web views, PDF viewers — correct while their window resizes live and moves between screens with different display scales.

## When to Use

Use this skill when:

- MTKView or CAMetalLayer content stretches, blurs, or letterboxes when the window resizes
- Deciding what to recompute in `drawableSizeWillChange` (projection, viewport, render targets)
- Keeping frame rate up while the user drags the window edge (live-resize throttling)
- A video layer, camera preview, map overlay, chart, `Canvas`, web view, or `PDFView` misbehaves at new window sizes
- Thumbnails or pre-rendered images come out blurry after moving to another screen (Mirroring, external display)
- Auditing rendering code that reads a size once and caches it

## Example Prompts

- "My MTKView content stretches when the iPad window resizes"
- "When do I update CAMetalLayer drawableSize?"
- "How do I keep my Metal app responsive while the window is being resized?"
- "My cached thumbnails are blurry in iPhone Mirroring"
- "My web view layout breaks at narrow window widths"

## What This Skill Provides

- **The sizing rule** – size from the surface, scale from the traits, re-derive both on change
- **Metal patterns** – `drawableSizeWillChange` recompute/reallocate discipline with live-resize throttling, and manual `CAMetalLayer.drawableSize`/`contentsScale` ownership
- **Per-surface table** – what video layers, maps, Swift Charts, `Canvas`, `WKWebView`, `PDFView`, SpriteKit, and SceneKit each need (usually one property or nothing)
- **Scale-keyed caching** – keying raster caches by size *and* displayScale, with UIKit and SwiftUI invalidation hooks

## Related

- [Metal Migration](/skills/games/metal-migration) – MTKView setup, pipelines, and shader work this skill builds on
- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the scene-geometry side: what changed at iOS 27, `isInteractivelyResizing`, screen-vs-trait migration
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – layout-level adaptation; this skill covers the pixel level
- [Display Performance](/skills/debugging/display-performance) – frame pacing and ProMotion once the surface sizes correctly
