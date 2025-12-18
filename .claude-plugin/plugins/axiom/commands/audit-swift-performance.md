---
name: audit-swift-performance
description: Scan Swift code for performance anti-patterns (launches swift-performance-analyzer agent)
---

# Swift Performance Audit

Launches the **swift-performance-analyzer** agent to scan for Swift performance anti-patterns that cause slowdowns, excessive allocations, and runtime overhead.

## What It Checks

**Critical Issues:**
- Excessive ARC traffic (weak where unowned works)
- Fine-grained actor calls in tight loops

**High Priority:**
- Unnecessary copies (large structs passed by value)
- Unspecialized generics (any instead of some)
- Actor isolation overhead (missing batching)

**Medium Priority:**
- Collection inefficiencies (missing reserveCapacity)
- Large value types without indirect storage
- Memory layout problems (poor field ordering)

**Low Priority:**
- Inlining issues (large @inlinable functions)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my Swift code for performance issues"
- "Scan for optimization opportunities"
- "I'm seeing excessive memory allocations"
- "Audit my code for Swift performance anti-patterns"
