# foundation-models-auditor

Scans Foundation Models (Apple Intelligence) code for issues — both known anti-patterns like missing availability checks, main-thread `respond()` calls, manual JSON parsing of model output, and missing specific error catches, and architectural gaps like prompt-injection risk from direct user-text interpolation, `@Generable` enums without `@frozen` (future-case crash on iOS update), missing Cancel UX on long generations, missing transcript trimming for multi-turn chats, stale availability cache when users disable Apple Intelligence in Settings, missing retry logic for transient errors, and partial-output validation gaps.

## What It Does

- Detects 10 known anti-patterns (no `SystemLanguageModel.default.availability` check before `LanguageModelSession()`, synchronous `respond()` blocking main thread, manual `JSONDecoder` of model output instead of `@Generable`, missing `exceededContextWindowSize` catch, missing `guardrailViolation` / `contentFiltered` catch, session created in button handler, no streaming for long generations, missing `@Guide` on numeric/collection properties, nested type without `@Generable`, no fallback UI when unavailable)
- Identifies architectural gaps (user-controlled text interpolated directly into prompts without injection mitigation, `@Generable` enums not marked `@frozen`, missing Cancel control + `Task.cancel()` on streaming, no transcript trimming so multi-turn chats hit the context-window wall, Tool errors not distinguished from session errors, stale availability assumption when user toggles Apple Intelligence in Settings, streaming partial outputs displayed without empty/malformed validation, no session pooling across features, English-only error strings in localized apps, privacy-disclosure gap for on-device AI processing, optional-property output not validated, no retry on transient errors)
- Correlates findings that compound into higher severity (missing availability + no fallback UI = broken feature with no explanation, sync respond + view body = watchdog kill, manual JSON + nested types = silent field drops, missing guardrail catch + user-controlled prompts = retry loop on safety refusal, `@Generable` enum without `@frozen` + iOS update = production-only crash on a switch fallthrough)
- Produces a Foundation Models Hardening Health Score (PRODUCTION-READY / NEEDS HARDENING / FRAGILE)

## How to Use

**Natural language:**
- "Can you check my Foundation Models code for issues?"
- "Review my @Generable structs for correctness"
- "Audit my Apple Intelligence integration"
- "My LanguageModelSession keeps crashing"
- "Check if I'm handling Foundation Models errors properly"

**Explicit command:**
```bash
/axiom:audit foundation-models
```

## Related

- **foundation-models** skill (axiom-ai) — on-device AI implementation patterns (iOS 26+)
- **foundation-models-ref** skill (axiom-ai) — complete API reference with WWDC 2025 examples
- **foundation-models-diag** skill (axiom-ai) — Foundation Models troubleshooting
- **concurrency-auditor** agent — overlaps on main-thread `respond()` blocking
- **memory-auditor** agent — overlaps on long-lived session ownership and retain cycles
- **codable-auditor** agent — overlaps on `@Generable` decode-time issues (silent field drops, future-case enum decode)
- **energy-auditor** agent — overlaps on repeated inference battery cost
- **security-privacy-scanner** agent — overlaps on user content in prompts and privacy manifest disclosure
- **iap-auditor** agent — overlaps when AI features are gated by purchase entitlement
- **health-check** agent — includes foundation-models-auditor in project-wide scans
