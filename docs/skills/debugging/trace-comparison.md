---
name: trace-comparison
description: Use when comparing two performance traces, detecting CPU regressions between builds, or gating CI on performance — function-level deltas with xcprof compare and a non-zero exit code your pipeline can fail on
---

# Trace Comparison

Diff two Instruments `.trace` recordings into function-level regression/improvement deltas with `xcprof compare`, and gate CI on the result. Replaces the old "export both traces and eyeball the XML" approach with a real before/after diff and a non-zero exit code.

## When to Use This Skill

Use this skill when you're:
- Checking whether a change slowed down a hot path ("did this PR regress CPU?")
- Gating a merge on performance in CI
- Quantifying how much an optimization actually helped
- Tired of manually diffing two exported trace XMLs

**Core principle:** Only CPU-cycle *share* is comparable across two runs — raw cycles and milliseconds depend on total work and duration, so compare reports percentage-point deltas.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Did my change regress CPU performance? Here are two traces."
- "Compare baseline.trace and current.trace for regressions."
- "How do I gate my CI on performance regressions?"
- "What does the `severity` number in the compare output mean?"
- "Why are some frames missing from the comparison?"
- "What threshold should I use for `--fail-on-regression`?"

## What This Skill Provides

- **The two-trace workflow** — record a baseline, make the change, record the current trace exercising the *same* workload, then compare.
- **Reading the deltas** — inclusive vs self share, severity ranking (% delta × absolute time), and the regression/improvement classification.
- **A CI recipe** — a shell gate plus a GitHub Actions example using `--fail-on-regression`.
- **Exit-code semantics** — `0` clean, `2` usage/environment error, `3` regression met the threshold under the gate, `8` output-write error.
- **Honest caveats** — raw-address frames are excluded (ASLR), the top-frame cutoff, why ms is approximate, and that network deltas are totals only.
- **The GUI alternative** — Instruments in Xcode 27 has built-in Run Comparisons for interactive before/after analysis; `xcprof compare` remains the headless/CI path.

## Documentation Scope

This page documents the `trace-comparison` skill in the `axiom-performance` suite. The comparison itself is performed by the `xcprof compare` CLI subcommand.

- For recording and single-trace analysis, see [/axiom:profile](/commands/debugging/profile) and the `performance-profiler` agent
- To run a comparison directly, use [/axiom:compare-traces](/commands/debugging/compare-traces)

## Related

- [/axiom:compare-traces](/commands/debugging/compare-traces) — The command that runs this comparison
- [Performance Profiling](/skills/debugging/performance-profiling) — Choosing and reading Instruments tools
- [performance-profiler](/agents/performance-profiler) — Records the traces you compare
