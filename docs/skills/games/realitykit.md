---
name: realitykit
description: RealityKit development — ECS architecture, SwiftUI integration, AR, physics, materials, animation, multiplayer
---

# RealityKit

Complete guide to building 3D content, AR experiences, and spatial computing apps using RealityKit's Entity-Component-System (ECS) architecture. Covers SwiftUI integration via RealityView, AR anchoring, physics, materials, animation, audio, and multiplayer sync.

## When to Use

Use this skill when:
- Building any 3D experience (AR, games, visualization, spatial computing)
- Creating SwiftUI apps with 3D content (RealityView, Model3D)
- Implementing AR with anchors (world, image, face, body tracking)
- Working with Entity-Component-System (ECS) architecture
- Setting up physics, collisions, or spatial interactions
- Building multiplayer or shared AR experiences
- Migrating from SceneKit to RealityKit
- Targeting visionOS

## Example Prompts

- "How do I add a 3D model to a SwiftUI view?"
- "What's the difference between ECS and scene graph?"
- "How do I detect collisions between RealityKit entities?"
- "My entity is added but nothing appears on screen"
- "How do I make entities tappable in visionOS?"
- "How do I set up AR plane detection with RealityKit?"
- "What materials does RealityKit support?"

## What This Skill Provides

### ECS Mental Model
- Entity-Component-System vs scene graph thinking
- Components as value types (structs, not classes)
- Systems for per-frame logic with EntityQuery
- Read-modify-write pattern for component updates

### Entity Hierarchy
- Creating entities with components, hierarchy management, cloning
- Transform operations (local vs world-space, look-at)

### Custom Components and Systems
- Defining Component structs, registration, lifecycle
- System protocol with query filtering and event handling
- Collision events, scene update subscriptions

### SwiftUI Integration
- RealityView (iOS 18+, visionOS 1.0+) with make/update/placeholder closures
- Model3D for simple 3D display
- SwiftUI attachments in visionOS
- State binding between SwiftUI and RealityKit

### AR on iOS
- AnchorEntity types (plane, world, image, face, body)
- SpatialTrackingSession (iOS 18+)
- Best practices for surface detection and device support

### Interaction
- ManipulationComponent for drag/rotate/scale gestures
- InputTargetComponent (visionOS) with gesture integration
- Hit testing and ray-casting

### Materials
- 7 material types: Simple, PhysicallyBased, Unlit, Occlusion, Video, ShaderGraph, Custom
- PBR configuration and environment lighting

### Physics
- Collision shapes, physics bodies (dynamic, static, kinematic)
- Collision groups, filters, and events
- Applying forces and velocities

### Anti-Patterns
- UIKit-style thinking in ECS (subclassing entities)
- Monolithic entities, frame-based updates without Systems
- Missing collision shapes on interactive entities
- Storing entity references across frames in Systems

## Related

- [RealityKit API Reference](/reference/realitykit-ref) — Complete API tables for entities, components, systems, materials, animation, audio
- [RealityKit Diagnostics](/diagnostic/realitykit-diag) — Decision trees for invisible entities, anchor tracking, gesture failures, performance drops
- [SceneKit](/skills/games/scenekit) — Legacy 3D framework with migration guidance to RealityKit
- [SceneKit API Reference](/reference/scenekit-ref) — SceneKit API with RealityKit migration mapping
