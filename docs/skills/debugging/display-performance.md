---
name: display-performance
description: Systematic diagnosis for frame rate issues on variable refresh rate displays like ProMotion
version: 1.0.0
---

# Display Performance

Systematic diagnosis for frame rate issues on variable refresh rate displays like ProMotion.

## When to Use

Use this skill when:
- Your app runs at 60fps on a ProMotion (120Hz) device
- MTKView or CADisplayLink isn't reaching expected frame rate
- You're experiencing micro-stuttering despite good average FPS
- You need to configure CAMetalDisplayLink for precise timing
- You want to monitor animation hitches in production

## Example Prompts

- "My Metal app is stuck at 60fps on iPhone Pro. Why?"
- "How do I configure MTKView for 120Hz?"
- "Why does UIScreen say 120 but I'm getting 60fps?"
- "What's the CADisableMinimumFrameDurationOnPhone key for?"
- "How do I use present(afterMinimumDuration:) for smooth frame pacing?"
- "How do I detect frame drops in my Metal app?"

## What This Skill Provides

- Decision tree for diagnosing why you're stuck at 60fps
- Render loop configuration patterns (MTKView, CADisplayLink, CAMetalDisplayLink)
- System cap detection (Low Power Mode, thermal throttling, Adaptive Power)
- Frame pacing APIs to eliminate micro-stuttering
- Hitch mechanics (commit hitches vs render hitches)
- Production telemetry with MetricKit

## Related

- [energy](/skills/debugging/energy) — Use when frame rate issues are battery-related or you need power-aware rendering
- [performance-profiling](/skills/debugging/performance-profiling) — Use for general Instruments profiling before diving into display-specific issues
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Use for SwiftUI view update performance, not Metal/CADisplayLink rendering
