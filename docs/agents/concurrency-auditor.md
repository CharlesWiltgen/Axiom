# concurrency-auditor

Automatically scans Swift code for Swift 6 strict concurrency violations to prevent data races.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my code for Swift 6 concurrency issues"
- "I'm getting data race warnings, can you scan for concurrency violations?"
- "Review my async code for concurrency safety"
- "Check if my code is ready for Swift 6 strict concurrency"

**Explicit command:**
```bash
/axiom:audit concurrency
```

## What It Checks

1. **Missing @MainActor** (CRITICAL) — UIViewController, UIView, ObservableObject without @MainActor
2. **Unsafe Task Captures** (HIGH) — Task { self.property } without [weak self]
3. **Sendable Violations** (HIGH) — Non-Sendable types passed across actor boundaries
4. **Actor Isolation Problems** (MEDIUM) — Accessing actor properties without await
5. **Thread Confinement Violations** (HIGH) — @MainActor properties accessed from background

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: green

## Related Skills

- **swift-concurrency** skill — Comprehensive Swift 6 concurrency patterns
