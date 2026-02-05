---
name: axiom-ios-games
description: Use when building ANY 2D or 3D game, game prototype, or interactive simulation with SpriteKit, SceneKit, or RealityKit. Covers scene graphs, ECS architecture, physics, actions, game loops, rendering, SwiftUI integration, SceneKit migration.
license: MIT
---

# iOS Games Router

**You MUST use this skill for ANY game development, SpriteKit, SceneKit, RealityKit, or interactive simulation work.**

## When to Use

Use this router when:
- Building a new SpriteKit game or prototype (2D)
- Building a 3D game with SceneKit or RealityKit
- Implementing physics (collisions, contacts, forces, joints)
- Setting up game architecture (scenes, layers, cameras, ECS)
- Debugging SpriteKit, SceneKit, or RealityKit issues
- Optimizing game performance (draw calls, node counts, entity counts, batching)
- Managing game loop, delta time, or pause handling
- Implementing touch/input handling in a game context
- Integrating SpriteKit or RealityKit with SwiftUI
- Working with particle effects, texture atlases, or 3D models
- Looking up SpriteKit, SceneKit, or RealityKit API details
- Migrating from SceneKit to RealityKit
- Building AR games with RealityKit

## Routing Logic

### SpriteKit (2D)

**Architecture, patterns, and best practices** → `/skill axiom-spritekit`
- Scene graph model, coordinate systems, anchor points
- Physics engine: bitmask discipline, contact detection, body types
- Actions system: sequencing, grouping, named actions, timing
- Input handling: touches, coordinate conversion
- Performance: draw calls, batching, object pooling, SKShapeNode trap
- Game loop: frame cycle, delta time, pause handling
- Scene transitions and data passing
- SwiftUI integration (SpriteView, UIViewRepresentable)
- Metal integration (SKRenderer)
- Anti-patterns and code review checklist
- Pressure scenarios with push-back templates

**API reference and lookup** → `/skill axiom-spritekit-ref`
- All 16 node types with properties and performance notes
- SKPhysicsBody creation methods and properties
- Complete SKAction catalog (movement, rotation, scaling, fading, composition, physics)
- Texture and atlas management
- SKConstraint types and SKRange
- SKView configuration and scale modes
- SKEmitterNode properties and presets
- SKRenderer setup and SKShader syntax

**Troubleshooting and diagnostics** → `/skill axiom-spritekit-diag`
- Physics contacts not firing (6-branch decision tree)
- Objects tunneling through walls (5-branch)
- Poor frame rate (4 top branches, 12 leaves)
- Touches not registering (6-branch)
- Memory spikes and crashes (5-branch)
- Coordinate confusion (5-branch)
- Scene transition crashes (5-branch)

### SceneKit (3D — Deprecated)

**SceneKit is soft-deprecated as of iOS 26.** Use for maintenance of existing code only. New 3D projects should use RealityKit.

**Maintenance and migration planning** → `/skill axiom-scenekit`
- Scene graph architecture, coordinate system, transforms
- Rendering: SCNView, SceneView (deprecated), SCNViewRepresentable
- Geometry, PBR materials, shader modifiers
- Lighting, animation (SCNAction, SCNTransaction, CAAnimation bridge)
- Physics: bodies, collision categories, contact delegate
- Asset pipeline: Model I/O, USD/DAE/SCN formats
- ARKit integration (legacy ARSCNView)
- Migration decision tree (when to migrate vs maintain)
- Anti-patterns and pressure scenarios

**API reference and migration mapping** → `/skill axiom-scenekit-ref`
- Complete SceneKit → RealityKit concept mapping table
- Scene graph API: SCNScene, SCNNode, SCNGeometry
- Materials: lighting models, PBR properties, shader modifiers
- Lighting: all light types with properties
- Camera: SCNCamera properties
- Physics: body types, shapes, joints
- Animation: SCNAction catalog, timing functions
- Constraints: all constraint types

### RealityKit (3D — Modern)

**For non-game 3D content display (product viewers, AR try-on, spatial computing), the ios-graphics router also routes to these RealityKit skills.**

**Architecture, ECS, and best practices** → `/skill axiom-realitykit`
- Entity-Component-System mental model and paradigm shift
- Entity hierarchy, transforms, world-space queries
- Built-in and custom components, component lifecycle
- System protocol, update ordering, event handling
- SwiftUI integration: RealityView, Model3D, attachments
- AR on iOS: AnchorEntity types, SpatialTrackingSession
- Interaction: ManipulationComponent, gestures, hit testing
- Materials: SimpleMaterial, PBR, Unlit, Occlusion, ShaderGraph, Custom
- Physics: collision shapes, groups/filters, events, forces
- Animation: transform, USD playback, playback control
- Audio: spatial, ambient, channel
- Performance: instancing, component churn, shape optimization
- Multiplayer: synchronization, ownership
- Anti-patterns and code review checklist
- Pressure scenarios

**API reference and lookup** → `/skill axiom-realitykit-ref`
- Entity API: properties, hierarchy, subclasses
- Complete component catalog with all properties
- MeshResource generators
- ShapeResource types and performance
- System protocol and EntityQuery
- Scene events catalog
- RealityView API: initializers, content, gestures
- Model3D API
- Material system: all types with full property listings
- Animation timing functions and playback control
- Audio components and playback
- RealityRenderer (Metal integration)

**Troubleshooting and diagnostics** → `/skill axiom-realitykit-diag`
- Entity not visible (8-branch decision tree)
- Anchor not tracking (6-branch)
- Gesture not responding (6-branch)
- Performance problems (7-branch)
- Material looks wrong (6-branch)
- Physics not working (6-branch)
- Multiplayer sync issues (5-branch)

## Decision Tree

1. Building/designing a 2D SpriteKit game? → axiom-spritekit
2. How to use a specific SpriteKit API? → axiom-spritekit-ref
3. SpriteKit broken or performing badly? → axiom-spritekit-diag
4. Maintaining existing SceneKit code? → axiom-scenekit
5. SceneKit API reference or migration mapping? → axiom-scenekit-ref
6. Building new 3D game or experience? → axiom-realitykit
7. How to use a specific RealityKit API? → axiom-realitykit-ref
8. RealityKit entity not visible, gestures broken, performance? → axiom-realitykit-diag
9. Migrating SceneKit to RealityKit? → axiom-scenekit (migration tree) + axiom-scenekit-ref (mapping table)
10. Building AR game? → axiom-realitykit
11. Physics contacts not working (SpriteKit)? → axiom-spritekit-diag (Symptom 1)
12. Frame rate dropping (SpriteKit)? → axiom-spritekit-diag (Symptom 3)
13. Coordinate/position confusion (SpriteKit)? → axiom-spritekit-diag (Symptom 6)
14. Need the complete action list? → axiom-spritekit-ref (Part 3)
15. Physics body setup reference? → axiom-spritekit-ref (Part 2)
16. Entity not visible (RealityKit)? → axiom-realitykit-diag (Symptom 1)
17. Gesture not responding (RealityKit)? → axiom-realitykit-diag (Symptom 3)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "SpriteKit is simple, I don't need a skill" | Physics bitmasks default to 0xFFFFFFFF and cause phantom collisions. The bitmask checklist catches this in 2 min. |
| "I'll just use SKShapeNode, it's quick" | Each SKShapeNode is a separate draw call. 50 of them = 50 draw calls. axiom-spritekit has the pre-render-to-texture pattern. |
| "I can figure out the coordinate system" | SpriteKit uses bottom-left origin (opposite of UIKit). Anchor points add another layer. axiom-spritekit-diag Symptom 6 resolves in 5 min. |
| "Physics is straightforward" | Three different bitmask properties, modification rules inside callbacks, and tunneling edge cases. axiom-spritekit Section 3 covers all gotchas. |
| "The performance is fine on my device" | Performance varies dramatically across devices. axiom-spritekit Section 6 has the debug overlay checklist. |
| "SceneKit is fine for our new project" | SceneKit is soft-deprecated iOS 26. No new features, only security patches. axiom-scenekit has the migration decision tree. |
| "I'll learn RealityKit later" | Every line of SceneKit is migration debt. axiom-scenekit-ref has the concept mapping table so the transition is concrete, not abstract. |
| "ECS is overkill for a simple 3D app" | You're already using ECS — Entity + ModelComponent. axiom-realitykit shows how to scale from simple to complex. |
| "I don't need collision shapes for taps" | RealityKit gestures require CollisionComponent. axiom-realitykit-diag diagnoses this in 2 min vs 30 min guessing. |
| "I'll just use a Timer for game updates" | Timer-based updates miss frames and aren't synchronized with rendering. axiom-realitykit has the System pattern. |

## Critical Patterns

**axiom-spritekit**:
- PhysicsCategory struct with explicit bitmasks (default `0xFFFFFFFF` causes phantom collisions)
- Camera node pattern for viewport + HUD separation
- SKShapeNode pre-render-to-texture conversion
- `[weak self]` in all `SKAction.run` closures
- Delta time with spiral-of-death clamping

**axiom-spritekit-ref**:
- Complete node type table (16 types with batching behavior)
- Physics body creation methods (circle cheapest, texture most expensive)
- Full action catalog with composition patterns
- SKView debug overlays and scale mode matrix

**axiom-spritekit-diag**:
- 5-step bitmask checklist (2 min vs 30-120 min guessing)
- Debug overlays as mandatory first diagnostic step
- Tunneling prevention flowchart
- Memory growth diagnosis via `showsNodeCount` trending

**axiom-scenekit**:
- Migration decision tree (new project → RealityKit, existing → maintain or migrate)
- USDZ asset conversion before migration (`xcrun scntool`)
- SceneView deprecation and SCNViewRepresentable replacement
- Pressure scenarios for "just use SceneKit" rationalization

**axiom-scenekit-ref**:
- Complete SceneKit → RealityKit concept mapping table
- All material lighting models and properties
- Full constraint catalog

**axiom-realitykit**:
- ECS mental shift table (scene graph thinking → ECS thinking)
- Custom component registration (`registerComponent()`)
- Read-modify-write pattern for component updates
- CollisionComponent required for all interaction
- System-based updates instead of timers

**axiom-realitykit-ref**:
- Complete component catalog with all properties
- MeshResource generators and ShapeResource types
- Scene events catalog
- Material system with all PBR properties

**axiom-realitykit-diag**:
- Entity visibility checklist (8 branches, 2-5 min vs 30-60 min)
- Gesture debugging (CollisionComponent first check)
- Performance diagnosis (entity count, resource sharing, component churn)
- Physics constraint: entities must share an anchor

## Example Invocations

User: "I'm building a SpriteKit game"
→ Invoke: `/skill axiom-spritekit`

User: "My physics contacts aren't firing"
→ Invoke: `/skill axiom-spritekit-diag`

User: "How do I create a physics body from a texture?"
→ Invoke: `/skill axiom-spritekit-ref`

User: "Frame rate is dropping in my game"
→ Invoke: `/skill axiom-spritekit-diag`

User: "How do I set up SpriteKit with SwiftUI?"
→ Invoke: `/skill axiom-spritekit`

User: "What action types are available?"
→ Invoke: `/skill axiom-spritekit-ref`

User: "Objects pass through walls"
→ Invoke: `/skill axiom-spritekit-diag`

User: "I need to build a 3D game"
→ Invoke: `/skill axiom-realitykit`

User: "How do I add a 3D model to my SwiftUI app?"
→ Invoke: `/skill axiom-realitykit`

User: "My RealityKit entity isn't showing up"
→ Invoke: `/skill axiom-realitykit-diag`

User: "How do I set up physics in RealityKit?"
→ Invoke: `/skill axiom-realitykit-ref`

User: "I'm migrating from SceneKit to RealityKit"
→ Invoke: `/skill axiom-scenekit` + `/skill axiom-scenekit-ref`

User: "What's the RealityKit equivalent of SCNNode?"
→ Invoke: `/skill axiom-scenekit-ref`

User: "Should I use SceneKit for my new 3D project?"
→ Invoke: `/skill axiom-scenekit`

User: "Tap gestures don't work on my RealityKit entity"
→ Invoke: `/skill axiom-realitykit-diag`

User: "How do I set up ECS in RealityKit?"
→ Invoke: `/skill axiom-realitykit`

User: "My AR content isn't tracking"
→ Invoke: `/skill axiom-realitykit-diag`

User: "What materials are available in RealityKit?"
→ Invoke: `/skill axiom-realitykit-ref`

User: "How do I animate entities in RealityKit?"
→ Invoke: `/skill axiom-realitykit-ref`

User: "Memory keeps growing during gameplay"
→ Invoke: `/skill axiom-spritekit-diag`

User: "What particle emitter settings should I use for fire?"
→ Invoke: `/skill axiom-spritekit-ref`
