---
name: axiom-scenekit-ref
description: SceneKit → RealityKit concept mapping, complete API cross-reference for migration, scene graph API, materials, lighting, camera, physics, animation, constraints
license: MIT
compatibility: [iOS 8+, macOS 10.8+, tvOS 9+]
metadata:
  version: "1.0.0"
---

# SceneKit API Reference & Migration Mapping

Complete API reference for SceneKit with RealityKit equivalents for every major concept.

## When to Use This Reference

Use this reference when:
- Looking up SceneKit → RealityKit API equivalents during migration
- Checking specific SceneKit class properties or methods
- Planning which SceneKit features have direct RealityKit counterparts
- Understanding architectural differences between scene graph and ECS

---

## Part 1: SceneKit → RealityKit Concept Mapping

### Core Architecture

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNScene` | `RealityViewContent` / `Entity` (root) | RealityKit scenes are entity hierarchies |
| `SCNNode` | `Entity` | Lightweight container in both |
| `SCNView` | `RealityView` (SwiftUI) | `ARView` for UIKit on iOS |
| `SceneView` (SwiftUI) | `RealityView` | SceneView deprecated iOS 26 |
| `SCNRenderer` | `RealityRenderer` | Low-level Metal rendering |
| Node properties | Components | ECS separates data from hierarchy |
| `SCNSceneRendererDelegate` | `System` / `SceneEvents.Update` | Frame-level updates |
| `.scn` files | `.usdz` / `.usda` files | Convert with `xcrun scntool` |

### Geometry & Rendering

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNGeometry` | `MeshResource` | RealityKit generates from code or loads USD |
| `SCNBox`, `SCNSphere`, etc. | `MeshResource.generateBox()`, `.generateSphere()` | Similar built-in shapes |
| `SCNMaterial` | `SimpleMaterial`, `PhysicallyBasedMaterial` | PBR-first in RealityKit |
| `SCNMaterial.lightingModel = .physicallyBased` | `PhysicallyBasedMaterial` | Default in RealityKit |
| `SCNMaterial.diffuse` | `PhysicallyBasedMaterial.baseColor` | Different property name |
| `SCNMaterial.metalness` | `PhysicallyBasedMaterial.metallic` | Different property name |
| `SCNMaterial.roughness` | `PhysicallyBasedMaterial.roughness` | Same concept |
| `SCNMaterial.normal` | `PhysicallyBasedMaterial.normal` | Same concept |
| Shader modifiers | `ShaderGraphMaterial` / `CustomMaterial` | No direct port — must rewrite |
| `SCNProgram` (custom shaders) | `CustomMaterial` with Metal functions | Different API surface |
| `SCNGeometrySource` | `MeshResource.Contents` | Low-level mesh data |

### Transforms & Hierarchy

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `node.position` | `entity.position` | Both SCNVector3 / SIMD3<Float> |
| `node.eulerAngles` | `entity.orientation` (quaternion) | RealityKit prefers quaternions |
| `node.scale` | `entity.scale` | Both SIMD3<Float> |
| `node.transform` | `entity.transform` | 4×4 matrix |
| `node.worldTransform` | `entity.transform(relativeTo: nil)` | World-space transform |
| `node.addChildNode(_:)` | `entity.addChild(_:)` | Same hierarchy concept |
| `node.removeFromParentNode()` | `entity.removeFromParent()` | Same concept |
| `node.childNodes` | `entity.children` | Children collection |
| `node.parent` | `entity.parent` | Parent reference |
| `node.childNode(withName:recursively:)` | `entity.findEntity(named:)` | Named lookup |

### Lighting

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNLight` (`.omni`) | `PointLightComponent` | Point light |
| `SCNLight` (`.directional`) | `DirectionalLightComponent` | Sun/directional light |
| `SCNLight` (`.spot`) | `SpotLightComponent` | Cone light |
| `SCNLight` (`.area`) | No direct equivalent | Use multiple point lights |
| `SCNLight` (`.ambient`) | `EnvironmentResource` (IBL) | Image-based lighting preferred |
| `SCNLight` (`.probe`) | `EnvironmentResource` | Environment probes |
| `SCNLight` (`.IES`) | No direct equivalent | Use light intensity profiles |

### Camera

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNCamera` | `PerspectiveCamera` entity | Entity with camera component |
| `camera.fieldOfView` | `PerspectiveCameraComponent.fieldOfViewInDegrees` | Same concept |
| `camera.zNear` / `camera.zFar` | `PerspectiveCameraComponent.near` / `.far` | Clipping planes |
| `camera.wantsDepthOfField` | Post-processing effects | Different mechanism |
| `camera.motionBlurIntensity` | Post-processing effects | Different mechanism |
| `allowsCameraControl` | Custom gesture handling | No built-in orbit camera |

### Physics

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNPhysicsBody` | `PhysicsBodyComponent` | Component-based |
| `.dynamic` | `.dynamic` | Same mode |
| `.static` | `.static` | Same mode |
| `.kinematic` | `.kinematic` | Same mode |
| `SCNPhysicsShape` | `CollisionComponent` / `ShapeResource` | Separate from body in RealityKit |
| `categoryBitMask` | `CollisionGroup` | Named groups vs raw bitmasks |
| `collisionBitMask` | `CollisionFilter` | Filter-based |
| `contactTestBitMask` | `CollisionEvents.Began` subscription | Event-based contacts |
| `SCNPhysicsContactDelegate` | `scene.subscribe(to: CollisionEvents.Began.self)` | Combine-style events |
| `SCNPhysicsField` | `PhysicsBodyComponent` forces | Apply forces directly |
| `SCNPhysicsJoint` | `PhysicsJoint` | Similar joint types |

### Animation

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `SCNAction` | `entity.move(to:relativeTo:duration:)` | Transform animation |
| `SCNAction.sequence` | Animation chaining | Less declarative in RealityKit |
| `SCNAction.group` | Parallel animations | Apply to different entities |
| `SCNAction.repeatForever` | `AnimationPlaybackController` repeat | Different API |
| `SCNTransaction` (implicit) | No direct equivalent | Explicit animations only |
| `CAAnimation` bridge | `entity.playAnimation()` | Load from USD |
| `SCNAnimationPlayer` | `AnimationPlaybackController` | Playback control |
| Morph targets | Blend shapes in USD | Load via USD files |

### Interaction

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `hitTest(_:options:)` | `RealityViewContent.entities(at:)` | Different API |
| Gesture recognizers on SCNView | `ManipulationComponent` | Built-in drag/rotate/scale |
| `allowsCameraControl` | Custom implementation | No built-in orbit |

### AR Integration

| SceneKit | RealityKit | Notes |
|----------|-----------|-------|
| `ARSCNView` | `RealityView` + `AnchorEntity` | Legacy → modern |
| `ARSCNViewDelegate` | `AnchorEntity` auto-tracking | Event-driven |
| `renderer(_:didAdd:for:)` | `AnchorEntity(.plane)` | Declarative anchoring |
| `ARWorldTrackingConfiguration` | `SpatialTrackingSession` | iOS 18+ |

---

## Part 2: Scene Graph API

### SCNScene

```swift
// Loading
let scene = SCNScene(named: "scene.usdz")!
let scene = try SCNScene(url: url, options: [
    .checkConsistency: true,
    .convertToYUp: true
])

// Properties
scene.rootNode                    // Root of node hierarchy
scene.background.contents        // Skybox (UIImage, UIColor, MDLSkyCubeTexture)
scene.lightingEnvironment.contents // IBL environment map
scene.fogStartDistance            // Fog near
scene.fogEndDistance              // Fog far
scene.fogColor                   // Fog color
scene.isPaused                   // Pause simulation
```

### SCNNode

```swift
// Creation
let node = SCNNode()
let node = SCNNode(geometry: SCNBox(width: 1, height: 1, length: 1, chamferRadius: 0))

// Transform
node.position = SCNVector3(x, y, z)
node.eulerAngles = SCNVector3(pitch, yaw, roll)
node.scale = SCNVector3(1, 1, 1)
node.simdPosition = SIMD3<Float>(x, y, z)  // SIMD variants available
node.pivot = SCNMatrix4MakeTranslation(0, -0.5, 0) // Offset pivot point

// Visibility
node.isHidden = false
node.opacity = 1.0
node.castsShadow = true
node.renderingOrder = 0   // Lower = rendered first

// Hierarchy
node.addChildNode(child)
node.removeFromParentNode()
node.childNodes
node.childNode(withName: "name", recursively: true)
node.enumerateChildNodes { child, stop in }
```

---

## Part 3: Materials

### Lighting Models

| Model | Description | Use Case |
|-------|-------------|----------|
| `.physicallyBased` | PBR metallic-roughness | Realistic rendering (recommended) |
| `.blinn` | Blinn-Phong specular | Simple shiny surfaces |
| `.phong` | Phong specular | Classic specular highlight |
| `.lambert` | Diffuse only, no specular | Matte surfaces |
| `.constant` | Unlit, flat color | UI elements, debug visualization |
| `.shadowOnly` | Invisible, receives shadows | AR ground plane |

### Material Properties

```swift
let mat = SCNMaterial()
mat.lightingModel = .physicallyBased

// Textures or scalar values
mat.diffuse.contents = UIImage(named: "albedo")    // Base color
mat.metalness.contents = 0.0                        // 0 = dielectric, 1 = metal
mat.roughness.contents = 0.5                        // 0 = mirror, 1 = rough
mat.normal.contents = UIImage(named: "normal")      // Normal map
mat.ambientOcclusion.contents = UIImage(named: "ao") // AO map
mat.emission.contents = UIColor.blue                // Glow
mat.displacement.contents = UIImage(named: "height") // Height map

// Options
mat.isDoubleSided = false        // Render both sides
mat.writesToDepthBuffer = true
mat.readsFromDepthBuffer = true
mat.blendMode = .alpha           // .add, .subtract, .multiply, .screen
mat.transparencyMode = .aOne     // .rgbZero for pre-multiplied alpha
```

---

## Part 4: Physics

### Body Types and Properties

```swift
// Dynamic body with custom shape
let shape = SCNPhysicsShape(geometry: SCNSphere(radius: 0.5), options: nil)
let body = SCNPhysicsBody(type: .dynamic, shape: shape)
body.mass = 1.0
body.friction = 0.5
body.restitution = 0.3       // Bounciness
body.damping = 0.1            // Linear damping
body.angularDamping = 0.1     // Angular damping
body.isAffectedByGravity = true
body.allowsResting = true     // Sleep optimization
node.physicsBody = body

// Compound shapes
let compound = SCNPhysicsShape(shapes: [shape1, shape2],
    transforms: [transform1, transform2])

// Concave (static only)
let concave = SCNPhysicsShape(geometry: mesh, options: [
    .type: SCNPhysicsShape.ShapeType.concavePolyhedron
])
```

### Joint Types

| Joint | Description |
|-------|-------------|
| `SCNPhysicsHingeJoint` | Single-axis rotation (door) |
| `SCNPhysicsBallSocketJoint` | Free rotation around point (pendulum) |
| `SCNPhysicsSliderJoint` | Linear movement along axis (drawer) |
| `SCNPhysicsConeTwistJoint` | Limited rotation (ragdoll limb) |

---

## Part 5: Animation API

### SCNAction Catalog

| Category | Actions |
|----------|---------|
| Movement | `move(by:duration:)`, `move(to:duration:)` |
| Rotation | `rotate(by:around:duration:)`, `rotateTo(x:y:z:duration:)` |
| Scale | `scale(by:duration:)`, `scale(to:duration:)` |
| Fade | `fadeIn(duration:)`, `fadeOut(duration:)`, `fadeOpacity(to:duration:)` |
| Visibility | `hide()`, `unhide()` |
| Audio | `playAudio(source:waitForCompletion:)` |
| Custom | `run { node in }`, `customAction(duration:action:)` |
| Composition | `sequence([])`, `group([])`, `repeat(_:count:)`, `repeatForever(_:)` |
| Control | `wait(duration:)`, `removeFromParentNode()` |

### Timing Functions

```swift
action.timingMode = .linear        // Default
action.timingMode = .easeIn        // Slow start
action.timingMode = .easeOut       // Slow end
action.timingMode = .easeInEaseOut // Slow start and end
action.timingFunction = { t in     // Custom curve
    return t * t  // Quadratic ease-in
}
```

---

## Part 6: Constraints

| Constraint | Purpose |
|------------|---------|
| `SCNLookAtConstraint` | Node always faces target |
| `SCNBillboardConstraint` | Node always faces camera |
| `SCNDistanceConstraint` | Maintains min/max distance |
| `SCNReplicatorConstraint` | Copies transform of target |
| `SCNAccelerationConstraint` | Smooths transform changes |
| `SCNSliderConstraint` | Locks to axis |
| `SCNIKConstraint` | Inverse kinematics chain |

```swift
let lookAt = SCNLookAtConstraint(target: targetNode)
lookAt.isGimbalLockEnabled = true  // Prevent roll
lookAt.influenceFactor = 0.8       // Partial constraint
node.constraints = [lookAt]
```

**In RealityKit**: No direct constraint system. Implement with `System` update logic or `entity.look(at:from:relativeTo:)`.

---

## Part 7: Scene Configuration

### SCNView Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `antialiasingMode` | `.multisampling4X` | MSAA level |
| `preferredFramesPerSecond` | 60 | Target frame rate |
| `allowsCameraControl` | `false` | Built-in orbit/pan/zoom |
| `autoenablesDefaultLighting` | `false` | Add default light if none |
| `showsStatistics` | `false` | FPS/node/draw count overlay |
| `isTemporalAntialiasingEnabled` | `false` | TAA smoothing |
| `isJitteringEnabled` | `false` | Temporal jitter for TAA |
| `debugOptions` | `[]` | `.showPhysicsShapes`, `.showBoundingBoxes`, `.renderAsWireframe` |

---

## Resources

**WWDC**: 2014-609, 2014-610, 2017-604, 2019-612

**Docs**: /scenekit, /scenekit/scnscene, /scenekit/scnnode, /scenekit/scnmaterial, /scenekit/scnphysicsbody, /scenekit/scnaction

**Skills**: axiom-scenekit, axiom-realitykit, axiom-realitykit-ref
