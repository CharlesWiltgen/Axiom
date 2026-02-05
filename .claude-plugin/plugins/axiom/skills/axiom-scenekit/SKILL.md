---
name: axiom-scenekit
description: Use when working with SceneKit 3D scenes, migrating SceneKit to RealityKit, or maintaining legacy SceneKit code. Covers scene graph, materials, physics, animation, SwiftUI bridge, migration decision tree.
license: MIT
metadata:
  version: "1.0.0"
---

# SceneKit Development Guide

**Purpose**: Maintain existing SceneKit code safely and plan migration to RealityKit
**iOS Version**: iOS 8+ (SceneKit), deprecated iOS 26+
**Xcode**: Xcode 15+

## When to Use This Skill

Use this skill when:
- Maintaining existing SceneKit code
- Building a SceneKit prototype (with awareness of deprecation)
- Planning migration from SceneKit to RealityKit
- Debugging SceneKit rendering, physics, or animation issues
- Integrating SceneKit content with SwiftUI
- Loading 3D models via Model I/O or SCNSceneSource

Do NOT use this skill for:
- New 3D projects (use `axiom-realitykit`)
- AR experiences (use `axiom-realitykit`)
- visionOS development (use `axiom-realitykit`)
- SpriteKit 2D games (`axiom-spritekit`)
- Metal shader programming (`axiom-metal-migration-ref`)

---

## Deprecation Context

SceneKit is **soft-deprecated as of iOS 26** (WWDC 2025). This means:
- Existing apps continue to work
- No new features or general bug fixes
- Only critical security patches
- `SceneView` (SwiftUI) is formally deprecated in iOS 26

**Apple's forward path is RealityKit.** All new 3D projects should use RealityKit. SceneKit knowledge remains valuable for maintaining legacy code and understanding concepts during migration.

**In RealityKit**: ECS architecture replaces scene graph. See `axiom-scenekit-ref` for the complete concept mapping table.

---

## 1. Mental Model

### Scene Graph Architecture

SceneKit uses a **tree of nodes** (SCNNode) attached to a root node in an SCNScene. Each node has a transform (position, rotation, scale) relative to its parent.

```
SCNScene
└── rootNode
    ├── cameraNode (SCNCamera)
    ├── lightNode (SCNLight)
    ├── playerNode (SCNGeometry + SCNPhysicsBody)
    │   ├── weaponNode
    │   └── particleNode (SCNParticleSystem)
    └── environmentNode
        ├── groundNode
        └── wallNodes
```

**In RealityKit**: Entities replace nodes. Components replace node properties. The hierarchy concept persists, but behavior is driven by Systems rather than node callbacks.

### Coordinate System

SceneKit uses a **right-handed Y-up** coordinate system:

```
     +Y (up)
      |
      |
      +──── +X (right)
     /
    /
  +Z (toward viewer)
```

This matches RealityKit's coordinate system, so spatial concepts transfer directly during migration.

### Transform Hierarchy

Transforms cascade parent → child. A child's world transform = parent's world transform × child's local transform.

```swift
let parent = SCNNode()
parent.position = SCNVector3(10, 0, 0)

let child = SCNNode()
child.position = SCNVector3(0, 5, 0)
parent.addChildNode(child)

// child.worldPosition = (10, 5, 0)
// child.position (local) = (0, 5, 0)
```

**In RealityKit**: Same concept. `entity.position` is local, `entity.position(relativeTo: nil)` gives world position.

---

## 2. Scene Setup and Rendering

### SCNView (UIKit)

```swift
let sceneView = SCNView(frame: view.bounds)
sceneView.scene = SCNScene(named: "scene.scn")
sceneView.allowsCameraControl = true
sceneView.showsStatistics = true
sceneView.backgroundColor = .black
view.addSubview(sceneView)
```

### SceneView (SwiftUI) — Deprecated iOS 26

```swift
// Still works but deprecated. Use SCNViewRepresentable for new code.
import SceneKit

SceneView(
    scene: scene,
    pointOfView: cameraNode,
    options: [.allowsCameraControl, .autoenablesDefaultLighting]
)
```

### SCNViewRepresentable (SwiftUI replacement)

```swift
struct SceneKitView: UIViewRepresentable {
    let scene: SCNScene

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = scene
        view.allowsCameraControl = true
        view.autoenablesDefaultLighting = true
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}
}
```

**In RealityKit**: Use `RealityView` in SwiftUI — no UIViewRepresentable needed.

---

## 3. Geometry and Materials

### Built-in Geometries

```swift
let box = SCNBox(width: 1, height: 1, length: 1, chamferRadius: 0.1)
let sphere = SCNSphere(radius: 0.5)
let cylinder = SCNCylinder(radius: 0.3, height: 1)
let plane = SCNPlane(width: 2, height: 2)
let torus = SCNTorus(ringRadius: 1, pipeRadius: 0.3)
let capsule = SCNCapsule(capRadius: 0.3, height: 1)
let cone = SCNCone(topRadius: 0, bottomRadius: 0.5, height: 1)
let tube = SCNTube(innerRadius: 0.3, outerRadius: 0.5, height: 1)
let text = SCNText(string: "Hello", extrusionDepth: 0.2)
```

### PBR Materials

```swift
let material = SCNMaterial()
material.lightingModel = .physicallyBased
material.diffuse.contents = UIColor.red          // or UIImage
material.metalness.contents = 0.8
material.roughness.contents = 0.2
material.normal.contents = UIImage(named: "normal_map")
material.ambientOcclusion.contents = UIImage(named: "ao_map")

let node = SCNNode(geometry: sphere)
node.geometry?.firstMaterial = material
```

**In RealityKit**: Use `PhysicallyBasedMaterial` with similar properties but different API surface. See `axiom-scenekit-ref` Part 1 for the mapping.

### Shader Modifiers

SceneKit supports GLSL/Metal shader snippets injected at specific entry points:

```swift
// Fragment modifier — custom effect on surface
material.shaderModifiers = [
    .fragment: """
    float stripe = sin(_surface.position.x * 20.0);
    _output.color.rgb *= step(0.0, stripe);
    """
]
```

Entry points: `.geometry`, `.surface`, `.lightingModel`, `.fragment`

**In RealityKit**: Use `ShaderGraphMaterial` with Reality Composer Pro, or `CustomMaterial` with Metal functions.

---

## 4. Lighting

### Light Types

| Type | Description | Shadows |
|------|-------------|---------|
| `.omni` | Point light, radiates in all directions | No |
| `.directional` | Parallel rays (sun) | Yes |
| `.spot` | Cone-shaped beam | Yes |
| `.area` | Rectangle emitter (soft shadows) | Yes |
| `.IES` | Real-world light profile | Yes |
| `.ambient` | Uniform, no direction | No |
| `.probe` | Environment lighting from cubemap | No |

```swift
let light = SCNLight()
light.type = .directional
light.intensity = 1000
light.castsShadow = true
light.shadowRadius = 3
light.shadowSampleCount = 8

let lightNode = SCNNode()
lightNode.light = light
lightNode.eulerAngles = SCNVector3(-Float.pi / 4, 0, 0)
scene.rootNode.addChildNode(lightNode)
```

**In RealityKit**: Use `DirectionalLightComponent`, `PointLightComponent`, `SpotLightComponent` as components on entities. Image-based lighting via `EnvironmentResource`.

---

## 5. Animation

### SCNAction (Declarative)

```swift
let moveUp = SCNAction.moveBy(x: 0, y: 2, z: 0, duration: 1)
let fadeOut = SCNAction.fadeOut(duration: 0.5)
let sequence = SCNAction.sequence([moveUp, fadeOut])
let forever = SCNAction.repeatForever(moveUp.reversed())
node.runAction(sequence)
```

### Implicit Animation (SCNTransaction)

```swift
SCNTransaction.begin()
SCNTransaction.animationDuration = 0.5
node.position = SCNVector3(0, 5, 0)
node.opacity = 0.5
SCNTransaction.commit()
```

### Explicit Animation (CAAnimation bridge)

```swift
let animation = CABasicAnimation(keyPath: "rotation")
animation.toValue = NSValue(scnVector4: SCNVector4(0, 1, 0, Float.pi * 2))
animation.duration = 2
animation.repeatCount = .infinity
node.addAnimation(animation, forKey: "spin")
```

### Loading Animations from Files

```swift
let scene = SCNScene(named: "character.dae")!
let animationPlayer = scene.rootNode
    .childNode(withName: "mixamorig:Hips", recursively: true)!
    .animationPlayer(forKey: nil)!

characterNode.addAnimationPlayer(animationPlayer, forKey: "walk")
animationPlayer.play()
```

**In RealityKit**: Use `entity.playAnimation()` with animations loaded from USD files. Transform animations via `entity.move(to:relativeTo:duration:)`.

---

## 6. Physics

### Physics Bodies

```swift
// Dynamic — simulation controls position
node.physicsBody = SCNPhysicsBody(type: .dynamic,
    shape: SCNPhysicsShape(geometry: node.geometry!, options: nil))

// Static — immovable collision surface
ground.physicsBody = SCNPhysicsBody(type: .static, shape: nil)

// Kinematic — code controls position, participates in collisions
platform.physicsBody = SCNPhysicsBody(type: .kinematic, shape: nil)
```

### Collision Categories

```swift
struct PhysicsCategory {
    static let player:    Int = 1 << 0   // 1
    static let enemy:     Int = 1 << 1   // 2
    static let projectile: Int = 1 << 2  // 4
    static let wall:      Int = 1 << 3   // 8
}

playerNode.physicsBody?.categoryBitMask = PhysicsCategory.player
playerNode.physicsBody?.collisionBitMask = PhysicsCategory.wall | PhysicsCategory.enemy
playerNode.physicsBody?.contactTestBitMask = PhysicsCategory.enemy | PhysicsCategory.projectile
```

### Contact Delegate

```swift
class GameScene: SCNScene, SCNPhysicsContactDelegate {
    func setupPhysics() {
        physicsWorld.contactDelegate = self
    }

    func physicsWorld(_ world: SCNPhysicsWorld,
                      didBegin contact: SCNPhysicsContact) {
        let nodeA = contact.nodeA
        let nodeB = contact.nodeB
        // Handle collision
    }
}
```

**In RealityKit**: Use `PhysicsBodyComponent`, `CollisionComponent`, and collision event subscriptions via `scene.subscribe(to: CollisionEvents.Began.self)`.

---

## 7. Hit Testing and Interaction

```swift
// In SCNView tap handler
let results = sceneView.hitTest(tapLocation, options: [
    .searchMode: SCNHitTestSearchMode.closest.rawValue,
    .boundingBoxOnly: false
])

if let hit = results.first {
    let tappedNode = hit.node
    let worldPosition = hit.worldCoordinates
}
```

**In RealityKit**: Use `ManipulationComponent` for drag/rotate/scale gestures, or collision-based hit testing.

---

## 8. Asset Pipeline

### Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| USD/USDZ | `.usdz`, `.usda`, `.usdc` | Preferred format, works in both SceneKit and RealityKit |
| Collada | `.dae` | Legacy, still supported |
| SceneKit Archive | `.scn` | Xcode-specific, not portable to RealityKit |
| Wavefront OBJ | `.obj` | Geometry only, no animations |
| Alembic | `.abc` | Animation baking |

### Loading Models

```swift
// From bundle
let scene = SCNScene(named: "model.usdz")!

// From URL
let scene = try SCNScene(url: modelURL, options: nil)

// Via Model I/O (for format conversion)
let asset = MDLAsset(url: modelURL)
let scene = SCNScene(mdlAsset: asset)
```

**Migration tip**: Convert `.scn` files to `.usdz` using `xcrun scntool --convert file.scn --format usdz` before migrating to RealityKit.

---

## 9. ARKit Integration (Legacy)

```swift
// ARSCNView — SceneKit + ARKit (legacy approach)
let arView = ARSCNView(frame: view.bounds)
arView.delegate = self
arView.session.run(ARWorldTrackingConfiguration())

// Adding virtual content at anchors
func renderer(_ renderer: SCNSceneRenderer,
              didAdd node: SCNNode, for anchor: ARAnchor) {
    let box = SCNBox(width: 0.1, height: 0.1, length: 0.1, chamferRadius: 0)
    node.addChildNode(SCNNode(geometry: box))
}
```

**In RealityKit**: Use `RealityView` with `AnchorEntity` types. ARSCNView is legacy — all new AR development should use RealityKit.

---

## 10. Anti-Patterns

### Anti-Pattern 1: Starting New Projects in SceneKit

**Time cost**: Weeks of rework when you eventually must migrate

SceneKit is deprecated. New projects should use RealityKit from the start, even if the learning curve is steeper initially.

### Anti-Pattern 2: Using .scn Files Without USDZ Conversion

**Time cost**: Hours when migration begins

`.scn` files are SceneKit-specific and cannot be loaded in RealityKit. Convert early:
```bash
xcrun scntool --convert model.scn --format usdz --output model.usdz
```

### Anti-Pattern 3: Deep Shader Modifier Customization

**Time cost**: Complete rewrite during migration

SceneKit shader modifiers use a proprietary entry-point system. Heavy investment here has zero portability to RealityKit's `ShaderGraphMaterial`.

### Anti-Pattern 4: Relying on SCNRenderer for Custom Pipelines

**Time cost**: Architecture redesign during migration

If you need custom render pipelines, build on Metal directly or use `RealityRenderer` (RealityKit's Metal-level API).

### Anti-Pattern 5: Ignoring Deprecation Warnings

**Time cost**: Surprise breakage when Apple removes APIs

Track `SceneView` deprecation warnings and plan UIViewRepresentable fallback or RealityKit migration.

---

## 11. Migration Decision Tree

```
Should you migrate to RealityKit?
│
├─ Is this a new project?
│   └─ YES → Use RealityKit from the start. No question.
│
├─ Does the app need AR features?
│   └─ YES → Migrate. ARSCNView is legacy, RealityKit is the only forward path.
│
├─ Does the app target visionOS?
│   └─ YES → Must migrate. SceneKit doesn't support visionOS spatial features.
│
├─ Is the codebase heavily invested in SceneKit?
│   ├─ YES, and app is stable → Maintain in SceneKit for now, plan phased migration.
│   └─ YES, but needs new features → Migrate incrementally (new features in RealityKit).
│
├─ Is performance a concern?
│   └─ YES → RealityKit is optimized for Apple Silicon with Metal-first rendering.
│
└─ Is the app in maintenance mode?
    └─ YES → Keep SceneKit until critical. Security patches will continue.
```

---

## 12. Pressure Scenarios

### Scenario 1: "Just Use SceneKit, It Works Fine"

**Pressure**: Team familiarity with SceneKit, deadline to ship

**Wrong approach**: Start new project in SceneKit because the team knows it.

**Correct approach**: Invest in RealityKit learning. SceneKit will receive no new features. The longer you wait, the larger the migration debt.

**Push-back template**: "SceneKit is deprecated as of iOS 26. Starting new work in it creates migration debt that grows with every feature we add. RealityKit's ECS model is different but learnable — let's invest the time now."

### Scenario 2: "We Don't Have Time to Learn RealityKit"

**Pressure**: Tight deadline, team unfamiliar with ECS

**Wrong approach**: Build everything in SceneKit to meet the deadline.

**Correct approach**: Build the prototype in SceneKit if necessary, but document every SceneKit dependency and plan the migration. Use USDZ assets from the start so they're portable.

**Push-back template**: "Let's use USDZ assets and keep the SceneKit layer thin. When we migrate, the assets transfer directly and only the code layer changes."

### Scenario 3: "Port Everything At Once"

**Pressure**: Desire for a clean migration

**Wrong approach**: Attempt to rewrite the entire SceneKit codebase in RealityKit at once.

**Correct approach**: Migrate incrementally. New features in RealityKit. Existing SceneKit code stays until it needs changes. Modularize with Swift packages (per Apple's migration guide).

**Push-back template**: "Apple's own migration guide recommends modularizing into Swift packages and migrating system by system. A big-bang rewrite risks introducing new bugs across the entire app."

---

## Code Review Checklist

- [ ] No new SceneKit code in projects targeting iOS 26+ without migration plan
- [ ] Assets in USDZ format (not .scn) for portability
- [ ] No deep shader modifier customization without RealityKit equivalent identified
- [ ] SCNTransaction used for implicit animations (not direct property changes without animation context)
- [ ] Physics categoryBitMask explicitly set (not relying on defaults)
- [ ] Contact delegate set and protocol conformance added
- [ ] `[weak self]` in completion handlers and closures
- [ ] Debug overlays enabled during development (`showsStatistics = true`)

---

## Resources

**WWDC**: 2014-609, 2014-610, 2017-604, 2019-612

**Docs**: /scenekit, /scenekit/scnscene, /scenekit/scnnode, /scenekit/scnmaterial, /scenekit/scnphysicsbody

**Skills**: axiom-scenekit-ref, axiom-realitykit, axiom-realitykit-ref
