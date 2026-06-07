# /axiom:triage

Pull, classify, and rank production crash issues from Sentry or App Store Connect (launches the `triage-analyzer` agent).

## Command

```bash
/axiom:triage sentry
/axiom:triage asc
```

## What It Does

1. **Fetch grouped issues** — Pulls recent crash groups from Sentry or App Store Connect
2. **Classify crash families** — Maps each group to a `pattern_tag` (null pointer, Swift runtime, watchdog, etc.)
3. **Filter suspension noise** — Identifies idle-runloop and OS background-termination false positives that aren't actionable
4. **Cluster related groups** — Merges issues that share the same root cause across different stack variants
5. **Rank by impact** — Orders by affected-user count and crash rate, flagging regressions
6. **Generate triage report** — Ranked list with pattern, cluster, noise flag, and suggested next step

## When to Use

- You have a backlog of Sentry or App Store Connect crash groups and need to prioritize
- A release just shipped and you want to confirm what's regressed vs. pre-existing
- You suspect suspension/idle-runloop noise is inflating your crash count
- You need a team-readable report of the top crash families before a sprint

## Related

- [triage-analyzer](/agents/triage-analyzer) — The agent behind this command
- [production-triage](/skills/debugging/production-triage) — Skill with Sentry/ASC fetch patterns, clustering, and the suspension noise classifier
- [/axiom:analyze-crash](/commands/debugging/analyze-crash) — Use this instead when you have a single crash log to investigate
