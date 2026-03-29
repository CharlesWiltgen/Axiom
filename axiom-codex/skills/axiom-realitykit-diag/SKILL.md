---
name: axiom-realitykit-diag
description: Use when RealityKit entities not visible, anchors not tracking, gestures not responding, performance drops, materials wrong, or multiplayer sync fails
license: MIT
metadata:
  version: "1.0.0"
---

# RealityKit Diagnostics

Systematic diagnosis for common RealityKit issues with time-cost annotations.

## When to Use This Diagnostic Skill

Use this skill when:
- Entity added but not visible in the scene
- AR anchor not tracking or content floating
- Tap/drag gestures not responding on 3D entities
- Frame rate dropping or stuttering
- Material looks wrong (too dark, too bright, incorrect colors)
- Multiplayer entities not syncing across devices
- Physics bodies not colliding or passing through each other

For RealityKit architecture patterns and best practices, see `axiom-realitykit`. For API reference, see `axiom-realitykit-ref`.

---

## Mandatory First Step: Enable Debug Visualization

**Time cost**: 10 seconds vs hours of blind debugging

```swift
// In your RealityView or ARView setup
#if DEBUG
// Xcode: Debug → Attach to Process → Show RealityKit Statistics
// Or enable in code:
arView.debugOptions = [
    .showStatistics,       // Entity count, draw calls, FPS
    .showPhysics,          // Collision shapes
    .showAnchorOrigins,    // Anchor positions
    .showAnchorGeometry    // Detected plane geometry
]
#endif
```

If you can't see collision shapes with `.showPhysics`, your `CollisionComponent` is missing or misconfigured. **Fix collision before debugging gestures or physics.**

---

## Symptom 1: Entity Not Visible

**Time saved**: 30-60 min → 2-5 min

```
Entity added but nothing appears
│
├─ Is the entity added to the scene?
│   └─ NO → Add to RealityView content:
│        content.add(entity)
│        ✓ Entities must be in the scene graph to render
│
├─ Does the entity have a ModelComponent?
│   └─ NO → Add mesh and material:
│        entity.components[ModelComponent.self] = ModelComponent(
│            mesh: .generateBox(size: 0.1),
│            materials: [SimpleMaterial(color: .red, isMetallic: false)]
│        )
│        ✓ Bare Entity is invisible — it's just a container
│
├─ Is the entity's scale zero or nearly zero?
│   └─ CHECK → Print: entity.scale
│        USD models may import with unexpected scale.
│        Try: entity.scale = SIMD3(repeating: 0.01) for meter-scale models
│
├─ Is the entity behind the camera?
│   └─ CHECK → Print: entity.position(relativeTo: nil)
│        In RealityKit, -Z is forward (toward screen).
│        Try: entity.position = SIMD3(0, 0, -0.5) (half meter in front)
│
├─ Is the entity inside another object?
│   └─ CHECK → Move to a known visible position:
│        entity.position = SIMD3(0, 0, -1)
│
├─ Is the entity's isEnabled set to false?
│   └─ CHECK → entity.isEnabled = true
│        Also check parent: entity.isEnabledInHierarchy
│
├─ Is the entity on an untracked anchor?
│   └─ CHECK → Verify anchor is tracking:
│        entity.isAnchored (should be true)
│        If using plane anchor, ensure surface is detected first
│
└─ Is the material transparent or OcclusionMaterial?
    └─ CHECK → Inspect material:
         If using PhysicallyBasedMaterial, check baseColor is not black
         If using blending = .transparent, check opacity > 0
```

### Quick Diagnostic

```swift
func diagnoseVisibility(_ entity: Entity) {
    print("Name: \(entity.name)")
    print("Is enabled: \(entity.isEnabled)")
    print("In hierarchy: \(entity.isEnabledInHierarchy)")
    print("Is anchored: \(entity.isAnchored)")
    print("Position (world): \(entity.position(relativeTo: nil))")
    print("Scale: \(entity.scale)")
    print("Has model: \(entity.components[ModelComponent.self] != nil)")
    print("Children: \(entity.children.count)")
}
```

---

## Symptom 2: Anchor Not Tracking

**Time saved**: 20-45 min → 3-5 min

```
AR content not appearing or floating
│
├─ Is the AR session running?
│   └─ For RealityView on iOS 18+, AR runs automatically
│       For ARView, check: arView.session.isRunning
│
├─ Is SpatialTrackingSession configured? (iOS 18+)
│   └─ CHECK → Ensure tracking modes requested:
│        let config = SpatialTrackingSession.Configuration(
│            tracking: [.plane, .object])
│        let result = await session.run(config)
│        if let notSupported = result {
│            // Handle unsupported modes
│        }
│
├─ Is the anchor type appropriate for the environment?
│   ├─ .plane(.horizontal) → Need a flat surface visible to camera
│   ├─ .plane(.vertical) → Need a wall visible to camera
│   ├─ .image → Image must be in "AR Resources" asset catalog
│   ├─ .face → Front camera required (not rear)
│   └─ .body → Full body must be visible
│
├─ Is minimumBounds too large?
│   └─ CHECK → Reduce minimum bounds:
│        AnchorEntity(.plane(.horizontal, classification: .any,
│            minimumBounds: SIMD2(0.1, 0.1)))  // Smaller = detects sooner
│
├─ Is the device supported?
│   └─ CHECK → Plane detection requires A12+ chip
│       Face tracking requires TrueDepth camera
│       Body tracking requires A12+ chip
│
└─ Is the environment adequate?
    └─ CHECK → AR needs:
         - Adequate lighting (not too dark)
         - Textured surfaces (not blank walls)
         - Stable device position during initial detection
```

---

## Symptom 3: Gesture Not Responding

**Time saved**: 15-30 min → 2-3 min

```
Tap/drag on entity does nothing
│
├─ Does the entity have a CollisionComponent?
│   └─ NO → Add collision shapes:
│        entity.generateCollisionShapes(recursive: true)
│        // or manual:
│        entity.components[CollisionComponent.self] = CollisionComponent(
│            shapes: [.generateBox(size: SIMD3(0.1, 0.1, 0.1))])
│        ✓ Collision shapes are REQUIRED for gesture hit testing
│
├─ [visionOS] Does the entity have InputTargetComponent?
│   └─ NO → Add it:
│        entity.components[InputTargetComponent.self] = InputTargetComponent()
│        ✓ Required on visionOS for gesture input
│
├─ Is the gesture attached to the RealityView?
│   └─ CHECK → Gesture must be on the view, not the entity:
│        RealityView { content in ... }
│            .gesture(TapGesture().targetedToAnyEntity().onEnded { ... })
│
├─ Is the collision shape large enough to hit?
│   └─ CHECK → Enable .showPhysics to see shapes
│        Shapes too small = hard to tap.
│        Try: .generateBox(size: SIMD3(repeating: 0.1)) minimum
│
├─ Is the entity behind another entity?
│   └─ CHECK → Front entities may block gestures on back entities
│        Ensure collision is on the intended target
│
└─ Is the entity enabled?
    └─ CHECK → entity.isEnabled must be true
         Disabled entities don't receive input
```

### Quick Diagnostic

```swift
func diagnoseGesture(_ entity: Entity) {
    print("Has collision: \(entity.components[CollisionComponent.self] != nil)")
    print("Has input target: \(entity.components[InputTargetComponent.self] != nil)")
    print("Is enabled: \(entity.isEnabled)")
    print("Is anchored: \(entity.isAnchored)")

    if let collision = entity.components[CollisionComponent.self] {
        print("Collision shapes: \(collision.shapes.count)")
    }
}
```

---

## Symptom 4: Performance Problems

**Time saved**: 1-3 hours → 10-20 min

```
Frame rate dropping or stuttering
│
├─ How many entities are in the scene?
│   └─ CHECK → Print entity count:
│        var count = 0
│        func countEntities(_ entity: Entity) {
│            count += 1
│            for child in entity.children { countEntities(child) }
│        }
│        Under 100: unlikely to be entity count
│        100-500: review for optimization
│        500+: definitely needs optimization
│
├─ Are mesh/material resources shared?
│   └─ NO → Share resources across identical entities:
│        let sharedMesh = MeshResource.generateBox(size: 0.05)
│        let sharedMaterial = SimpleMaterial(color: .white, isMetallic: false)
│        // Reuse for all instances
│        ✓ RealityKit batches entities with identical resources
│
├─ Is a System creating components every frame?
│   └─ CHECK → Look for allocations in update():
│        Creating ModelComponent, CollisionComponent, or materials
│        every frame causes GC pressure.
│        Cache resources, only update when values change.
│
├─ Are collision shapes mesh-based?
│   └─ CHECK → Replace generateCollisionShapes(recursive: true)
│        with simple shapes (box, sphere, capsule) for dynamic entities
│
├─ Is generateCollisionShapes called repeatedly?
│   └─ CHECK → Call once during setup, not every frame
│
├─ Are there too many physics bodies?
│   └─ CHECK → Dynamic bodies are most expensive.
│        Convert distant/static objects to .static mode.
│        Remove physics from non-interactive entities.
│
└─ Is the model polygon count too high?
    └─ CHECK → Decimate models for real-time use.
         Target: <100K triangles total for mobile AR.
         Use LOD (Level of Detail) for distant objects.
```

---

## Symptom 5: Material Looks Wrong

**Time saved**: 15-45 min → 5-10 min

```
Colors, lighting, or textures look incorrect
│
├─ Is the scene too dark?
│   └─ CHECK → Missing environment lighting:
│        Add DirectionalLightComponent or EnvironmentResource
│        In AR, RealityKit uses real-world lighting automatically
│        In non-AR, you must provide lighting explicitly
│
├─ Is the baseColor set?
│   └─ CHECK → PhysicallyBasedMaterial defaults to white
│        material.baseColor = .init(tint: .red)
│        If using a texture, verify it loaded:
│        try TextureResource(named: "albedo")
│
├─ Is metallic set incorrectly?
│   └─ CHECK → metallic = 1.0 makes surfaces mirror-like
│        Most real objects: metallic = 0.0
│        Only metals (gold, silver, chrome): metallic = 1.0
│
├─ Is the texture semantic wrong?
│   └─ CHECK → Use correct semantic:
│        .color for albedo/baseColor textures
│        .raw for data textures (metallic, roughness)
│        .normal for normal maps
│        .hdrColor for HDR textures
│
├─ Is the model upside down or inside out?
│   └─ CHECK → Try:
│        material.faceCulling = .none (shows both sides)
│        If that fixes it, the model normals are flipped
│
└─ Is blending/transparency unexpected?
    └─ CHECK → material.blending
         Default is .opaque
         For transparency: .transparent(opacity: ...)
```

---

## Symptom 6: Physics Not Working

**Time saved**: 20-40 min → 5-10 min

```
Objects pass through each other or don't collide
│
├─ Do both entities have CollisionComponent?
│   └─ NO → Both sides of a collision need CollisionComponent
│
├─ Does the moving entity have PhysicsBodyComponent?
│   └─ NO → Add physics body:
│        entity.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
│            mode: .dynamic)
│
├─ Are collision groups/filters configured correctly?
│   └─ CHECK → Entities must be in compatible groups:
│        Default: group = .default, mask = .all
│        If using custom groups, verify mask includes the other group
│
├─ Is the physics mode correct?
│   ├─ Two .static bodies → Never collide (both immovable)
│   ├─ .dynamic + .static → Correct (common setup)
│   ├─ .dynamic + .dynamic → Both move on collision
│   └─ .kinematic + .dynamic → Kinematic pushes dynamic
│
├─ Is the collision shape appropriate?
│   └─ CHECK → .showPhysics debug option
│        Shape may be too small, offset, or wrong type
│
└─ Are entities on different anchors?
    └─ CHECK → "Physics bodies and colliders affect only
         entities that share the same anchor" (Apple docs)
         Move entities under the same anchor for physics interaction
```

---

## Symptom 7: Multiplayer Sync Issues

**Time saved**: 30-60 min → 10-15 min

```
Entities not appearing on other devices
│
├─ Does the entity have SynchronizationComponent?
│   └─ NO → Add it:
│        entity.components[SynchronizationComponent.self] =
│            SynchronizationComponent()
│
├─ Is the MultipeerConnectivityService set up?
│   └─ CHECK → Verify MCSession is connected before syncing
│
├─ Are custom components Codable?
│   └─ NO → Non-Codable components don't sync
│        struct MyComponent: Component, Codable { ... }
│
├─ Does the entity have an owner?
│   └─ CHECK → Only the owner can modify synced properties
│        Request ownership before modifying:
│        entity.requestOwnership { result in ... }
│
└─ Is the entity anchored?
    └─ CHECK → Unanchored entities may not sync position correctly
         Use a shared world anchor for reliable positioning
```

---

## Common Mistakes

| Mistake | Time Cost | Fix |
|---------|-----------|-----|
| No CollisionComponent on interactive entity | 15-30 min | `entity.generateCollisionShapes(recursive: true)` |
| Missing InputTargetComponent on visionOS | 10-20 min | Add `InputTargetComponent()` |
| Gesture on wrong view (not RealityView) | 10-15 min | Attach `.gesture()` to `RealityView` |
| Entity scale wrong for USD model | 15-30 min | Check units: meters vs centimeters |
| No lighting in non-AR scene | 10-20 min | Add `DirectionalLightComponent` |
| Storing entity refs in System | 30-60 min crash debugging | Query with `EntityQuery` each frame |
| Components not registered | 10-15 min | Call `registerComponent()` in app init |
| Systems not registered | 10-15 min | Call `registerSystem()` before scene load |
| Physics across different anchors | 20-40 min | Put interacting entities under same anchor |
| Calling generateCollisionShapes every frame | Performance degradation | Call once during setup |

---

## Diagnostic Quick Reference

| Symptom | First Check | Time Saved |
|---------|-------------|------------|
| Not visible | Has ModelComponent? Scale > 0? | 30-60 min |
| No gesture response | Has CollisionComponent? | 15-30 min |
| Not tracking | Anchor type matches environment? | 20-45 min |
| Frame drops | Entity count? Resource sharing? | 1-3 hours |
| Wrong colors | Has lighting? Metallic value? | 15-45 min |
| No collision | Both have CollisionComponent? Same anchor? | 20-40 min |
| No sync | SynchronizationComponent? Codable? | 30-60 min |
| Sim OK, device crash | Metal features? Texture format? | 15-30 min |

---

## Symptom 8: Works in Simulator, Crashes on Device

**Time cost**: 15-30 min (often misdiagnosed as model issue)

```
Q1: Is the crash a Metal error (MTLCommandBuffer, shader compilation)?
├─ YES → Simulator uses software rendering, device uses real GPU
│   Common causes:
│   - Custom Metal shaders with unsupported features
│   - Texture formats not supported on device GPU
│   - Exceeding device texture size limits (max 8192x8192 on older)
│   Fix: Check device GPU family, use supported formats
│
└─ NO → Check next

Q2: Is it an out-of-memory crash?
├─ YES → Simulator has more RAM available
│   Common: Large USDZ files with uncompressed textures
│   Fix: Compress textures, reduce polygon count, use LOD
│   Check: USDZ file size (keep < 50MB for reliable loading)
│
└─ NO → Check next

Q3: Is it an AR-related crash (camera, tracking)?
├─ YES → Simulator has no real camera/sensors
│   Fix: Test AR features on device only, use simulator for UI/layout
│
└─ NO → Check device capabilities
    - A12+ required for RealityKit
    - LiDAR for scene reconstruction
    - TrueDepth for face tracking
```

---

## Resources

**WWDC**: 2019-603, 2019-605, 2023-10080, 2024-10103

**Docs**: /realitykit, /realitykit/entity, /realitykit/collisioncomponent, /realitykit/physicsbodycomponent

**Skills**: axiom-realitykit, axiom-realitykit-ref
