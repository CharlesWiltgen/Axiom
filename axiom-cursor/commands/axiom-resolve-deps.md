---
name: axiom-resolve-deps
description: "Diagnose and resolve Swift Package Manager dependency conflicts (Delegate to the `spm-conflict-resolver` subagent)"
---


# Resolve Dependency Conflicts

Delegate to the **spm-conflict-resolver** subagent to diagnose Swift Package Manager resolution failures, version conflicts, and the link errors they cause.

## What It Does

The agent will:
1. Read `Package.swift` and `Package.resolved` to map the declared and resolved dependency graphs
2. Identify version conflicts where two packages require incompatible versions of a shared dependency
3. Trace "No such module" errors back to an unresolved or misnamed product
4. Diagnose duplicate-symbol link errors caused by a package vendored twice
5. Check Swift 6 language-mode compatibility across the graph
6. Propose concrete version pins or `Package.swift` edits, with the tradeoff of each

## Prefer Natural Language?

You can also trigger this agent by saying:
- "SPM won't resolve my dependencies"
- "I'm getting 'No such module' after adding a package"
- "Duplicate symbol linker error"
- "Two packages require different versions of the same dependency"
- "This package won't build with Swift 6"
