---
name: realitykit-ref
description: RealityKit API reference — Entity, Component, System, RealityView, Model3D, materials, physics, animation, audio
---

# RealityKit API Reference

Complete API reference for RealityKit organized by category. Covers the Entity hierarchy, all built-in components, the System protocol, SwiftUI views (RealityView, Model3D), the material system, physics, animation, audio, and RealityRenderer for Metal integration.

## When to Use This Reference

Use this reference when:
- Looking up specific RealityKit API signatures or properties
- Checking which component types are available
- Finding the right anchor type for an AR experience
- Browsing material properties and options
- Setting up physics body parameters
- Looking up animation or audio API details
- Checking platform availability for specific APIs

## Example Prompts

- "What properties does PhysicallyBasedMaterial have?"
- "How do I create a RealityView with attachments?"
- "What are the ShapeResource types for collision?"
- "What events can I subscribe to in RealityKit?"
- "How do I set up spatial audio on an entity?"
- "What Entity subclasses are available?"

## What's Covered

- **Entity API** -- Creation, properties (isEnabled, isAnchored, scene), hierarchy methods, 10 Entity subclasses (ModelEntity, AnchorEntity, PerspectiveCamera, lights, TriggerVolume)
- **Component catalog** -- 20+ built-in components including Transform, ModelComponent, CollisionComponent, PhysicsBodyComponent, AnchoringComponent, InputTargetComponent, AccessibilityComponent
- **MeshResource generators** -- Box, sphere, plane, cylinder, cone, text
- **System protocol** -- SceneUpdateContext, EntityQuery (has/and/not), 8 scene event types (Update, DidAddEntity, CollisionEvents)
- **RealityView API** -- Initializers (basic, update, placeholder, attachments), RealityViewContent, gesture integration (tap, drag, rotate, magnify)
- **Model3D API** -- Simple display, phase handling, URL loading
- **Material system** -- SimpleMaterial, PhysicallyBasedMaterial (full PBR), UnlitMaterial, OcclusionMaterial, VideoMaterial, TextureResource loading
- **Animation** -- Transform animation with timing functions, USD animation playback, AnimationPlaybackController
- **Audio** -- AudioFileResource, SpatialAudioComponent, AmbientAudioComponent, ChannelAudioComponent, playback control
- **RealityRenderer** -- Low-level Metal integration for rendering RealityKit content to Metal textures

## Documentation Scope

This page documents the `axiom-realitykit-ref` skill. For architecture patterns, ECS guidance, and best practices, use the discipline skill. For troubleshooting, use the diagnostic skill.

- For ECS architecture and patterns, see [RealityKit](/skills/games/realitykit)
- For troubleshooting, see [RealityKit Diagnostics](/diagnostic/realitykit-diag)
- For SceneKit migration mapping, see [SceneKit API Reference](/reference/scenekit-ref)

## Related

- [RealityKit](/skills/games/realitykit) -- ECS architecture patterns and best practices
- [RealityKit Diagnostics](/diagnostic/realitykit-diag) -- Troubleshooting invisible entities, physics, and rendering
- [SceneKit API Reference](/reference/scenekit-ref) -- SceneKit equivalents for migration reference
- [SpriteKit API Reference](/reference/spritekit-ref) -- 2D game framework (complements RealityKit's 3D)

## Resources

**WWDC**: 2019-605, 2023-10080, 2023-10081

**Docs**: /realitykit, /realitykit/entity, /realitykit/realityview
