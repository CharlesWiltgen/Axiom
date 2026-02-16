---
name: scenekit-ref
description: SceneKit API reference and RealityKit migration mapping — scene graph, materials, lighting, camera, physics, animation, constraints
---

# SceneKit API Reference and Migration Mapping

Complete API reference for SceneKit with RealityKit equivalents for every major concept. Use this reference both for maintaining SceneKit code and for planning migrations to RealityKit.

## When to Use This Reference

Use this reference when:
- Looking up SceneKit to RealityKit API equivalents during migration
- Checking specific SceneKit class properties or methods
- Planning which SceneKit features have direct RealityKit counterparts
- Understanding architectural differences between scene graph and ECS

## Example Prompts

- "What's the RealityKit equivalent of SCNPhysicsBody?"
- "How do I convert SCNAction sequences to RealityKit animations?"
- "What maps to SCNLight types in RealityKit?"
- "How do SCNConstraints translate to RealityKit?"
- "What SCNMaterial properties map to PhysicallyBasedMaterial?"
- "What's the RealityKit replacement for SCNSceneRendererDelegate?"

## What's Covered

- **Core architecture mapping** -- SCNScene/SCNNode/SCNView to Entity/RealityViewContent/RealityView, file format conversion (.scn to .usdz)
- **Geometry and rendering mapping** -- SCNGeometry to MeshResource, SCNMaterial to PhysicallyBasedMaterial, shader modifiers to ShaderGraphMaterial/CustomMaterial
- **Transform and hierarchy mapping** -- Position, rotation, scale, parent-child methods with API equivalents
- **Lighting mapping** -- All 7 SCNLight types to RealityKit light components, with notes on missing equivalents (area, IES)
- **Camera mapping** -- SCNCamera to PerspectiveCamera, field of view, clipping planes
- **Physics mapping** -- SCNPhysicsBody to PhysicsBodyComponent, collision categories to CollisionGroup, contact delegate to event subscriptions
- **Animation mapping** -- SCNAction to entity.move(), SCNTransaction (no direct equivalent), CAAnimation to entity.playAnimation()
- **Scene graph API** -- SCNScene properties, SCNNode creation and configuration, hierarchy methods
- **Materials API** -- All lighting models (PBR, Blinn, Phong, Lambert, constant, shadowOnly), material properties
- **Physics API** -- Body properties, compound and concave shapes, all 4 joint types (hinge, ball socket, slider, cone twist)
- **Animation API** -- Full SCNAction catalog, timing functions, SCNAnimationPlayer
- **Constraints** -- All 7 constraint types (lookAt, billboard, distance, replicator, acceleration, slider, IK)
- **Scene configuration** -- SCNView properties (antialiasing, frame rate, camera control, debug options)

## Documentation Scope

This page documents the `axiom-scenekit-ref` skill. For SceneKit development patterns, deprecation context, and migration planning, use the discipline skill.

- For SceneKit patterns and migration planning, see [SceneKit](/skills/games/scenekit)
- For RealityKit development, see [RealityKit](/skills/games/realitykit)
- For RealityKit API details, see [RealityKit API Reference](/reference/realitykit-ref)

## Related

- [SceneKit](/skills/games/scenekit) -- SceneKit patterns, deprecation context, and migration decision tree
- [RealityKit](/skills/games/realitykit) -- ECS architecture for the modern replacement
- [RealityKit API Reference](/reference/realitykit-ref) -- API details for migration targets

## Resources

**Docs**: /scenekit, /scenekit/scnscene, /scenekit/scnnode
