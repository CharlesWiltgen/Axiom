
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
- Browsing the 27-cycle additions: navigation mesh, level of detail, soft shadows, projective textures, Gaussian splats, custom reverb (Part 10)

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

// Build the CameraOutput descriptor (single-view to a Metal texture).
// There is no colorFormat:/depthFormat: init — describe the destination
// with singleProjection(colorTexture:) or set colorTextures/viewports directly.
let descriptor = RealityRenderer.CameraOutput.Descriptor.singleProjection(colorTexture: colorTexture)
// Equivalent manual setup:
// var descriptor = ...
// descriptor.colorTextures = [colorTexture]
// descriptor.viewports = [.init(originX: 0, originY: 0, width: 1, height: 1)]

let cameraOutput = try RealityRenderer.CameraOutput(descriptor)

// Render entry point — no view/projection matrix params.
// The camera comes from renderer.activeCamera / cameraSettings.
try renderer.updateAndRender(
    deltaTime: deltaTime,
    cameraOutput: cameraOutput
)
```

---

## Part 10: RealityKit 27 Additions `OS27`

Everything in this part requires the 27 releases (macOS/iOS/iPadOS/tvOS/visionOS — RealityKit does not ship on watchOS). Platform-narrower APIs are tagged on the row or subsection.

### New Components and Resources Catalog

| Addition | Purpose |
|----------|---------|
| `NavigationMeshComponent` / `NavigationMeshResource` / `NavigationComponent` / `NavigationController` | Pathfinding over a navigation mesh (see below) |
| `LevelOfDetailComponent` | Automatic mesh LOD switching (see below) |
| `LightmapComponent` / `LightmapResource` | Baked lighting textures (see below) |
| `SpotLightComponent.ProjectiveTexture` | Project a texture from a spotlight (see below) |
| `SpotLightComponent.SurroundingsLight` / `PointLightComponent.SurroundingsLight` | Light the real surroundings (visionOS27/macOS27, see below) |
| `GaussianSplatComponent` / `GaussianSplatResource` | Render 3D Gaussian splats (visionOS27, see below) |
| `ReverbMeshResource` | Geometry for raytraced acoustic simulation (see below) |
| `AudioPlaybackGroupController` | Coordinated, synchronized playback across multiple entities |
| `BloomComponent` / `BloomOptionsComponent` / `BloomSettingsComponent` | HDR bloom post-processing |
| `ToneMappingComponent` | Tone-mapping control |
| `ClippingComponent` / `ClippingPrimitiveComponent` | Clip geometry against primitives, with feathered edges |
| `PhysicallyBasedDecalComponent` | Project PBR decals onto geometry |
| `OcclusionCullingComponent` | Skip rendering of occluded entities |
| `RenderLayer` / `RenderLayerComponent` | Assign entities to render layers |
| `LightingModel` (`LitLightingModel`, `UnlitLightingModel`, `HairLightingModel`) | Per-material lighting model selection, including an advanced hair shader |
| `PhysicallyBasedMaterial` subsurface properties (`SubsurfaceWeight`, `SubsurfaceColor`, `SubsurfaceRadius`, `SubsurfaceRadiusScale`, `SubsurfaceScatterAnisotropy`) | Subsurface scattering for character rendering |
| `PortalFactory` + `PortalMaterial` additions | Custom portal opacity and shape |
| `MeshDeformer` protocol, `MeshDeformerComponent`, `MeshDeformationStack`, deformers (`BlendShapeDeformer`, `SkinningDeformer`, `OpenSubdivisionDeformer`, `RenormalizationDeformer`, `CalculateBoundingBoxDeformer`) | Composable mesh deformation pipeline |
| `SkeletonResource`, `RetargetingConfiguration`, `IKRig` additions | Skeletal animation retargeting and IK |
| `AnimationGraphResource` / `AnimationGraphComponent` | Animation graphs (author in Reality Composer Pro 3) |
| `BehaviorTreeResource` / `BehaviorTreeComponent` / `BehaviorTreeAction` / `BehaviorTreeActionHandler` | Behavior trees for NPC logic (author in Reality Composer Pro 3) |
| `DiffuseLightProbeGroupComponent` / `DiffuseLightProbeReceiverComponent` / `DiffuseProbeResource` | Baked diffuse light probes |
| `ComputeGraphComponent` and related (`ComputeGraphResource`, `ComputeGraphOutputComponent`, `ComputeGraphRuntimeComponent`, `ComputeGraphViewpointComponent`) | Run Reality Composer Pro 3 compute node graphs (particles, simulations) at runtime |
| `LowLevelDeviceResource` | Low-level GPU-resource-backed RealityKit resource |
| `USDStageComponent` / `USDPlayer` | Render a USDKit stage directly — see axiom-graphics (skills/usdkit.md) |

### Cloth Simulation (`OS27`, not watchOS/tvOS)

RealityKit 27 ships GPU cloth in the `RealityFoundationCloth` implementation module — **`import RealityKit`** surfaces it (`iOS27`/`macOS27`/`visionOS27`). Build a cloth entity from three components:

| Component | Role |
|-----------|------|
| `ClothBodyComponent` | The simulated cloth — `mesh` (`ClothMeshResource`), `mass`, per-vertex `motionTypes` (`ParticleMotionType.dynamic`/`.kinematic`), `externalForces`, `targetShapes`, `inflationConstraint`, `colliderBinding`, `materialNames` (names into `ClothSimulationComponent.materials`) |
| `ClothColliderComponent` | What the cloth collides with — `init(shape:)` from `ClothColliderShape` (sphere/box/rounded-box/capsule/plane/mesh, e.g. `ClothSphereShape`), plus `init(mesh:bias:)`; `collisionFilter`, `isCollisionResponseEnabled`, `ClothColliderMaterial` |
| `ClothSimulationComponent` | World settings on the simulation root — `gravity`, `wind`, `dampingFactor` |

Also: `ClothGrabComponent` (interactive grabbing), `ClothForceVolumeComponent` / `ClothQueryVolumeComponent`, per-vertex data via `PerClothVertexData<T>`, collision via `ClothCollisionGroupSet` / `ClothCollisionFilter`, and event streams `ClothSimulationEvents` / `ClothBodyEvents` / `ClothColliderEvents` / `ClothQueryVolumeEvents`.

```swift
import RealityKit

@available(iOS 27, macOS 27, visionOS 27, *)
func setUpCloth(simulationRoot: Entity, cloth: Entity) {
    simulationRoot.components.set(ClothSimulationComponent())          // gravity / wind / damping
    let collider = ClothColliderComponent(shape: .sphere(ClothSphereShape(radius: 0.1)))
    cloth.components.set(collider)
    // cloth also carries a ClothBodyComponent built from its ClothMeshResource
}
```

**Building the cloth mesh:** create geometry with `ClothMeshResource` factories — `.patch(size:)`, `.box(size:)`, `.sphere(radius:)`, `.capsule(height:radius:)`, `.cylinder(height:radius:withCaps:)`, or `init(from: MeshResource)` — then `ClothBodyComponent(mesh:meshDraping:)`, draping from a `ClothPoseResource(positions:)`. `ClothSimulationComponent` also exposes `solver` (`.gaussSeidel(iterationCount:)` / `.jacobi(iterationCount:)`), `speedLimit`, `timeStep`, and a by-name `materials` collection where `ClothBodyMaterial` / `ClothColliderMaterial` register (referenced by each component's `materialNames`). Force/query/grab volumes take a `ClothVolumeShape` (distinct from the collider's `ClothColliderShape`).

**Experimental API:** the entire cloth surface is annotated `@available(*, deprecated, message: "This API is experimental and may change or be removed in a future release.")` in the 27 beta. Adopting it emits deprecation warnings today and can source-break in a later beta — gate it behind your own flag and re-verify each beta.

### ComputeGraph framework (`OS27`, not watchOS)

The runtime `ComputeGraphComponent` family above *runs* compute node graphs; the new **`ComputeGraph`** framework (`import ComputeGraph`) is the programmatic, code-level way to *build and drive* one — the Swift counterpart to authoring a graph visually in Reality Composer Pro 3. Two core types: `ComputeNodeGraph` (the graph *description*) and `ComputeGraphSimulation` (the runtime — `simulationRate`, `advance(_:)`). Plus the node-description enums: `Topology` (`.point`/`.triangle`/`.quad`/`.octagon`/`.strip`/`.instances`), `BinaryOperation` / `UnaryOperation` / `StandardLibraryFunction` (node math), `AddressSpace`, `CoordinateSpace`, `ElementGrouping`, `Sorting`, `StripOrientation`, `ElementSpawnParameters`, `PortReference`. Available on iOS/macOS/visionOS/tvOS 27 (not watchOS). Most apps author graphs in RCP 3 and run them via `ComputeGraphComponent`; reach for the framework only when you need to generate or mutate graphs at build/runtime.

### ShaderGraph in Swift (`OS27`, not watchOS)

27 is the first cycle where you can **author** a shader graph in code. `ShaderGraphMaterial` existed in 26 but was opaque — load an asset made in Reality Composer Pro, then `setParameter(name:)` and nothing more. 27 adds `ShaderGraphMaterial.Program` (+ `Program.Descriptor`) and `PortalMaterial.Program`, both built from a `ShaderGraph` you construct yourself.

Everything nests under `ShaderGraph`: `NodeLibrary` (`.materialX138` / `.materialX139` / `.default`, with `definition(named:)` and `makeNode(from:)`), `NodeDefinition` (+ `.Input` / `.Output` / `.SemanticType` / `.Availability`), `Node` and its nested `Node.NodeData` (`.definition` / `.graph` for subgraphs / `.constant`), `Edge`, `Value` (24 cases), `DataType` (28 cases), `TextureCoordinate`. Graph ops: `addNode`, `addEdge`, `connect`, `validate()`, `encode()`.

```swift
import RealityKit   // NOT `import ShaderGraph` — see the import rule in Part 11

@available(iOS 27, macOS 27, visionOS 27, tvOS 27, *)
func makeMaterial() async throws -> ShaderGraphMaterial {
    let library = ShaderGraph.NodeLibrary(version: .default)   // .default is a Version, not a library
    let graph = try ShaderGraph(named: "MyShader", inputs: [], outputs: [], nodeLibrary: library)

    guard let def = library.definition(named: "ND_atan2_float") else { throw MyError.unknownNode }
    let node = try library.makeNode(from: def)                 // makeNode is on NodeLibrary
    try graph.addNode(node)                                    // throws; returns the assigned name

    guard graph.validate() else { throw MyError.invalidGraph }  // returns Bool — does NOT throw
    let descriptor = try ShaderGraphMaterial.Program.Descriptor(inferredFrom: graph)
    return try await ShaderGraphMaterial(program: .init(descriptor: descriptor))
}
```

| Gotcha | Consequence |
|---|---|
| `validate()` returns `Bool` | It does not throw. `try graph.validate()` is a compile error, and ignoring the result silently accepts a broken graph |
| `definition(named:)` returns an **Optional** | An unknown or misspelled MaterialX name yields `nil`, not an error |
| `init(named:inputs:outputs:)` is deprecated in the SDK that introduces it | Use the `nodeLibrary:` overload |
| `validate()` runs the compiler **front end only** | Apple: a graph that passes may still fail later during Metal library generation. It is not a green light |
| `connect` has String-keyed and Node-keyed overloads | Mixing the two in one call fails to typecheck |
| `functionConstantInputs` bake in at `Program` compile time | Cannot change afterward — recompile the program |
| `arguments` / `results` are **virtual nodes** | Connect *from* `arguments`, *to* `results` |

Node names follow the MaterialX convention (`ND_atan2_float`), and each definition carries a `group` (`"math"`, `"texture"`) because Apple expects you to build a node-picker UI on it.

**Do not use the ShaderGraph module's `_Proto_*` types**, `MaterialDecodingConfiguration` (an empty struct), `MaterialXVersion`, `MaterialXTarget`, or `MaterialXAvailability` — module-public but dead, referenced by nothing but their own protocol conformances. This applies to the **ShaderGraph** module specifically; `RealityCoreDeformation` ships its own separate `_Proto_*` family, and that one is live.

### GPU Mesh Deformation (`OS27`, not watchOS)

**`MeshDeformerComponent` (in the catalog above) is the mainstream path.** This is the custom-renderer escape hatch: raw `MTLBuffer`s encoded into your own `MTLComputeCommandEncoder`, with no `Entity`, `Component`, or `MeshResource` in any signature. Zero type overlap with the ECS deformation stack — reach for it only if you already own the render loop.

| Type | Role |
|---|---|
| `LowLevelDeformationContext` | Per-`MTLDevice` owner. `makePipeline(_:)` (sync and async), `makeDeformation(pipeline:descriptor:)` |
| `LowLevelDeformation` | Encodes blend-shape, skinning, and renormalization passes. `encode(into:) throws` |
| `LowLevelDeformation.Mesh` / `.BlendShape` / `.Skinning` / `.Renormalization` | The working surface — `setVertices`, the `set*Offsets` setters, and the `replace*` validators live here, not on `LowLevelDeformation` itself |

| Gotcha | Consequence |
|---|---|
| `encode(into:)` throws if the encoder uses **concurrent dispatch** | Needs a serial compute encoder |
| Compile the `Pipeline` once and reuse it | But re-bind `input`/`output` vertices *every* frame |
| The `replace*` closures validate on return and **throw** | Joint indices vs `jointTransformCount`, adjacencies vs `indexCount / 3`, triangle indices vs `vertexCount`, and `replaceAdjacencyEndIndices` vs `renormalizing.adjacenciesCount` |
| Buffer shapes are exact | Blend-shape offsets = `targetCount × vertexCount`; weights = `targetCount` floats |

Unlike cloth, this is **not** experimental — no deprecation annotations, and it ships on tvOS too. The cloth source-break caveat does not transfer.

### Runtime Skybox and IBL Generation (`OS27`, not watchOS)

Elsewhere the guidance for a model that renders black is "add an image-based light," followed by `EnvironmentResource(named:)` loading a **pre-baked** asset. This is how you *produce* one at runtime, in Metal, from an equirectangular HDR.

| Type | Purpose |
|---|---|
| `SkyboxGenerator` | Equirectangular `MTLTexture` → skybox cube (with mipmaps) |
| `ImageBasedLightTextureGenerator` | Skybox cube → diffuse irradiance + specular pre-filtered cubes, the shape `EnvironmentResource` consumes |
| `TextureSamplingQuality` | `.low` (**default**) / `.normal` / `.high` / `.veryHigh` |

```swift
@available(iOS 27, macOS 27, visionOS 27, tvOS 27, *)
func makeSkybox(device: MTLDevice, commandBuffer: MTLCommandBuffer,
                equirect: MTLTexture) throws -> MTLTexture {
    let generator = SkyboxGenerator(device: device)
    let descriptor = try generator.makeDescriptor(fromEquirectangular: equirect)  // allocates mipmaps
    let cube = device.makeTexture(descriptor: descriptor)!
    try generator.generateSkybox(using: commandBuffer, fromEquirectangular: equirect,
                                 quality: .high, into: cube)   // pass quality explicitly
    return cube
}
```

- **The skybox cube must have mipmaps** — the IBL generators require a mipmapped source. `makeDescriptor(fromEquirectangular:)` allocates them, so hand-rolling a descriptor is where this goes wrong.
- **`.low` is the silent default** on all three `generate*` calls and it bands gradients. Pass a quality explicitly. (The `make*Descriptor` methods take no quality.)
- Throws if the destination's pixel format does not support shader writes on this device.
- Each `generate*` takes an `MTLCommandBuffer` you own, so it composes with your other GPU work.

### Soft Shadows

`lightSize` (diameter in meters) on `SpotLightComponent.Shadow` produces a penumbra (spotlights only — `DirectionalLightComponent.Shadow` did not gain these members). Quality must be `.medium` or `.high` — `.low` always renders hard shadows regardless of `lightSize`.

```swift
guard var shadow = hearthSpotlight.components[SpotLightComponent.Shadow.self] else { return }
shadow.lightSize = 0.7   // diameter in meters; 0 = hard shadow (default)
shadow.quality = .medium // .low produces hard shadows regardless of lightSize
hearthSpotlight.components.set(shadow)
```

### Projective Textures

Project a texture from a spotlight, like film in front of a flashlight (window patterns, animated caustics). Like soft shadows, the availability annotation lists visionOS/iOS/macCatalyst/macOS 27 without naming tvOS (tvOS is not marked unavailable).

```swift
let spotLightEntity = Entity()
spotLightEntity.components.set(SpotLightComponent(
    color: .white,   // white avoids tinting the projected texture
    intensity: intensity,
    innerAngleInDegrees: innerAngle,
    outerAngleInDegrees: outerAngle,
    attenuationRadius: attenuationRadius
))
spotLightEntity.components.set(SpotLightComponent.ProjectiveTexture(texture: projectiveTexture))
```

### Physical Space Lighting (visionOS27/macOS27)

`SurroundingsLight` makes a virtual spot or point light illuminate the real surroundings via the scene-understanding mesh. It is explicitly unavailable on iOS. Spot and point lights only.

```swift
spotLightEntity.components.set(SpotLightComponent.SurroundingsLight())
```

### Lightmaps

`LightmapResource` holds baked lighting; `LightmapComponent` applies it. `BakeType` cases: `.ambientOcclusion`, `.indirectDiffuseIrradiance`, `.indirectDiffuseSHL1Irradiance`, `.finalShadedColor`. Generate lightmaps with Reality Composer Pro 3's light baker rather than authoring textures by hand.

### Navigation Mesh

Three pieces: `NavigationMeshResource` (geometry, labeled areas, traversal costs, off-mesh connections — build in Swift or Reality Composer Pro 3) → `NavigationComponent` (holds the resource plus a filter for area costs and include/exclude flags) → `NavigationController` (computes paths).

```swift
extension Entity {
    func navigate(from fromPosition: SIMD3<Float>, to toPosition: SIMD3<Float>) async {
        guard let navigator = try? NavigationController(entity: self) else { return }
        guard let result = await navigator.computePath(from: fromPosition, to: toPosition) else {
            return  // nil: no valid path exists
        }
        if result.isEmpty { return }  // empty: already at destination
        var finalPath: [SIMD3<Float>] = []
        for node in result {
            switch node.category {
            case .meshPoint:
                finalPath.append(node.position)
            case .offMeshConnection:
                break  // traverse ladder/bridge connection
            @unknown default:
                break
            }
        }
    }
}
```

`computePath(to:)` uses the entity's current position as the start. Both variants are async and return `[NavigationMeshResource.PathNode]?`. A synchronous request path also exists: `requestPath(to:)`/`requestPath(from:to:)` start the computation, then poll `pathfindStatus` and read `currentPath` (cancel with `stopPathfind()`).

### Level of Detail

`LevelOfDetailComponent.DetailLevel` is `[Entity]`. Three convenience switching strategies — by camera distance, by screen area, and `addByResolutionMetric(to:levels:boundingBox:)`:

```swift
let entity = Entity()

// By camera distance — maxDistance per level, .infinity for the last
LevelOfDetailComponent.addByCameraDistance(to: entity, levels: [
    (entities: lod0, maxDistance: 1.0),  // highest detail
    (entities: lod1, maxDistance: 5.0),
    (entities: lod2, maxDistance: .infinity),
])

// By screen area — minArea as fraction of screen
LevelOfDetailComponent.addByScreenArea(to: entity, levels: [
    (entities: lod0, minArea: 0.2),
    (entities: lod1, minArea: 0.1),
    (entities: lod2, minArea: 0.01),
])
```

### Gaussian Splats (visionOS27)

Renders captured volumetric scenes as 3D Gaussians. No file format is assumed — you supply per-splat buffers (position, scale, rotation, opacity, spherical harmonics plus degree; degree 0 = view-independent color). In the first 27 beta the API is present only in the visionOS SDK. Each buffer parameter is a `GaussianSplatResource.BufferDescriptor` (`LowLevelBuffer` + `MTLAttributeFormat` + stride + offset); the degree is a `SphericalHarmonicDegree` enum value.

```swift
let buffers = try GaussianSplatResource.BufferResource(
    count: splatCount,
    position: positionBuffer,      // GaussianSplatResource.BufferDescriptor each
    scale: scaleBuffer,
    rotation: rotationBuffer,
    opacity: opacityBuffer,
    sphericalHarmonics: (sphericalHarmonicsBuffer, degree)
)
let splatResource = GaussianSplatResource(buffers)
splatEntity.components.set(GaussianSplatComponent(splatResource))
```

### Custom Reverb Meshes

Raytraced geometrical acoustics: model the room with a `ReverbMeshResource` (from mesh descriptors, a mesh resource, or the `.shoebox(size:)`, `.box(size:)`, and `.plane(width:depth:)` starters), pair it with audio materials, and attach via the existing `ReverbComponent`. Takes effect only in immersive spaces — in a shared space visionOS uses its room-sensed reverb instead.

```swift
let mesh: ReverbMeshResource = .shoebox(size: [5, 4, 6])  // width, height, depth in meters
let reverb: Reverb = .simulated(mesh: mesh, materials: [.dryWall])
entity.components.set(ReverbComponent(reverb: reverb))
```

Audio materials come from presets (`.dryWall`, `.carpet`, ...), by scaling a preset, or from scratch with 10-band absorption plus per-frequency scattering (RealityKit extrapolates unspecified frequencies):

```swift
let thickCarpet: Audio.Material = .carpet.scalingAbsorption { freq in 0.1 }

// Absorption per center frequency:
// 31.5Hz, 63, 125, 250, 500, 1k, 2k, 4k, 8k, 16kHz
let absorption = Audio.Absorption(
    [0.10, 0.15, 0.28, 0.20, 0.15, 0.10, 0.10, 0.07, 0.07, 0.05])
let scattering = Audio.Scattering([500: 0.5, 1000: 0.6, 4000: 0.7])
let bookshelf = Audio.Material(absorption: absorption, scattering: scattering)
```

### ARKit Object Tracking (iOS27)

| API | Purpose |
|-----|---------|
| `ARWorldTrackingConfiguration.trackingObjects: Set<ARReferenceObject>` | Live object tracking (also on `ARGeoTrackingConfiguration`; not on the `ARConfiguration` base) |
| `ARObjectAnchor.isTracked` | Whether the object is actively tracked |
| `ARReferenceObject.usdzFile` | USDZ file backing a reference object |
| `ARFrame.metadataObjects` | `AVMetadataObject`s detected in the frame (`API_UNAVAILABLE(visionos)`) |
| `ARFaceTrackingConfiguration.environmentTexturingEnabled` | Environment texturing during face tracking |

---

## Part 11: Low-Level Renderer (`OS27`, not watchOS)

RealityKit's renderer decoupled from `Entity` and `RealityView`, driven from **your** `MTLCommandBuffer`. Apple: "You are responsible for creating and committing the Metal command buffer; the renderer only encodes into it." It still handles camera constants, per-instance transforms, MSAA resolve, tone mapping, and color-gamut conversion.

**This is not Part 9's `RealityRenderer`.** `RealityRenderer` takes an entity list and renders it for you (`updateAndRender(deltaTime:cameraOutput:)`). `LowLevelRenderer` has no entities at all — you build mesh/material/buffer *resources* and submit draws inside a render callback. Pick Part 9 when you want RealityKit's scene graph rendered into a texture; pick Part 11 when you have your own renderer and want RealityKit's shading in it.

### The import rule (governs all four new submodules)

`RealityCoreRenderer`, `ShaderGraph`, `RealityCoreDeformation`, and `RealityCoreTextureProcessing` live in `System/Library/SubFrameworks/` and are re-exported from RealityKit. **A direct import is a hard compile error**: `"…is an implementation detail of 'RealityKit'; import 'RealityKit' instead"`. Reach all four through `import RealityKit`.

Do not generalize this to `ComputeGraph` — that one *is* a real top-level framework and `import ComputeGraph` is correct.

### Type catalog

| Theme | Types |
|---|---|
| Frame loop | `LowLevelRenderer` (`.output`, `.cameras`, `.time`, `.colorMatch`, `render(using:_:)`), `Configuration`, `Camera` / `CameraArray`, `RenderState` (`~Copyable, ~Escapable`; exposes `MTLRenderCommandEncoder`) |
| Resource context | `LowLevelRenderContext` (protocol), `…Standalone`, `…Lighting`, `…ShaderGraph` (bridges the ShaderGraph module) |
| Resources | `LowLevelMeshResource` (custom vertex formats), `LowLevelTextureResource`, `LowLevelBufferResource`, `LowLevelBufferSlice`, `LowLevelInstanceTransformResource` |
| Materials | `LowLevelMaterialResource` = `GeometryModifier` + `SurfaceShader` + `LightingFunction`; `LowLevelArgumentTable`, `LowLevelMaterialParameterMapping` |
| Pipeline / targets | `LowLevelRenderPipelineState` (compiled once, async, immutable), `LowLevelRenderTarget.Descriptor` |
| Draw submission | `LowLevelMeshPart` → `LowLevelMeshInstance` → `LowLevelMeshInstanceArray` |
| Cull / sort | `BoundingSphereBox`, `LowLevelRenderer.cullMeshInstances(…)`, `LowLevelRenderer.sortMeshInstances(…)` |

### Frame shape

```swift
import RealityKit

@available(iOS 27, macOS 27, visionOS 27, tvOS 27, *)
func drawFrame(_ renderer: LowLevelRenderer,
               _ commandBuffer: MTLCommandBuffer,
               colorTexture: MTLTexture) {
    renderer.output.color = .init(texture: colorTexture)
    renderer.time = Float(CACurrentMediaTime())   // .time is Float, not Double

    renderer.render(using: commandBuffer) { state in
        state.render(meshInstancesArrayIndex: 0, meshInstanceIndex: 0)
    }
    // You commit the command buffer. The renderer never does.
}
```

### Naming-collision trap

The 26-era types and the 27 renderer resources coexist in one file under `import RealityKit`, with near-identical names and unrelated purposes. The 26 types are entity-attached procedural geometry; the 27 `*Resource` types belong to the standalone renderer.

| 26-era (RealityFoundation) | 27 (RealityCoreRenderer) |
|---|---|
| `LowLevelMesh` | `LowLevelMeshResource` |
| `LowLevelTexture` | `LowLevelTextureResource` |
| `LowLevelBuffer` | `LowLevelBufferResource` |
| `LowLevelInstanceData` | `LowLevelInstanceTransformResource` |

Autocomplete will happily offer the wrong one. Two reliable tells: the 26-era types are `@MainActor` classes that bridge to resources (`MeshResource.init(from: LowLevelMesh)`, `.lowLevelMesh`), while every 27 `*Resource` is minted from a `LowLevelRenderContext` (for example `makeInstanceTransformResource(instanceCapacity:)`). If you are constructing it from a render context, it is the 27 API.

### Semantics worth knowing

- GPU instancing composes transforms as `meshInstance.transform * instanceTransforms[i]` — final world transform, in that order.
- `LowLevelRenderPipelineState` compiles once, asynchronously, and is immutable. Hoist it out of the frame loop.
- `Camera.Projection.perspective(…)` defaults to `reverseZ: true`. Match your depth comparison to it.
- `RenderState` is `~Copyable, ~Escapable` — it cannot outlive the render callback. Do not stash it.

Availability: macOS/macCatalyst/iOS/visionOS/tvOS 27, with no `unavailable` clauses (RealityKit does not ship on watchOS).

---

## Resources

**WWDC**: 2019-603, 2019-605, 2021-10074, 2022-10074, 2023-10080, 2024-10103, 2024-10153, 2026-279

**Docs**: /realitykit, /realitykit/entity, /realitykit/component, /realitykit/system, /realitykit/realityview, /realitykit/model3d, /realitykit/modelentity, /realitykit/anchorentity, /realitykit/physicallybasedmaterial, /computegraph

**Skills**: axiom-graphics (skills/realitykit.md), axiom-graphics (skills/realitykit-diag.md), axiom-graphics (skills/usdkit.md), axiom-graphics (skills/scenekit-ref.md)
