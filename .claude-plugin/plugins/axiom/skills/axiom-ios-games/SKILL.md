---
name: axiom-ios-games
description: Use when building ANY 2D game, game prototype, or interactive simulation with SpriteKit. Covers scene graphs, physics, actions, game loops, rendering performance, SwiftUI integration.
license: MIT
---

# iOS Games Router

**You MUST use this skill for ANY game development, SpriteKit, SceneKit, or interactive simulation work.**

## When to Use

Use this router when:
- Building a new SpriteKit game or prototype
- Implementing physics (collisions, contacts, forces, joints)
- Setting up game architecture (scenes, layers, cameras)
- Debugging SpriteKit issues (contacts not firing, tunneling, frame drops)
- Optimizing game performance (draw calls, node counts, batching)
- Managing game loop, delta time, or pause handling
- Implementing touch/input handling in a game context
- Integrating SpriteKit with SwiftUI or Metal
- Working with particle effects or texture atlases
- Looking up SpriteKit API details

## Routing Logic

### SpriteKit

**Architecture, patterns, and best practices** → `/skill axiom-spritekit`
- Scene graph model, coordinate systems, anchor points
- Physics engine: bitmask discipline, contact detection, body types
- Actions system: sequencing, grouping, named actions, timing
- Input handling: touches, coordinate conversion
- Performance: draw calls, batching, object pooling, SKShapeNode trap
- Game loop: frame cycle, delta time, pause handling
- Scene transitions and data passing
- SwiftUI integration (SpriteView, UIViewRepresentable)
- Metal integration (SKRenderer)
- Anti-patterns and code review checklist
- Pressure scenarios with push-back templates

**API reference and lookup** → `/skill axiom-spritekit-ref`
- All 16 node types with properties and performance notes
- SKPhysicsBody creation methods and properties
- Complete SKAction catalog (movement, rotation, scaling, fading, composition, physics)
- Texture and atlas management
- SKConstraint types and SKRange
- SKView configuration and scale modes
- SKEmitterNode properties and presets
- SKRenderer setup and SKShader syntax

**Troubleshooting and diagnostics** → `/skill axiom-spritekit-diag`
- Physics contacts not firing (6-branch decision tree)
- Objects tunneling through walls (5-branch)
- Poor frame rate (4 top branches, 12 leaves)
- Touches not registering (6-branch)
- Memory spikes and crashes (5-branch)
- Coordinate confusion (5-branch)
- Scene transition crashes (5-branch)

### SceneKit (Future)

SceneKit skills are planned but not yet available. For 3D game development, use Apple's SceneKit documentation directly.

## Decision Tree

1. Building/designing a SpriteKit game? → axiom-spritekit
2. How to use a specific SpriteKit API? → axiom-spritekit-ref
3. Something broken or performing badly? → axiom-spritekit-diag
4. Physics contacts not working? → axiom-spritekit-diag (Symptom 1)
5. Frame rate dropping? → axiom-spritekit-diag (Symptom 3)
6. Coordinate/position confusion? → axiom-spritekit-diag (Symptom 6)
7. Need the complete action list? → axiom-spritekit-ref (Part 3)
8. Physics body setup reference? → axiom-spritekit-ref (Part 2)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "SpriteKit is simple, I don't need a skill" | Physics bitmasks default to 0xFFFFFFFF and cause phantom collisions. The bitmask checklist catches this in 2 min. |
| "I'll just use SKShapeNode, it's quick" | Each SKShapeNode is a separate draw call. 50 of them = 50 draw calls. axiom-spritekit has the pre-render-to-texture pattern. |
| "I can figure out the coordinate system" | SpriteKit uses bottom-left origin (opposite of UIKit). Anchor points add another layer. axiom-spritekit-diag Symptom 6 resolves in 5 min. |
| "Physics is straightforward" | Three different bitmask properties, modification rules inside callbacks, and tunneling edge cases. axiom-spritekit Section 3 covers all gotchas. |
| "The performance is fine on my device" | Performance varies dramatically across devices. axiom-spritekit Section 6 has the debug overlay checklist. |

## Critical Patterns

**axiom-spritekit**:
- PhysicsCategory struct with explicit bitmasks (default `0xFFFFFFFF` causes phantom collisions)
- Camera node pattern for viewport + HUD separation
- SKShapeNode pre-render-to-texture conversion
- `[weak self]` in all `SKAction.run` closures
- Delta time with spiral-of-death clamping

**axiom-spritekit-ref**:
- Complete node type table (16 types with batching behavior)
- Physics body creation methods (circle cheapest, texture most expensive)
- Full action catalog with composition patterns
- SKView debug overlays and scale mode matrix

**axiom-spritekit-diag**:
- 5-step bitmask checklist (2 min vs 30-120 min guessing)
- Debug overlays as mandatory first diagnostic step
- Tunneling prevention flowchart
- Memory growth diagnosis via `showsNodeCount` trending

## Example Invocations

User: "I'm building a SpriteKit game"
→ Invoke: `/skill axiom-spritekit`

User: "My physics contacts aren't firing"
→ Invoke: `/skill axiom-spritekit-diag`

User: "How do I create a physics body from a texture?"
→ Invoke: `/skill axiom-spritekit-ref`

User: "Frame rate is dropping in my game"
→ Invoke: `/skill axiom-spritekit-diag`

User: "How do I set up SpriteKit with SwiftUI?"
→ Invoke: `/skill axiom-spritekit`

User: "What action types are available?"
→ Invoke: `/skill axiom-spritekit-ref`

User: "Objects pass through walls"
→ Invoke: `/skill axiom-spritekit-diag`

User: "How do I organize my SpriteKit scene?"
→ Invoke: `/skill axiom-spritekit`

User: "My game uses too many draw calls"
→ Invoke: `/skill axiom-spritekit`

User: "How do physics bitmasks work?"
→ Invoke: `/skill axiom-spritekit`

User: "What particle emitter settings should I use for fire?"
→ Invoke: `/skill axiom-spritekit-ref`

User: "Memory keeps growing during gameplay"
→ Invoke: `/skill axiom-spritekit-diag`
