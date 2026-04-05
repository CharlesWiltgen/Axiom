# concurrency-auditor

Scans Swift code for concurrency issues — from known anti-patterns to architectural problems like missing isolation, incoherent concurrency strategies, and incomplete cancellation.

## What It Does

- Detects 8 known anti-patterns (missing @MainActor, unsafe Task captures, Sendable violations, actor isolation, thread confinement, and more)
- Identifies architectural issues (async≠background misconceptions, permanent escape hatches, GCD mixed with actors)
- Correlates findings that compound into higher severity
- Produces a Concurrency Health Score (READY / NEEDS WORK / NOT READY)

## How to Use

**Natural language:**
- "Check my code for Swift 6 concurrency issues"
- "I'm getting data race warnings, can you scan for concurrency violations?"
- "Review my async code for concurrency safety"

**Explicit command:**
```bash
/axiom:audit concurrency
```

## Related

- **swift-concurrency** skill — the concurrency patterns this auditor checks against
- **memory-auditor** agent — overlaps on Task lifecycle and cancellation findings
- **health-check** agent — includes concurrency-auditor when async/await/actor code is detected
