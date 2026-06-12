# Trace Comparison (Regression Detection)

`xcprof compare <baseline> <current>` diffs two `.trace` recordings into a regression/improvement view and gates CI on the result. It replaces the old "export both traces and eyeball the XML" workflow with function-level deltas and a non-zero exit code your pipeline can fail on.

## When to Use

- Verifying a change didn't slow down a hot path ("did this PR regress CPU?").
- Gating merges on performance in CI (fail the build when a function's CPU share jumps).
- Confirming an optimization actually helped (the improvement list quantifies it).

It is **CPU-share regression detection**. For absolute "is this fast enough" thresholds on a single trace, use `xcprof analyze`; compare needs two traces.

For interactive (GUI) comparison, Instruments in Xcode 27 has built-in **Run Comparisons** — filter both runs to the same `os_signpost` interval, pick a baseline run, and read per-function deltas as a call tree, flame graph, or Top Functions view (`axiom-performance (skills/performance-profiling.md)`). `xcprof compare` remains the headless/CI path.

## The Two-Trace Workflow

The diff is only meaningful when **both recordings exercise the same workload** — drive the identical user flow (a UI test, a benchmark entry point, a scripted CLI run) both times, or the deltas measure workload differences, not code regressions.

```bash
export XCPROF_TRACE_ROOT="$(mktemp -d)"   # sandbox the output

# 1. Baseline — build the BEFORE revision, record while exercising the hot path.
xcprof record --preset cpu --attach MyApp --time-limit 15s --no-prompt \
  --output "$XCPROF_TRACE_ROOT/baseline.trace"

# 2. Make the change (or check out the PR), rebuild, record the SAME flow.
xcprof record --preset cpu --attach MyApp --time-limit 15s --no-prompt \
  --output "$XCPROF_TRACE_ROOT/current.trace"

# 3. Compare.
xcprof compare "$XCPROF_TRACE_ROOT/baseline.trace" "$XCPROF_TRACE_ROOT/current.trace" --human
```

## Reading the Output

Compare emits compact JSON by default, `--human` for markdown, `--both` for markdown then JSON. Each delta carries:

| Field | Meaning |
|-------|---------|
| `incl_pct_delta` | change in inclusive CPU-cycle share, in percentage points (the headline metric) |
| `self_pct_delta` | change in self (leaf) share, percentage points — pinpoints the function whose own body got hotter |
| `incl_ms_delta` / `self_ms_delta` | approximate wall-time shift (sample-share × window); informational |
| `severity` | `\|incl_pct_delta\| × max(baseline,current inclusive ms)` — the "% delta × absolute time" rank; lists sort by it |
| `kind` | `changed` (in both), `new` (current only), `gone` (baseline only) |

A frame is a **regression** when its inclusive share rose by ≥ `--threshold-pct`, an **improvement** when it fell by ≥ that much; anything between is noise and dropped. `regressed: true` (and the CI exit code) fires when the regression list is non-empty.

Percentage points — not raw cycles or ms — because two traces have different total work; only *share* is comparable across runs. A function rising 51%→85% regressed even if the traces ran for different durations.

**But a share is relative to its trace's total — read the summary's baseline-vs-current totals first.** If the current trace's total CPU is higher, the run regressed regardless of any per-function share drop: a function can do *more absolute work while its share shrinks*, so it lands in the **improvement** list and gets dropped (`incl_pct_delta` is negative). When the totals diverge, the per-function view tells you *where the new work landed*, not *what got faster* — never read a falling share as an optimization until the totals match (re-record like-for-like). Concretely: `22% of 1.2s = 0.26s` → `17.5% of 2.05s = 0.36s` is a **36% slowdown** wearing an "improvement" label.

## CI Recipe

`--fail-on-regression` turns a regression into a non-zero exit, so a pipeline step gates on it directly:

```bash
#!/usr/bin/env bash
set -euo pipefail
xcprof compare baseline.trace current.trace \
  --fail-on-regression --threshold-pct 5 --both
# exits 3 if any function's inclusive CPU share rose ≥ 5 percentage points
```

GitHub Actions:

```yaml
name: Performance regression gate
on: pull_request
jobs:
  perf:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # record-trace.sh: check out the given ref, build, launch, record into $1
      - name: Record baseline
        run: ./scripts/record-trace.sh "${{ github.event.pull_request.base.sha }}" baseline.trace
      - name: Record current
        run: ./scripts/record-trace.sh "${{ github.sha }}" current.trace
      - name: Compare and gate
        run: xcprof compare baseline.trace current.trace --fail-on-regression --threshold-pct 5 --both
```

Start the threshold loose (10–15pp) to catch only gross regressions, then tighten as the recording's workload becomes more deterministic. A flaky workload produces noisy deltas; a fixed UI test or benchmark target keeps the gate trustworthy.

## Exit Codes

| Exit | Meaning |
|------|---------|
| `0` | compared cleanly — no regression met the threshold, OR `--fail-on-regression` wasn't set |
| `2` | usage/environment error (trace missing, bad args, export failed) |
| `3` | a regression met `--threshold-pct` AND `--fail-on-regression` was set (the CI gate) |
| `8` | output-write error (the diff itself succeeded) |

`3` is distinct from `2` so an agent can tell "the app got slower" from "the tool broke."

## Caveats

- **Symbolicate both traces.** Frames are matched by `(binary, function name)`. Raw-address frames (`0x…`) don't match across builds (ASLR), so they're excluded from the diff and counted in a note. Pass `--dsym <path>` (or rely on UUID auto-discovery) for symbol-level deltas on release builds.
- **Top-frame cutoff.** Compare diffs each trace's top frames; a function absent from the other trace's top list is treated as `0%`. A frame just below the cutoff in one trace can therefore overstate its delta slightly. The severity rank and threshold keep trivial frames out of the gate.
- **ms is approximate.** Percentage-point deltas are exact (cycle share); ms deltas are a sample-share estimate and shift with window length. Gate on `--threshold-pct`, not ms.
- **Network deltas are totals only.** Per-connection matching across runs is unreliable (ephemeral ports, per-run serials), so only total rx/tx byte deltas are reported.

## Resources

**Tools**: `xcprof compare` (companion: `xcprof record`, `xcprof analyze`)

**Skills**: xctrace-ref, performance-profiling, axiom-tools (skills/xcprof-ref.md)
