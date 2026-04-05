# memory-auditor

Scans for memory leaks — from known patterns like timer and observer mismatches to architectural issues like missing cleanup paths and unbounded collection growth.

## What It Does

- Detects 6 known leak patterns (timers, observers, closures, delegates, view callbacks, PhotoKit)
- Identifies architectural issues (missing deinit, partial cleanup, unbounded collection growth, inconsistent lifecycle management)
- Correlates findings that compound into higher severity
- Produces a Resource Lifecycle Health Score (CLEAN / NEEDS ATTENTION / LEAKING)

## How to Use

**Natural language:**
- "Can you check my code for memory leaks?"
- "Scan for potential memory leak patterns"
- "Review my code for retain cycles"

**Explicit command:**
```bash
/axiom:audit memory
```

## Related

- **memory-debugging** skill — use to diagnose and fix the issues this auditor finds, including Instruments workflows
- **concurrency-auditor** agent — overlaps on Task lifecycle and async sequence retention
- **health-check** agent — includes memory-auditor in project-wide scans
