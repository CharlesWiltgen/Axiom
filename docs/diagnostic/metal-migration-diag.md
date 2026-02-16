---
name: metal-migration-diag
description: Metal migration diagnostics — black screen, shader errors, wrong colors, performance regression, GPU crashes
---

# Metal Migration Diagnostics

Systematic diagnosis for common Metal porting issues with decision trees and time-cost annotations. Covers the 5 most common symptoms when migrating from OpenGL or DirectX to Metal.

## Symptoms This Diagnoses

Use when you're experiencing:
- Black screen after porting to Metal
- Shader compilation errors (GLSL to MSL conversion)
- Wrong colors, upside-down images, or mirrored rendering
- Performance worse than the original OpenGL/DirectX version
- Crashes during GPU work (EXC_BAD_ACCESS, command buffer aborts, GPU timeouts)

## Example Prompts

- "My Metal view is showing a black screen after porting from OpenGL"
- "I'm getting shader compilation errors converting GLSL to MSL"
- "The rendering is upside down after porting to Metal"
- "Colors are swapped red and blue in my Metal renderer"
- "My Metal port is slower than the OpenGL version"
- "App crashes with 'command buffer was aborted'"

## Diagnostic Workflow

**Mandatory first step**: Enable Metal validation (Metal API Validation, Metal Shader Validation, GPU Frame Capture) in Xcode scheme diagnostics. Most Metal bugs produce clear validation errors. Time cost: 30 seconds setup vs hours of blind debugging.

### Decision Trees

| Symptom | Branches | Time Saved |
|---------|----------|------------|
| Black screen | 8 branches (drawable, pipeline, draw calls, resources, coordinates, clear color) | 1-4 hrs to 5-10 min |
| Shader compilation errors | 7 branches (undeclared identifiers, texture sampling, type mismatches, attribute ranges) | 15-30 min/shader to 2-5 min |
| Wrong colors/coordinates | 7 branches (Y-flip, mirroring, color swap, sRGB, depth fighting, clipping, transparency) | 1-2 hrs to 5-10 min |
| Performance regression | 8 branches (validation overhead, resource creation, PSO per frame, draw calls, sync stalls, buffer updates, storage modes) | hours to 15-30 min |
| GPU crashes | 6 branches (released resources, GPU timeout, validation errors, missing render targets, out-of-bounds, GPU hang) | hours to 15-30 min |

### Debugging Tools Quick Reference

- **GPU Frame Capture** (Cmd+Opt+Shift+G) -- inspect buffers, textures, draw call sequence, shader variables
- **Metal System Trace** (Instruments) -- GPU/CPU timeline analysis, synchronization stalls
- **Shader Debugger** -- step through shader execution, inspect per-pixel/vertex values

## Related

- [Metal Migration](/skills/games/metal-migration) — Migration strategy, phased planning, architecture differences, anti-patterns
- [Metal Migration Reference](/reference/metal-migration-ref) — GLSL/HLSL to MSL conversion tables, API equivalents, setup code
