# /axiom:compare-traces

Diff two Instruments `.trace` recordings for performance regressions using `xcprof compare` — function-level CPU-share deltas with a CI-gating exit code.

## Command

```bash
/axiom:compare-traces
```

## What It Scans

- **Function-level CPU deltas** – change in inclusive/self CPU-cycle share per function, matched by name across the two traces
- **Regressions vs improvements** – separated and sorted by severity (% delta × absolute time)
- **A CI gate** – `--fail-on-regression` exits non-zero (3) when any function's CPU share rises past a threshold
- **Network totals** – total rx/tx byte deltas between the two recordings

## Usage

The two recordings must exercise the **same workload** (same UI flow or benchmark), or the deltas measure workload differences rather than code changes.

```bash
# Read the diff
xcprof compare baseline.trace current.trace --human

# Gate CI: exit 3 if any function's inclusive CPU share rose ≥ 5 percentage points
xcprof compare baseline.trace current.trace --fail-on-regression --threshold-pct 5
```

## When to Use

- You want to confirm a change didn't slow down a hot path
- You need to fail a CI build when performance regresses
- You want to quantify how much an optimization helped

## Related

- [Trace Comparison](/skills/debugging/trace-comparison) – Full workflow, CI recipe, and exit-code semantics
- [/axiom:profile](/commands/debugging/profile) – Record and analyze a single trace
- [performance-profiler](/agents/performance-profiler) – The agent that records the traces you compare
