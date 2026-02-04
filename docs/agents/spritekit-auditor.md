# spritekit-auditor

Scans SpriteKit game code for the 8 most common anti-patterns that cause physics bugs, performance issues, and memory leaks.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my SpriteKit code for issues?"
- "Audit my game for performance problems"
- "Scan my SpriteKit project for anti-patterns"
- "Check my physics bitmask setup"

**Explicit command:**
```bash
/axiom:audit spritekit
```

## What It Checks

### Critical
- **Physics bitmask issues** — Default `0xFFFFFFFF` masks, missing `contactTestBitMask`, magic number bitmasks without named constants

### High Priority
- **Draw call waste** — `SKShapeNode` used for gameplay sprites (1 draw call each, unbatchable), missing texture atlases
- **Node accumulation** — Nodes created but never removed, `addChild` without matching `removeFromParent`
- **Action memory leaks** — Strong `self` capture in `SKAction.run` closures, `repeatForever` without `withKey:`

### Medium Priority
- **Coordinate confusion** — `touch.location(in: self.view)` instead of `touch.location(in: self)`
- **Touch handling bugs** — `touchesBegan` implemented without `isUserInteractionEnabled = true`
- **Missing object pooling** — `SKSpriteNode` creation inside `update()` or spawn functions

### Low Priority
- **Missing debug overlays** — No `showsFPS`, `showsNodeCount`, or `showsDrawCount` configured

## Example Output

```markdown
## SpriteKit Audit Results

### Summary
- **CRITICAL Issues**: 2 (Physics bitmask problems)
- **HIGH Issues**: 3 (Draw call waste, action leaks)
- **MEDIUM Issues**: 1 (Touch handling)

### CRITICAL: Default Bitmask
**File**: `GameScene.swift:45`
**Issue**: collisionBitMask not set (defaults to 0xFFFFFFFF)
**Impact**: Body collides with everything, causing phantom collisions
**Fix**: Set explicit collisionBitMask using PhysicsCategory struct
```

## Model & Tools

- **Model**: sonnet (needs code understanding for pattern analysis)
- **Tools**: Glob, Grep, Read
- **Color**: green

## Related

- [SpriteKit](/skills/games/spritekit) — Architecture patterns and anti-patterns
- [SpriteKit API Reference](/reference/spritekit-ref) — Complete API tables
- [SpriteKit Diagnostics](/diagnostic/spritekit-diag) — Decision trees for common symptoms
