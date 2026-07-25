---
name: resolve-deps
description: Diagnose Swift Package Manager resolution failures, version conflicts, and the link errors they cause
---

# resolve-deps

Diagnose why Swift Package Manager won't resolve, or why a package that resolved still won't build.

## What This Command Does

Launches the **spm-conflict-resolver** agent. It reads `Package.swift` and `Package.resolved` to reconstruct the declared and resolved dependency graphs, then explains the conflict rather than just reporting that one exists.

## What It Checks

1. **Version conflicts** – two packages requiring incompatible versions of a shared transitive dependency
2. **"No such module"** – traced back to an unresolved package, a renamed product, or a target that never declared the dependency
3. **Duplicate symbol link errors** – usually the same package vendored twice through different paths
4. **Swift 6 compatibility** – packages that don't build under the language mode your target uses
5. **Resolution vs. build failures** – distinguishing "SPM cannot pick versions" from "SPM picked versions that don't compile together"

## Usage

```
/axiom:resolve-deps
```

## Related

- [spm-conflict-resolver](/agents/spm-conflict-resolver) – The agent that powers this command
- [fix-build](/commands/build/fix-build) – Start here if the build fails for reasons unrelated to packages; it checks environment causes first
