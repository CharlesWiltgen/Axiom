---
name: axiom-ios-graphics
description: Use when working with ANY GPU rendering, Metal, OpenGL migration, shaders, 3D content, RealityKit, AR, or display performance. Covers Metal migration, shader conversion, RealityKit ECS, RealityView, variable refresh rate, ProMotion.
license: MIT
---

# iOS Graphics Router

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

## Routing Logic

### Metal Migration

**Strategy decisions** → `/skill axiom-metal-migration`
- Translation layer vs native rewrite decision
- Project assessment and migration planning
- Anti-patterns and common mistakes
- Pressure scenarios for deadline resistance

**API reference & conversion** → `/skill axiom-metal-migration-ref`
- GLSL → MSL shader conversion tables
- HLSL → MSL shader conversion tables
- GL/D3D API → Metal API equivalents
- MTKView setup, render pipelines, compute shaders
- Complete WWDC code examples

**Diagnostics** → `/skill axiom-metal-migration-diag`
- Black screen after porting
- Shader compilation errors
- Wrong colors or coordinate systems
- Performance regressions
- Time-cost analysis per diagnostic path

### Display Performance

**Frame rate & render loops** → `/skill axiom-display-performance`
- App stuck at 60fps on ProMotion (120Hz) device
- MTKView or CADisplayLink configuration
- Variable refresh rate optimization
- System caps (Low Power Mode, Limit Frame Rate, Thermal, Adaptive Power)
- Frame budget math (8.33ms for 120Hz)
- Measuring actual vs reported frame rate

### RealityKit (Non-Game 3D Content)

For 3D content in non-game SwiftUI apps, AR experiences, and spatial computing, use the RealityKit skills. **For game-specific RealityKit patterns, use the ios-games router instead.**

**Architecture, ECS, and best practices** → `/skill axiom-realitykit`
- Entity-Component-System architecture
- SwiftUI integration: RealityView, Model3D, attachments
- AR on iOS: AnchorEntity types, SpatialTrackingSession
- Materials, physics, interaction
- Performance optimization

**API reference** → `/skill axiom-realitykit-ref`
- Complete component catalog
- RealityView and Model3D API
- Material system (PBR, Unlit, Occlusion, Custom)
- RealityRenderer (Metal integration)

**Troubleshooting** → `/skill axiom-realitykit-diag`
- Entity not visible, anchor not tracking
- Gesture not responding, performance issues
- Material problems, physics issues

## Decision Tree

1. Translation layer vs native rewrite? → metal-migration
2. Porting / converting code to Metal? → metal-migration
3. API reference / shader conversion tables? → metal-migration-ref
4. MTKView / render pipeline setup? → metal-migration-ref
5. Something broken after porting (black screen, wrong colors)? → metal-migration-diag
6. Stuck at 60fps on ProMotion device? → display-performance
7. CADisplayLink / variable refresh rate? → display-performance
8. Frame rate not as expected? → display-performance
9. Display a 3D model in SwiftUI? → axiom-realitykit
10. Build an AR experience? → axiom-realitykit
11. RealityView or Model3D setup? → axiom-realitykit-ref
12. 3D content not visible or not tracking? → axiom-realitykit-diag
13. Custom Metal rendering of RealityKit content? → axiom-realitykit-ref (RealityRenderer)
14. Building a 3D game? → Use ios-games router instead

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just translate the shaders line by line" | GLSL→MSL has type, coordinate, and precision differences. metal-migration-ref has conversion tables. |
| "MetalANGLE will handle everything" | Translation layers have significant limitations for production. metal-migration evaluates the trade-offs. |
| "It's just a black screen, probably a simple bug" | Black screen has 6 distinct causes. metal-migration-diag diagnoses in 5 min vs 30+ min. |
| "My app runs at 60fps, that's fine" | ProMotion devices support 120Hz. display-performance configures the correct frame rate. |
| "I'll just use SceneKit for the 3D model" | SceneKit is soft-deprecated. RealityView and Model3D are the modern path. axiom-realitykit covers SwiftUI integration. |
| "I don't need ECS for one 3D model" | Model3D shows one model with zero ECS. RealityView scales to complex scenes. axiom-realitykit shows both paths. |

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

**axiom-realitykit** (non-game 3D):
- RealityView make/update closure pattern
- Model3D for simple model display
- AR anchoring with AnchorEntity
- Material selection (SimpleMaterial, PBR, Occlusion)

**axiom-realitykit-ref** (API):
- RealityRenderer for custom Metal rendering of RealityKit content
- Complete material property reference
- RealityView gesture integration

## Example Invocations

User: "Should I use MetalANGLE or rewrite in native Metal?"
→ Invoke: `/skill axiom-metal-migration`

User: "I'm porting projectM from OpenGL ES to iOS"
→ Invoke: `/skill axiom-metal-migration`

User: "How do I convert this GLSL shader to Metal?"
→ Invoke: `/skill axiom-metal-migration-ref`

User: "Setting up MTKView for the first time"
→ Invoke: `/skill axiom-metal-migration-ref`

User: "My ported app shows a black screen"
→ Invoke: `/skill axiom-metal-migration-diag`

User: "Performance is worse after porting to Metal"
→ Invoke: `/skill axiom-metal-migration-diag`

User: "My app is stuck at 60fps on iPhone Pro"
→ Invoke: `/skill axiom-display-performance`

User: "How do I configure CADisplayLink for 120Hz?"
→ Invoke: `/skill axiom-display-performance`

User: "ProMotion not working in my Metal app"
→ Invoke: `/skill axiom-display-performance`

User: "How do I show a 3D model in my SwiftUI app?"
→ Invoke: `/skill axiom-realitykit`

User: "I need to display a USDZ model"
→ Invoke: `/skill axiom-realitykit`

User: "How do I set up RealityView?"
→ Invoke: `/skill axiom-realitykit-ref`

User: "My 3D model isn't showing in RealityView"
→ Invoke: `/skill axiom-realitykit-diag`

User: "How do I use RealityRenderer with Metal?"
→ Invoke: `/skill axiom-realitykit-ref`

User: "I need AR in my app"
→ Invoke: `/skill axiom-realitykit`
