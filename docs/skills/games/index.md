# Games

Skills for building games and interactive 3D experiences on Apple platforms using SpriteKit, SceneKit, and RealityKit.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03
    classDef agent fill:#f8d7da,stroke:#dc3545,color:#58151c

    axiom_ios_games["ios-games router"]:::router

    subgraph skills_d["Skills"]
        spritekit["spritekit"]:::discipline
        scenekit["scenekit"]:::discipline
        realitykit["realitykit"]:::discipline
    end
    axiom_ios_games --> skills_d

    subgraph skills_r["References"]
        spritekit_ref["spritekit-ref"]:::reference
        scenekit_ref["scenekit-ref"]:::reference
        realitykit_ref["realitykit-ref"]:::reference
    end
    axiom_ios_games --> skills_r

    subgraph skills_diag["Diagnostics"]
        spritekit_diag["spritekit-diag"]:::diagnostic
        realitykit_diag["realitykit-diag"]:::diagnostic
    end
    axiom_ios_games --> skills_diag

    subgraph agents_sg["Agents"]
        agent_ska["spritekit-auditor"]:::agent
    end
    axiom_ios_games --> agents_sg
```

## Available Skills

### SpriteKit

Complete guide to building 2D games with SpriteKit. Covers the scene graph model, physics engine (bitmask discipline, contact detection, body types), action system, game loop, performance optimization, and SwiftUI/Metal integration.

- [SpriteKit](/skills/games/spritekit) — Architecture, patterns, anti-patterns, and code review checklist

## Available Agents

- [spritekit-auditor](/agents/spritekit-auditor) — Scans SpriteKit code for physics bitmask issues, draw call waste, node accumulation, and action memory leaks

## Available References

- [SpriteKit API](/reference/spritekit-ref) — All 16 node types, physics body creation, complete action catalog, texture atlases, constraints, particles, SKRenderer

## Available Diagnostics

- [SpriteKit Diagnostics](/diagnostic/spritekit-diag) — Decision trees for contacts not firing, tunneling, frame drops, touch bugs, memory spikes, coordinate confusion, transition crashes

## Example Prompts

- "I'm building a SpriteKit game"
- "My physics contacts aren't firing"
- "Frame rate is dropping in my game"
- "How do I set up SpriteKit with SwiftUI?"
- "Objects pass through walls in my game"
- "Audit my SpriteKit code for issues"
