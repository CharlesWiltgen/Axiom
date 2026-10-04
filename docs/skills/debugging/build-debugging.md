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
- "Find the actionable error in my saved build report before rebuilding."
- "Use axbuild for the next necessary test and explain incomplete collection."

## What This Skill Provides

- Dependency and framework search-path checks
- CocoaPods lockfile and installation diagnostics
- Package version and resolution troubleshooting
- Duplicate target-output investigation
- Build configuration comparisons across environments
- Xcode 27 linker and dependency-scanning guidance
- Retained build evidence through axbuild, with a saved-log fallback

## Build Diagnostic Capture

For a necessary build or test, axbuild returns bounded JSON and retains the complete report and compiler log. Inspect native `command` status, `collection` issues and `omissions`; read saved evidence before rebuilding. Cleanup must follow a confirmed cause and appropriate authorization. See [Tools](/tools/) for installation and harness availability.

## Documentation Scope

This page introduces the build-debugging guidance in the `axiom-build` suite. Detailed diagnostic procedures live in the skill loaded by your assistant.

## Related

- [xcode-debugging](/skills/debugging/xcode-debugging) – Environment checks for Xcode and simulator problems
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Swift 6 isolation and concurrency build errors
- [build-fixer](/agents/build-fixer) – Autonomous diagnosis using retained build evidence
- [Tools](/tools/) – axbuild installation, report handling and compatibility limits
