---
name: spritekit-ref
description: SpriteKit API reference — node types, physics bodies, actions, textures, constraints, particles, SKRenderer
---

# SpriteKit API Reference

Complete API reference for SpriteKit organized by category. Covers all 16 node types, physics body creation and properties, the full action catalog, texture atlases, constraints, scene setup, particle emitters, and SKRenderer for Metal integration.

## When to Use This Reference

Use this reference when:
- Looking up specific SpriteKit API signatures or properties
- Checking physics body creation methods
- Finding the right SKAction for an animation
- Configuring SKEmitterNode particle properties
- Setting up SKView with debug overlays
- Looking up SKConstraint types
- Configuring SKShader for custom effects

## Example Prompts

- "How do I create a physics body from a texture?"
- "What SKAction types are available for movement?"
- "What properties does SKEmitterNode have?"
- "How do I set up SKRenderer for Metal?"
- "What are the SKView debug overlay options?"
- "What particle settings create a fire effect?"

## What's Covered

### Part 1: Node Hierarchy
All 16 node types with purpose, batchability, and performance notes. Key properties for SKSpriteNode (anchor points, color blend, lighting, shaders) and SKLabelNode (font, alignment, multiline).

### Part 2: Physics API
Body creation methods (circle, rectangle, polygon, texture, edge, compound). All physics body properties (mass, friction, restitution, damping). Force/impulse methods. SKPhysicsWorld configuration. All 5 joint types (pin, fixed, spring, sliding, limit). Physics field types (gravity, radial, electric, noise, vortex, drag).

### Part 3: Action Catalog
All action types organized by category: movement, rotation, scaling, fading, composition, texture/color, sound, node tree, physics. Timing modes and speed control.

### Part 4: Textures and Atlases
SKTexture creation (imageNamed, atlas, subrectangle, CGImage). Filtering modes (nearest for pixel art, linear for smooth). Atlas preloading. Animation from atlas frames.

### Part 5: Constraints
SKConstraint types: orient, position, distance, rotation. SKRange creation patterns. Constraint ordering and toggling.

### Part 6: Scene Setup
SKView configuration with all debug overlays. Scale mode matrix. All SKTransition types.

### Part 7: Particles
SKEmitterNode key properties organized by category (emission, position, movement, appearance, scale, rotation). Common particle preset settings for fire, smoke, sparks, rain, snow, trails, explosions.

### Part 8: SKRenderer and Shaders
SKRenderer Metal integration pattern. SKShader GLSL-like syntax with uniforms and built-in variables.

## Documentation Scope

This page documents the `axiom-spritekit-ref` skill. For architecture patterns and best practices, use the discipline skill. For troubleshooting, use the diagnostic skill.

- For game development patterns, see [SpriteKit](/skills/games/spritekit)
- For troubleshooting, see [SpriteKit Diagnostics](/diagnostic/spritekit-diag)
- For automated scanning, use [spritekit-auditor](/agents/spritekit-auditor)
