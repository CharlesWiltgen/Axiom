# memory-auditor

Automatically scans for the 6 most common memory leak patterns to prevent crashes and progressive memory growth.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my code for memory leaks?"
- "Scan for potential memory leak patterns"
- "Review my code for retain cycles"
- "Before I ship, can you check for memory issues?"

**Explicit command:**
```bash
/axiom:audit memory
```

## What It Checks

1. **Timer Leaks** (CRITICAL) — Timer.scheduledTimer(repeats: true) without .invalidate()
2. **Observer/Notification Leaks** (HIGH) — addObserver without removeObserver
3. **Closure Capture Leaks** (HIGH) — Closures in arrays capturing self strongly
4. **Strong Delegate Cycles** (MEDIUM) — Delegate properties without weak
5. **View Callback Leaks** (MEDIUM) — SwiftUI callbacks capturing self
6. **PhotoKit Accumulation** (LOW) — PHImageManager requests without cancellation

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: red

## Related Skills

- **memory-debugging** skill — Systematic memory leak diagnosis with Instruments
