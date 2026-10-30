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
- Reading mouse deltas and keyboard state for gameplay (iPad pointer, iPhone Mirroring)
- Making a Mac game work on a touch-display Mac or a Sidecar iPad

## Example Prompts

- "I'm porting my game to iPhone — how do I add touch controls?"
- "How do I make the whole left half of the screen a virtual thumbstick?"
- "My touch controls cover the character — how should I lay them out?"
- "How do I handle game controller input alongside touch?"
- "How do I let players remap the controller Home button?"
- "How do I track a spatial accessory on Vision Pro?"
- "How do I read GCMouse deltas for camera look in my iPad game?"
- "How do I handle WASD keyboard input with GCKeyboard?"

## What This Skill Provides

### One GCController Pipeline
- Touch controls surface as a `GCController` — existing controller logic needs no changes
- The Game Controllers capability that declares controller support, and on-screen button prompts that follow players' button remapping in Settings

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

### Mouse and Keyboard as Game Input
- `GCMouse` delta-based look/aim, scroll as a direction pad, `GCKeyboard.coalesced` key handlers — same connect/handler pattern as controllers

### Touch on a Touch-Display Mac
- How AppKit emulates the mouse for games, and why a pointer position built from deltas drifts under touch
- The extra `GCMouse` that each touch surface appears as, and opting out with `NSIsTouchNative`
- Touch-only gesture recognizers on the game view, routed to whichever input context is active

## Related

- [SpriteKit](/skills/games/spritekit) – Touch handling inside SpriteKit scenes; this skill covers on-screen controls and controllers
- [touch](/skills/macos/touch) – App-level touch on the Mac (tracking loops, hit targets, system gestures) that the game section builds on
- [Metal Migration](/skills/games/metal-migration) – Porting the rest of the game (rendering, shaders, Game Porting Toolkit)
- [RealityKit](/skills/games/realitykit) – 3D and spatial games that consume the same controller input
