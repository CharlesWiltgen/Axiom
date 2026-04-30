# spritekit-auditor

Scans SpriteKit game code for anti-patterns and architectural gaps — both known anti-patterns like default physics bitmasks, draw call waste, action memory leaks, and coordinate confusion, and architectural issues like leaked scenes from missing transition cleanup, runaway node accumulation, missing time-step clamping, and HUD layered on the scene root instead of the camera.

## What It Does

- Detects 8 known anti-patterns (default `0xFFFFFFFF` bitmasks, `SKShapeNode` for gameplay sprites, unbalanced `addChild`/`removeFromParent`, strong `self` in `SKAction` closures, view-coordinates in touch handlers, missing `isUserInteractionEnabled` on custom touch nodes, missing object pooling for hot spawns, missing debug overlays)
- Identifies architectural gaps (`physicsWorld.contactDelegate` set but bitmasks ungated, scene transitions without `removeAllActions()` and child cleanup, no offscreen/TTL cleanup for spawn-in-`update()` patterns, missing time-step clamping that lets the spiral-of-death teleport bodies through walls after backgrounding, gameplay textures not atlased, fast bodies without `usesPreciseCollisionDetection`, debug overlays not gated `#if DEBUG`, custom SKNode subclasses not releasing state on removal, no async texture preload, HUD attached to scene root instead of camera)
- Correlates findings that compound into higher severity (default bitmask + active `didBegin`, leaked scene + running infinite actions, node accumulation + spawn from `update()`, silent input dead zones + custom anchor points)
- Produces a SpriteKit Health Score (PERFORMANT / DEGRADED / UNPLAYABLE)

## How to Use

**Natural language:**
- "Can you check my SpriteKit code for issues?"
- "Audit my game for performance problems"
- "Scan my SpriteKit project for anti-patterns"
- "Check my physics bitmask setup"

**Explicit command:**
```bash
/axiom:audit spritekit
```

## Related

- **spritekit** skill — architecture patterns, PhysicsCategory discipline, camera/world/HUD layering, and the spiral-of-death clamp
- **spritekit-ref** skill — full SKNode/SKAction/physics API reference
- **spritekit-diag** skill — decision trees for contacts not firing, tunneling, frame drops, scene-transition crashes
- **memory-auditor** agent — overlaps on `[weak self]` capture in `SKAction.run` closures
- **concurrency-auditor** agent — overlaps on main-thread asset loading and `update(_:)` workload
- **swift-performance-analyzer** agent — overlaps on per-frame allocation hot paths
- **swiftui-performance-analyzer** agent — overlaps on `SpriteView` re-creation churn from parent re-renders
- **energy-auditor** agent — overlaps on always-on debug overlays in shipping builds
- **health-check** agent — includes spritekit-auditor in project-wide scans
