---
name: spritekit
description: SpriteKit game development — scene graph, physics, actions, performance, SwiftUI integration
---

# SpriteKit

Complete guide to building reliable SpriteKit games. Covers the scene graph model, physics engine, action system, game loop, rendering optimization, and integration with SwiftUI and Metal.

## When to Use

Use this skill when:
- Building a new SpriteKit game or interactive simulation
- Implementing physics (collisions, contacts, forces, joints)
- Setting up game architecture (scenes, layers, cameras)
- Optimizing frame rate or reducing draw calls
- Implementing touch/input handling in a game
- Managing scene transitions and data passing
- Integrating SpriteKit with SwiftUI or Metal
- Debugging physics contacts that don't fire

## Example Prompts

- "I'm building a SpriteKit platformer, how should I structure the scenes?"
- "My physics contacts aren't firing — what's wrong?"
- "How do I organize layers with a camera node?"
- "What's the correct way to handle touch in SpriteKit?"
- "My frame rate is dropping, how do I optimize?"
- "How do I integrate SpriteKit with SwiftUI?"
- "Objects are passing through walls in my game"

## What This Skill Provides

### Scene Graph Model
- Bottom-left origin coordinate system (opposite of UIKit)
- Anchor point mechanics for sprites and scenes
- Node tree hierarchy with z-ordering layers
- Camera node pattern for viewport control and HUD

### Physics Engine
- Bitmask discipline (the #1 source of SpriteKit bugs)
- PhysicsCategory struct pattern for named bitmasks
- Contact detection with delegate pattern
- Body types: dynamic volume, static volume, edge
- Tunneling prevention with precise collision detection
- Forces vs impulses for movement

### Actions System
- Sequencing, grouping, and repeating actions
- Named actions for cancellation and management
- Timing modes (linear, easeIn, easeOut, easeInEaseOut)
- Critical rule: never use actions on physics-controlled nodes

### Performance Optimization
- Debug overlays (showsFPS, showsNodeCount, showsDrawCount)
- Texture atlas batching for reduced draw calls
- SKShapeNode trap (1 draw call per instance, unbatchable)
- Object pooling for frequently spawned objects
- Offscreen node removal

### Game Loop
- 8-phase frame cycle understanding
- Delta time with spiral-of-death clamping
- Pause handling

### Anti-Patterns
- Default bitmasks (0xFFFFFFFF)
- Missing contactTestBitMask
- Actions fighting physics
- SKShapeNode for gameplay sprites
- Strong self capture in action closures

### Code Review Checklist
- 14-item verification covering physics, actions, performance, and scene management

### Pressure Scenarios
- Physics contacts deadline debugging
- Frame rate denial
- SKShapeNode sunk cost

## Related

- [SpriteKit API Reference](/reference/spritekit-ref) — Complete API tables for all node types, physics, actions, textures, and particles
- [SpriteKit Diagnostics](/diagnostic/spritekit-diag) — Decision trees for 7 common SpriteKit symptoms
- [spritekit-auditor](/agents/spritekit-auditor) — Automated scanning for SpriteKit anti-patterns
