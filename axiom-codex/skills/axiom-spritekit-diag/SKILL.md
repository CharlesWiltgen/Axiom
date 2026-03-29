---
name: axiom-spritekit-diag
description: Use when physics contacts don't fire, objects tunnel through walls, frame rate drops, touches don't register, memory spikes, coordinate confusion, or scene transition crashes
license: MIT
metadata:
  version: "1.0.0"
---

# SpriteKit Diagnostics

Systematic diagnosis for common SpriteKit issues with time-cost annotations.

## When to Use This Diagnostic Skill

Use this skill when:
- Physics contacts never fire (didBegin not called)
- Objects pass through walls (tunneling)
- Frame rate drops below 60fps
- Touches don't register on nodes
- Memory grows continuously during gameplay
- Positions and coordinates seem wrong
- App crashes during scene transitions

## Mandatory First Step: Enable Debug Overlays

**Time cost**: 10 seconds setup vs hours of blind debugging

```swift
if let view = self.view as? SKView {
    view.showsFPS = true
    view.showsNodeCount = true
    view.showsDrawCount = true
    view.showsPhysics = true
}
```

If `showsPhysics` doesn't show expected physics body outlines, your physics bodies aren't configured correctly. **Stop and fix bodies before debugging contacts.**

For SpriteKit architecture patterns and best practices, see `axiom-spritekit`. For API reference, see `axiom-spritekit-ref`.

---

## Symptom 1: Physics Contacts Not Firing

**Time saved**: 30-120 min → 2-5 min

```
didBegin(_:) never called
│
├─ Is physicsWorld.contactDelegate set?
│   └─ NO → Set in didMove(to:):
│        physicsWorld.contactDelegate = self
│        ✓ This alone fixes ~30% of contact issues
│
├─ Does the class conform to SKPhysicsContactDelegate?
│   └─ NO → Add conformance:
│        class GameScene: SKScene, SKPhysicsContactDelegate
│
├─ Does body A have contactTestBitMask that includes body B's category?
│   ├─ Print: "A contact: \(bodyA.contactTestBitMask), B cat: \(bodyB.categoryBitMask)"
│   ├─ Result should be: (A.contactTestBitMask & B.categoryBitMask) != 0
│   └─ FIX: Set contactTestBitMask to include the other body's category
│        player.physicsBody?.contactTestBitMask = PhysicsCategory.enemy
│
├─ Is categoryBitMask set (not default 0xFFFFFFFF)?
│   ├─ Default category means everything matches — but in unexpected ways
│   └─ FIX: Always set explicit categoryBitMask for each body type
│
├─ Do the bodies actually overlap? (Check showsPhysics)
│   ├─ Bodies too small or offset from sprite → Fix physics body size
│   └─ Bodies never reach each other → Check collisionBitMask isn't blocking
│
└─ Are you modifying the world inside didBegin?
    ├─ Removing nodes inside didBegin can cause missed callbacks
    └─ FIX: Flag nodes for removal, process in update(_:)
```

### Quick Diagnostic Print

```swift
func didBegin(_ contact: SKPhysicsContact) {
    print("CONTACT: \(contact.bodyA.node?.name ?? "nil") (\(contact.bodyA.categoryBitMask)) <-> \(contact.bodyB.node?.name ?? "nil") (\(contact.bodyB.categoryBitMask))")
}
```

If this never prints, the issue is delegate/bitmask setup. If it prints but with wrong bodies, the issue is bitmask values.

---

## Symptom 2: Objects Tunneling Through Walls

**Time saved**: 20-60 min → 5 min

```
Fast objects pass through thin walls
│
├─ Is the object moving faster than wall thickness per frame?
│   ├─ At 60fps: max safe speed = wall_thickness × 60 pt/s
│   ├─ A 10pt wall is safe up to ~600 pt/s
│   └─ FIX: usesPreciseCollisionDetection = true on the fast object
│
├─ Is usesPreciseCollisionDetection enabled?
│   ├─ Only needed on the MOVING object (not the wall)
│   └─ FIX: fastObject.physicsBody?.usesPreciseCollisionDetection = true
│
├─ Is the wall an edge body?
│   ├─ Edge bodies have zero area — tunneling is easier
│   └─ FIX: Use volume body for walls (rectangleOf:) with isDynamic = false
│
├─ Is the wall thick enough?
│   └─ FIX: Make walls at least 10pt thick for objects up to 600pt/s
│
└─ Are collision bitmasks correct?
    ├─ Wall's categoryBitMask must be in object's collisionBitMask
    └─ FIX: Verify with print: object.collisionBitMask & wall.categoryBitMask != 0
```

---

## Symptom 3: Poor Frame Rate

**Time saved**: 2-4 hours → 15-30 min

```
FPS below 60 (or 120 on ProMotion)
│
├─ Check showsNodeCount
│   ├─ >1000 nodes → Offscreen nodes not removed
│   │   ├─ Are you removing nodes that leave the screen?
│   │   ├─ FIX: In update(), remove nodes outside visible area
│   │   └─ FIX: Use object pooling for frequently spawned objects
│   │
│   ├─ 200-1000 nodes → Likely manageable, check draw count
│   └─ <200 nodes → Nodes aren't the problem, check below
│
├─ Check showsDrawCount
│   ├─ >50 draw calls → Batching problem
│   │   ├─ Using SKShapeNode for gameplay? → Replace with pre-rendered textures
│   │   ├─ Sprites from different images? → Use texture atlas
│   │   ├─ Sprites at different zPositions? → Consolidate layers
│   │   └─ ignoresSiblingOrder = false? → Set to true
│   │
│   ├─ 10-50 draw calls → Acceptable for most games
│   └─ <10 draw calls → Drawing isn't the problem
│
├─ Physics expensive?
│   ├─ Many texture-based physics bodies → Use circles/rectangles
│   ├─ usesPreciseCollisionDetection on too many bodies → Use only on fast objects
│   ├─ Many contact callbacks firing → Reduce contactTestBitMask scope
│   └─ Complex polygon bodies → Simplify to fewer vertices
│
├─ Particle overload?
│   ├─ Multiple emitters active → Reduce particleBirthRate
│   ├─ High particleLifetime → Reduce (fewer active particles)
│   ├─ numParticlesToEmit = 0 (infinite) without cleanup → Add limits
│   └─ FIX: Profile with Instruments → Time Profiler
│
├─ SKEffectNode without shouldRasterize?
│   ├─ CIFilter re-renders every frame
│   └─ FIX: effectNode.shouldRasterize = true (if content is static)
│
└─ Complex update() logic?
    ├─ O(n²) collision checking? → Use physics engine instead
    ├─ String-based enumerateChildNodes every frame? → Cache references
    └─ Heavy computation in update? → Spread across frames or background
```

### Quick Performance Audit

```swift
#if DEBUG
private var frameCount = 0
#endif

override func update(_ currentTime: TimeInterval) {
    #if DEBUG
    frameCount += 1
    if frameCount % 60 == 0 {
        print("Nodes: \(children.count)")
    }
    #endif
}
```

---

## Symptom 4: Touches Not Registering

**Time saved**: 15-45 min → 2 min

```
touchesBegan not called on a node
│
├─ Is isUserInteractionEnabled = true on the node?
│   ├─ SKScene: true by default
│   ├─ All other SKNode subclasses: FALSE by default
│   └─ FIX: node.isUserInteractionEnabled = true
│
├─ Is the node hidden or alpha = 0?
│   ├─ Hidden nodes don't receive touches
│   └─ FIX: Check node.isHidden and node.alpha
│
├─ Is another node on top intercepting touches?
│   ├─ Higher zPosition nodes with isUserInteractionEnabled get first chance
│   └─ DEBUG: Print nodes(at: touchLocation) to see what's there
│
├─ Is the touch in the correct coordinate space?
│   ├─ Using touch.location(in: self.view)? → WRONG for SpriteKit
│   └─ FIX: Use touch.location(in: self) for scene coordinates
│        Or touch.location(in: targetNode) for node-local coordinates
│
├─ Is the physics body blocking touch pass-through?
│   └─ Physics bodies don't affect touch handling — not the issue
│
└─ Is the node's frame correct?
    ├─ SKNode (container) has zero frame — can't be hit-tested by area
    ├─ SKSpriteNode frame matches texture size × scale
    └─ FIX: Use contains(point) or nodes(at:) for manual hit testing
```

---

## Symptom 5: Memory Spikes and Crashes

**Time saved**: 1-3 hours → 15 min

```
Memory grows during gameplay
│
├─ Nodes accumulating? (Check showsNodeCount over time)
│   ├─ Count increasing? → Nodes created but not removed
│   │   ├─ Missing removeFromParent() for expired objects
│   │   ├─ FIX: Add cleanup in update() or use SKAction.removeFromParent()
│   │   └─ FIX: Implement object pooling for frequently spawned items
│   │
│   └─ Count stable? → Memory issue elsewhere
│
├─ Infinite particle emitters?
│   ├─ numParticlesToEmit = 0 creates particles forever
│   ├─ Each emitter accumulates particles up to birthRate × lifetime
│   └─ FIX: Set finite numParticlesToEmit or manually stop and remove
│
├─ Texture caching?
│   ├─ SKTexture(imageNamed:) caches — repeated calls don't leak
│   ├─ SKTexture(cgImage:) from camera/dynamic sources → Not cached
│   └─ FIX: Reuse texture references for dynamic textures
│
├─ Strong reference cycles in actions?
│   ├─ SKAction.run { self.doSomething() } captures self strongly
│   ├─ In repeatForever, this prevents scene deallocation
│   └─ FIX: SKAction.run { [weak self] in self?.doSomething() }
│
├─ Scene not deallocating?
│   ├─ Add deinit { print("Scene deallocated") }
│   ├─ If never prints → retain cycle
│   ├─ Common: strong delegate, closure capture, NotificationCenter observer
│   └─ FIX: Clean up in willMove(from:):
│        removeAllActions()
│        removeAllChildren()
│        physicsWorld.contactDelegate = nil
│
└─ Instruments → Allocations
    ├─ Filter by "SK" to see SpriteKit objects
    ├─ Mark generation before/after scene transition
    └─ Persistent growth = leak
```

---

## Symptom 6: Coordinate Confusion

**Time saved**: 20-60 min → 5 min

```
Positions seem wrong or flipped
│
├─ Y-axis confusion?
│   ├─ SpriteKit: origin at BOTTOM-LEFT, Y goes UP
│   ├─ UIKit: origin at TOP-LEFT, Y goes DOWN
│   └─ FIX: Use scene coordinate methods, not view coordinates
│        touch.location(in: self)  ← CORRECT (scene space)
│        touch.location(in: view)  ← WRONG (UIKit space, Y flipped)
│
├─ Anchor point confusion?
│   ├─ Scene anchor (0,0) = bottom-left of view is scene origin
│   ├─ Scene anchor (0.5,0.5) = center of view is scene origin
│   ├─ Sprite anchor (0.5,0.5) = center of sprite is at position (default)
│   ├─ Sprite anchor (0,0) = bottom-left of sprite is at position
│   └─ FIX: Print anchorPoint values and draw expected position
│
├─ Parent coordinate space?
│   ├─ node.position is relative to PARENT, not scene
│   ├─ Child at (0,0) of parent at (100,100) is at scene (100,100)
│   └─ FIX: Use convert(_:to:) and convert(_:from:) for cross-node coordinates
│        let scenePos = node.convert(localPoint, to: scene)
│        let localPos = node.convert(scenePoint, from: scene)
│
├─ Camera offset?
│   ├─ Camera position offsets the visible area
│   ├─ HUD attached to camera stays in place
│   └─ FIX: For world coordinates, account for camera position
│        scene.convertPoint(fromView: viewPoint)
│
└─ Scale mode cropping?
    ├─ aspectFill crops edges — content at edges may be offscreen
    └─ FIX: Keep important content in the "safe area" center
```

---

## Symptom 7: Scene Transition Crashes

**Time saved**: 30-90 min → 5 min

```
Crash during or after scene transition
│
├─ EXC_BAD_ACCESS after transition?
│   ├─ Old scene deallocated while something still references it
│   ├─ Common: Timer, NotificationCenter, delegate still referencing old scene
│   └─ FIX: Clean up in willMove(from:):
│        removeAllActions()
│        removeAllChildren()
│        physicsWorld.contactDelegate = nil
│        // Remove any NotificationCenter observers
│
├─ Crash in didMove(to:) of new scene?
│   ├─ Accessing view before it's available
│   ├─ Force-unwrapping optional that's nil during init
│   └─ FIX: Use guard let view = self.view in didMove(to:)
│
├─ Memory spike during transition?
│   ├─ Both scenes exist simultaneously during transition animation
│   ├─ For large scenes, this doubles memory usage
│   └─ FIX: Preload textures, reduce scene size, or use .fade transition
│        (fade briefly shows neither scene, reducing peak memory)
│
├─ Nodes from old scene appearing in new scene?
│   ├─ node.move(toParent:) during transition
│   └─ FIX: Don't move nodes between scenes — recreate in new scene
│
└─ didMove(to:) called twice?
    ├─ Presenting scene multiple times (button double-tap)
    └─ FIX: Disable transition trigger after first tap
         guard view?.scene !== nextScene else { return }
```

---

## Common Mistakes

These mistakes cause the majority of SpriteKit issues. Check these first before diving into symptom trees.

1. **Leaving default bitmasks** — `collisionBitMask` defaults to `0xFFFFFFFF` (collides with everything). Always set all three masks explicitly.
2. **Forgetting `contactTestBitMask`** — Defaults to `0x00000000`. Contacts never fire without setting this.
3. **Forgetting `physicsWorld.contactDelegate = self`** — Fixes ~30% of contact issues on its own.
4. **Using SKShapeNode for gameplay** — Each instance = 1 draw call. Pre-render to texture with `view.texture(from:)`.
5. **SKAction.move on physics bodies** — Actions override physics, causing jitter and missed collisions. Use forces/impulses.
6. **Strong self in action closures** — `SKAction.run { self.foo() }` in `repeatForever` creates retain cycles. Use `[weak self]`.
7. **Not removing offscreen nodes** — Node count climbs silently, degrading performance.
8. **Missing `isUserInteractionEnabled = true`** — Default is `false` on all non-scene nodes.

---

## Diagnostic Quick Reference Card

| Symptom | First Check | Most Likely Cause |
|---------|------------|-------------------|
| Contacts don't fire | `contactDelegate` set? | Missing `contactTestBitMask` |
| Tunneling | Object speed vs wall thickness | Missing `usesPreciseCollisionDetection` |
| Low FPS | `showsDrawCount` | SKShapeNode in gameplay or missing atlas |
| Touches broken | `isUserInteractionEnabled`? | Default is `false` on non-scene nodes |
| Memory growth | `showsNodeCount` increasing? | Nodes created but never removed |
| Wrong positions | Y-axis direction | Using view coordinates instead of scene |
| Transition crash | `willMove(from:)` cleanup? | Strong references to old scene |

## Resources

**WWDC**: 2014-608, 2016-610, 2017-609

**Docs**: /spritekit/skphysicsbody, /spritekit/maximizing-node-drawing-performance

**Skills**: axiom-spritekit, axiom-spritekit-ref
