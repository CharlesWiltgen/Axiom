---
name: audit-spritekit
description: Scan SpriteKit code for physics bitmask bugs, draw call waste, node accumulation, action leaks
---

# audit-spritekit

Scan SpriteKit game code for the most common bugs that cause physics misbehavior, frame drops, and memory growth.

## What This Command Does

Launches the **spritekit-auditor** agent to find scene-graph and physics issues that don't show up in tests but cripple gameplay performance.

## What It Checks

1. **Physics bitmask issues** — `categoryBitMask` and `contactTestBitMask` set in conflicting ways, causing missed collisions or false positives
2. **Draw-call waste** — texture atlas misuse, unbatched sprite renders, redundant `SKShapeNode` allocations per frame
3. **Node accumulation** — nodes added to the scene that are never removed, causing the tree to grow indefinitely
4. **Action leaks** — `SKAction` sequences with retain cycles via closures, or repeating actions never cancelled
5. **Coordinate confusion** — mixing scene/view/screen coordinate spaces, especially around `convertPoint(toView:)`

## Related Agent

- [spritekit-auditor](/agents/spritekit-auditor) — The agent that powers this command
- [spritekit-ref](/reference/spritekit-ref) — SpriteKit API reference
