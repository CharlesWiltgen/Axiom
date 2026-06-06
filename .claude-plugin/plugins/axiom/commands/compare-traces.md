---
name: compare-traces
description: Diff two performance traces for regressions with xcprof compare
disable-model-invocation: true
---

# Compare Performance Traces

Diffs two Instruments `.trace` recordings with **xcprof compare** — function-level CPU-share deltas, regressions separated from improvements, and a non-zero exit code your CI can gate on. Replaces the old "export both traces and eyeball the XML" workflow.

## When to Use

- Verify a change didn't slow down a hot path ("did this PR regress CPU?").
- Gate a merge on performance (fail when a function's CPU share jumps past a threshold).
- Quantify an optimization (the improvement list shows what got faster).

## Steps

1. **Verify the tool.** `command -v xcprof && xcprof doctor`. If `xcprof` is missing, the Axiom install is stale — tell the user to update Axiom.

2. **Get two traces.** Either the user already has `baseline.trace` + `current.trace`, or capture them. Both recordings MUST exercise the **same workload** (same UI flow / benchmark), or the deltas measure workload differences, not regressions:
   ```bash
   export XCPROF_TRACE_ROOT="$(mktemp -d)"
   # before-revision build, exercise the hot path:
   xcprof record --preset cpu --attach MyApp --time-limit 15s --no-prompt \
     --output "$XCPROF_TRACE_ROOT/baseline.trace"
   # after-revision build, exercise the SAME path:
   xcprof record --preset cpu --attach MyApp --time-limit 15s --no-prompt \
     --output "$XCPROF_TRACE_ROOT/current.trace"
   ```

3. **Compare.** Default output is compact JSON; add `--human` to read it:
   ```bash
   xcprof compare baseline.trace current.trace --human
   ```
   For a CI gate, add `--fail-on-regression` (exit 3 when any function's inclusive CPU share rose ≥ `--threshold-pct`, default 5):
   ```bash
   xcprof compare baseline.trace current.trace --fail-on-regression --threshold-pct 5
   ```

4. **Interpret honestly.** Report the regressions (sorted by severity = % delta × absolute time) and improvements. Note when frames were excluded for being unsymbolicated (pass `--dsym` for release builds). Deltas are percentage-points of CPU-cycle share — the only quantity comparable across two runs of different total work.

## Flags

- `--threshold-pct <n>` — inclusive CPU-share rise (percentage points) counted as a regression (default 5).
- `--fail-on-regression` — exit 3 when any regression meets the threshold (the CI gate).
- `--human` / `--both` — markdown, or markdown then JSON (default is compact JSON).
- `--dsym <path>` — symbolicate both traces (default: auto-discover by UUID).

## Prefer Natural Language?

You can also trigger this by saying:
- "Did my change regress CPU performance?"
- "Compare these two traces for regressions"
- "Gate my CI on performance regressions"

## Related

- Full workflow, CI recipe, and exit-code semantics: `axiom-performance` (skills/trace-comparison.md)
- Recording + single-trace analysis: `/axiom:profile`, `axiom-tools` (skills/xcprof-ref.md)
