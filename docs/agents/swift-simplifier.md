# swift-simplifier

Reports behavior-preserving Swift simplifications — guard/optional cleanups, `if`/`switch` expressions, collection idioms, redundant boilerplate, and dead availability guards — each tagged by how safe it is to apply. Point it at a file, a subsystem, or the whole project.

## What It Does

- Detects local, behavior-preserving Swift-language simplifications (control flow, optionals, collections, closures, boilerplate, error handling)
- Tags every finding SAFE / PRECONDITION / ADVISORY so you know what to verify before applying
- Flags always-true `if #available` guards against your deployment floor (Axiom-specific)
- Reports only — it does not edit; you apply findings (main loop, a simplify pass, or by hand)

**Note**: This is clarity-only and behavior-preserving. For old→new API migration use **modernization-helper**; for speed use **swift-performance-analyzer**; for SwiftUI structural moves (extract/decompose) use **swiftui-architecture-auditor**.

## How to Use

**Natural language:**
- "Simplify this Swift file"
- "Make MyService.swift more idiomatic"
- "Point swift-simplifier at the Networking subsystem"

**Explicit command:**
```bash
/axiom:audit swift-simplify
```

## Related

- **axiom-swift** skill — modern-idiom source this auditor draws from; use it to apply a finding
- **modernization-helper** agent — old→new API migration (complementary; owns `.filter{}.count` as a modernization)
- **swift-performance-analyzer** agent — speed rewrites (defer to it when clarity and perf conflict)
- **swiftui-architecture-auditor** agent — SwiftUI structural moves (this agent does local cleanups only)
