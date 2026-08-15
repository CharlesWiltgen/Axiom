# xcprof Reference (Structured xctrace Analysis)

xcprof turns an Instruments `.trace` into a structured, token-lean report for LLM consumers. It replaces the old grep-the-XML profiling pipeline: it resolves xctrace's `id`/`ref` back-references (which defeat grep), reports an **honest per-family support matrix** (never "no findings" when it means "couldn't measure"), and attributes CPU work to user code instead of burying it under `dyld`/`libsystem`.

## Invocation

xcprof has two front-ends over the same engine — use whichever your harness provides:

- **Claude Code** — `xcprof` is on PATH as a bare command (plugin `bin/` is auto-resolved). Run `xcprof <subcommand>`. The examples below use this CLI syntax.
- **MCP clients (Codex, Cursor, …)** — four wrapper tools (xcprof is currently the only Axiom bin tool exposed over MCP).

| CLI subcommand | MCP tool | Required input |
|---|---|---|
| `xcprof doctor` | `axiom_xcprof_doctor` | — |
| `xcprof analyze <trace>` | `axiom_xcprof_analyze` | `trace` |
| `xcprof compare <baseline> <current>` | `axiom_xcprof_compare` | `baseline`, `current` |
| `xcprof record` | `axiom_xcprof_record` | one target — `attach`, `launch`, or `allProcesses` |

CLI flags map to camelCase MCP params: `--start-ms`→`startMs`, `--end-ms`→`endMs`, `--hang-threshold-ms`→`hangThresholdMs`, `--user-binary`→`userBinary`, `--fail-on-regression`→`failOnRegression`, `--threshold-pct`→`thresholdPct`, `--allow-launch`→`allowLaunch`, `--all-processes`→`allProcesses`, `--time-limit`→`timeLimit`, `--dry-run`→`dryRun`. The launch target `-- <cmd>` becomes a `launch: [...]` argv array.

The MCP surface is a deliberate subset: no output-format flags (`--json`/`--both`/`--human` — the tool returns the CLI's output as text), no `--open` (headless), no `--no-prompt` (always non-interactive). `compare`'s regression verdict is returned in the response body rather than as exit code `3`, and off-macOS the tools return a clear unavailability message instead of exit `2`.

## Prerequisite: run `xcprof doctor`

`xcprof doctor` verifies `xcrun xctrace` and counts available instruments/devices. Exit `0` ready; exit `2` if xctrace is missing.

## Subcommands

- `xcprof record <target> [flags]` — capture a new `.trace`, then analyze it with `xcprof analyze`. Picks instruments by preset, bounds the recording, and enforces security gates (see Recording below).
- `xcprof analyze <trace> [flags]` — analyze an existing `.trace`. Exports the TOC, the `cpu-profile` table, and the `network-connection-stat` table (when present), resolves back-references into full backtraces, and reports: summary (target, device, duration, recording mode), the support matrix, CPU hot frames (inclusive + self as % of total CPU cycles plus an approximate ms), an approximate main-thread stall signal, top user-code frames, and a network section (connections aggregated by socket: process, protocol, remote, bytes in/out). Flags:
  - `--json` — compact single-line JSON (LLM-lean). Default is terse markdown.
  - `--both` — markdown then JSON.
  - `--start-ms N` / `--end-ms N` — scope analysis to a time window (the hang-window workflow: see a stall at t=2.0s, re-analyze 2000–2500ms without re-recording).
  - `--hang-threshold-ms N` — main-thread gap counted as a candidate stall (default 250).
  - `--user-binary <names>` — comma-separated extra binaries to treat as user code (embedded frameworks).
  - `--dsym <path>` — symbolicate raw-address frames using a `.dSYM` bundle or Mach-O. Without it, dSYMs are auto-discovered by UUID via Spotlight; frames with no matching dSYM stay raw and are flagged.
  - `--open` — open the trace in Instruments.app after analysis (opt-in; headless by default).
- `xcprof compare <baseline> <current> [flags]` — diff two traces for regressions (see Comparing traces below).
- `xcprof doctor [--human]` — environment check.

Flags may come before or after the positional `<trace>` arguments — xcprof handles the Go-flag positional gotcha for you.

## Recording

`xcprof record` captures a trace and reports the saved path so you can hand it straight to `analyze`. A target is required — exactly one of:

- `--attach <pid|name>` — attach to a running process (the everyday case, no gate).
- `--all-processes` — system-wide capture. Requires `--allow-all-processes`.
- `-- <cmd> [args…]` — launch and profile a process from startup (the command follows a literal `--`). Requires `--allow-launch`.

Instruments come from a `--preset` (default `cpu`), an explicit `--template <name>`, or repeated `--instrument <name>` (mutually exclusive — pick one source). Verified presets:

| Preset | Instruments | Use |
|--------|-------------|-----|
| `cpu` | CPU Profiler | "slow" / CPU bottlenecks (analyze round-trips) |
| `memory` | Allocations, Leaks | growth, retain cycles (Instruments.app only — see below) |
| `network` | CPU Profiler, Network Connections | connections, bytes per process (analyze round-trips) |
| `energy` | Power Profiler | battery (iOS/iPadOS only) |
| `full` | CPU Profiler, Allocations, Leaks, Network Connections | macOS "find everything" |
| `full-ios` | full + Power Profiler | iOS "find everything" |

Two instrument choices are deliberate, verified against real Xcode 26 exports — not guessed:

- The `cpu` preset uses **CPU Profiler** (schema `cpu-profile`), not Time Profiler (`time-profile`/`time-sample`, which `analyze` doesn't parse).
- The `network` preset uses **Network Connections** (schema `network-connection-stat` — socket-level, any process), not HTTP Traffic (cfnetwork tables that only populate for URLSession traffic and `analyze` doesn't read).

Allocations/Leaks stay in the `memory`/`full` presets so the recording is viewable in Instruments.app, but `analyze` can't surface their data (see Honesty caveats).

```bash
xcprof record --preset cpu --attach MyApp --time-limit 10s          # attach (no gate)
xcprof record --allow-launch --time-limit 10s -- /path/to/MyApp     # launch
xcprof record --preset cpu --attach MyApp --dry-run                 # preview the exact xctrace command
```

`record` emits compact JSON by default (the saved `trace` path, resolved `instruments`, a structured `target_mode` of `attach`/`launch`/`all_processes`, effective `time_limit`, and the full `command` for transparency); `--human` for terminal text.

### Security gates (designed up front, not bolted on)

- **Bounded by default.** `--max-duration` (default `60s`) is a hard ceiling; an unset `--time-limit` adopts it, so a recording is never unbounded. A `--time-limit` above the ceiling is refused — raise `--max-duration` to record longer.
- **`--allow-launch`** is required before `-- <cmd>` will execute anything.
- **`--allow-all-processes`** is required before system-wide capture.
- **Output sandbox.** `--output` must resolve under `XCPROF_TRACE_ROOT` (or cwd when unset); an outside path is refused unless `--allow-external-output` is passed.
- **`--no-prompt`** is needed for non-interactive use (otherwise xctrace's privacy prompt can stall). Pass it from agents.

### `record` honesty caveat

A `--launch` recording terminated at the time limit makes `xctrace` exit non-zero (it returns the killed target's status) **while still saving a valid trace**. `record` trusts the saved bundle, not the exit code: it reports `ok: true` with a `notes` entry explaining the benign non-zero exit.

## Comparing traces (regression detection)

`xcprof compare <baseline> <current>` runs the analyze pipeline on each trace and diffs them into function-level deltas — for "did this change regress CPU?" and for CI gating. It matches frames by `(binary, function name)` and reports the change in **inclusive CPU-cycle share** in percentage points (the comparable quantity across two runs of different total work — raw cycles and ms are not).

- A frame whose inclusive share rose by ≥ `--threshold-pct` (default `5`) is a **regression**; fell by ≥ that, an **improvement**; in between is noise and dropped. Lists sort by `severity` = `|incl_pct_delta| × max(baseline,current inclusive ms)` (the "% delta × absolute time" rank).
- `--fail-on-regression` exits **3** when any regression meets the threshold — the CI gate (distinct from `2` usage / `8` I/O so an agent can tell "slower" from "broke").
- Defaults to compact JSON; `--human` for markdown, `--both` (markdown then JSON). `--dsym` applies to both traces. (No `--user-binary`/window flags: compare diffs the hot-frame tables over the full trace.)

```bash
xcprof compare baseline.trace current.trace --human                              # read the diff
xcprof compare baseline.trace current.trace --fail-on-regression --threshold-pct 5  # CI gate (exit 3 on regression)
```

Both recordings must exercise the **same workload** or the deltas measure workload differences, not code changes. Raw-address frames (`0x…`) don't match across builds (ASLR) — they're excluded and counted in a note; pass `--dsym` for symbol-level deltas on release builds. Per-connection network matching is unreliable across runs, so only total rx/tx byte deltas are reported. Full workflow + CI recipe: `axiom-performance` (skills/trace-comparison.md).

## Honesty caveats

- **Frame cost is cycle share, not time.** The `%` is the exact share of total CPU cycles; the `ms` figure is an *approximate* wall-time from the frame's sample share × the analyzed window. Cycle-weight is cycles (the export's "Cycles" column), and cycles→time needs per-core frequency under DVFS that the trace doesn't carry — so ms is never derived from cycles.
- **Main-thread stalls are approximate.** cpu-profile samples only running threads, so a large inter-sample gap is a *candidate* stall, not a confirmed hang — the Hangs instrument confirms (a later xcprof phase).
- **Release builds show addresses.** Stripped binaries report raw `0x…` frame names. xcprof resolves them via `--dsym <path>` or auto-discovery by UUID through Spotlight; frames with no matching dSYM stay raw and are flagged (never invented). Fuller discovery sources (Archives/DerivedData walks, shared with xcsym) come with a later engine-extraction phase. Debug builds symbolicate natively, and Instruments may pre-symbolicate the export when it can find the dSYM at record time.
- **Support matrix is honest about what xctrace can export.** `cpu` and `network` parse (`available` when data is present, `partial` when the table is present but empty). **memory** and macOS **energy** report `not_exportable`: Allocations/Leaks data lives in the trace's event store (no XML table — open it in Instruments.app), and Power Profiler is iOS/iPadOS-only and unsupported on macOS. A family genuinely absent from the recording is `not_present`. None of these ever reads as a silent "clean". (On-device iOS energy parsing is a future, device-verified addition.)

## Output & exit codes

`analyze`: compact JSON (`--json`) or terse markdown (default); `--both` for both. `record`, `compare`, and `doctor`: compact JSON by default, `--human` for text. (`analyze` defaults to the human-readable report because it's a read-oriented analysis; `record`/`compare`/`doctor` default to JSON because they're scriptable status steps — the same split the rest of the toolkit follows: machine format is always compact JSON, `--human` is the prose escape.) Exit `0` ok · `2` environment/usage error (xctrace missing, trace not found, bad args, refused security gate) · `3` `compare` regression met `--threshold-pct` under `--fail-on-regression` · `8` output-write error.

## Scope

Shipped: `doctor`, `analyze` (CPU `cpu-profile` family with `--dsym` symbolication — explicit path + Spotlight auto-discovery — plus the `network-connection-stat` socket family), `record` (presets + bounded duration + launch/all-processes/output security gates), and `compare` (function-level CPU-share regression detection with a `--fail-on-regression` CI gate). memory and macOS energy are `not_exportable` by design (data not surfaced by xctrace export). The shared dSYM/symbolication engine with fuller discovery, on-device iOS energy parsing, and `cleanup` remain later phases.

## Resources

**Tools**: `xcrun xctrace` (Instruments CLI), companion tools `xclog`, `xcsym`, `xcui`

**Skills**: axiom-performance
