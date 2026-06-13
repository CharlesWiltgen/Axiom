---
name: usdkit
description: USDKit — open, traverse, edit, and export USD/USDZ scenes in Swift with the system framework new in the 27 releases
---

# USDKit

Reference for USDKit, the system framework (new in the 27 releases) that gives Swift apps first-class support for USD (Universal Scene Description, the industry-standard 3D scene format) — opening and traversing stages, editing prims and attributes, applying schemas, and exporting compressed USDZ packages, with direct RealityKit integration.

## When to Use

Use this skill when:
- Reading, inspecting, or editing a USD/USDZ file in Swift
- Building 3D content pipelines (authoring, converting, compressing assets)
- Adding accessibility metadata to 3D assets
- Exporting USDZ packages with mesh and texture compression
- Rendering a USD stage directly in RealityKit (USDStageComponent)
- Deciding between USDKit, SwiftUSD, and embedding OpenUSD

## Example Prompts

- "How do I open and edit a USD file in Swift?"
- "How do I reference one USD file from another?"
- "How do I add accessibility labels to a 3D asset?"
- "How do I shrink my USDZ files for delivery?"
- "How do I render a USD stage in RealityKit without converting it?"
- "Should I use USDKit or SwiftUSD?"

## What This Skill Provides

### USD Concepts
- Layers, composition, stages, prims, schemas, attributes, metadata

### Stage Workflows
- Opening stages from URLs, file paths, or layers; in-memory stages
- Traversal (descendants, children, predicates), defining prims, adding references

### Editing
- Typed attribute subscripts, transform operations, API schemas
- The standardized AccessibilityAPI schema for 3D assets

### Export
- `exportPackage` with AOM mesh compression and AVIF texture compression
- Preview and `usdcrush` no-code equivalents

### RealityKit Bridge
- `USDStageComponent` and `USDPlayer` for rendering stages directly

### Ecosystem Context
- OpenUSD/MaterialX/OpenVDB updates, Particle Fields (Gaussian splats in USD), Preview 3D editing, Safari Model tag, SwiftUSD alternative

## Related

- [RealityKit](/skills/games/realitykit) – Displaying and interacting with 3D content; use it (not USDKit) to simply show a USDZ model
- [RealityKit API Reference](/reference/realitykit-ref) – Component catalog including the 27-cycle additions and Gaussian splat rendering
