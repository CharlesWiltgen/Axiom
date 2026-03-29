---
name: axiom-realitykit-ref
description: RealityKit API reference — Entity, Component, System, RealityView, Model3D, anchor types, material system, physics, collision, animation, audio, accessibility
license: MIT
compatibility: [iOS 13+, macOS 10.15+, visionOS 1.0+, tvOS 26+]
metadata:
  version: "1.0.0"
---

# RealityKit API Reference

Complete API reference for RealityKit organized by category.

## When to Use This Reference

Use this reference when:
- Looking up specific RealityKit API signatures or properties
- Checking which component types are available
- Finding the right anchor type for an AR experience
- Browsing material properties and options
- Setting up physics body parameters
- Looking up animation or audio API details
- Checking platform availability for specific APIs

---

## Part 1: Entity API

### Entity

```swift
// Creation
let entity = Entity()
let entity = Entity(components: [TransformComponent(), ModelComponent(...)])

// Async loading
let entity = try await Entity(named: "scene", in: .main)
let entity = try await Entity(contentsOf: url)

// Clone
let clone = entity.clone(recursive: true)
```

### Entity Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `String` | Identifier for lookup |
| `id` | `ObjectIdentifier` | Unique identity |
| `isEnabled` | `Bool` | Local enabled state |
| `isEnabledInHierarchy` | `Bool` | Effective enabled (considers parents) |
| `isActive` | `Bool` | Entity is in an active scene |
| `isAnchored` | `Bool` | Has anchoring or anchored ancestor |
| `scene` | `RealityKit.Scene?` | Owning scene |
| `parent` | `Entity?` | Parent entity |
| `children` | `Entity.ChildCollection` | Child entities |
| `components` | `Entity.ComponentSet` | All attached components |
| `anchor` | `HasAnchoring?` | Nearest anchoring ancestor |

### Entity Hierarchy Methods

```swift
entity.addChild(child)
entity.addChild(child, preservingWorldTransform: true)
entity.removeChild(child)
entity.removeFromParent()
entity.findEntity(named: "name")  // Recursive search
```

### Entity Subclasses

| Class | Purpose | Key Component |
|-------|---------|---------------|
| `Entity` | Base container | Transform only |
| `ModelEntity` | Renderable object | ModelComponent |
| `AnchorEntity` | AR anchor point | AnchoringComponent |
| `PerspectiveCamera` | Virtual camera | PerspectiveCameraComponent |
| `DirectionalLight` | Sun/directional | DirectionalLightComponent |
| `PointLight` | Point light | PointLightComponent |
| `SpotLight` | Spot light | SpotLightComponent |
| `TriggerVolume` | Invisible collision zone | CollisionComponent |
| `ViewAttachmentEntity` | SwiftUI view in 3D | visionOS |
| `BodyTrackedEntity` | Body-tracked entity | BodyTrackingComponent |

---

## Part 2: Component Catalog

### Transform

```swift
// Properties
entity.position                    // SIMD3<Float>, local
entity.orientation                 // simd_quatf
entity.scale                      // SIMD3<Float>
entity.transform                  // Transform struct

// World-space
entity.position(relativeTo: nil)
entity.orientation(relativeTo: nil)
entity.setPosition(pos, relativeTo: nil)

// Utilities
entity.look(at: target, from: position, relativeTo: nil)
```

### ModelComponent

```swift
let component = ModelComponent(
    mesh: MeshResource.generateBox(size: 0.1),
    materials: [SimpleMaterial(color: .red, isMetallic: true)]
)
entity.components[ModelComponent.self] = component
```

### MeshResource Built-in Generators

| Method | Parameters |
|--------|-----------|
| `.generateBox(size:)` | `SIMD3<Float>` or single `Float` |
| `.generateBox(size:cornerRadius:)` | Rounded box |
| `.generateSphere(radius:)` | `Float` |
| `.generatePlane(width:depth:)` | `Float`, `Float` |
| `.generatePlane(width:height:)` | Vertical plane |
| `.generateCylinder(height:radius:)` | `Float`, `Float` |
| `.generateCone(height:radius:)` | `Float`, `Float` |
| `.generateText(_:)` | `String`, with options |

### CollisionComponent

```swift
let component = CollisionComponent(
    shapes: [
        .generateBox(size: SIMD3(0.1, 0.2, 0.1)),
        .generateSphere(radius: 0.05),
        .generateCapsule(height: 0.3, radius: 0.05),
        .generateConvex(from: meshResource)
    ],
    mode: .default,                    // .default or .trigger
    filter: CollisionFilter(
        group: CollisionGroup(rawValue: 1),
        mask: .all
    )
)
```

### ShapeResource Types

| Method | Description | Performance |
|--------|-------------|-------------|
| `.generateBox(size:)` | Axis-aligned box | Fastest |
| `.generateSphere(radius:)` | Sphere | Fast |
| `.generateCapsule(height:radius:)` | Capsule | Fast |
| `.generateConvex(from:)` | Convex hull from mesh | Moderate |
| `.generateStaticMesh(from:)` | Exact mesh | Slowest (static only) |

### PhysicsBodyComponent

```swift
let component = PhysicsBodyComponent(
    massProperties: .init(
        mass: 1.0,
        inertia: SIMD3(repeating: 0.1),
        centerOfMass: .zero
    ),
    material: .generate(
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.4
    ),
    mode: .dynamic                     // .dynamic, .static, .kinematic
)
```

| Mode | Behavior |
|------|----------|
| `.dynamic` | Physics simulation controls position |
| `.static` | Immovable, participates in collisions |
| `.kinematic` | Code-controlled, affects dynamic bodies |

### PhysicsMotionComponent

```swift
var motion = PhysicsMotionComponent()
motion.linearVelocity = SIMD3(0, 5, 0)
motion.angularVelocity = SIMD3(0, .pi, 0)
entity.components[PhysicsMotionComponent.self] = motion
```

### CharacterControllerComponent

```swift
entity.components[CharacterControllerComponent.self] = CharacterControllerComponent(
    radius: 0.3,
    height: 1.8,
    slopeLimit: .pi / 4,
    stepLimit: 0.3
)

// Move character with gravity
entity.moveCharacter(
    by: SIMD3(0.1, -0.01, 0),
    deltaTime: Float(context.deltaTime),
    relativeTo: nil
)
```

### AnchoringComponent

```swift
// Plane detection
AnchoringComponent(.plane(.horizontal, classification: .table,
                           minimumBounds: SIMD2(0.2, 0.2)))
AnchoringComponent(.plane(.vertical, classification: .wall,
                           minimumBounds: SIMD2(0.5, 0.5)))

// World position
AnchoringComponent(.world(transform: float4x4(...)))

// Image anchor
AnchoringComponent(.image(group: "AR Resources", name: "poster"))

// Face tracking
AnchoringComponent(.face)

// Body tracking
AnchoringComponent(.body)
```

### Plane Classification

| Classification | Description |
|----------------|-------------|
| `.table` | Horizontal table surface |
| `.floor` | Floor surface |
| `.ceiling` | Ceiling surface |
| `.wall` | Vertical wall |
| `.door` | Door |
| `.window` | Window |
| `.seat` | Chair/couch |

### Light Components

```swift
// Directional
let light = DirectionalLightComponent(
    color: .white,
    intensity: 1000,
    isRealWorldProxy: false
)
light.shadow = DirectionalLightComponent.Shadow(
    maximumDistance: 10,
    depthBias: 0.01
)

// Point
PointLightComponent(
    color: .white,
    intensity: 1000,
    attenuationRadius: 5
)

// Spot
SpotLightComponent(
    color: .white,
    intensity: 1000,
    innerAngleInDegrees: 30,
    outerAngleInDegrees: 60,
    attenuationRadius: 10
)
```

### Accessibility

```swift
var accessibility = AccessibilityComponent()
accessibility.label = "Red cube"
accessibility.value = "Interactive 3D object"
accessibility.traits = .button
accessibility.isAccessibilityElement = true
entity.components[AccessibilityComponent.self] = accessibility
```

### Additional Components

| Component | Purpose | Platform |
|-----------|---------|----------|
| `OpacityComponent` | Fade entity in/out | All |
| `GroundingShadowComponent` | Contact shadow beneath entity | All |
| `InputTargetComponent` | Enable gesture input | visionOS |
| `HoverEffectComponent` | Highlight on gaze/hover | visionOS |
| `SynchronizationComponent` | Multiplayer entity sync | All |
| `ImageBasedLightComponent` | Custom environment lighting | All |
| `ImageBasedLightReceiverComponent` | Receive IBL from source | All |

---

## Part 3: System API

### System Protocol

```swift
protocol System {
    init(scene: RealityKit.Scene)
    func update(context: SceneUpdateContext)
}
```

### SceneUpdateContext

| Property | Type | Description |
|----------|------|-------------|
| `deltaTime` | `TimeInterval` | Time since last update |
| `scene` | `RealityKit.Scene` | The scene |

```swift
// Query entities
context.entities(matching: query, updatingSystemWhen: .rendering)
```

### EntityQuery

```swift
// Has specific component
EntityQuery(where: .has(HealthComponent.self))

// Has multiple components
EntityQuery(where: .has(HealthComponent.self) && .has(ModelComponent.self))

// Does not have component
EntityQuery(where: .has(EnemyComponent.self) && !.has(DeadComponent.self))
```

### Scene Events

| Event | Trigger |
|-------|---------|
| `SceneEvents.Update` | Every frame |
| `SceneEvents.DidAddEntity` | Entity added to scene |
| `SceneEvents.DidRemoveEntity` | Entity removed from scene |
| `SceneEvents.AnchoredStateChanged` | Anchor tracking changes |
| `CollisionEvents.Began` | Two entities start colliding |
| `CollisionEvents.Updated` | Collision continues |
| `CollisionEvents.Ended` | Collision ends |
| `AnimationEvents.PlaybackCompleted` | Animation finishes |

```swift
scene.subscribe(to: CollisionEvents.Began.self, on: entity) { event in
    // event.entityA, event.entityB, event.impulse
}
```

---

## Part 4: RealityView API

### Initializers

```swift
// Basic (iOS 18+, visionOS 1.0+)
RealityView { content in
    // make: Add entities to content
}

// With update
RealityView { content in
    // make
} update: { content in
    // update: Called when SwiftUI state changes
}

// With placeholder
RealityView { content in
    // make (async loading)
} placeholder: {
    ProgressView()
}

// With attachments (visionOS)
RealityView { content, attachments in
    // make
} update: { content, attachments in
    // update
} attachments: {
    Attachment(id: "label") { Text("Hello") }
}
```

### RealityViewContent

```swift
content.add(entity)
content.remove(entity)
content.entities          // EntityCollection

// iOS/macOS — camera content
content.camera            // RealityViewCameraContent (non-visionOS)
```

### Gestures on RealityView

```swift
RealityView { content in ... }
    .gesture(TapGesture().targetedToAnyEntity().onEnded { value in
        let entity = value.entity
    })
    .gesture(DragGesture().targetedToAnyEntity().onChanged { value in
        value.entity.position = value.convert(value.location3D,
            from: .local, to: .scene)
    })
    .gesture(RotateGesture().targetedToAnyEntity().onChanged { value in
        // Handle rotation
    })
    .gesture(MagnifyGesture().targetedToAnyEntity().onChanged { value in
        // Handle scale
    })
```

---

## Part 5: Model3D API

```swift
// Simple display
Model3D(named: "robot")

// With phases
Model3D(named: "robot") { phase in
    switch phase {
    case .empty:
        ProgressView()
    case .success(let model):
        model.resizable().scaledToFit()
    case .failure(let error):
        Text("Failed: \(error.localizedDescription)")
    @unknown default:
        EmptyView()
    }
}

// From URL
Model3D(url: modelURL)
```

---

## Part 6: Material System

### SimpleMaterial

```swift
var material = SimpleMaterial()
material.color = .init(tint: .blue)
material.metallic = .init(floatLiteral: 1.0)
material.roughness = .init(floatLiteral: 0.3)
```

### PhysicallyBasedMaterial

```swift
var material = PhysicallyBasedMaterial()
material.baseColor = .init(tint: .white,
    texture: .init(try .load(named: "albedo")))
material.metallic = .init(floatLiteral: 0.0)
material.roughness = .init(floatLiteral: 0.5)
material.normal = .init(texture: .init(try .load(named: "normal")))
material.ambientOcclusion = .init(texture: .init(try .load(named: "ao")))
material.emissiveColor = .init(color: .blue)
material.emissiveIntensity = 2.0
material.clearcoat = .init(floatLiteral: 0.8)
material.clearcoatRoughness = .init(floatLiteral: 0.1)
material.specular = .init(floatLiteral: 0.5)
material.sheen = .init(color: .white)
material.anisotropyLevel = .init(floatLiteral: 0.5)
material.blending = .transparent(opacity: .init(floatLiteral: 0.5))
material.faceCulling = .back            // .none, .front, .back
```

### UnlitMaterial

```swift
var material = UnlitMaterial()
material.color = .init(tint: .red,
    texture: .init(try .load(named: "texture")))
material.blending = .transparent(opacity: .init(floatLiteral: 0.8))
```

### Special Materials

```swift
// Occlusion — invisible but hides content behind it
let occlusionMaterial = OcclusionMaterial()

// Video
let videoMaterial = VideoMaterial(avPlayer: avPlayer)
```

### TextureResource Loading

```swift
// From bundle
let texture = try await TextureResource(named: "texture")

// From URL
let texture = try await TextureResource(contentsOf: url)

// With options
let texture = try await TextureResource(named: "texture",
    options: .init(semantic: .color))  // .color, .raw, .normal, .hdrColor
```

---

## Part 7: Animation

### Transform Animation

```swift
entity.move(
    to: Transform(
        scale: .one,
        rotation: targetRotation,
        translation: targetPosition
    ),
    relativeTo: entity.parent,
    duration: 1.5,
    timingFunction: .easeInOut
)
```

### Timing Functions

| Function | Curve |
|----------|-------|
| `.default` | System default |
| `.linear` | Constant speed |
| `.easeIn` | Slow start |
| `.easeOut` | Slow end |
| `.easeInOut` | Slow start and end |

### Playing Loaded Animations

```swift
// All animations from USD
for animation in entity.availableAnimations {
    let controller = entity.playAnimation(animation)
}

// With options
let controller = entity.playAnimation(
    animation.repeat(count: 3),
    transitionDuration: 0.3,
    startsPaused: false
)
```

### AnimationPlaybackController

```swift
let controller = entity.playAnimation(animation)
controller.pause()
controller.resume()
controller.stop()
controller.speed = 0.5            // Half speed
controller.blendFactor = 1.0      // Full blend
controller.isComplete             // Check completion
```

---

## Part 8: Audio

### AudioFileResource

```swift
// Load
let resource = try AudioFileResource.load(
    named: "sound.wav",
    configuration: .init(
        shouldLoop: true,
        shouldRandomizeStartTime: false,
        mixGroupName: "effects"
    )
)
```

### Audio Components

```swift
// Spatial (3D positional)
entity.components[SpatialAudioComponent.self] = SpatialAudioComponent(
    directivity: .beam(focus: 0.5),
    distanceAttenuation: .rolloff(factor: 1.0),
    gain: 0                          // dB
)

// Ambient (non-positional, uniform)
entity.components[AmbientAudioComponent.self] = AmbientAudioComponent(
    gain: -6
)

// Channel (multi-channel output)
entity.components[ChannelAudioComponent.self] = ChannelAudioComponent(
    gain: 0
)
```

### Playback

```swift
let controller = entity.playAudio(resource)
controller.pause()
controller.stop()
controller.gain = -3               // Adjust volume (dB)
controller.speed = 1.5             // Pitch shift

entity.stopAllAudio()
```

---

## Part 9: RealityRenderer (Metal Integration)

```swift
// Low-level Metal rendering of RealityKit content
let renderer = try RealityRenderer()
renderer.entities.append(entity)

// Render to Metal texture
let descriptor = RealityRenderer.CameraOutput.Descriptor(
    colorFormat: .bgra8Unorm,
    depthFormat: .depth32Float
)
try renderer.render(
    viewMatrix: viewMatrix,
    projectionMatrix: projectionMatrix,
    size: size,
    colorTexture: colorTexture,
    depthTexture: depthTexture
)
```

---

## Resources

**WWDC**: 2019-603, 2019-605, 2021-10074, 2022-10074, 2023-10080, 2024-10103, 2024-10153

**Docs**: /realitykit, /realitykit/entity, /realitykit/component, /realitykit/system, /realitykit/realityview, /realitykit/model3d, /realitykit/modelentity, /realitykit/anchorentity, /realitykit/physicallybasedmaterial

**Skills**: axiom-realitykit, axiom-realitykit-diag, axiom-scenekit-ref
