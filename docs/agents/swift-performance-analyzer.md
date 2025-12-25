# swift-performance-analyzer

Scans Swift code for performance anti-patterns that cause slowdowns and excessive allocations.

## When to Use

- Auditing Swift code for performance issues
- Finding unnecessary copies and ARC overhead
- Detecting unspecialized generics
- Identifying collection inefficiencies
- Finding actor isolation costs
- Checking memory layout issues

## What It Detects

- **Unnecessary copies** — Value types copied when reference would suffice
- **ARC overhead** — Excessive retain/release cycles
- **Unspecialized generics** — Generic code not optimized for specific types
- **Collection inefficiencies** — Suboptimal collection usage patterns
- **Actor isolation costs** — Expensive actor hop patterns
- **Memory layout issues** — Poor struct packing, excessive padding

## Example Triggers

- "Check my Swift code for performance issues"
- "Audit my code for optimization opportunities"
- "I'm seeing excessive memory allocations"
- "Review my Swift performance anti-patterns"
- "Check if I'm using COW correctly"

## Related

- **swift-performance** — Swift performance optimization patterns
- **swiftui-performance** — SwiftUI-specific performance issues
- **memory-debugging** — Memory leak diagnosis
