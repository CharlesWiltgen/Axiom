---
name: triage
description: Triage a corpus of production crashes/hangs from Sentry or App Store Connect — classify, cluster into families, and flag suspension/idle-runloop false-positives
argument-hint: "[sentry|asc]"
disable-model-invocation: true
---

# Triage Production Crashes

Launches the **triage-analyzer** agent to pull grouped production issues from the named provider, classify and cluster them, and flag suspension/idle-runloop ANR false-positives — without hiding anything.

## Usage

```
/axiom:triage sentry
/axiom:triage asc
```

## What It Does

1. Fetches unresolved issues from the provider (Sentry token per the production-triage lookup order, scope-probed before the fetch; ASC via asc-mcp). Follows cursor pagination until the corpus is complete.
2. Ranks from the list payload, then normalizes event bodies into NormalizedReport JSONL for the issues analyzed in depth.
3. Runs `xcsym triage` to classify crashes + hangs, mechanically cluster by crashed-thread frame signature, and apply noise rules.
4. Merges clusters into root-cause families and ranks by users affected.
5. Produces a report that demotes likely-noise issues with reasons — never drops them.

## Prefer Natural Language?

You can also trigger this agent with:
- "Triage my Sentry crashes"
- "What are the top crash families in production?"
- "Show me which issues to fix first from App Store Connect"
