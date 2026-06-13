---
name: game-input
description: Game input — on-screen touch controls with TouchController, unified GCController handling, and the GameController additions new in the 27 releases
---

# Game Input

Guide to player input for games on Apple platforms: on-screen touch controls with the TouchController framework (iOS/iPadOS), unified game controller handling through GCController, and the GameController framework additions new in the 27 releases (controller Home button settings, visionOS spatial accessories).

## When to Use

Use this skill when:
- Adding touch controls to a controller-based game (including Mac/console ports)
- Designing on-screen control layouts that adapt across iPhone and iPad
- Handling game controller input (polling vs change handlers)
- Letting players customize the controller Home button action (new in the 27 releases)
- Reading spatial accessory input on visionOS 27

## Example Prompts

- "I'm porting my game to iPhone — how do I add touch controls?"
- "How do I make the whole left half of the screen a virtual thumbstick?"
- "My touch controls cover the character — how should I lay them out?"
- "How do I handle game controller input alongside touch?"
- "How do I let players remap the controller Home button?"
- "How do I track a spatial accessory on Vision Pro?"

## What This Skill Provides

### One GCController Pipeline
- Touch controls surface as a `GCController` — existing controller logic needs no changes

### Touch Controller Setup
- `TCTouchController` creation, connect/disconnect, Metal rendering, UIKit touch routing

### Control Catalog
- Buttons, switches, thumbsticks, direction pads, throttles, touchpads; standard and custom labels

### Flexible Layout
- Nine anchor points, safe-area-adjusted offsets, half-screen collider shapes (`.leftSide`/`.rightSide`)

### Fluid Interaction Patterns
- Context-sensitive icons, hiding unused controls, sprint from tilt magnitude, touchpad cameras, collapsing multi-finger combos

### GameController 27 Additions
- `GCControllerHomeButtonSettingsManager` (iOS/macOS/visionOS 27)
- visionOS 27 spatial accessories: `GCSpatialAccessory`, typed connect/disconnect messages, anchor-timestamp-aligned input

## Related

- [SpriteKit](/skills/games/spritekit) – Touch handling inside SpriteKit scenes; this skill covers on-screen controls and controllers
- [Metal Migration](/skills/games/metal-migration) – Porting the rest of the game (rendering, shaders, Game Porting Toolkit)
- [RealityKit](/skills/games/realitykit) – 3D and spatial games that consume the same controller input
