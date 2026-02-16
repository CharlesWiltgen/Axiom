---
name: metal-migration-ref
description: Metal migration reference — GLSL to MSL, HLSL to MSL, OpenGL to Metal API mappings, MTKView setup, compute shaders
---

# Metal Migration Reference

Complete reference for converting OpenGL/DirectX code to Metal. Covers shader language conversion tables, API equivalents, and setup code for MTKView, CAMetalLayer, and compute pipelines.

## When to Use This Reference

Use this reference when:
- Converting GLSL shaders to Metal Shading Language (MSL)
- Converting HLSL shaders to MSL
- Looking up OpenGL or DirectX API equivalents in Metal
- Setting up MTKView or CAMetalLayer
- Building render or compute pipelines
- Using Apple's Metal Shader Converter for DirectX

## Example Prompts

- "How do I convert this GLSL shader to Metal?"
- "What's the MSL equivalent of vec4 and texture()?"
- "How do I convert HLSL semantics to Metal attributes?"
- "What does glDrawElements map to in Metal?"
- "How do I set up a Metal compute shader?"
- "What are the buffer storage modes in Metal?"

## What's Covered

- **GLSL to MSL type mappings** -- vec4 to float4, sampler2D to texture2d + sampler, matrix types, precision qualifiers
- **GLSL to MSL built-in variable mappings** -- gl_Position, gl_FragCoord, gl_VertexID and their MSL attribute equivalents
- **GLSL to MSL function mappings** -- texture(), mod(), inversesqrt(), atan() and their MSL counterparts
- **Complete vertex/fragment shader conversion examples** -- Side-by-side GLSL and MSL with struct definitions, uniform buffers, and texture sampling
- **HLSL to MSL type and semantic mappings** -- SV_Position, SV_Target, dispatch thread IDs
- **Metal Shader Converter** -- Apple's tool for converting DXIL bytecode to Metal libraries, with workflow and options
- **OpenGL API to Metal API tables** -- View/context setup, resource creation, state management, draw commands, primitive types
- **Complete setup examples** -- MTKView (recommended), CAMetalLayer (custom control), compute shader pipeline
- **Buffer storage modes** -- Shared, private, managed (macOS) with use case guidance
- **Buffer alignment** -- Critical float3/SIMD3 alignment rules for CPU-GPU shared structs

## Documentation Scope

This page documents the `axiom-metal-migration-ref` skill. For migration strategy and planning, use the discipline skill. For troubleshooting porting issues, use the diagnostic skill.

- For migration planning, see [Metal Migration](/skills/games/metal-migration)
- For troubleshooting, see [Metal Migration Diagnostics](/diagnostic/metal-migration-diag)

## Related

- [Metal Migration](/skills/games/metal-migration) -- Migration strategy, phased approach, and anti-patterns
- [Metal Migration Diagnostics](/diagnostic/metal-migration-diag) -- Troubleshooting black screen, shader errors, GPU crashes
- [RealityKit API Reference](/reference/realitykit-ref) -- RealityKit uses Metal under the hood

## Resources

**WWDC**: 2019-611, 2020-10631

**Docs**: /metal, /metal/shader-libraries
