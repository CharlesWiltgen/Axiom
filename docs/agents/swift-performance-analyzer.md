# swift-performance-analyzer

Scans Swift code for performance issues — from known anti-patterns like unnecessary copies and ARC overhead to context-dependent problems like actor hops in tight loops and existential types in hot paths.

## What It Does

- Detects 8 known anti-patterns (unnecessary copies, ARC traffic, unspecialized generics, collection inefficiencies, actor overhead, large value types, inlining, memory layout)
- Identifies context-dependent performance issues (same code is acceptable in setup but devastating in a tight loop)
- Correlates findings that compound into higher severity
- Produces a Performance Health Score (OPTIMIZED / OVERHEAD / BOTTLENECKED)

**Note**: This agent checks Swift-level performance (ARC, copies, generics, actors). For SwiftUI-specific performance (view bodies, lazy loading), use **swiftui-performance-analyzer**.

## How to Use

**Natural language:**
- "Check my Swift code for performance issues"
- "Audit my code for optimization opportunities"
- "I'm seeing excessive memory allocations"

**Explicit command:**
```bash
/axiom:audit swift-performance
```

## Related

- **swift-performance** skill — use to profile and fix the issues this auditor finds
- **swiftui-performance-analyzer** agent — for SwiftUI view-specific performance (complementary)
- **memory-auditor** agent — overlaps on ARC and closure capture lifecycle
- **concurrency-auditor** agent — overlaps on actor isolation overhead
