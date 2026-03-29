---
name: axiom-realitykit
description: Use when building 3D content, AR experiences, or spatial computing with RealityKit. Covers ECS architecture, SwiftUI integration, RealityView, AR anchors, materials, physics, interaction, multiplayer, performance.
license: MIT
metadata:
  version: "1.0.0"
---

# RealityKit Development Guide

**Purpose**: Build 3D content, AR experiences, and spatial computing apps using RealityKit's Entity-Component-System architecture
**iOS Version**: iOS 13+ (base), iOS 18+ (RealityView on iOS), visionOS 1.0+
**Xcode**: Xcode 15+

## When to Use This Skill

Use this skill when:
- Building any 3D experience (AR, games, visualization, spatial computing)
- Creating SwiftUI apps with 3D content (RealityView, Model3D)
- Implementing AR with anchors (world, image, face, body tracking)
- Working with Entity-Component-System (ECS) architecture
- Setting up physics, collisions, or spatial interactions
- Building multiplayer or shared AR experiences
- Migrating from SceneKit to RealityKit
- Targeting visionOS

Do NOT use this skill for:
- SceneKit maintenance (use `axiom-scenekit`)
- 2D games (use `axiom-spritekit`)
- Metal shader programming (use `axiom-metal-migration-ref`)
- Pure GPU compute (use Metal directly)

---

## 1. Mental Model: ECS vs Scene Graph

### Scene Graph (SceneKit)

In SceneKit, nodes own their properties. A node IS a renderable, collidable, animated thing.

### Entity-Component-System (RealityKit)

In RealityKit, entities are **empty containers**. Components add data. Systems process that data.

```
Entity (identity + hierarchy)
  ├── TransformComponent (position, rotation, scale)
  ├── ModelComponent (mesh + materials)
  ├── CollisionComponent (collision shapes)
  ├── PhysicsBodyComponent (mass, mode)
  └── [YourCustomComponent] (game-specific data)

System (processes entities with specific components each frame)
```

**Why ECS matters**:
- **Composition over inheritance**: Combine any components on any entity
- **Data-oriented**: Systems process arrays of components efficiently
- **Decoupled logic**: Systems don't know about each other
- **Testable**: Components are pure data, Systems are pure logic

### The ECS Mental Shift

| Scene Graph Thinking | ECS Thinking |
|---------------------|--------------|
| "The player node moves" | "The movement system processes entities with MovementComponent" |
| "Add a method to the node subclass" | "Add a component, create a system" |
| "Override `update(_:)` in the node" | "Register a System that queries for components" |
| "The node knows its health" | "HealthComponent holds data, DamageSystem processes it" |

---

## 2. Entity Hierarchy

### Creating Entities

```swift
// Empty entity
let entity = Entity()
entity.name = "player"

// Entity with components
let entity = Entity()
entity.components[ModelComponent.self] = ModelComponent(
    mesh: .generateBox(size: 0.1),
    materials: [SimpleMaterial(color: .blue, isMetallic: false)]
)

// ModelEntity convenience (has ModelComponent built in)
let box = ModelEntity(
    mesh: .generateBox(size: 0.1),
    materials: [SimpleMaterial(color: .red, isMetallic: true)]
)
```

### Hierarchy Management

```swift
// Parent-child
parent.addChild(child)
child.removeFromParent()

// Find entities
let found = root.findEntity(named: "player")

// Enumerate
for child in entity.children {
    // Process children
}

// Clone
let clone = entity.clone(recursive: true)
```

### Transform

```swift
// Local transform (relative to parent)
entity.position = SIMD3<Float>(0, 1, 0)
entity.orientation = simd_quatf(angle: .pi / 4, axis: SIMD3(0, 1, 0))
entity.scale = SIMD3<Float>(repeating: 2.0)

// World-space queries
let worldPos = entity.position(relativeTo: nil)
let worldTransform = entity.transform(relativeTo: nil)

// Set world-space transform
entity.setPosition(SIMD3(1, 0, 0), relativeTo: nil)

// Look at a point
entity.look(at: targetPosition, from: entity.position, relativeTo: nil)
```

---

## 3. Components

### Built-in Components

| Component | Purpose |
|-----------|---------|
| `Transform` | Position, rotation, scale |
| `ModelComponent` | Mesh geometry + materials |
| `CollisionComponent` | Collision shapes for physics and interaction |
| `PhysicsBodyComponent` | Mass, physics mode (dynamic/static/kinematic) |
| `PhysicsMotionComponent` | Linear and angular velocity |
| `AnchoringComponent` | AR anchor attachment |
| `SynchronizationComponent` | Multiplayer sync |
| `PerspectiveCameraComponent` | Camera settings |
| `DirectionalLightComponent` | Directional light |
| `PointLightComponent` | Point light |
| `SpotLightComponent` | Spot light |
| `CharacterControllerComponent` | Character physics controller |
| `AudioMixGroupsComponent` | Audio mixing |
| `SpatialAudioComponent` | 3D positional audio |
| `AmbientAudioComponent` | Non-positional audio |
| `ChannelAudioComponent` | Multi-channel audio |
| `OpacityComponent` | Entity transparency |
| `GroundingShadowComponent` | Contact shadow |
| `InputTargetComponent` | Gesture input (visionOS) |
| `HoverEffectComponent` | Hover highlight (visionOS) |
| `AccessibilityComponent` | VoiceOver support |

### Custom Components

```swift
struct HealthComponent: Component {
    var current: Int
    var maximum: Int

    var percentage: Float {
        Float(current) / Float(maximum)
    }
}

// Register before use (typically in app init)
HealthComponent.registerComponent()

// Attach to entity
entity.components[HealthComponent.self] = HealthComponent(current: 100, maximum: 100)

// Read
if let health = entity.components[HealthComponent.self] {
    print(health.current)
}

// Modify
entity.components[HealthComponent.self]?.current -= 10
```

### Component Lifecycle

Components are value types (structs). When you read a component, modify it, and write it back, you're replacing the entire component:

```swift
// Read-modify-write pattern
var health = entity.components[HealthComponent.self]!
health.current -= damage
entity.components[HealthComponent.self] = health
```

**Anti-pattern**: Holding a reference to a component and expecting mutations to propagate. Components are copied on read.

---

## 4. Systems

### System Protocol

```swift
struct DamageSystem: System {
    // Define which components this system needs
    static let query = EntityQuery(where: .has(HealthComponent.self))

    init(scene: RealityKit.Scene) {
        // One-time setup
    }

    func update(context: SceneUpdateContext) {
        for entity in context.entities(matching: Self.query,
                                        updatingSystemWhen: .rendering) {
            var health = entity.components[HealthComponent.self]!
            if health.current <= 0 {
                entity.removeFromParent()
            }
        }
    }
}

// Register system
DamageSystem.registerSystem()
```

### System Best Practices

- **One responsibility per system**: MovementSystem, DamageSystem, RenderingSystem — not GameLogicSystem
- **Query filtering**: Use precise queries to avoid processing irrelevant entities
- **Order matters**: Systems run in registration order. Register dependencies first.
- **Avoid storing entity references**: Query each frame instead. Entity references can become stale.

### Event Handling

```swift
// Subscribe to collision events
scene.subscribe(to: CollisionEvents.Began.self) { event in
    let entityA = event.entityA
    let entityB = event.entityB
    // Handle collision
}

// Subscribe to scene update
scene.subscribe(to: SceneEvents.Update.self) { event in
    let deltaTime = event.deltaTime
    // Per-frame logic
}
```

---

## 5. SwiftUI Integration

### RealityView (iOS 18+, visionOS 1.0+)

```swift
struct ContentView: View {
    var body: some View {
        RealityView { content in
            // make closure — called once
            let box = ModelEntity(
                mesh: .generateBox(size: 0.1),
                materials: [SimpleMaterial(color: .blue, isMetallic: false)]
            )
            content.add(box)

        } update: { content in
            // update closure — called when SwiftUI state changes
        }
    }
}
```

### RealityView with Camera (iOS)

On iOS, `RealityView` provides a camera content parameter for configuring the AR or virtual camera:

```swift
RealityView { content, attachments in
    // Load 3D content
    if let model = try? await ModelEntity(named: "scene") {
        content.add(model)
    }
}
```

### Loading Content Asynchronously

```swift
RealityView { content in
    // Load from bundle
    if let entity = try? await Entity(named: "MyScene", in: .main) {
        content.add(entity)
    }

    // Load from URL
    if let entity = try? await Entity(contentsOf: modelURL) {
        content.add(entity)
    }
}
```

### Model3D (Simple Display)

```swift
// Simple 3D model display (no interaction)
Model3D(named: "toy_robot") { model in
    model
        .resizable()
        .scaledToFit()
} placeholder: {
    ProgressView()
}
```

### SwiftUI Attachments (visionOS)

```swift
RealityView { content, attachments in
    let entity = ModelEntity(mesh: .generateSphere(radius: 0.1))
    content.add(entity)

    if let label = attachments.entity(for: "priceTag") {
        label.position = SIMD3(0, 0.15, 0)
        entity.addChild(label)
    }
} attachments: {
    Attachment(id: "priceTag") {
        Text("$9.99")
            .padding()
            .glassBackgroundEffect()
    }
}
```

### State Binding Pattern

```swift
struct GameView: View {
    @State private var score = 0

    var body: some View {
        VStack {
            Text("Score: \(score)")

            RealityView { content in
                let scene = try! await Entity(named: "GameScene")
                content.add(scene)
            } update: { content in
                // React to state changes
                // Note: update is called when SwiftUI state changes,
                // not every frame. Use Systems for per-frame logic.
            }
        }
    }
}
```

---

## 6. AR on iOS

### AnchorEntity

```swift
// Horizontal plane
let anchor = AnchorEntity(.plane(.horizontal, classification: .table,
                                  minimumBounds: SIMD2(0.2, 0.2)))

// Vertical plane
let anchor = AnchorEntity(.plane(.vertical, classification: .wall,
                                  minimumBounds: SIMD2(0.5, 0.5)))

// World position
let anchor = AnchorEntity(world: SIMD3<Float>(0, 0, -1))

// Image anchor
let anchor = AnchorEntity(.image(group: "AR Resources", name: "poster"))

// Face anchor (front camera)
let anchor = AnchorEntity(.face)

// Body anchor
let anchor = AnchorEntity(.body)
```

### SpatialTrackingSession (iOS 18+)

```swift
let session = SpatialTrackingSession()
let configuration = SpatialTrackingSession.Configuration(tracking: [.plane, .object])
let result = await session.run(configuration)

if let notSupported = result {
    // Handle unsupported tracking on this device
    for denied in notSupported.deniedTrackingModes {
        print("Not supported: \(denied)")
    }
}
```

### AR Best Practices

- Anchor entities to detected surfaces rather than world positions for stability
- Use plane classification (`.table`, `.floor`, `.wall`) to place content appropriately
- Start with horizontal plane detection — it's the most reliable
- Test on real devices; simulator AR is limited
- Provide visual feedback during surface detection (coaching overlay)

---

## 7. Interaction

### ManipulationComponent (iOS, visionOS)

```swift
// Enable drag, rotate, scale gestures
entity.components[ManipulationComponent.self] = ManipulationComponent(
    allowedModes: .all  // .translate, .rotate, .scale
)

// Also requires CollisionComponent for hit testing
entity.generateCollisionShapes(recursive: true)
```

### InputTargetComponent (visionOS)

```swift
// Required for visionOS gesture input
entity.components[InputTargetComponent.self] = InputTargetComponent()
entity.components[CollisionComponent.self] = CollisionComponent(
    shapes: [.generateBox(size: SIMD3(0.1, 0.1, 0.1))]
)
```

### Gesture Integration with SwiftUI

```swift
RealityView { content in
    let entity = ModelEntity(mesh: .generateBox(size: 0.1))
    entity.generateCollisionShapes(recursive: true)
    entity.components.set(InputTargetComponent())
    content.add(entity)
}
.gesture(
    TapGesture()
        .targetedToAnyEntity()
        .onEnded { value in
            let tappedEntity = value.entity
            // Handle tap
        }
)
.gesture(
    DragGesture()
        .targetedToAnyEntity()
        .onChanged { value in
            value.entity.position = value.convert(value.location3D,
                from: .local, to: .scene)
        }
)
```

### Hit Testing

```swift
// Ray-cast from screen point
if let result = arView.raycast(from: screenPoint,
                                allowing: .estimatedPlane,
                                alignment: .horizontal).first {
    let worldPosition = result.worldTransform.columns.3
    // Place entity at worldPosition
}
```

---

## 8. Materials and Rendering

### Material Types

| Material | Purpose | Customization |
|----------|---------|---------------|
| `SimpleMaterial` | Solid color or texture | Color, metallic, roughness |
| `PhysicallyBasedMaterial` | Full PBR | All PBR maps (base color, normal, metallic, roughness, AO, emissive) |
| `UnlitMaterial` | No lighting response | Color or texture, always fully lit |
| `OcclusionMaterial` | Invisible but occludes | AR content hiding behind real objects |
| `VideoMaterial` | Video playback on surface | AVPlayer-driven |
| `ShaderGraphMaterial` | Custom shader graph | Reality Composer Pro |
| `CustomMaterial` | Metal shader functions | Full Metal control |

### PhysicallyBasedMaterial

```swift
var material = PhysicallyBasedMaterial()
material.baseColor = .init(tint: .white,
    texture: .init(try! .load(named: "albedo")))
material.metallic = .init(floatLiteral: 0.0)
material.roughness = .init(floatLiteral: 0.5)
material.normal = .init(texture: .init(try! .load(named: "normal")))
material.ambientOcclusion = .init(texture: .init(try! .load(named: "ao")))
material.emissiveColor = .init(color: .blue)
material.emissiveIntensity = 2.0

let entity = ModelEntity(
    mesh: .generateSphere(radius: 0.1),
    materials: [material]
)
```

### OcclusionMaterial (AR)

```swift
// Invisible plane that hides 3D content behind it
let occluder = ModelEntity(
    mesh: .generatePlane(width: 1, depth: 1),
    materials: [OcclusionMaterial()]
)
occluder.position = SIMD3(0, 0, 0)
anchor.addChild(occluder)
```

### Environment Lighting

```swift
// Image-based lighting
if let resource = try? await EnvironmentResource(named: "studio_lighting") {
    // Apply via RealityView content
}
```

---

## 9. Physics and Collision

### Collision Shapes

```swift
// Generate from mesh (accurate but expensive)
entity.generateCollisionShapes(recursive: true)

// Manual shapes (prefer for performance)
entity.components[CollisionComponent.self] = CollisionComponent(
    shapes: [
        .generateBox(size: SIMD3(0.1, 0.2, 0.1)),     // Box
        .generateSphere(radius: 0.1),                   // Sphere
        .generateCapsule(height: 0.3, radius: 0.05)     // Capsule
    ]
)
```

### Physics Body

```swift
// Dynamic — physics simulation controls movement
entity.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
    massProperties: .init(mass: 1.0),
    material: .generate(staticFriction: 0.5,
                        dynamicFriction: 0.3,
                        restitution: 0.4),
    mode: .dynamic
)

// Static — immovable collision surface
ground.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
    mode: .static
)

// Kinematic — code-controlled, participates in collisions
platform.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
    mode: .kinematic
)
```

### Collision Groups and Filters

```swift
// Define groups
let playerGroup = CollisionGroup(rawValue: 1 << 0)
let enemyGroup = CollisionGroup(rawValue: 1 << 1)
let bulletGroup = CollisionGroup(rawValue: 1 << 2)

// Filter: player collides with enemies and bullets
entity.components[CollisionComponent.self] = CollisionComponent(
    shapes: [.generateSphere(radius: 0.1)],
    filter: CollisionFilter(
        group: playerGroup,
        mask: enemyGroup | bulletGroup
    )
)
```

### Collision Events

```swift
// Subscribe in RealityView make closure or System
scene.subscribe(to: CollisionEvents.Began.self, on: playerEntity) { event in
    let otherEntity = event.entityA == playerEntity ? event.entityB : event.entityA
    handleCollision(with: otherEntity)
}
```

### Applying Forces

```swift
if var motion = entity.components[PhysicsMotionComponent.self] {
    motion.linearVelocity = SIMD3(0, 5, 0)  // Impulse up
    entity.components[PhysicsMotionComponent.self] = motion
}
```

---

## 10. Animation

### Transform Animation

```swift
// Animate to position over duration
entity.move(
    to: Transform(
        scale: SIMD3(repeating: 1.5),
        rotation: simd_quatf(angle: .pi, axis: SIMD3(0, 1, 0)),
        translation: SIMD3(0, 2, 0)
    ),
    relativeTo: entity.parent,
    duration: 2.0,
    timingFunction: .easeInOut
)
```

### Playing USD Animations

```swift
if let entity = try? await Entity(named: "character") {
    // Play all available animations
    for animation in entity.availableAnimations {
        entity.playAnimation(animation.repeat())
    }
}
```

### Animation Playback Control

```swift
let controller = entity.playAnimation(animation)
controller.pause()
controller.resume()
controller.speed = 2.0      // 2x playback speed
controller.blendFactor = 0.5 // Blend with current state
```

---

## 11. Audio

### Spatial Audio

```swift
// Load audio resource
let resource = try! AudioFileResource.load(named: "engine.wav",
    configuration: .init(shouldLoop: true))

// Create entity with spatial audio
let audioEntity = Entity()
audioEntity.components[SpatialAudioComponent.self] = SpatialAudioComponent()
let controller = audioEntity.playAudio(resource)

// Position the audio source in 3D space
audioEntity.position = SIMD3(2, 0, -1)
```

### Ambient Audio

```swift
entity.components[AmbientAudioComponent.self] = AmbientAudioComponent()
entity.playAudio(backgroundMusic)
```

---

## 12. Performance

### Entity Count

- **Under 100 entities**: No concerns
- **100-1000 entities**: Monitor with RealityKit debugger
- **1000+ entities**: Use instancing and LOD strategies

### Instancing

```swift
// Share mesh and material across many entities
let sharedMesh = MeshResource.generateSphere(radius: 0.01)
let sharedMaterial = SimpleMaterial(color: .white, isMetallic: false)

for i in 0..<1000 {
    let entity = ModelEntity(mesh: sharedMesh, materials: [sharedMaterial])
    entity.position = randomPosition()
    parent.addChild(entity)
}
```

RealityKit automatically batches entities with identical mesh and material resources.

### Component Churn

**Anti-pattern**: Creating and replacing components every frame.

```swift
// BAD — component allocation every frame
func update(context: SceneUpdateContext) {
    for entity in context.entities(matching: query, updatingSystemWhen: .rendering) {
        entity.components[ModelComponent.self] = ModelComponent(
            mesh: .generateBox(size: 0.1),
            materials: [newMaterial]  // New allocation every frame
        )
    }
}

// GOOD — modify existing component
func update(context: SceneUpdateContext) {
    for entity in context.entities(matching: query, updatingSystemWhen: .rendering) {
        // Only update when actually needed
        if needsUpdate {
            var model = entity.components[ModelComponent.self]!
            model.materials = [cachedMaterial]
            entity.components[ModelComponent.self] = model
        }
    }
}
```

### Collision Shape Optimization

- Use simple shapes (box, sphere, capsule) instead of mesh-based collision
- `generateCollisionShapes(recursive: true)` is convenient but expensive
- For static geometry, generate shapes once during setup

### Profiling

Use Xcode's RealityKit debugger:
- **Entity Inspector**: View entity hierarchy and components
- **Statistics Overlay**: Entity count, draw calls, triangle count
- **Physics Visualization**: Show collision shapes

---

## 13. Multiplayer

### Synchronization Basics

```swift
// Components sync automatically if they conform to Codable
struct ScoreComponent: Component, Codable {
    var points: Int
}

// SynchronizationComponent controls what syncs
entity.components[SynchronizationComponent.self] = SynchronizationComponent()
```

### MultipeerConnectivityService

```swift
let service = try MultipeerConnectivityService(session: mcSession)
// Entities with SynchronizationComponent auto-sync across peers
```

### Ownership

- Only the **owner** of an entity can modify it
- Request ownership before modifying shared entities
- Non-Codable component data does not sync

---

## 14. Anti-Patterns

### Anti-Pattern 1: UIKit-Style Thinking in ECS

**Time cost**: Hours of frustration from fighting the architecture

```swift
// BAD — subclassing Entity for behavior
class PlayerEntity: Entity {
    func takeDamage(_ amount: Int) { /* logic in entity */ }
}

// GOOD — component holds data, system has logic
struct HealthComponent: Component { var hp: Int }
struct DamageSystem: System {
    static let query = EntityQuery(where: .has(HealthComponent.self))
    func update(context: SceneUpdateContext) {
        // Process damage here
    }
}
```

### Anti-Pattern 2: Monolithic Entities

**Time cost**: Untestable, inflexible architecture

Don't put all game logic in one entity type. Split into components that can be mixed and matched.

### Anti-Pattern 3: Frame-Based Updates Without Systems

**Time cost**: Missed frame updates, inconsistent behavior

```swift
// BAD — timer-based updates
Timer.scheduledTimer(withTimeInterval: 1/60, repeats: true) { _ in
    entity.position.x += 0.01
}

// GOOD — System update
struct MovementSystem: System {
    static let query = EntityQuery(where: .has(VelocityComponent.self))
    func update(context: SceneUpdateContext) {
        for entity in context.entities(matching: Self.query,
                                        updatingSystemWhen: .rendering) {
            let velocity = entity.components[VelocityComponent.self]!
            entity.position += velocity.value * Float(context.deltaTime)
        }
    }
}
```

### Anti-Pattern 4: Not Generating Collision Shapes for Interactive Entities

**Time cost**: 15-30 min debugging "why taps don't work"

Gestures require `CollisionComponent`. If an entity has `InputTargetComponent` (visionOS) or `ManipulationComponent` but no `CollisionComponent`, gestures will never fire.

### Anti-Pattern 5: Storing Entity References in Systems

**Time cost**: Crashes from stale references

```swift
// BAD — entity might be removed between frames
struct BadSystem: System {
    var playerEntity: Entity?  // Stale reference risk

    func update(context: SceneUpdateContext) {
        playerEntity?.position.x += 0.1  // May crash
    }
}

// GOOD — query each frame
struct GoodSystem: System {
    static let query = EntityQuery(where: .has(PlayerComponent.self))

    func update(context: SceneUpdateContext) {
        for entity in context.entities(matching: Self.query,
                                        updatingSystemWhen: .rendering) {
            entity.position.x += Float(context.deltaTime)
        }
    }
}
```

---

## 15. Code Review Checklist

- [ ] Custom components registered via `registerComponent()` before use
- [ ] Systems registered via `registerSystem()` before scene loads
- [ ] Components are value types (structs), not classes
- [ ] Read-modify-write pattern used for component updates
- [ ] Interactive entities have `CollisionComponent`
- [ ] visionOS interactive entities have `InputTargetComponent`
- [ ] Collision shapes are simple (box/sphere/capsule) where possible
- [ ] No entity references stored across frames in Systems
- [ ] Mesh and material resources shared across identical entities
- [ ] Component updates only occur when values actually change
- [ ] USD/USDZ format used for 3D assets (not .scn)
- [ ] Async loading used for all model/scene loading
- [ ] `[weak self]` in closure-based subscriptions if retaining view/controller

---

## 16. Pressure Scenarios

### Scenario 1: "ECS Is Overkill for Our Simple App"

**Pressure**: Team wants to avoid learning ECS, just needs one 3D model displayed

**Wrong approach**: Skip ECS, jam all logic into RealityView closures.

**Correct approach**: Even simple apps benefit from ECS. A single `ModelEntity` in a `RealityView` is already using ECS — you're just not adding custom components yet. Start simple, add components as complexity grows.

**Push-back template**: "We're already using ECS — Entity and ModelComponent. The pattern scales. Adding a custom component when we need behavior is one struct definition, not an architecture change."

### Scenario 2: "Just Use SceneKit, We Know It"

**Pressure**: Team has SceneKit experience, RealityKit is unfamiliar

**Wrong approach**: Build new features in SceneKit.

**Correct approach**: SceneKit is soft-deprecated. New features won't be added. Invest in RealityKit now — the ECS concepts transfer to other game engines (Unity, Unreal, Bevy) if needed.

**Push-back template**: "SceneKit is in maintenance mode — no new features, only security patches. Every line of SceneKit we write is migration debt. RealityKit's concepts (Entity, Component, System) are industry-standard ECS."

### Scenario 3: "Make It Work Without Collision Shapes"

**Pressure**: Deadline, collision shape setup seems complex

**Wrong approach**: Skip collision shapes, use position-based proximity detection.

**Correct approach**: `entity.generateCollisionShapes(recursive: true)` takes one line. Without it, gestures won't work and physics won't collide. The "shortcut" creates more debugging time than it saves.

**Push-back template**: "Collision shapes are required for gestures and physics. It's one line: `entity.generateCollisionShapes(recursive: true)`. Skipping it means gestures silently fail — a harder bug to diagnose."

---

## Resources

**WWDC**: 2019-603, 2019-605, 2021-10074, 2022-10074, 2023-10080, 2023-10081, 2024-10103, 2024-10153

**Docs**: /realitykit, /realitykit/entity, /realitykit/realityview, /realitykit/modelentity, /realitykit/anchorentity, /realitykit/component

**Skills**: axiom-realitykit-ref, axiom-realitykit-diag, axiom-scenekit, axiom-scenekit-ref
