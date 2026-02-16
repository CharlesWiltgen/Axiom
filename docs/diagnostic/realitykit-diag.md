---
name: realitykit-diag
description: RealityKit diagnostics — invisible entities, anchor tracking, gesture failures, performance, materials, physics, multiplayer sync
---

# RealityKit Diagnostics

Systematic RealityKit troubleshooting with decision trees and time-cost annotations. Covers the 7 most common RealityKit symptoms that waste developer time.

## Symptoms This Diagnoses

Use when you're experiencing:
- Entity added but not visible in the scene
- AR anchor not tracking or content floating
- Tap/drag gestures not responding on 3D entities
- Frame rate dropping or stuttering
- Material looks wrong (too dark, too bright, incorrect colors)
- Physics bodies not colliding or passing through each other
- Multiplayer entities not syncing across devices

## Example Prompts

- "I added an entity but nothing appears in my RealityView"
- "AR content isn't showing up on the table surface"
- "Tap gestures don't fire on my 3D entities"
- "RealityKit frame rate is dropping below 60fps"
- "My 3D model looks too dark, like there's no lighting"
- "Physics objects pass through each other"
- "Multiplayer entities don't appear on the other device"

## Diagnostic Workflow

**Mandatory first step**: Enable debug visualization (`.showStatistics`, `.showPhysics`, `.showAnchorOrigins`, `.showAnchorGeometry`). If you cannot see collision shapes with `.showPhysics`, your CollisionComponent is missing or misconfigured. Fix collision before debugging gestures or physics.

### Decision Trees

| Symptom | Key Checks | Time Saved |
|---------|-----------|------------|
| Entity not visible | ModelComponent? Scale > 0? Behind camera? isEnabled? | 30-60 min to 2-5 min |
| Anchor not tracking | Session running? Anchor type? minimumBounds? Device support? | 20-45 min to 3-5 min |
| Gesture not responding | CollisionComponent? InputTargetComponent (visionOS)? Gesture on RealityView? | 15-30 min to 2-3 min |
| Performance problems | Entity count? Shared resources? Component churn? Mesh-based collision? | 1-3 hrs to 10-20 min |
| Material looks wrong | Lighting? baseColor? Metallic value? Texture semantic? Face culling? | 15-45 min to 5-10 min |
| Physics not working | Both have CollisionComponent? Same anchor? Collision groups? | 20-40 min to 5-10 min |
| Multiplayer sync | SynchronizationComponent? Codable? Ownership? Anchored? | 30-60 min to 10-15 min |

### Common Mistakes Quick Reference

| Mistake | Time Cost | Fix |
|---------|-----------|-----|
| No CollisionComponent on interactive entity | 15-30 min | `entity.generateCollisionShapes(recursive: true)` |
| Missing InputTargetComponent on visionOS | 10-20 min | Add `InputTargetComponent()` |
| Gesture on wrong view (not RealityView) | 10-15 min | Attach `.gesture()` to `RealityView` |
| No lighting in non-AR scene | 10-20 min | Add `DirectionalLightComponent` |
| Components/Systems not registered | 10-15 min | Call `registerComponent()` / `registerSystem()` at launch |
| Physics across different anchors | 20-40 min | Put interacting entities under same anchor |

## Related

- [RealityKit](/skills/games/realitykit) — ECS architecture, SwiftUI integration, physics, materials, anti-patterns
- [RealityKit API Reference](/reference/realitykit-ref) — Complete API tables for all RealityKit classes and components
