---
name: axiom-spritekit
description: Use when building SpriteKit games, implementing physics, actions, scene management, or debugging game performance. Covers scene graph, physics engine, actions system, game loop, rendering optimization.
license: MIT
metadata:
  version: "1.0.0"
---

# SpriteKit Game Development Guide

**Purpose**: Build reliable SpriteKit games by mastering the scene graph, physics engine, action system, and rendering pipeline
**iOS Version**: iOS 13+ (SwiftUI integration), iOS 11+ (SKRenderer)
**Xcode**: Xcode 15+

## When to Use This Skill

Use this skill when:
- Building a new SpriteKit game or interactive simulation
- Implementing physics (collisions, contacts, forces, joints)
- Setting up game architecture (scenes, layers, cameras)
- Optimizing frame rate or reducing draw calls
- Implementing touch/input handling in a game
- Managing scene transitions and data passing
- Integrating SpriteKit with SwiftUI or Metal
- Debugging physics contacts that don't fire
- Fixing coordinate system confusion

Do NOT use this skill for:
- SceneKit 3D rendering (future skill)
- GameplayKit entity-component systems (future skill)
- Metal shader programming (`axiom-metal-migration-ref`)
- General SwiftUI layout (`axiom-swiftui-layout`)

---

## 1. Mental Model

### Coordinate System

SpriteKit uses a **bottom-left origin** with Y pointing up. This differs from UIKit (top-left, Y down).

```
SpriteKit:          UIKit:
┌─────────┐         ┌─────────┐
│    +Y    │         │  (0,0)  │
│    ↑     │         │    ↓    │
│    │     │         │    +Y   │
│(0,0)──→+X│        │    │    │
└─────────┘         └─────────┘
```

**Anchor Points** define which point on a sprite maps to its `position`. Default is `(0.5, 0.5)` (center).

```swift
// Common anchor point trap:
// Anchor (0, 0) = bottom-left of sprite is at position
// Anchor (0.5, 0.5) = center of sprite is at position (DEFAULT)
// Anchor (0.5, 0) = bottom-center (useful for characters standing on ground)
sprite.anchorPoint = CGPoint(x: 0.5, y: 0)
```

**Scene anchor point** maps the view's frame to scene coordinates:
- `(0, 0)` — scene origin at bottom-left of view (default)
- `(0.5, 0.5)` — scene origin at center of view

### Node Tree

Everything in SpriteKit is an `SKNode` in a tree hierarchy. Parent transforms propagate to children.

```
SKScene
├── SKCameraNode (viewport control)
├── SKNode "world" (game content layer)
│   ├── SKSpriteNode "player"
│   ├── SKSpriteNode "enemy"
│   └── SKNode "platforms"
│       ├── SKSpriteNode "platform1"
│       └── SKSpriteNode "platform2"
└── SKNode "hud" (UI layer, attached to camera)
    ├── SKLabelNode "score"
    └── SKSpriteNode "healthBar"
```

### Z-Ordering

`zPosition` controls draw order. Higher values render on top. Nodes at the same `zPosition` render in child array order (unless `ignoresSiblingOrder` is `true`).

```swift
// Establish clear z-order layers
enum ZLayer {
    static let background: CGFloat = -100
    static let platforms: CGFloat = 0
    static let items: CGFloat = 10
    static let player: CGFloat = 20
    static let effects: CGFloat = 30
    static let hud: CGFloat = 100
}
```

---

## 2. Scene Architecture

### Scale Mode Decision

| Mode | Behavior | Use When |
|------|----------|----------|
| `.aspectFill` | Fills view, crops edges | Full-bleed games (most games) |
| `.aspectFit` | Fits in view, letterboxes | Puzzle games needing exact layout |
| `.resizeFill` | Stretches to fill | Almost never — distorts |
| `.fill` | Matches view size exactly | Scene adapts to any ratio |

```swift
class GameScene: SKScene {
    override func sceneDidLoad() {
        scaleMode = .aspectFill
        // Design for a reference size, let aspectFill crop edges
    }
}
```

### Camera Node Pattern

Always use `SKCameraNode` for viewport control. Attach HUD elements to the camera so they don't scroll.

```swift
let camera = SKCameraNode()
camera.name = "mainCamera"
addChild(camera)
self.camera = camera

// HUD follows camera automatically
let scoreLabel = SKLabelNode(text: "Score: 0")
scoreLabel.position = CGPoint(x: 0, y: size.height / 2 - 50)
camera.addChild(scoreLabel)

// Move camera to follow player
let follow = SKConstraint.distance(SKRange(constantValue: 0), to: playerNode)
camera.constraints = [follow]
```

### Layer Organization

```swift
// Create layer nodes for organization
let worldNode = SKNode()
worldNode.name = "world"
addChild(worldNode)

let hudNode = SKNode()
hudNode.name = "hud"
camera?.addChild(hudNode)

// All gameplay objects go in worldNode
worldNode.addChild(playerSprite)
worldNode.addChild(enemySprite)

// All UI goes in hudNode (moves with camera)
hudNode.addChild(scoreLabel)
```

### Scene Transitions

```swift
// Preload next scene for smooth transitions
guard let nextScene = LevelScene(fileNamed: "Level2") else { return }
nextScene.scaleMode = .aspectFill

let transition = SKTransition.fade(withDuration: 0.5)
view?.presentScene(nextScene, transition: transition)
```

**Data passing between scenes**: Use a shared game state object, not node properties.

```swift
class GameState {
    static let shared = GameState()
    var score = 0
    var currentLevel = 1
    var playerHealth = 100
}

// In scene transition:
let nextScene = LevelScene(size: size)
// GameState.shared is already accessible
view?.presentScene(nextScene, transition: .fade(withDuration: 0.5))
```

**Note**: A singleton works for simple games. For larger projects with testing needs, consider passing a `GameState` instance through scene initializers to avoid hidden global state.

**Cleanup in `willMove(from:)`**:

```swift
override func willMove(from view: SKView) {
    removeAllActions()
    removeAllChildren()
    physicsWorld.contactDelegate = nil
}
```

---

## 3. Physics Engine

### Bitmask Discipline

**This is the #1 source of SpriteKit bugs.** Physics bitmasks use a 32-bit system where each bit represents a category.

```swift
struct PhysicsCategory {
    static let none:       UInt32 = 0
    static let player:     UInt32 = 0b0001  // 1
    static let enemy:      UInt32 = 0b0010  // 2
    static let ground:     UInt32 = 0b0100  // 4
    static let projectile: UInt32 = 0b1000  // 8
    static let powerUp:    UInt32 = 0b10000 // 16
}
```

**Three bitmask properties** (all default to `0xFFFFFFFF` — everything):

| Property | Purpose | Default |
|----------|---------|---------|
| `categoryBitMask` | What this body IS | `0xFFFFFFFF` |
| `collisionBitMask` | What it BOUNCES off | `0xFFFFFFFF` |
| `contactTestBitMask` | What TRIGGERS delegate | `0x00000000` |

**The default `collisionBitMask` of `0xFFFFFFFF` means everything collides with everything.** This is the most common source of unexpected physics behavior.

```swift
// CORRECT: Explicit bitmask setup
player.physicsBody?.categoryBitMask = PhysicsCategory.player
player.physicsBody?.collisionBitMask = PhysicsCategory.ground | PhysicsCategory.enemy
player.physicsBody?.contactTestBitMask = PhysicsCategory.enemy | PhysicsCategory.powerUp

enemy.physicsBody?.categoryBitMask = PhysicsCategory.enemy
enemy.physicsBody?.collisionBitMask = PhysicsCategory.ground | PhysicsCategory.player
enemy.physicsBody?.contactTestBitMask = PhysicsCategory.player | PhysicsCategory.projectile
```

### Bitmask Checklist

For every physics body, verify:
1. `categoryBitMask` set to exactly one category
2. `collisionBitMask` set to only categories it should bounce off (NOT `0xFFFFFFFF`)
3. `contactTestBitMask` set to categories that should trigger delegate callbacks
4. Delegate is assigned: `physicsWorld.contactDelegate = self`

### Contact Detection

```swift
class GameScene: SKScene, SKPhysicsContactDelegate {
    override func didMove(to view: SKView) {
        physicsWorld.contactDelegate = self
    }

    func didBegin(_ contact: SKPhysicsContact) {
        // Sort bodies so bodyA has the lower category
        let (first, second): (SKPhysicsBody, SKPhysicsBody)
        if contact.bodyA.categoryBitMask < contact.bodyB.categoryBitMask {
            (first, second) = (contact.bodyA, contact.bodyB)
        } else {
            (first, second) = (contact.bodyB, contact.bodyA)
        }

        // Now dispatch based on categories
        if first.categoryBitMask == PhysicsCategory.player &&
           second.categoryBitMask == PhysicsCategory.enemy {
            guard let playerNode = first.node, let enemyNode = second.node else { return }
            playerHitEnemy(player: playerNode, enemy: enemyNode)
        }
    }
}
```

**Modification rule**: You cannot modify the physics world inside `didBegin`/`didEnd`. Set flags and apply changes in `update(_:)`.

```swift
var enemiesToRemove: [SKNode] = []

func didBegin(_ contact: SKPhysicsContact) {
    // Flag for removal — don't remove here
    if let enemy = contact.bodyB.node {
        enemiesToRemove.append(enemy)
    }
}

override func update(_ currentTime: TimeInterval) {
    for enemy in enemiesToRemove {
        enemy.removeFromParent()
    }
    enemiesToRemove.removeAll()
}
```

### Body Types

| Type | Created With | Responds to Forces | Use For |
|------|-------------|-------------------|---------|
| Dynamic volume | `init(circleOfRadius:)`, `init(rectangleOf:)`, `init(texture:size:)` | Yes | Players, enemies, projectiles |
| Static volume | Dynamic body + `isDynamic = false` | No (but collides) | Platforms, walls |
| Edge | `init(edgeLoopFrom:)`, `init(edgeFrom:to:)` | No (boundary only) | Screen boundaries, terrain |

```swift
// Screen boundary using edge loop
physicsBody = SKPhysicsBody(edgeLoopFrom: frame)

// Texture-based body for irregular shapes
guard let texture = enemy.texture else { return }
enemy.physicsBody = SKPhysicsBody(texture: texture, size: enemy.size)

// Circle for performance (cheapest collision detection)
bullet.physicsBody = SKPhysicsBody(circleOfRadius: 5)
```

### Tunneling Prevention

Fast-moving objects can pass through thin walls. Fix:

```swift
// Enable precise collision detection for fast objects
bullet.physicsBody?.usesPreciseCollisionDetection = true

// Make walls thick enough (at least as wide as fastest object moves per frame)
// At 60fps, an object at velocity 600pt/s moves 10pt/frame
```

### Forces vs Impulses

```swift
// Force: continuous (applied per frame, accumulates)
body.applyForce(CGVector(dx: 0, dy: 100))

// Impulse: instant velocity change (one-time, like a jump)
body.applyImpulse(CGVector(dx: 0, dy: 50))

// Torque: continuous rotation
body.applyTorque(0.5)

// Angular impulse: instant rotation change
body.applyAngularImpulse(1.0)
```

---

## 4. Actions System

### Core Patterns

```swift
// Movement
let move = SKAction.move(to: CGPoint(x: 200, y: 300), duration: 1.0)
let moveBy = SKAction.moveBy(x: 100, y: 0, duration: 0.5)

// Rotation
let rotate = SKAction.rotate(byAngle: .pi * 2, duration: 1.0)

// Scale
let scale = SKAction.scale(to: 2.0, duration: 0.3)

// Fade
let fadeOut = SKAction.fadeOut(withDuration: 0.5)
let fadeIn = SKAction.fadeIn(withDuration: 0.5)
```

### Sequencing and Grouping

```swift
// Sequence: one after another
let moveAndFade = SKAction.sequence([
    SKAction.move(to: target, duration: 1.0),
    SKAction.fadeOut(withDuration: 0.3),
    SKAction.removeFromParent()
])

// Group: all at once
let spinAndGrow = SKAction.group([
    SKAction.rotate(byAngle: .pi * 2, duration: 1.0),
    SKAction.scale(to: 2.0, duration: 1.0)
])

// Repeat
let pulse = SKAction.repeatForever(SKAction.sequence([
    SKAction.scale(to: 1.2, duration: 0.3),
    SKAction.scale(to: 1.0, duration: 0.3)
]))
```

### Named Actions (Critical for Management)

```swift
// Use named actions so you can cancel/replace them
node.run(pulse, withKey: "pulse")

// Later, stop the pulse:
node.removeAction(forKey: "pulse")

// Check if running:
if node.action(forKey: "pulse") != nil {
    // Still pulsing
}
```

### Custom Actions with Weak Self

```swift
// WRONG: Retain cycle risk
node.run(SKAction.run {
    self.score += 1  // Strong capture of self
})

// CORRECT: Weak capture
node.run(SKAction.run { [weak self] in
    self?.score += 1
})

// For repeating actions, always use weak self
let spawn = SKAction.repeatForever(SKAction.sequence([
    SKAction.run { [weak self] in self?.spawnEnemy() },
    SKAction.wait(forDuration: 2.0)
]))
scene.run(spawn, withKey: "enemySpawner")
```

### Timing Modes

```swift
action.timingMode = .linear     // Constant speed (default)
action.timingMode = .easeIn     // Accelerate from rest
action.timingMode = .easeOut    // Decelerate to rest
action.timingMode = .easeInEaseOut  // Smooth start and end
```

### Actions vs Physics

**Never use actions to move physics-controlled nodes.** Actions override the physics simulation, causing jittering and missed collisions.

```swift
// WRONG: Action fights physics
playerNode.run(SKAction.moveTo(x: 200, duration: 0.5))

// CORRECT: Use forces/impulses for physics bodies
playerNode.physicsBody?.applyImpulse(CGVector(dx: 50, dy: 0))

// CORRECT: Use actions for non-physics nodes (UI, effects, decorations)
hudLabel.run(SKAction.scale(to: 1.5, duration: 0.2))
```

---

## 5. Input Handling

### Touch Handling

```swift
// CRITICAL: isUserInteractionEnabled must be true on the responding node
// SKScene has it true by default; other nodes default to false

class Player: SKSpriteNode {
    init() {
        super.init(texture: SKTexture(imageNamed: "player"), color: .clear, size: CGSize(width: 50, height: 50))
        isUserInteractionEnabled = true  // Required!
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        // Handle touch on this specific node
    }
}
```

### Coordinate Space Conversion

```swift
// Touch location in SCENE coordinates (most common)
override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    guard let touch = touches.first else { return }
    let locationInScene = touch.location(in: self)

    // Touch location in a SPECIFIC NODE's coordinates
    let locationInWorld = touch.location(in: worldNode)

    // Hit test: what node was touched?
    let touchedNodes = nodes(at: locationInScene)
}
```

**Common mistake**: Using `touch.location(in: self.view)` returns UIKit coordinates (Y-flipped). Always use `touch.location(in: self)` for scene coordinates.

### Game Controller Support

```swift
import GameController

func setupControllers() {
    NotificationCenter.default.addObserver(
        self, selector: #selector(controllerConnected),
        name: .GCControllerDidConnect, object: nil
    )

    // Check already-connected controllers
    for controller in GCController.controllers() {
        configureController(controller)
    }
}
```

---

## 6. Performance

### Performance Priorities

For detailed performance diagnosis, see `axiom-spritekit-diag` Symptom 3. Key priorities:

1. **Node count** — Remove offscreen nodes, use object pooling
2. **Draw calls** — Use texture atlases, replace SKShapeNode with pre-rendered textures
3. **Physics cost** — Prefer simple body shapes, limit `usesPreciseCollisionDetection`
4. **Particles** — Limit birth rate, set finite emission counts

### Debug Overlays (Always Enable During Development)

```swift
if let view = self.view as? SKView {
    view.showsFPS = true
    view.showsNodeCount = true
    view.showsDrawCount = true
    view.showsPhysics = true  // Shows physics body outlines

    // Performance: render order optimization
    view.ignoresSiblingOrder = true
}
```

### Texture Atlas Batching

Sprites using textures from the same atlas render in a single draw call.

```swift
// Create atlas in Xcode: Assets → New Sprite Atlas
// Or use .atlas folder in project

let atlas = SKTextureAtlas(named: "Characters")
let texture = atlas.textureNamed("player_idle")
let sprite = SKSpriteNode(texture: texture)

// Preload atlas to avoid frame drops
SKTextureAtlas.preloadTextureAtlases([atlas]) {
    // Atlas ready — present scene
}
```

### SKShapeNode Trap

**SKShapeNode generates one draw call per instance.** It cannot be batched. Use it for prototyping and debug visualization only.

```swift
// WRONG: 100 SKShapeNodes = 100 draw calls
for _ in 0..<100 {
    let dot = SKShapeNode(circleOfRadius: 5)
    addChild(dot)
}

// CORRECT: Pre-render to texture, use SKSpriteNode
let shape = SKShapeNode(circleOfRadius: 5)
shape.fillColor = .red
guard let texture = view?.texture(from: shape) else { return }
for _ in 0..<100 {
    let dot = SKSpriteNode(texture: texture)
    addChild(dot)
}
```

### Object Pooling

For frequently spawned/destroyed objects (bullets, particles, enemies):

```swift
class BulletPool {
    private var available: [SKSpriteNode] = []
    private let texture: SKTexture

    init(texture: SKTexture, initialSize: Int = 20) {
        self.texture = texture
        for _ in 0..<initialSize {
            available.append(createBullet())
        }
    }

    private func createBullet() -> SKSpriteNode {
        let bullet = SKSpriteNode(texture: texture)
        bullet.physicsBody = SKPhysicsBody(circleOfRadius: 3)
        bullet.physicsBody?.categoryBitMask = PhysicsCategory.projectile
        bullet.physicsBody?.collisionBitMask = PhysicsCategory.none
        bullet.physicsBody?.contactTestBitMask = PhysicsCategory.enemy
        return bullet
    }

    func spawn() -> SKSpriteNode {
        if available.isEmpty {
            available.append(createBullet())
        }
        let bullet = available.removeLast()
        bullet.isHidden = false
        bullet.physicsBody?.isDynamic = true
        return bullet
    }

    func recycle(_ bullet: SKSpriteNode) {
        bullet.removeAllActions()
        bullet.removeFromParent()
        bullet.physicsBody?.isDynamic = false
        bullet.physicsBody?.velocity = .zero
        bullet.isHidden = true
        available.append(bullet)
    }
}
```

### Offscreen Node Removal

```swift
// Manual removal is faster than shouldCullNonVisibleNodes
override func update(_ currentTime: TimeInterval) {
    enumerateChildNodes(withName: "bullet") { node, _ in
        if !self.frame.intersects(node.frame) {
            self.bulletPool.recycle(node as! SKSpriteNode)
        }
    }
}
```

---

## 7. Game Loop

### Frame Cycle (8 Phases)

```
1. update(_:)              ← Your game logic here
2. didEvaluateActions()    ← Actions completed
3. [Physics simulation]    ← SpriteKit runs physics
4. didSimulatePhysics()    ← Physics done, adjust results
5. [Constraint evaluation] ← SKConstraints applied
6. didApplyConstraints()   ← Constraints done
7. didFinishUpdate()       ← Last chance before render
8. [Rendering]             ← Frame drawn
```

### Delta Time

```swift
private var lastUpdateTime: TimeInterval = 0

override func update(_ currentTime: TimeInterval) {
    let dt: TimeInterval
    if lastUpdateTime == 0 {
        dt = 0
    } else {
        dt = currentTime - lastUpdateTime
    }
    lastUpdateTime = currentTime

    // Clamp delta time to prevent spiral of death
    // (when app returns from background, dt can be huge)
    let clampedDt = min(dt, 1.0 / 30.0)

    updatePlayer(deltaTime: clampedDt)
    updateEnemies(deltaTime: clampedDt)
}
```

### Pause Handling

```swift
// Pause the scene (stops actions, physics, update loop)
scene.isPaused = true

// Pause specific subtree only
worldNode.isPaused = true  // Game paused but HUD still animates

// Handle app backgrounding
NotificationCenter.default.addObserver(
    self, selector: #selector(pauseGame),
    name: UIApplication.willResignActiveNotification, object: nil
)
```

---

## 8. Particle Effects

### Emitter Best Practices

```swift
// Load from .sks file (designed in Xcode Particle Editor)
guard let emitter = SKEmitterNode(fileNamed: "Explosion") else { return }
emitter.position = explosionPoint
addChild(emitter)

// CRITICAL: Auto-remove after emission completes
let duration = TimeInterval(emitter.numParticlesToEmit) / TimeInterval(emitter.particleBirthRate)
    + TimeInterval(emitter.particleLifetime + emitter.particleLifetimeRange / 2)
emitter.run(SKAction.sequence([
    SKAction.wait(forDuration: duration),
    SKAction.removeFromParent()
]))
```

### Target Node for Trails

Without `targetNode`, particles move with the emitter. For trails (like rocket exhaust), set `targetNode` to the scene:

```swift
let trail = SKEmitterNode(fileNamed: "RocketTrail")!
trail.targetNode = scene  // Particles stay where emitted
rocketNode.addChild(trail)
```

### Infinite Emitter Cleanup

```swift
// WRONG: Infinite emitter never cleaned up
let fire = SKEmitterNode(fileNamed: "Fire")!
fire.numParticlesToEmit = 0  // 0 = infinite
addChild(fire)
// Memory leak — particles accumulate forever

// CORRECT: Set emission limit or remove when done
fire.numParticlesToEmit = 200  // Stops after 200 particles

// Or manually stop and remove:
fire.particleBirthRate = 0  // Stop new particles
fire.run(SKAction.sequence([
    SKAction.wait(forDuration: TimeInterval(fire.particleLifetime)),
    SKAction.removeFromParent()
]))
```

---

## 9. SwiftUI Integration

### SpriteView (Recommended, iOS 14+)

The simplest way to embed SpriteKit in SwiftUI. Use this unless you need custom SKView configuration.

```swift
import SpriteKit
import SwiftUI

struct GameView: View {
    var body: some View {
        SpriteView(scene: {
            let scene = GameScene(size: CGSize(width: 390, height: 844))
            scene.scaleMode = .aspectFill
            return scene
        }(), debugOptions: [.showsFPS, .showsNodeCount])
        .ignoresSafeArea()
    }
}
```

### UIViewRepresentable (Advanced)

Use when you need full control over SKView configuration (custom frame rate, transparency, or multiple scenes).

```swift
import SwiftUI
import SpriteKit

struct SpriteKitView: UIViewRepresentable {
    let scene: SKScene

    func makeUIView(context: Context) -> SKView {
        let view = SKView()
        view.showsFPS = true
        view.showsNodeCount = true
        view.ignoresSiblingOrder = true
        return view
    }

    func updateUIView(_ view: SKView, context: Context) {
        if view.scene == nil {
            view.presentScene(scene)
        }
    }
}
```

### SKRenderer for Metal Hybrid

Use `SKRenderer` when SpriteKit is one layer in a Metal pipeline:

```swift
let renderer = SKRenderer(device: metalDevice)
renderer.scene = gameScene

// In your Metal render loop:
renderer.update(atTime: currentTime)
renderer.render(
    withViewport: viewport,
    commandBuffer: commandBuffer,
    renderPassDescriptor: renderPassDescriptor
)
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Default Bitmasks

**Time cost**: 30-120 minutes debugging phantom collisions

```swift
// WRONG: Default collisionBitMask is 0xFFFFFFFF
let body = SKPhysicsBody(circleOfRadius: 10)
node.physicsBody = body
// Collides with EVERYTHING — even things it shouldn't

// CORRECT: Always set all three masks explicitly
body.categoryBitMask = PhysicsCategory.player
body.collisionBitMask = PhysicsCategory.ground
body.contactTestBitMask = PhysicsCategory.enemy
```

### Anti-Pattern 2: Missing contactTestBitMask

**Time cost**: 30-60 minutes wondering why didBegin never fires

```swift
// WRONG: contactTestBitMask defaults to 0 — no contacts ever fire
player.physicsBody?.categoryBitMask = PhysicsCategory.player
// Forgot contactTestBitMask!

// CORRECT: Both bodies need compatible masks
player.physicsBody?.contactTestBitMask = PhysicsCategory.enemy
enemy.physicsBody?.categoryBitMask = PhysicsCategory.enemy
```

### Anti-Pattern 3: Actions on Physics Bodies

**Time cost**: 1-3 hours of jittering and missed collisions

```swift
// WRONG: SKAction.move overrides physics position each frame
playerNode.run(SKAction.moveTo(x: 200, duration: 1.0))
// Physics body position is set by action, ignoring forces/collisions

// CORRECT: Use physics for physics-controlled nodes
playerNode.physicsBody?.applyForce(CGVector(dx: 100, dy: 0))
```

### Anti-Pattern 4: SKShapeNode for Gameplay

**Time cost**: Hours diagnosing frame drops

Each SKShapeNode is a separate draw call that cannot be batched. 50 shape nodes = 50 draw calls. See the pre-render-to-texture pattern in Section 6 (SKShapeNode Trap) for the fix.

### Anti-Pattern 5: Strong Self in Action Closures

**Time cost**: Memory leaks, eventual crash

```swift
// WRONG: Strong capture in repeating action
node.run(SKAction.repeatForever(SKAction.sequence([
    SKAction.run { self.spawnEnemy() },
    SKAction.wait(forDuration: 2.0)
])))

// CORRECT: Weak capture
node.run(SKAction.repeatForever(SKAction.sequence([
    SKAction.run { [weak self] in self?.spawnEnemy() },
    SKAction.wait(forDuration: 2.0)
])))
```

---

## 11. Code Review Checklist

### Physics
- [ ] Every physics body has explicit `categoryBitMask` (not default)
- [ ] Every physics body has explicit `collisionBitMask` (not `0xFFFFFFFF`)
- [ ] Bodies needing contact detection have `contactTestBitMask` set
- [ ] `physicsWorld.contactDelegate` is assigned
- [ ] No world modifications inside `didBegin`/`didEnd` callbacks
- [ ] Fast objects use `usesPreciseCollisionDetection`

### Actions
- [ ] No `SKAction.move`/`rotate` on physics-controlled nodes
- [ ] Repeating actions use `withKey:` for cancellation
- [ ] `SKAction.run` closures use `[weak self]`
- [ ] One-shot emitters are removed after emission

### Performance
- [ ] Debug overlays enabled during development
- [ ] `ignoresSiblingOrder = true` on SKView
- [ ] No SKShapeNode in gameplay sprites (use pre-rendered textures)
- [ ] Texture atlases used for related sprites
- [ ] Offscreen nodes removed manually

### Scene Management
- [ ] `willMove(from:)` cleans up actions, children, delegates
- [ ] Scene data passed via shared state, not node properties
- [ ] Camera used for viewport control

---

## 12. Pressure Scenarios

### Scenario 1: "Physics Contacts Don't Work — Ship Tonight"

**Pressure**: Deadline pressure to skip systematic debugging

**Wrong approach**: Randomly changing bitmask values, adding `0xFFFFFFFF` everywhere, or disabling physics

**Correct approach** (2-5 minutes):
1. Enable `showsPhysics` — verify bodies exist and overlap
2. Print all three bitmasks for both bodies
3. Verify `contactTestBitMask` on body A includes category of body B (or vice versa)
4. Verify `physicsWorld.contactDelegate` is set
5. Verify you're not modifying the world inside the callback

**Push-back template**: "Let me run the 5-step bitmask checklist. It takes 2 minutes and catches 90% of contact issues. Random changes will make it worse."

### Scenario 2: "Frame Rate Is Fine on My Device"

**Pressure**: Authority says "it runs at 60fps for me, ship it"

**Wrong approach**: Shipping without profiling on minimum-spec device

**Correct approach**:
1. Enable `showsFPS`, `showsNodeCount`, `showsDrawCount`
2. Test on oldest supported device
3. If >200 nodes or >30 draw calls, investigate
4. Check for SKShapeNode in gameplay
5. Verify offscreen nodes are being removed

**Push-back template**: "Performance varies by device. Let me check node count and draw calls — takes 30 seconds with debug overlays. If counts are low, we're safe to ship."

### Scenario 3: "Just Use SKShapeNode, It's Faster to Code"

**Pressure**: Sunk cost — already built with SKShapeNode, don't want to redo

**Wrong approach**: Shipping with 100+ SKShapeNodes causing frame drops

**Correct approach**:
1. Check `showsDrawCount` — each SKShapeNode adds a draw call
2. If >20 shape nodes in gameplay, pre-render to textures
3. Use `view.texture(from:)` to convert once, reuse as SKSpriteNode
4. Keep SKShapeNode only for debug visualization

**Push-back template**: "Each SKShapeNode is a separate draw call. Converting to pre-rendered textures is a 15-minute refactor that can double frame rate. SKSpriteNode from atlas = 1 draw call for all of them."

## Resources

**WWDC**: 2014-608, 2016-610, 2017-609, 2013-502

**Docs**: /spritekit, /spritekit/skscene, /spritekit/skphysicsbody, /spritekit/maximizing-node-drawing-performance

**Skills**: axiom-spritekit-ref, axiom-spritekit-diag
