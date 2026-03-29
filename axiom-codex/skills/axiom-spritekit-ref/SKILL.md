---
name: axiom-spritekit-ref
description: SpriteKit API reference — all node types, physics body creation, action catalog, texture atlases, constraints, scene setup, particles, SKRenderer
license: MIT
compatibility: [iOS 13+, macOS 10.15+, tvOS 13+, watchOS 6+]
metadata:
  version: "1.0.0"
---

# SpriteKit API Reference

Complete API reference for SpriteKit organized by category.

## When to Use This Reference

Use this reference when:
- Looking up specific SpriteKit API signatures or properties
- Checking which node types are available and their performance characteristics
- Finding the right physics body creation method
- Browsing the complete action catalog
- Configuring SKView, scale modes, or transitions
- Setting up particle emitter properties
- Working with SKRenderer or SKShader

## Part 1: Node Hierarchy

### All Node Types

| Node | Purpose | Batches? | Performance Notes |
|------|---------|----------|-------------------|
| `SKNode` | Container, grouping | N/A | Zero rendering cost |
| `SKSpriteNode` | Textured sprites | Yes (same atlas) | Primary gameplay node |
| `SKShapeNode` | Vector paths | **No** | 1 draw call each — avoid in gameplay |
| `SKLabelNode` | Text rendering | No | 1 draw call each |
| `SKEmitterNode` | Particle systems | N/A | GPU-bound, limit birth rate |
| `SKCameraNode` | Viewport control | N/A | Attach HUD as children |
| `SKEffectNode` | Core Image filters | No | Expensive — cache with `shouldRasterize` |
| `SKCropNode` | Masking | No | Mask + content = 2+ draw calls |
| `SKTileMapNode` | Tile-based maps | Yes (same tileset) | Efficient for large maps |
| `SKVideoNode` | Video playback | No | Uses AVPlayer |
| `SK3DNode` | SceneKit content | No | Renders SceneKit scene |
| `SKReferenceNode` | Reusable .sks files | N/A | Loads archive at runtime |
| `SKLightNode` | Per-pixel lighting | N/A | Limits: 8 lights per scene |
| `SKFieldNode` | Physics fields | N/A | Gravity, electric, magnetic, etc. |
| `SKAudioNode` | Positional audio | N/A | Uses AVAudioEngine |
| `SKTransformNode` | 3D rotation wrapper | N/A | xRotation, yRotation for perspective |

### SKSpriteNode Properties

```swift
// Creation
SKSpriteNode(imageNamed: "player")           // From asset catalog
SKSpriteNode(texture: texture)                // From SKTexture
SKSpriteNode(texture: texture, size: size)    // Custom size
SKSpriteNode(color: .red, size: CGSize(width: 50, height: 50))  // Solid color

// Key properties
sprite.anchorPoint = CGPoint(x: 0.5, y: 0)   // Bottom-center
sprite.colorBlendFactor = 0.5                  // Tint strength (0-1)
sprite.color = .red                            // Tint color
sprite.normalTexture = normalMap               // For lighting
sprite.lightingBitMask = 0x1                   // Which lights affect this
sprite.shadowCastBitMask = 0x1                 // Which lights cast shadows
sprite.shader = customShader                   // Per-pixel effects
```

### SKLabelNode Properties

```swift
let label = SKLabelNode(text: "Score: 0")
label.fontName = "AvenirNext-Bold"
label.fontSize = 24
label.fontColor = .white
label.horizontalAlignmentMode = .left
label.verticalAlignmentMode = .top
label.numberOfLines = 0          // Multi-line (iOS 11+)
label.preferredMaxLayoutWidth = 200
label.lineBreakMode = .byWordWrapping
```

---

## Part 2: Physics API

### SKPhysicsBody Creation

```swift
// Volume bodies (have mass, respond to forces)
SKPhysicsBody(circleOfRadius: 20)                    // Cheapest
SKPhysicsBody(rectangleOf: CGSize(width: 40, height: 60))
SKPhysicsBody(polygonFrom: path)                     // Convex only
SKPhysicsBody(texture: texture, size: size)          // Pixel-perfect (expensive)
SKPhysicsBody(texture: texture, alphaThreshold: 0.5, size: size)
SKPhysicsBody(bodies: [body1, body2])                // Compound

// Edge bodies (massless boundaries)
SKPhysicsBody(edgeLoopFrom: rect)                    // Rectangle boundary
SKPhysicsBody(edgeLoopFrom: path)                    // Path boundary
SKPhysicsBody(edgeFrom: pointA, to: pointB)          // Single edge
SKPhysicsBody(edgeChainFrom: path)                   // Open path
```

### Physics Body Properties

```swift
// Identity
body.categoryBitMask = 0x1          // What this body IS
body.collisionBitMask = 0x2         // What it bounces off
body.contactTestBitMask = 0x4       // What triggers didBegin/didEnd

// Physical characteristics
body.mass = 1.0                     // kg
body.density = 1.0                  // kg/m^2 (auto-calculates mass)
body.friction = 0.2                 // 0.0 (ice) to 1.0 (rubber)
body.restitution = 0.3              // 0.0 (no bounce) to 1.0 (perfect bounce)
body.linearDamping = 0.1            // Air resistance (0 = none)
body.angularDamping = 0.1           // Rotational damping

// Behavior
body.isDynamic = true               // Responds to forces
body.affectedByGravity = true       // Subject to world gravity
body.allowsRotation = true          // Can rotate from physics
body.pinned = false                 // Pinned to parent position
body.usesPreciseCollisionDetection = false  // For fast objects

// Motion (read/write)
body.velocity = CGVector(dx: 100, dy: 0)
body.angularVelocity = 0.0

// Force application
body.applyForce(CGVector(dx: 0, dy: 100))           // Continuous
body.applyImpulse(CGVector(dx: 0, dy: 50))          // Instant
body.applyTorque(0.5)                                 // Continuous rotation
body.applyAngularImpulse(1.0)                         // Instant rotation
body.applyForce(CGVector(dx: 10, dy: 0), at: point)  // Force at point
```

### SKPhysicsWorld

```swift
scene.physicsWorld.gravity = CGVector(dx: 0, dy: -9.8)
scene.physicsWorld.speed = 1.0        // 0 = paused, 2 = double speed
scene.physicsWorld.contactDelegate = self

// Ray casting
let body = scene.physicsWorld.body(at: point)
let bodyInRect = scene.physicsWorld.body(in: rect)
scene.physicsWorld.enumerateBodies(alongRayStart: start, end: end) { body, point, normal, stop in
    // Process each body the ray intersects
}
```

### Physics Joints

```swift
// Pin joint (pivot)
let pin = SKPhysicsJointPin.joint(
    withBodyA: bodyA, bodyB: bodyB,
    anchor: anchorPoint
)

// Fixed joint (rigid connection)
let fixed = SKPhysicsJointFixed.joint(
    withBodyA: bodyA, bodyB: bodyB,
    anchor: anchorPoint
)

// Spring joint
let spring = SKPhysicsJointSpring.joint(
    withBodyA: bodyA, bodyB: bodyB,
    anchorA: pointA, anchorB: pointB
)
spring.frequency = 1.0    // Oscillations per second
spring.damping = 0.5       // 0 = no damping

// Sliding joint (linear constraint)
let slide = SKPhysicsJointSliding.joint(
    withBodyA: bodyA, bodyB: bodyB,
    anchor: point, axis: CGVector(dx: 1, dy: 0)
)

// Limit joint (distance constraint)
let limit = SKPhysicsJointLimit.joint(
    withBodyA: bodyA, bodyB: bodyB,
    anchorA: pointA, anchorB: pointB
)

// Add joint to world
scene.physicsWorld.add(joint)
// Remove: scene.physicsWorld.remove(joint)
```

### Physics Fields

```swift
// Gravity (directional)
let gravity = SKFieldNode.linearGravityField(withVector: vector_float3(0, -9.8, 0))

// Radial gravity (toward/away from point)
let radial = SKFieldNode.radialGravityField()
radial.strength = 5.0

// Electric field (charge-dependent)
let electric = SKFieldNode.electricField()

// Noise field (turbulence)
let noise = SKFieldNode.noiseField(withSmoothness: 0.5, animationSpeed: 1.0)

// Vortex
let vortex = SKFieldNode.vortexField()

// Drag
let drag = SKFieldNode.dragField()

// All fields share:
field.region = SKRegion(radius: 100)     // Area of effect
field.strength = 1.0                      // Intensity
field.falloff = 0.0                       // Distance falloff
field.minimumRadius = 10                  // Inner dead zone
field.isEnabled = true
field.categoryBitMask = 0xFFFFFFFF        // Which bodies affected
```

---

## Part 3: Action Catalog

### Movement

```swift
SKAction.move(to: point, duration: 1.0)
SKAction.move(by: CGVector(dx: 100, dy: 0), duration: 0.5)
SKAction.moveTo(x: 200, duration: 1.0)
SKAction.moveTo(y: 300, duration: 1.0)
SKAction.moveBy(x: 50, y: 0, duration: 0.5)
SKAction.follow(path, asOffset: true, orientToPath: true, duration: 2.0)
```

### Rotation

```swift
SKAction.rotate(byAngle: .pi, duration: 1.0)        // Relative
SKAction.rotate(toAngle: .pi / 2, duration: 0.5)    // Absolute
SKAction.rotate(toAngle: angle, duration: 0.5, shortestUnitArc: true)
```

### Scaling

```swift
SKAction.scale(to: 2.0, duration: 0.5)
SKAction.scale(by: 1.5, duration: 0.3)
SKAction.scaleX(to: 2.0, y: 1.0, duration: 0.5)
SKAction.resize(toWidth: 100, height: 50, duration: 0.5)
```

### Fading

```swift
SKAction.fadeIn(withDuration: 0.5)
SKAction.fadeOut(withDuration: 0.5)
SKAction.fadeAlpha(to: 0.5, duration: 0.3)
SKAction.fadeAlpha(by: -0.2, duration: 0.3)
```

### Composition

```swift
SKAction.sequence([action1, action2, action3])       // Sequential
SKAction.group([action1, action2])                    // Parallel
SKAction.repeat(action, count: 5)                     // Finite repeat
SKAction.repeatForever(action)                         // Infinite
action.reversed()                                      // Reverse
SKAction.wait(forDuration: 1.0)                       // Delay
SKAction.wait(forDuration: 1.0, withRange: 0.5)      // Random delay
```

### Texture & Color

```swift
SKAction.setTexture(texture)
SKAction.setTexture(texture, resize: true)
SKAction.animate(with: [tex1, tex2, tex3], timePerFrame: 0.1)
SKAction.animate(with: textures, timePerFrame: 0.1, resize: false, restore: true)
SKAction.colorize(with: .red, colorBlendFactor: 1.0, duration: 0.5)
SKAction.colorize(withColorBlendFactor: 0, duration: 0.5)
```

### Sound

```swift
SKAction.playSoundFileNamed("explosion.wav", waitForCompletion: false)
```

### Node Tree

```swift
SKAction.removeFromParent()
SKAction.run(block)
SKAction.run(block, queue: .main)
SKAction.customAction(withDuration: 1.0) { node, elapsed in
    // Custom per-frame logic
}
```

### Physics

```swift
SKAction.applyForce(CGVector(dx: 0, dy: 100), duration: 0.5)
SKAction.applyImpulse(CGVector(dx: 50, dy: 0), duration: 1.0/60.0)  // ~1 frame
SKAction.applyTorque(0.5, duration: 1.0)
SKAction.changeCharge(to: 1.0, duration: 0.5)
SKAction.changeMass(to: 2.0, duration: 0.5)
```

### Timing Modes

```swift
action.timingMode = .linear          // Constant speed
action.timingMode = .easeIn          // Slow → fast
action.timingMode = .easeOut         // Fast → slow
action.timingMode = .easeInEaseOut   // Slow → fast → slow

action.speed = 2.0                   // 2x speed
```

---

## Part 4: Textures and Atlases

### SKTexture

```swift
// From image
let tex = SKTexture(imageNamed: "player")

// From atlas
let atlas = SKTextureAtlas(named: "Characters")
let tex = atlas.textureNamed("player_run_1")

// Subrectangle (for manual sprite sheets)
let sub = SKTexture(rect: CGRect(x: 0, y: 0, width: 0.25, height: 0.5), in: sheetTexture)

// From CGImage
let tex = SKTexture(cgImage: cgImage)

// Filtering
tex.filteringMode = .nearest    // Pixel art (no smoothing)
tex.filteringMode = .linear     // Smooth scaling (default)

// Preload
SKTexture.preload([tex1, tex2]) { /* Ready */ }
```

### SKTextureAtlas

```swift
// Create in Xcode: Assets.xcassets → New Sprite Atlas
// Or .atlas folder in project bundle

let atlas = SKTextureAtlas(named: "Characters")
let textureNames = atlas.textureNames  // All texture names in atlas

// Preload entire atlas
atlas.preload { /* Atlas ready */ }

// Preload multiple atlases
SKTextureAtlas.preloadTextureAtlases([atlas1, atlas2]) { /* All ready */ }

// Animation from atlas
let frames = (1...8).map { atlas.textureNamed("run_\($0)") }
let animate = SKAction.animate(with: frames, timePerFrame: 0.1)
```

---

## Part 5: Constraints

```swift
// Orient toward another node
let orient = SKConstraint.orient(to: targetNode, offset: SKRange(constantValue: 0))

// Orient toward a point
let orient = SKConstraint.orient(to: point, offset: SKRange(constantValue: 0))

// Position constraint (keep X in range)
let xRange = SKConstraint.positionX(SKRange(lowerLimit: 0, upperLimit: 400))

// Position constraint (keep Y in range)
let yRange = SKConstraint.positionY(SKRange(lowerLimit: 50, upperLimit: 750))

// Distance constraint (stay within range of node)
let dist = SKConstraint.distance(SKRange(lowerLimit: 50, upperLimit: 200), to: targetNode)

// Rotation constraint
let rot = SKConstraint.zRotation(SKRange(lowerLimit: -.pi/4, upperLimit: .pi/4))

// Apply constraints (processed in order)
node.constraints = [orient, xRange, yRange]

// Toggle
node.constraints?.first?.isEnabled = false
```

### SKRange

```swift
SKRange(constantValue: 100)                    // Exactly 100
SKRange(lowerLimit: 50, upperLimit: 200)       // 50...200
SKRange(lowerLimit: 0)                          // >= 0
SKRange(upperLimit: 500)                        // <= 500
SKRange(value: 100, variance: 20)              // 80...120
```

---

## Part 6: Scene Setup

### SKView Configuration

```swift
let skView = SKView(frame: view.bounds)

// Debug overlays
skView.showsFPS = true
skView.showsNodeCount = true
skView.showsDrawCount = true
skView.showsPhysics = true
skView.showsFields = true
skView.showsQuadCount = true

// Performance
skView.ignoresSiblingOrder = true        // Enables batching optimizations
skView.shouldCullNonVisibleNodes = true  // Auto-hide offscreen (manual is faster)
skView.isAsynchronous = true             // Default: renders asynchronously
skView.allowsTransparency = false        // Opaque is faster

// Frame rate
skView.preferredFramesPerSecond = 60     // Or 120 for ProMotion

// Present scene
skView.presentScene(scene)
skView.presentScene(scene, transition: .fade(withDuration: 0.5))
```

### Scale Mode Matrix

| Mode | Aspect Ratio | Content | Best For |
|------|-------------|---------|----------|
| `.aspectFill` | Preserved | Fills view, crops edges | Most games |
| `.aspectFit` | Preserved | Fits in view, letterboxes | Exact layout needed |
| `.resizeFill` | Distorted | Stretches to fill | Almost never |
| `.fill` | Varies | Scene resizes to match view | Adaptive scenes |

### SKTransition Types

```swift
SKTransition.fade(withDuration: 0.5)
SKTransition.fade(with: .black, duration: 0.5)
SKTransition.crossFade(withDuration: 0.5)
SKTransition.flipHorizontal(withDuration: 0.5)
SKTransition.flipVertical(withDuration: 0.5)
SKTransition.reveal(with: .left, duration: 0.5)
SKTransition.moveIn(with: .right, duration: 0.5)
SKTransition.push(with: .up, duration: 0.5)
SKTransition.doorway(withDuration: 0.5)
SKTransition.doorsOpenHorizontal(withDuration: 0.5)
SKTransition.doorsOpenVertical(withDuration: 0.5)
SKTransition.doorsCloseHorizontal(withDuration: 0.5)
SKTransition.doorsCloseVertical(withDuration: 0.5)
// Custom with CIFilter:
SKTransition(ciFilter: filter, duration: 0.5)
```

---

## Part 7: Particles

### SKEmitterNode Key Properties

```swift
let emitter = SKEmitterNode(fileNamed: "Spark")!

// Emission control
emitter.particleBirthRate = 100          // Particles per second
emitter.numParticlesToEmit = 0           // 0 = infinite
emitter.particleLifetime = 2.0           // Seconds
emitter.particleLifetimeRange = 0.5      // ± random

// Position
emitter.particlePosition = .zero
emitter.particlePositionRange = CGVector(dx: 10, dy: 10)

// Movement
emitter.emissionAngle = .pi / 2         // Direction (radians)
emitter.emissionAngleRange = .pi / 4    // Spread
emitter.particleSpeed = 100              // Points per second
emitter.particleSpeedRange = 50          // ± random
emitter.xAcceleration = 0
emitter.yAcceleration = -100             // Gravity-like

// Appearance
emitter.particleTexture = SKTexture(imageNamed: "spark")
emitter.particleSize = CGSize(width: 8, height: 8)
emitter.particleColor = .white
emitter.particleColorAlphaSpeed = -0.5   // Fade out
emitter.particleBlendMode = .add         // Additive for fire/glow
emitter.particleAlpha = 1.0
emitter.particleAlphaSpeed = -0.5

// Scale
emitter.particleScale = 1.0
emitter.particleScaleRange = 0.5
emitter.particleScaleSpeed = -0.3        // Shrink over time

// Rotation
emitter.particleRotation = 0
emitter.particleRotationSpeed = 2.0

// Target node (for trails)
emitter.targetNode = scene               // Particles stay in world space

// Render order
emitter.particleRenderOrder = .dontCare  // .oldestFirst, .oldestLast, .dontCare

// Physics field interaction
emitter.fieldBitMask = 0x1
```

### Common Particle Presets

| Effect | Key Settings |
|--------|-------------|
| Fire | `blendMode: .add`, fast `alphaSpeed`, orange→red color, upward speed |
| Smoke | `blendMode: .alpha`, slow speed, gray color, scale up over time |
| Sparks | `blendMode: .add`, high speed + range, short lifetime, small size |
| Rain | Downward `emissionAngle`, narrow range, long lifetime, thin texture |
| Snow | Slow downward speed, wide position range, slight x acceleration |
| Trail | Set `targetNode` to scene, narrow emission angle, medium lifetime |
| Explosion | High birth rate, short `numParticlesToEmit`, high speed range |

---

## Part 8: SKRenderer and Shaders

### SKRenderer (Metal Integration)

```swift
import MetalKit

let device = MTLCreateSystemDefaultDevice()!
let renderer = SKRenderer(device: device)
renderer.scene = gameScene
renderer.ignoresSiblingOrder = true

// In Metal render loop:
func draw(in view: MTKView) {
    guard let commandBuffer = commandQueue.makeCommandBuffer(),
          let rpd = view.currentRenderPassDescriptor else { return }

    renderer.update(atTime: CACurrentMediaTime())
    renderer.render(
        withViewport: CGRect(origin: .zero, size: view.drawableSize),
        commandBuffer: commandBuffer,
        renderPassDescriptor: rpd
    )

    commandBuffer.present(view.currentDrawable!)
    commandBuffer.commit()
}
```

### SKShader (Custom GLSL ES Effects)

```swift
// Fragment shader for per-pixel effects
let shader = SKShader(source: """
    void main() {
        vec4 color = texture2D(u_texture, v_tex_coord);
        // Desaturate
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(vec3(gray), color.a) * v_color_mix.a;
    }
""")

sprite.shader = shader

// With uniforms
let shader = SKShader(source: """
    void main() {
        vec4 color = texture2D(u_texture, v_tex_coord);
        color.rgb *= u_intensity;
        gl_FragColor = color;
    }
""")
shader.uniforms = [
    SKUniform(name: "u_intensity", float: 0.8)
]

// Built-in uniforms:
// u_texture     — sprite texture
// u_time        — elapsed time
// u_path_length — shape node path length
// v_tex_coord   — texture coordinate
// v_color_mix   — color/alpha mix
// SKAttribute for per-node values
```

## Part 7: SwiftUI Integration

### SpriteView

```swift
import SpriteKit
import SwiftUI

// Basic embedding
struct GameView: View {
    var body: some View {
        SpriteView(scene: makeScene())
            .ignoresSafeArea()
    }

    func makeScene() -> SKScene {
        let scene = GameScene(size: CGSize(width: 1024, height: 768))
        scene.scaleMode = .aspectFill
        return scene
    }
}

// With options
SpriteView(
    scene: scene,
    transition: .fade(withDuration: 0.5),       // Scene transition
    isPaused: false,                              // Pause control
    preferredFramesPerSecond: 60,                 // Frame rate
    options: [.ignoresSiblingOrder, .shouldCullNonVisibleNodes],
    debugOptions: [.showsFPS, .showsNodeCount]    // Debug overlays
)
```

### SpriteView Options

| Option | Purpose |
|--------|---------|
| `.ignoresSiblingOrder` | Enable draw order batching optimization |
| `.shouldCullNonVisibleNodes` | Auto-hide offscreen nodes |
| `.allowsTransparency` | Allow transparent background (slower) |

### Debug Options

| Option | Shows |
|--------|-------|
| `.showsFPS` | Frames per second |
| `.showsNodeCount` | Total visible nodes |
| `.showsDrawCount` | Draw calls per frame |
| `.showsPhysics` | Physics body outlines |
| `.showsFields` | Physics field regions |
| `.showsQuadCount` | Quad subdivisions |

### Communicating Between SwiftUI and SpriteKit

```swift
// Observable model shared between SwiftUI and scene
@Observable
class GameState {
    var score = 0
    var isPaused = false
    var lives = 3
}

// Scene reads/writes the shared model
class GameScene: SKScene {
    var gameState: GameState?

    override func update(_ currentTime: TimeInterval) {
        guard let state = gameState, !state.isPaused else { return }
        // Game logic updates state.score, state.lives, etc.
    }
}

// SwiftUI view owns the model
struct GameContainerView: View {
    @State private var gameState = GameState()
    @State private var scene: GameScene = {
        let s = GameScene(size: CGSize(width: 1024, height: 768))
        s.scaleMode = .aspectFill
        return s
    }()

    var body: some View {
        VStack {
            Text("Score: \(gameState.score)")
            SpriteView(scene: scene, isPaused: gameState.isPaused)
                .ignoresSafeArea()
        }
        .onAppear { scene.gameState = gameState }
    }
}
```

**Key pattern**: Use `@Observable` model as bridge. Scene mutates it; SwiftUI observes changes. Avoid recreating scenes in view body — use `@State` to persist the scene instance.

---

## Resources

**WWDC**: 2014-608, 2016-610, 2017-609

**Docs**: /spritekit/skspritenode, /spritekit/skphysicsbody, /spritekit/skaction, /spritekit/skemitternode, /spritekit/skrenderer

**Skills**: axiom-spritekit, axiom-spritekit-diag
