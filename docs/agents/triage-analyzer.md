# triage-analyzer

Pulls grouped crash issues from Sentry or App Store Connect, classifies and clusters crash families, filters suspension/idle-runloop noise, and produces a ranked impact report.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Triage my Sentry crashes"
- "What are the top crash families in App Store Connect?"
- "Which crashes should I fix first before my next release?"
- "Is my crash count inflated by suspension noise?"
- "Give me a ranked list of production crashes"

**Explicit command:**
```bash
/axiom:triage sentry
/axiom:triage asc
```

## What It Does

1. **Pull grouped issues** – Fetches recent crash groups from Sentry (via API) or App Store Connect (via ASC MCP or manual export)
2. **Classify crash families** – Maps each group to a crash pattern (null pointer, watchdog, Swift runtime error, OOM, etc.) using xcsym pattern tags where available
3. **Filter suspension noise** – Identifies idle-runloop and background-termination events that the OS generates but which aren't true app crashes; flags them rather than hiding them so you can make the call
4. **Cluster related groups** – Merges crash groups that share the same root cause but surface under different threads or stack variants
5. **Rank by impact** – Orders the final list by affected-user count and session crash rate, and flags groups that appeared or worsened after the most recent build
6. **Report** – Produces a ranked triage table: crash family, pattern, affected users, noise flag, and a suggested next step (investigate, monitor, or dismiss)

## Related

- [crash-analyzer](/agents/crash-analyzer) – Use when you have a single `.ips` or `.crash` report; triage-analyzer works on aggregated groups, not individual files
- [production-triage](/skills/debugging/production-triage) – The skill that provides Sentry/ASC fetch patterns, noise classification rules, and clustering heuristics
- [xcsym Reference](/reference/xcsym-ref) – The crash symbolication tool whose `pattern_tag` output the agent uses to classify families
