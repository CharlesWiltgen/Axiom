---
name: optimize-build
description: Scan Xcode project for build performance optimizations (launches build-optimizer agent)
---

# Optimize Build Performance

Launches the **build-optimizer** agent to scan your Xcode project for build performance optimization opportunities.

## What It Does

The agent will:
1. Scan build settings for quick wins (compilation mode, architecture settings)
2. Check build phase scripts for conditional execution
3. Identify type checking performance issues
4. Detect suboptimal compiler flags
5. Provide specific fixes with expected time savings

## Expected Results

Based on typical findings:
- **30-50% faster** incremental debug builds
- **5-10 seconds saved** per build from conditional scripts
- **Measurable improvements** in Build Timeline

## Prefer Natural Language?

Instead of using this command, you can simply say:
- "My builds are slow"
- "How can I speed up build times?"
- "Optimize my Xcode build performance"
- "Builds are taking forever"

The build-optimizer agent will automatically trigger.

## Deep Dive

For comprehensive build analysis and optimization workflows, use:
```bash
/skill axiom:build-performance
```

This provides Build Timeline interpretation, type checking deep dive, and incremental vs clean build comparison.
