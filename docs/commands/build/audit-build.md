---
name: audit-build
description: Scan project for build-time optimization opportunities — slow type checking, expensive build phases, parallelization
---

# audit-build

Scan the Xcode project for build-performance issues that add seconds to every incremental compile.

## What This Command Does

Launches the **build-optimizer** agent to identify build configuration and code patterns that slow down compilation, then recommend specific changes that typically reduce build times by 30–50%.

## What It Checks

1. **Slow type checking** – Swift expressions exceeding the type-checker's complexity threshold, often resolved by adding type annotations
2. **Expensive build phases** – shell scripts running on every build that should be cached or moved to derived data
3. **Suboptimal build settings** – debug optimization mismatches, missing module verification, redundant compilation
4. **Parallelization opportunities** – serial dependencies that could fan out, framework-vs-static decisions
5. **Whole-module vs incremental** – release/debug configs misconfigured for the build mode

## Related Agent

- [build-optimizer](/agents/build-optimizer) – The agent that powers this command
