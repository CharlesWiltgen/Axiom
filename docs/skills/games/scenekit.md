---
name: scenekit
description: SceneKit development — scene graph, materials, physics, animation, SwiftUI bridge, RealityKit migration planning
---

# SceneKit

Guide to maintaining existing SceneKit code and planning migration to RealityKit. SceneKit is soft-deprecated as of iOS 26 (no new features, only security patches). This skill covers the scene graph model, materials, physics, animation, SwiftUI integration, and a migration decision tree.

## When to Use

Use this skill when:
- Maintaining existing SceneKit code
- Building a SceneKit prototype (with awareness of deprecation)
- Planning migration from SceneKit to RealityKit
- Debugging SceneKit rendering, physics, or animation issues
- Integrating SceneKit content with SwiftUI
- Loading 3D models via Model I/O or SCNSceneSource

## Example Prompts

- "Should I start a new 3D project in SceneKit or RealityKit?"
- "How do I integrate SceneKit with SwiftUI now that SceneView is deprecated?"
- "What's the best way to migrate our SceneKit app to RealityKit?"
- "How do I set up PBR materials in SceneKit?"
- "My SceneKit physics contacts aren't working"
- "How do I convert .scn files to USDZ for RealityKit?"

## What This Skill Provides

### Deprecation Context
- SceneKit soft-deprecated as of iOS 26 (existing apps continue to work)
- SceneView (SwiftUI) formally deprecated -- UIViewRepresentable replacement pattern
- Apple's forward path is RealityKit

### Scene Graph Architecture
- Right-handed Y-up coordinate system
- Transform hierarchy (parent-child cascading)
- SCNView (UIKit) and UIViewRepresentable (SwiftUI replacement)

### Geometry and Materials
- Built-in geometry types (box, sphere, cylinder, plane, torus, capsule, cone, tube, text)
- PBR materials (diffuse, metalness, roughness, normal, AO, emission)
- Shader modifiers at 4 entry points (geometry, surface, lightingModel, fragment)

### Animation
- SCNAction (declarative sequences, groups, repeats)
- Implicit animation (SCNTransaction)
- Explicit animation (CAAnimation bridge)
- Loading animations from files

### Physics
- Body types (dynamic, static, kinematic), collision categories, contact delegate
- Category, collision, and contact test bitmasks

### Asset Pipeline
- Supported formats (USDZ preferred, DAE, SCN, OBJ, Alembic)
- Converting .scn to USDZ via `xcrun scntool`

### Migration Decision Tree
- New project, AR features, visionOS target, heavy investment, maintenance mode -- clear branching guidance

### Anti-Patterns
- Starting new projects in SceneKit
- Using .scn files without USDZ conversion
- Deep shader modifier customization (zero portability to RealityKit)
- Relying on SCNRenderer for custom pipelines
- Ignoring deprecation warnings

## Related

- [SceneKit API Reference](/reference/scenekit-ref) — Complete SceneKit API with RealityKit migration mapping for every major concept
- [RealityKit](/skills/games/realitykit) — Apple's recommended 3D framework with ECS architecture
- [RealityKit API Reference](/reference/realitykit-ref) — RealityKit API for migration target reference
