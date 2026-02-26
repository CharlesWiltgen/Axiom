# foundation-models-auditor

Scans Foundation Models (Apple Intelligence) code for the 10 most critical violations — missing availability checks, main thread blocking, manual JSON parsing, missing error handling, and session lifecycle issues.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my Foundation Models code for issues?"
- "Review my @Generable structs for correctness"
- "Audit my Apple Intelligence integration"
- "My LanguageModelSession keeps crashing"

**Explicit command:**
```bash
/axiom:audit foundation-models
```

## What It Does

1. **No Availability Check** (CRITICAL) — Crash on devices without Apple Intelligence
2. **Synchronous respond() on Main Thread** (CRITICAL) — UI freeze and watchdog kill
3. **Manual JSON Parsing** (CRITICAL) — Use @Generable instead of JSONDecoder
4. **Missing exceededContextWindowSize Catch** (HIGH) — Needs conversation trimming
5. **Missing guardrailViolation Catch** (HIGH) — Needs user-facing safety messaging
6. **Session Created in Button Handler** (HIGH) — Wasteful recreation on every tap
7. **No Streaming for Long Generations** (MEDIUM) — Unresponsive UI during inference
8. **Missing @Guide Annotations** (MEDIUM) — Unconstrained numeric/collection output
9. **Nested Type Without @Generable** (MEDIUM) — Compilation or runtime failure
10. **No Fallback UI When Unavailable** (LOW) — Broken UI on unsupported devices

## Model & Tools

- **Model**: sonnet
- **Tools**: Glob, Grep, Read
- **Color**: cyan

## Related

- **foundation-models** — On-device AI implementation patterns (iOS 26+)
- **foundation-models-diag** — Foundation Models troubleshooting
- **foundation-models-ref** — Complete API reference with WWDC examples
