# xcprof Reference (Structured xctrace Analysis)

xcprof turns an Instruments `.trace` into a structured, token-lean report for LLM consumers. It replaces the old grep-the-XML profiling pipeline: it resolves xctrace's `id`/`ref` back-references (which defeat grep), reports an **honest per-family support matrix** (never "no findings" when it means "couldn't measure"), and attributes CPU work to user code instead of burying it under `dyld`/`libsystem`.

## Invocation

`xcprof` is on PATH as a bare command (plugin `bin/` is auto-resolved). Run `xcprof <subcommand>`.

## Prerequisite: run `xcprof doctor`

`xcprof doctor` verifies `xcrun xctrace` and counts available instruments/devices. Exit `0` ready; exit `2` if xctrace is missing.

## Subcommands

- `xcprof record <target> [flags]` — capture a new `.trace`, then analyze it with `xcprof analyze`. Picks instruments by preset, bounds the recording, and enforces security gates (see Recording below).
- `xcprof analyze <trace> [flags]` — analyze an existing `.trace`. Exports the TOC + the `cpu-profile` table, resolves back-references into full backtraces, and reports: summary (target, device, duration, recording mode), the support matrix, CPU hot frames (inclusive + self as % of total CPU cycles plus an approximate ms), an approximate main-thread stall signal, and top user-code frames. Flags:
  - `--json` — compact single-line JSON (LLM-lean). Default is terse markdown.
  - `--both` — markdown then JSON.
  - `--start-ms N` / `--end-ms N` — scope analysis to a time window (the hang-window workflow: see a stall at t=2.0s, re-analyze 2000–2500ms without re-recording).
  - `--hang-threshold-ms N` — main-thread gap counted as a candidate stall (default 250).
  - `--user-binary <names>` — comma-separated extra binaries to treat as user code (embedded frameworks).
  - `--dsym <path>` — symbolicate raw-address frames using a `.dSYM` bundle or Mach-O. Without it, dSYMs are auto-discovered by UUID via Spotlight; frames with no matching dSYM stay raw and are flagged.
  - `--open` — open the trace in Instruments.app after analysis (opt-in; headless by default).
- `xcprof doctor [--human]` — environment check.

Flags may come before or after `<trace>` — xcprof handles the Go-flag positional gotcha for you.

## Recording

`xcprof record` captures a trace and reports the saved path so you can hand it straight to `analyze`. A target is required — exactly one of:

- `--attach <pid|name>` — attach to a running process (the everyday case, no gate).
- `--all-processes` — system-wide capture. Requires `--allow-all-processes`.
- `-- <cmd> [args…]` — launch and profile a process from startup (the command follows a literal `--`). Requires `--allow-launch`.

Instruments come from a `--preset` (default `cpu`), an explicit `--template <name>`, or repeated `--instrument <name>` (mutually exclusive — pick one source). Verified presets:

| Preset | Instruments | Use |
|--------|-------------|-----|
| `cpu` | CPU Profiler | "slow" / CPU bottlenecks (the analyze round-trip target) |
| `memory` | Allocations, Leaks | growth, retain cycles |
| `network` | CPU Profiler, HTTP Traffic | API performance |
| `energy` | Power Profiler | battery (iOS/iPadOS) |
| `full` | CPU Profiler, Allocations, Leaks, HTTP Traffic | macOS "find everything" |
| `full-ios` | full + Power Profiler | iOS "find everything" |

The `cpu` preset uses **CPU Profiler** (schema `cpu-profile`), not Time Profiler (`time-profile`/`time-sample`, which `analyze` does not yet parse) — record→analyze only round-trips on `cpu-profile`.

```bash
xcprof record --preset cpu --attach MyApp --time-limit 10s          # attach (no gate)
xcprof record --allow-launch --time-limit 10s -- /path/to/MyApp     # launch
xcprof record --preset cpu --attach MyApp --dry-run                 # preview the exact xctrace command
```

`record` emits compact JSON by default (the saved `trace` path, resolved `instruments`, effective `time_limit`, and the full `command` for transparency); `--human` for terminal text.

### Security gates (designed up front, not bolted on)

- **Bounded by default.** `--max-duration` (default `60s`) is a hard ceiling; an unset `--time-limit` adopts it, so a recording is never unbounded. A `--time-limit` above the ceiling is refused — raise `--max-duration` to record longer.
- **`--allow-launch`** is required before `-- <cmd>` will execute anything.
- **`--allow-all-processes`** is required before system-wide capture.
- **Output sandbox.** `--output` must resolve under `XCPROF_TRACE_ROOT` (or cwd when unset); an outside path is refused unless `--allow-external-output` is passed.
- **`--no-prompt`** is needed for non-interactive use (otherwise xctrace's privacy prompt can stall). Pass it from agents.

### `record` honesty caveat

A `--launch` recording terminated at the time limit makes `xctrace` exit non-zero (it returns the killed target's status) **while still saving a valid trace**. `record` trusts the saved bundle, not the exit code: it reports `ok: true` with a `notes` entry explaining the benign non-zero exit.

## Honesty caveats

- **Frame cost is cycle share, not time.** The `%` is the exact share of total CPU cycles; the `ms` figure is an *approximate* wall-time from the frame's sample share × the analyzed window. Cycle-weight is cycles (the export's "Cycles" column), and cycles→time needs per-core frequency under DVFS that the trace doesn't carry — so ms is never derived from cycles.
- **Main-thread stalls are approximate.** cpu-profile samples only running threads, so a large inter-sample gap is a *candidate* stall, not a confirmed hang — the Hangs instrument confirms (a later xcprof phase).
- **Release builds show addresses.** Stripped binaries report raw `0x…` frame names. xcprof resolves them via `--dsym <path>` or auto-discovery by UUID through Spotlight; frames with no matching dSYM stay raw and are flagged (never invented). Fuller discovery sources (Archives/DerivedData walks, shared with xcsym) come with the engine-extraction epic (axiom-fo7k). Debug builds symbolicate natively, and Instruments may pre-symbolicate the export when it can find the dSYM at record time.
- **Phase 1 is CPU-only.** the memory / network / energy / hangs families report `not_present` (absent from the recording) or `partial` (schema present, parsing pending) — never a silent "clean".

## Output & exit codes

`analyze`: compact JSON (`--json`) or terse markdown (default); `--both` for both. `record` and `doctor`: compact JSON by default, `--human` for text. Exit `0` ok · `2` environment/usage error (xctrace missing, trace not found, bad args, refused security gate) · `8` output-write error.

## Scope

Shipped: `doctor`, `analyze` (CPU / Time Profiler family with `--dsym` symbolication — explicit path + Spotlight auto-discovery), and `record` (presets + bounded duration + launch/all-processes/output security gates). The shared dSYM/symbolication engine with fuller discovery (axiom-fo7k), memory/network/energy parsing, `compare` (regression detection), and `cleanup` remain later phases.

## Resources

**Tools**: `xcrun xctrace` (Instruments CLI), companion tools `xclog`, `xcsym`, `xcui`

**Skills**: axiom-performance
