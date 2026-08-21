
# USDKit Reference `OS27`

USDKit is the system framework for working with USD (Universal Scene Description) in Swift — opening, traversing, editing, and exporting USD scenes without bundling OpenUSD yourself. New in the 27 releases (iOS/iPadOS/macOS/tvOS/visionOS — not watchOS), with RealityKit and Spatial Preview integration.

## When to Use This Reference

Use this reference when:
- Reading, inspecting, or editing a USD/USDZ file in Swift
- Building 3D content pipelines (authoring, converting, compressing assets)
- Adding accessibility metadata to 3D assets
- Exporting USDZ packages with mesh/texture compression
- Rendering a USD stage directly in RealityKit (`USDStageComponent`)

Do NOT use for:
- Displaying a USDZ model in an app UI — `Model3D`/`RealityView` need no USDKit; see axiom-graphics (skills/realitykit.md)
- Cross-platform pipelines — SwiftUSD (SPM) for Swift, or embed OpenUSD directly for C++ (see Part 9)

## Part 1: USD Concepts

| Concept | Meaning |
|---------|---------|
| Layer (`USDLayer`) | A single USD data file |
| Composition | Combining layers — references pull other layers in without copying data |
| Stage (`USDStage`) | The composed result of one or more layers; your window into the full scene |
| Prim (`USDPrim`) | Everything in a scene; typed by a schema (`Xform`, `Mesh`, ...) |
| Attribute | Holds a prim's data (typed values, possibly time-sampled) |
| Metadata | Information about the prim itself |

Composition is the collaboration model: each contributor authors their own layer, your stage references them, and upstream edits flow in automatically.

## Part 2: Stages

```swift
import USDKit

// New in-memory stage
let stage = USDStage()

// Open from disk (throws)
let stage = try USDStage.open(URL(fileURLWithPath: "/ALab/entry.usda"))

// Other variants
// USDStage.open(_:sessionLayer:options:)          — from a FilePath
// USDStage.open(rootLayer:sessionLayer:options:)  — from an opened USDLayer
// USDStage(displayName:loadingPayloads:)          — control payload loading
//   (.all by default; the URL open variant takes loadingPayloads: too)
```

Variant sets, payload load/unload after opening, and edit targets are not covered here — check the `/usdkit` docs before using those APIs.

## Part 3: Traversal and Prims

```swift
// Walk the composed hierarchy
for prim in stage.descendants {
    if prim.path.name == "scope" {   // prims have no direct name — use path.name
        // found it
    }
}

// Define a new prim and reference another file into it
let scope = stage.definePrim(at: "/World/scope", type: "Xform")
try scope.references.add("/ALab/assets/scope.usda")
```

Traversal API on stages and prims: `descendants` / `allDescendants` (all includes inactive), `children` / `allChildren`, `children(where:)` and `descendants(where:)` with a `USDPrim.Predicate`, `parent`, `nextSibling`, `prim(at:)`, `object(at:)`. Paths are `USDLayer.Path` values and are `ExpressibleByStringLiteral` — string literals like `"/World/scope"` convert directly.

## Part 4: Attributes and Transforms

Attributes read and write through a typed subscript; `makeAttribute` creates them:

```swift
// Move a prim: creates xformOp:translate and updates xformOpOrder
scope.addTransformOperation(type: .translate)
scope["xformOp:translate", as: USDValue.Vec3d.self] = [2.5, 0.0, -1.0]

// Reads return an optional
let translation = scope["xformOp:translate", as: USDValue.Vec3d.self]  // Vec3d?
```

Other attribute API: `attributes` / `authoredAttributes`, `attribute(named:)`, `attribute(at:)`, `hasAttribute(named:)`, `makeAttribute(named:as:custom:variability:)`.

## Part 5: API Schemas and Accessibility

USD now standardizes accessibility metadata for 3D objects (label + description, defined by the AccessibilityAPI multi-apply schema; authorable in Blender and Maya too). USDKit applies schemas but does not provide schema-specific accessors — create the attributes with the exact names from the specification:

```swift
try scope.applyAPISchema("AccessibilityAPI", instanceName: "default")

scope.makeAttribute(named: "accessibility:default:label", as: .string)
scope.makeAttribute(named: "accessibility:default:description", as: .string)

scope["accessibility:default:label", as: String.self] = "Oscilloscope"
scope["accessibility:default:description", as: String.self] =
    "Vintage signal analyzer with a 3D wireframe display"
```

## Part 6: Export and Compression

`exportPackage` writes a USDZ package; export options enable AOM mesh compression (up to ~90% smaller meshes) and AVIF texture compression — Apple cites ~7× smaller average assets without visual-quality loss:

```swift
try stage.exportPackage(
    to: URL(fileURLWithPath: "/ALab/alab_compressed.usdz"),
    options: [
        .preferSmallTextureFiles(quality: .standard),  // .low / .medium / .standard
        .preferSmallMeshFiles
    ]
)
```

The same compression is available without code in Preview (macOS 27) and the `usdcrush` command-line tool.

## Part 7: Observing Changes

Stages publish change notices — register a typed observer for `USDStage.ObjectsDidChange` and inspect its changed/resynced paths:

```swift
let token = stage.addObserver(for: USDStage.ObjectsDidChange.self) { notice in
    // notice.changedPaths / notice.resyncedPaths
}
```

`USDStage.TimeCode` represents time-sampled values (`.default`, `.earliest`, numeric and pre-time variants) — used when sampling animated attributes and by `USDStageComponent`.

## Part 8: RealityKit Integration

The RealityKit overlay renders a USDKit stage directly — no conversion step:

| API | Purpose |
|-----|---------|
| `USDStageComponent` | Attach a `USDStage` to an entity; `init(_:timeCode:allowsHitTesting:)` is async; `stage` is read-only — build a new component or use `render(_:to:at:)` to change stages |
| `USDStageComponent.render(_:to:at:)` / `waitForRenderComplete(on:)` | Static async helpers — render a stage to an entity at a time code; await render completion |
| `USDPlayer` | Drives stage rendering; `init(stage:)` or `init(stage:gpuFamily:)` |

For ECS architecture, RealityView, and the rest of RealityKit, see axiom-graphics (skills/realitykit.md).

## Part 9: The 27 USD Ecosystem

Context for platform decisions (WWDC 2026-285):

- OpenUSD, MaterialX, and (new) OpenVDB are all updated across the 27 platforms; volumetrics join the composable USD stack.
- Particle Fields — a new USD primitive type (developed with NVIDIA, Adobe, Pixar) describing Gaussian splats and similar representations alongside meshes. To render splats see axiom-graphics (skills/realitykit-ref.md) Part 10.
- Preview on macOS 27 adds essential 3D editing, a choice of renderers (RealityKit, Storm, and a new production-quality Raytracer), and OpenPBR material support.
- The Spatial Preview framework (macOS 27) streams a scene live from a Mac app to Quick Look on Vision Pro, with SharePlay collaboration.
- Safari's Model tag embeds interactive USD models in web pages (spatial presentation on visionOS).
- Picking an integration: USDKit for apps on Apple platforms; SwiftUSD (SPM) for advanced cross-platform Swift needs; embed OpenUSD as a framework for C++ codebases. All read/write the same files.

## Resources

**WWDC**: 2026-285, 2026-279

**Docs**: /usdkit

**Skills**: axiom-graphics (skills/realitykit.md), axiom-graphics (skills/realitykit-ref.md)
