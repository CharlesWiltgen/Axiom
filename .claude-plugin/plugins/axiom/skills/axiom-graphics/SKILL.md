---
name: axiom-graphics
description: Use when working with ANY GPU rendering, Metal, OpenGL migration, shaders, 3D content, RealityKit, AR, USD/USDZ files, or display performance. Covers Metal migration, shader conversion, RealityKit ECS, RealityView, USDKit, ProMotion.
license: MIT
---

# Graphics

**You MUST use this skill for ANY GPU rendering, graphics programming, 3D content display, or display performance work.**

## When to Use

Use this router when:
- Porting OpenGL/OpenGL ES code to Metal
- Porting DirectX code to Metal
- Converting GLSL/HLSL shaders to Metal Shading Language
- Setting up MTKView or CAMetalLayer
- Debugging GPU rendering issues (black screen, wrong colors, crashes)
- Evaluating translation layers (MetalANGLE, MoltenVK)
- Optimizing GPU performance or fixing thermal throttling
- App stuck at 60fps on ProMotion device
- Configuring CADisplayLink or render loops
- Variable refresh rate display issues
- Displaying 3D content in a non-game SwiftUI app
- Building AR experiences with RealityKit
- Using RealityView or Model3D in SwiftUI
- Spatial computing or visionOS 3D content
- Reading, editing, or exporting USD/USDZ files in Swift (USDKit)
- Adding ML to a render pipeline (MetalFX denoising, Metal tensors, neural rendering)
- Profiling long game sessions (metalperftrace, look-back traces)

## Routing Logic

### Metal Migration

**Strategy decisions** → See skills/metal-migration.md
- Translation layer vs native rewrite decision
- Project assessment and migration planning
- Anti-patterns and common mistakes
- Pressure scenarios for deadline resistance

**API reference & conversion** → See skills/metal-migration-ref.md
- GLSL → MSL shader conversion tables
- HLSL → MSL shader conversion tables
- GL/D3D API → Metal API equivalents
- MTKView setup, render pipelines, compute shaders
- Complete WWDC code examples

**Diagnostics** → See skills/metal-migration-diag.md
- Black screen after porting
- Shader compilation errors
- Wrong colors or coordinate systems
- Performance regressions
- Time-cost analysis per diagnostic path

### Display Performance

**Frame rate & render loops** → See skills/display-performance.md
- App stuck at 60fps on ProMotion (120Hz) device
- MTKView or CADisplayLink configuration
- Variable refresh rate optimization
- System caps (Low Power Mode, Limit Frame Rate, Thermal, Adaptive Power)
- Frame budget math (8.33ms for 120Hz)
- Measuring actual vs reported frame rate

### RealityKit (Non-Game 3D Content)

For 3D content in non-game SwiftUI apps, AR experiences, and spatial computing, use the RealityKit skills. **For game-specific RealityKit patterns, use the axiom-games router instead.**

**Architecture, ECS, and best practices** → See skills/realitykit.md
- Entity-Component-System architecture
- SwiftUI integration: RealityView, Model3D, attachments
- AR on iOS: AnchorEntity types, SpatialTrackingSession
- Materials, physics, interaction
- Performance optimization

**API reference** → See skills/realitykit-ref.md
- Complete component catalog
- RealityView and Model3D API
- Material system (PBR, Unlit, Occlusion, Custom)
- RealityRenderer (Metal integration)

**Troubleshooting** → See skills/realitykit-diag.md
- Entity not visible, anchor not tracking
- Gesture not responding, performance issues
- Material problems, physics issues

### USD Authoring (USDKit) `OS27`

**USD file work in Swift** → See skills/usdkit.md
- Open, traverse, edit USD stages and prims
- References and composition
- Accessibility metadata for 3D assets
- USDZ export with mesh/texture compression
- Rendering a USD stage in RealityKit (USDStageComponent)

## Decision Tree

1. Translation layer vs native rewrite? → metal-migration
2. Porting / converting code to Metal? → metal-migration
3. API reference / shader conversion tables? → metal-migration-ref
4. MTKView / render pipeline setup? → metal-migration-ref
5. Something broken after porting (black screen, wrong colors)? → metal-migration-diag
6. Stuck at 60fps on ProMotion device? → display-performance
7. CADisplayLink / variable refresh rate? → display-performance
8. Frame rate not as expected? → display-performance
9. Display a 3D model in SwiftUI? → realitykit
10. Build an AR experience? → realitykit
11. RealityView or Model3D setup? → realitykit-ref
12. 3D content not visible or not tracking? → realitykit-diag
13. Custom Metal rendering of RealityKit content? → realitykit-ref (RealityRenderer)
14. Pathfinding, LOD, soft shadows, splats, reverb meshes? → realitykit-ref (Part 10)
15. Read/edit/export a USD or USDZ file in Swift? → usdkit
16. ML in the render pipeline (denoising, Metal tensors)? → metal-migration-ref (Part 6)
17. Frame drops in long play sessions? → display-performance (Part 12)
18. Building a 3D game? → Use axiom-games router instead

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just translate the shaders line by line" | GLSL→MSL has type, coordinate, and precision differences. metal-migration-ref has conversion tables. |
| "MetalANGLE will handle everything" | Translation layers have significant limitations for production. metal-migration evaluates the trade-offs. |
| "It's just a black screen, probably a simple bug" | Black screen has 6 distinct causes. metal-migration-diag diagnoses in 5 min vs 30+ min. |
| "My app runs at 60fps, that's fine" | ProMotion devices support 120Hz. display-performance configures the correct frame rate. |
| "I'll just use SceneKit for the 3D model" | SceneKit is soft-deprecated. RealityView and Model3D are the modern path. `skills/realitykit.md` covers SwiftUI integration. |
| "I don't need ECS for one 3D model" | Model3D shows one model with zero ECS. RealityView scales to complex scenes. `skills/realitykit.md` shows both paths. |
| "I'll parse the USD file myself / bundle OpenUSD" | USDKit is system-provided USD on the 27 releases. `skills/usdkit.md` covers stages, editing, and compressed export. |
| "I'll write my own pathfinding over the scene graph" | RealityKit 27 ships navigation meshes with costs and off-mesh connections. `skills/realitykit-ref.md` Part 10. |
| "The frame drop only happens after an hour of play, can't trace that" | The 27 releases record Metal metrics continuously — collect after the fact with metalperftrace. `skills/display-performance.md` Part 12. |

## Critical Patterns

**metal-migration**:
- Translation layer (MetalANGLE) for quick demos
- Native Metal rewrite for production
- State management differences (GL stateful → Metal explicit)
- Coordinate system gotchas (Y-flip, NDC differences)

**metal-migration-ref**:
- Complete shader type mappings
- API equivalent tables
- MTKView vs CAMetalLayer decision
- Render pipeline setup patterns

**metal-migration-diag**:
- GPU Frame Capture workflow (2-5 min vs 30+ min guessing)
- Shader debugger for variable inspection
- Metal validation layer for API misuse
- Performance regression diagnosis

**display-performance**:
- MTKView defaults to 60fps (must set preferredFramesPerSecond = 120)
- CADisplayLink preferredFrameRateRange for explicit rate control
- System caps: Low Power Mode, Limit Frame Rate, Thermal, Adaptive Power (iOS 26)
- 8.33ms frame budget for 120Hz
- UIScreen.maximumFramesPerSecond lies; CADisplayLink tells truth

**realitykit** (non-game 3D):
- RealityView make/update closure pattern
- Model3D for simple model display
- AR anchoring with AnchorEntity
- Material selection (SimpleMaterial, PBR, Occlusion)

**realitykit-ref** (API):
- RealityRenderer for custom Metal rendering of RealityKit content
- Complete material property reference
- RealityView gesture integration
- RealityKit 27 additions: navigation mesh, LOD, soft shadows, Gaussian splats (visionOS), reverb meshes (Part 10), cloth simulation (`ClothBodyComponent`), ComputeGraph framework

**usdkit** (USD authoring, 27 releases):
- USDStage open/traverse/edit, references and composition
- Accessibility metadata schema for 3D assets
- Compressed USDZ export (AOM meshes + AVIF textures)
- USDStageComponent / USDPlayer RealityKit bridge

## Example Invocations

User: "Should I use MetalANGLE or rewrite in native Metal?"
→ See `skills/metal-migration.md`

User: "I'm porting projectM from OpenGL ES to iOS"
→ See `skills/metal-migration.md`

User: "How do I convert this GLSL shader to Metal?"
→ See `skills/metal-migration-ref.md`

User: "Setting up MTKView for the first time"
→ See `skills/metal-migration-ref.md`

User: "My ported app shows a black screen"
→ See `skills/metal-migration-diag.md`

User: "Performance is worse after porting to Metal"
→ See `skills/metal-migration-diag.md`

User: "My app is stuck at 60fps on iPhone Pro"
→ See `skills/display-performance.md`

User: "How do I configure CADisplayLink for 120Hz?"
→ See `skills/display-performance.md`

User: "ProMotion not working in my Metal app"
→ See `skills/display-performance.md`

User: "How do I show a 3D model in my SwiftUI app?"
→ See `skills/realitykit.md`

User: "I need to display a USDZ model"
→ See `skills/realitykit.md`

User: "How do I set up RealityView?"
→ See `skills/realitykit-ref.md`

User: "My 3D model isn't showing in RealityView"
→ See `skills/realitykit-diag.md`

User: "How do I use RealityRenderer with Metal?"
→ See `skills/realitykit-ref.md`

User: "I need AR in my app"
→ See `skills/realitykit.md`

User: "How do I read and edit a USD file in Swift?"
→ See `skills/usdkit.md`

User: "How do I shrink my USDZ assets for delivery?"
→ See `skills/usdkit.md`

User: "How do I add pathfinding to my RealityKit scene?"
→ See `skills/realitykit-ref.md` (Part 10)

User: "My game's frame rate drops after an hour of play"
→ See `skills/display-performance.md` (Part 12)

User: "How do I run a neural network inside my Metal shader?"
→ See `skills/metal-migration-ref.md` (Part 6)
