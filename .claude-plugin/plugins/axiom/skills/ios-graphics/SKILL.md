---
name: ios-graphics
description: Use when working with ANY GPU rendering, Metal, OpenGL migration, shaders, or graphics programming. Covers Metal migration from OpenGL/DirectX, shader conversion, GPU debugging, translation layers.
---

# iOS Graphics Router

**You MUST use this skill for ANY GPU rendering or graphics programming work.**

## When to Use

Use this router when:
- Porting OpenGL/OpenGL ES code to Metal
- Porting DirectX code to Metal
- Converting GLSL/HLSL shaders to Metal Shading Language
- Setting up MTKView or CAMetalLayer
- Debugging GPU rendering issues (black screen, wrong colors, crashes)
- Evaluating translation layers (MetalANGLE, MoltenVK)
- Optimizing GPU performance or fixing thermal throttling

## Routing Logic

### Metal Migration

**Strategy decisions** → `/skill metal-migration`
- Translation layer vs native rewrite decision
- Project assessment and migration planning
- Anti-patterns and common mistakes
- Pressure scenarios for deadline resistance

**API reference & conversion** → `/skill metal-migration-ref`
- GLSL → MSL shader conversion tables
- HLSL → MSL shader conversion tables
- GL/D3D API → Metal API equivalents
- MTKView setup, render pipelines, compute shaders
- Complete WWDC code examples

**Diagnostics** → `/skill metal-migration-diag`
- Black screen after porting
- Shader compilation errors
- Wrong colors or coordinate systems
- Performance regressions
- Time-cost analysis per diagnostic path

## Decision Tree

```
User asks about GPU/graphics/Metal
  ├─ "Should I use translation layer or native?" → metal-migration
  ├─ "How do I migrate/port/convert?" → metal-migration
  ├─ "Show me the API/code/example" → metal-migration-ref
  ├─ "How do I set up MTKView?" → metal-migration-ref
  └─ "Something's broken/wrong/slow" → metal-migration-diag
```

## Critical Patterns

**metal-migration**:
- Translation layer (MetalANGLE) for quick demos
- Native Metal rewrite for production
- State management differences (GL stateful → Metal explicit)
- Coordinate system gotchas (Y-flip, NDC differences)

**metal-migration-ref**:
- Complete shader type mappings
- API equivalent tables
- MTKView vs CAMetalLayer decision
- Render pipeline setup patterns

**metal-migration-diag**:
- GPU Frame Capture workflow (2-5 min vs 30+ min guessing)
- Shader debugger for variable inspection
- Metal validation layer for API misuse
- Performance regression diagnosis

## Example Invocations

User: "Should I use MetalANGLE or rewrite in native Metal?"
→ Invoke: `/skill metal-migration`

User: "I'm porting projectM from OpenGL ES to iOS"
→ Invoke: `/skill metal-migration`

User: "How do I convert this GLSL shader to Metal?"
→ Invoke: `/skill metal-migration-ref`

User: "Setting up MTKView for the first time"
→ Invoke: `/skill metal-migration-ref`

User: "My ported app shows a black screen"
→ Invoke: `/skill metal-migration-diag`

User: "Performance is worse after porting to Metal"
→ Invoke: `/skill metal-migration-diag`
