---
name: spritekit-diag
description: SpriteKit diagnostics — physics contacts, tunneling, frame drops, touch bugs, memory, coordinates, transitions
---

# SpriteKit Diagnostics

Systematic SpriteKit troubleshooting with decision trees and time-cost annotations. Covers the 7 most common SpriteKit symptoms that waste developer time.

## Symptoms This Diagnoses

Use when you're experiencing:
- `didBegin(_:)` never called (physics contacts not firing)
- Objects passing through walls (tunneling)
- Frame rate below 60fps (performance drops)
- `touchesBegan` not called on nodes
- Memory growing during gameplay
- Sprites appearing in wrong positions (coordinate confusion)
- Crashes during or after scene transitions

## Example Prompts

- "My physics contacts aren't firing, didBegin never gets called"
- "Bullets pass through walls in my game"
- "SpriteKit frame rate is dropping"
- "touchesBegan doesn't work on my sprite node"
- "Memory keeps growing during my game"
- "My sprite positions are Y-flipped"
- "App crashes when transitioning between scenes"

## Diagnostic Workflow

**Mandatory first step**: Enable debug overlays (`showsFPS`, `showsNodeCount`, `showsDrawCount`, `showsPhysics`). Most SpriteKit bugs become visually obvious with overlays enabled.

### Decision Trees

| Symptom | Branches | Time Saved |
|---------|----------|------------|
| Physics contacts not firing | 6 branches | 30-120 min → 2-5 min |
| Objects tunneling through walls | 5 branches | 20-60 min → 5 min |
| Poor frame rate | 4 top, 12 leaves | 2-4 hrs → 15-30 min |
| Touches not registering | 6 branches | 15-45 min → 2 min |
| Memory spikes/crashes | 5 branches | 1-3 hrs → 15 min |
| Coordinate confusion | 5 branches | 20-60 min → 5 min |
| Scene transition crashes | 5 branches | 30-90 min → 5 min |

### Quick Reference

| Symptom | First Check | Most Likely Cause |
|---------|------------|-------------------|
| Contacts don't fire | `contactDelegate` set? | Missing `contactTestBitMask` |
| Tunneling | Object speed vs wall thickness | Missing `usesPreciseCollisionDetection` |
| Low FPS | `showsDrawCount` | SKShapeNode in gameplay or missing atlas |
| Touches broken | `isUserInteractionEnabled`? | Default is `false` on non-scene nodes |
| Memory growth | `showsNodeCount` increasing? | Nodes created but never removed |
| Wrong positions | Y-axis direction | Using view coordinates instead of scene |
| Transition crash | `willMove(from:)` cleanup? | Strong references to old scene |

## Related

- [SpriteKit](/skills/games/spritekit) — Architecture patterns, anti-patterns, and code review checklist
- [SpriteKit API Reference](/reference/spritekit-ref) — Complete API tables for all SpriteKit classes
- [spritekit-auditor](/agents/spritekit-auditor) — Automated scanning for SpriteKit anti-patterns
