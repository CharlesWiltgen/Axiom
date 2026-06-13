---
name: production-triage
description: Systematic workflow for triaging production crash groups from Sentry and App Store Connect — fetch, classify, cluster, filter suspension noise, and rank by user impact
---

# Production Crash Triage

Systematic workflow for triaging production crash groups from Sentry and App Store Connect. Pull the full picture before diving into any single crash — 20 minutes of triage prevents fixing the wrong thing while your top crash keeps climbing.

## When to Use This Skill

Use this skill when you're:
- Looking at a Sentry or App Store Connect dashboard with multiple crash groups and not sure where to start
- Preparing a triage report before a sprint or incident review
- Wondering whether a spike in crash count is real or driven by suspension/idle-runloop noise
- Trying to identify which crash families regressed in the latest build
- Clustering Sentry fingerprints that look different on the surface but share a root cause

**Core principle:** Understand the crash landscape before touching code. Fixing crash #3 while #1 affects 10× more users is a waste of a sprint.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Triage my Sentry crashes and tell me what to fix first."
- "What are my top crash families in App Store Connect?"
- "Is my crash rate inflated by suspension or idle-runloop noise?"
- "Which crashes appeared after my last release?"
- "Cluster these Sentry groups and tell me which ones are the same bug."
- "Show me a ranked report of production crashes by affected users."

## What This Skill Provides

### Sentry Fetch Patterns
- Querying the Sentry Issues API for grouped crash events
- Filtering by release version, environment, and time window
- Extracting stack traces, fingerprints, and per-group affected-user counts

### App Store Connect Fetch Patterns
- Using ASC MCP to pull crash organizer data programmatically
- Reading App Store Connect crash reports when MCP isn't available (manual export path)
- Correlating ASC crash groups with xcsym `pattern_tag` output

### Suspension and Idle-Runloop Noise Classification
- Recognizing idle-runloop hangs (`anr_idle_runloop`) — the app was parked in its runloop, not truly blocked — which `noise.anr_suspension.v1` ranks as noise
- Separating those from real main-thread blocks (`anr_main_thread_block`) and watchdog terminations (`0x8badf00d`), which are genuine responsiveness failures and are never flagged as noise
- Flag-never-hide policy: noise is surfaced in the report as "noise" so you can decide, not silently dropped

### Crash Family Clustering
- Grouping Sentry issues that share the same root frame but differ in thread count or stack depth
- Merging App Store Connect groups with similar exception codes and crash address offsets
- Naming clusters by the actionable pattern (e.g., "nil dereference in SessionManager") not the raw exception

### Impact Ranking
- Ordering crash families by unique affected users (not event count, which suspension noise skews)
- Flagging regressions: groups that first appeared or materially worsened in the most recent build
- Separating pre-existing background noise from newly introduced issues

## Key Pattern

### The Triage Report Structure

A well-formed triage report answers three questions for each crash family:

| Column | What It Tells You |
|--------|------------------|
| Pattern | What kind of failure it is (watchdog, nil deref, OOM, etc.) |
| Affected users | How many real users hit this, not inflated by suspension noise |
| Regression? | Did this appear or worsen after the latest build? |
| Noise? | Is this an OS-generated termination, not a code bug? |
| Next step | Investigate, monitor, dismiss, or escalate |

### Suspension Noise: The Common False Positive

App Store Connect and Sentry both surface background-task-expired and idle-runloop terminations as crashes. They look alarming but usually aren't:

- **Background task expired** – App failed to call `endBackgroundTask()` before the OS killed it. Fix the background task, or flag as noise if it's a deliberate "fire and forget."
- **Idle runloop termination** – App sat idle too long in the background. Not a code bug; the OS reclaimed resources. Dismiss unless your app is supposed to stay alive.

These two patterns account for a disproportionate share of "crash" noise in most dashboards.

## Documentation Scope

This page documents the `production-triage` skill — the workflow Claude uses when you ask about Sentry or App Store Connect crash groups. The skill contains complete fetch patterns, noise classification rules, clustering heuristics, and the ranked-report format.

The skill routes through the `axiom-performance` and `axiom-shipping` routers, so asking about production crashes or crash dashboards will automatically invoke this guidance.

## Related

- [testflight-triage](/skills/debugging/testflight-triage) – Use this instead when your crashes come from the Xcode Organizer or TestFlight feedback; production-triage covers Sentry and ASC programmatic access
- [axiom-data](/skills/persistence/grdb) – The `0xdead10cc` (file lock) crash pattern often traced to GRDB or SQLite; see GRDB for the fix
- [xcsym Reference](/reference/xcsym-ref) – The Axiom crash symbolication tool whose `pattern_tag` values this skill uses to classify families

## Resources

**Docs**: /xcode/diagnosing-issues-using-crash-reports-and-device-logs, /xcode/understanding-the-exception-types-in-a-crash-report

**Skills**: testflight-triage, xcsym-ref, crash-analyzer
