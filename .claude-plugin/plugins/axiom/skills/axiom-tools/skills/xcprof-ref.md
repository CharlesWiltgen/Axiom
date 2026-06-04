# xcprof Reference (Structured xctrace Analysis)

xcprof turns an Instruments `.trace` into a structured, token-lean report for LLM consumers. It replaces the old grep-the-XML profiling pipeline: it resolves xctrace's `id`/`ref` back-references (which defeat grep), reports an **honest per-family support matrix** (never "no findings" when it means "couldn't measure"), and attributes CPU work to user code instead of burying it under `dyld`/`libsystem`.

## Invocation

`xcprof` is on PATH as a bare command (plugin `bin/` is auto-resolved). Run `xcprof <subcommand>`.

## Prerequisite: run `xcprof doctor`

`xcprof doctor` verifies `xcrun xctrace` and counts available instruments/devices. Exit `0` ready; exit `2` if xctrace is missing.

## Subcommands (Phase 1)

- `xcprof analyze <trace> [flags]` — analyze an existing `.trace`. Exports the TOC + the `cpu-profile` table, resolves back-references into full backtraces, and reports: summary (target, device, duration, recording mode), the support matrix, CPU hot frames (inclusive + self as % of total CPU cycles plus an approximate ms), an approximate main-thread stall signal, and top user-code frames. Flags:
  - `--json` — compact single-line JSON (LLM-lean). Default is terse markdown.
  - `--both` — markdown then JSON.
  - `--start-ms N` / `--end-ms N` — scope analysis to a time window (the hang-window workflow: see a stall at t=2.0s, re-analyze 2000–2500ms without re-recording).
  - `--hang-threshold-ms N` — main-thread gap counted as a candidate stall (default 250).
  - `--user-binary <names>` — comma-separated extra binaries to treat as user code (embedded frameworks).
  - `--open` — open the trace in Instruments.app after analysis (opt-in; headless by default).
- `xcprof doctor [--human]` — environment check.

Flags may come before or after `<trace>` — xcprof handles the Go-flag positional gotcha for you.

## Capturing a trace (until `xcprof record` lands)

xcprof Phase 1 analyzes existing traces; use raw xctrace to record (Xcode 26+ prefers `--instrument` over `--template`):

```bash
xcrun xctrace record --instrument 'CPU Profiler' --attach <pid|name> --time-limit 10s --output app.trace
xcprof analyze app.trace --json
```

## Honesty caveats

- **Frame cost is cycle share, not time.** The `%` is the exact share of total CPU cycles; the `ms` figure is an *approximate* wall-time from the frame's sample share × the analyzed window. Cycle-weight is cycles (the export's "Cycles" column), and cycles→time needs per-core frequency under DVFS that the trace doesn't carry — so ms is never derived from cycles.
- **Main-thread stalls are approximate.** cpu-profile samples only running threads, so a large inter-sample gap is a *candidate* stall, not a confirmed hang — the Hangs instrument confirms (a later xcprof phase).
- **Release builds show addresses.** Stripped binaries report raw `0x…` frame names; symbol resolution via `--dsym` arrives in a later phase. Debug builds symbolicate natively.
- **Phase 1 is CPU-only.** the memory / network / energy / hangs families report `not_present` (absent from the recording) or `partial` (schema present, parsing pending) — never a silent "clean".

## Output & exit codes

Compact JSON (`--json`) or terse markdown (default); `--both` for both. Exit `0` analyzed · `2` environment/usage error (xctrace missing, trace not found, bad args).

## Scope

Phase 1 ships `doctor` + `analyze` (CPU / Time Profiler family). `record` (presets + security gates), `--dsym` symbolication, memory/network/energy parsing, `compare` (regression detection), and `cleanup` are later phases.

## Resources

**Tools**: `xcrun xctrace` (Instruments CLI), companion tools `xclog`, `xcsym`, `xcui`

**Skills**: axiom-performance
