---
name: build-debugging
description: Dependency and build configuration debugging for CocoaPods, SPM, and framework conflicts
version: 1.1.0
---

# Build Debugging

Guidance for dependency resolution and build configuration failures. The skill helps your assistant distinguish package, framework and project settings problems before choosing a fix.

## When to Use

Use this skill when:

- A newly added package produces a "No such module" error
- Several targets produce the same output file
- CocoaPods installs successfully but the project still fails to build
- Package resolution hangs, or frameworks have conflicting versions
- A build works locally but fails in CI
- Xcode 27 ignores `-ld_classic`, or dependency scanning reports duplicate Clang module names

## Example Prompts

- "I added a Swift package and now the compiler cannot find its module."
- "Why do two targets produce the same file?"
- "My build log says '-ld_classic is no longer supported and will be ignored' — does that matter?"
- "The build failed but the error scrolled away. Can you find it without rebuilding?"

## What This Skill Provides

- Dependency and framework search-path checks
- CocoaPods lockfile and installation diagnostics
- Package version and resolution troubleshooting
- Duplicate target-output investigation
- Build configuration comparisons across environments
- Xcode 27 linker and dependency-scanning guidance
- Build and test output saved through axbuild, or a plain log file where axbuild isn't available

## Build Diagnostic Capture

When your assistant runs a build or test, Axiom has it use axbuild where available. axbuild returns a short summary and saves the full report and compiler log, so the assistant can find the real error without rebuilding. The [build-fixer](/agents/build-fixer) agent asks before deleting caches or stopping processes. See [Tools](/tools/) for which setups include axbuild and what happens without it.

## Documentation Scope

This page introduces the build-debugging guidance in the `axiom-build` suite. Detailed diagnostic procedures live in the skill loaded by your assistant.

## Related

- [xcode-debugging](/skills/debugging/xcode-debugging) – Environment checks for Xcode and simulator problems
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Swift 6 isolation and concurrency build errors
- [build-fixer](/agents/build-fixer) – Autonomous diagnosis using retained build evidence
- [Tools](/tools/) – axbuild installation, report handling and compatibility limits
