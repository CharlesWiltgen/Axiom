---
name: metal-migration
description: Metal migration — OpenGL/DirectX porting, translation layers, native rewrite, phased migration, anti-patterns
---

# Metal Migration

Porting OpenGL/OpenGL ES or DirectX code to Metal on Apple platforms. Covers the decision between translation layers (MetalANGLE, MoltenVK) and native Metal rewrites, with phased migration strategies and common anti-patterns.

## When to Use

Use this skill when:
- Porting an OpenGL/OpenGL ES codebase to iOS or macOS
- Porting a DirectX codebase to Apple platforms
- Deciding between a translation layer (MetalANGLE) and a native Metal rewrite
- Planning a phased migration strategy for production apps
- Evaluating effort vs performance tradeoffs for GPU code

## Example Prompts

- "Should I use MetalANGLE or rewrite our renderer in Metal?"
- "How do I plan a phased migration from OpenGL to Metal?"
- "What are the biggest gotchas when porting GL to Metal?"
- "We have 50 GLSL shaders to convert, how should we approach this?"
- "My Metal port is slower than the original OpenGL version"
- "What's the difference between Metal and OpenGL state management?"

## What This Skill Provides

### Migration Strategy Decision Tree
- Quick demo path (MetalANGLE, MoltenVK) vs production path (native Metal)
- Tradeoffs table comparing time-to-demo, runtime overhead, shader changes, compute support, and future-proofing

### Translation Layer Setup
- MetalANGLE configuration for OpenGL ES to Metal
- When MetalANGLE fails (compute shaders, performance requirements, visionOS)

### Native Metal Rewrite
- 3-phase migration: Abstraction Layer, Metal Backend, Optimization
- Core architecture differences between OpenGL and Metal (state model, validation, shader compilation, command submission)
- MTKView setup with render pipeline, depth stencil, and vertex descriptors

### Anti-Patterns
- Keeping GL state machine mentality (30-60 min debugging cost)
- Ignoring coordinate system differences (2-4 hours debugging cost)
- Skipping Metal validation during development
- Single buffer without CPU/GPU synchronization (triple buffering pattern)

### Pre- and Post-Migration Checklists
- Shader inventory, extension audit, state management assessment
- Visual parity, performance parity, thermal and memory validation

### Pressure Scenarios
- "Just ship with MetalANGLE" deadline pressure
- "Port all shaders this sprint" scope pressure
- "We don't need GPU Frame Capture" tooling resistance

## Related

- [Metal Migration Reference](/reference/metal-migration-ref) — GLSL/HLSL to MSL conversion tables, API mappings, setup examples
- [Metal Migration Diagnostics](/diagnostic/metal-migration-diag) — Decision trees for black screen, shader errors, wrong colors, performance regressions, GPU crashes
