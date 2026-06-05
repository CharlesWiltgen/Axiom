---
name: xcprof-ref
description: Complete reference for the `xcprof` CLI that ships with Axiom — doctor/record/analyze subcommands for capturing and structurally analyzing Instruments traces, the recording presets, the security gates (launch/all-processes/duration/output sandbox), the honest per-family support matrix, --dsym symbolication, output envelope, and exit codes
---

# xcprof Reference (Structured xctrace Capture & Analysis)

Complete reference for `xcprof`, the Axiom-bundled CLI that captures Instruments traces and turns them into structured, token-lean reports for coding harnesses. It replaces the old grep-the-XML profiling pipeline: it records with bounded, gated `xctrace` invocations, resolves xctrace's `id`/`ref` back-references that defeat `grep`, reports an **honest per-family support matrix** (never "no findings" when it means "couldn't measure"), and attributes CPU work to user code instead of burying it under `dyld`/`libsystem`. Every subcommand emits a compact JSON object with a `tool`/`version` envelope, and exit codes drive pass/fail in scripts.

## When to Use This Reference

Use this reference when:
- Looking up `xcprof doctor` / `record` / `analyze` subcommand flags
- Choosing a recording preset (`cpu` / `memory` / `network` / `energy` / `full` / `full-ios`) or recording a single `--template` / `--instrument`
- Understanding the security gates — why `--launch` needs `--allow-launch`, `--all-processes` needs `--allow-all-processes`, and how `--max-duration` and `XCPROF_TRACE_ROOT` bound a capture
- Interpreting an exit code (0 ok / 2 environment-or-usage error / 8 output-write error)
- Reading the support matrix (`available` / `partial` / `not_exportable` / `not_present`) and understanding why a family reads `not_present`
- Symbolicating raw-address frames from a stripped/release build with `--dsym` (explicit path or UUID auto-discovery)
- Re-scoping CPU analysis to a hang window with `--start-ms` / `--end-ms` without re-recording
- Previewing the exact `xctrace` command a `record` would run (`--dry-run`)

## Example Prompts

- "How do I record a CPU trace and analyze it in one workflow?"
- "How do I profile my app without letting the tool launch arbitrary processes?"
- "Why does my analyze report show memory as `not_present`?"
- "How do I symbolicate a release build's stack frames in a trace?"
- "How do I re-analyze just the 2.0–2.5s window where I saw a hang?"
- "What does `xcprof doctor` check?"
- "Why did `xcprof record` exit non-zero but still save a trace?"
- "Which preset records leaks and allocations?"

## What's Covered

- **Invocation** — `xcprof` is on PATH as a bare command (plugin `bin/` is auto-resolved); run `xcprof <subcommand>`
- **`doctor` subcommand** — verifies `xcrun xctrace` and counts available instruments/devices; `--human` for prose. Exit `0` ready, `2` if xctrace is missing
- **`record` subcommand** — captures a `.trace` and reports the saved path so you can hand it straight to `analyze`. Picks instruments by `--preset` (default `cpu`), or `--template <name>` / repeated `--instrument <name>` (one source only). A target is required — exactly one of `--attach <pid|name>`, `--all-processes`, or `-- <cmd>` (launch, after a literal `--`). Emits compact JSON (saved `trace`, resolved `instruments`, effective `time_limit`, `target_mode`, and the full `command` echo for transparency); `--human` for text; `--dry-run` previews without spawning
- **Recording presets** — six verified preset → instrument maps (see table below). The `cpu` preset uses **CPU Profiler** (schema `cpu-profile`, which `analyze` parses), not Time Profiler (`time-profile`/`time-sample`, not yet parsed) — record → analyze only round-trips on `cpu-profile`
- **Security gates** — bounded by default (`--max-duration`, default 60s; an unset `--time-limit` adopts it, so a capture is never unbounded), `--allow-launch` before `-- <cmd>` will execute anything, `--allow-all-processes` before system-wide capture, and an `XCPROF_TRACE_ROOT` output sandbox (`--output` must resolve under it or cwd unless `--allow-external-output`). `--no-prompt` is needed for non-interactive use
- **`analyze` subcommand** — exports the TOC + `cpu-profile` table, resolves back-references into full backtraces, and reports the summary, support matrix, CPU hot frames (inclusive + self as % of total cycles plus an approximate ms), an approximate main-thread stall signal, and top user-code frames. Flags: `--json` / `--both`, `--start-ms` / `--end-ms` (hang-window scoping), `--hang-threshold-ms`, `--user-binary <names>`, `--dsym <path>`, `--open`
- **Honest support matrix** — per family, `available` (parsed, results present), `partial` (schema present, parsing pending), `not_exportable` (schema absent from the export, GUI may still show it), or `not_present` (instrument wasn't in the recording). Silence never reads as "clean"
- **Symbolication** — `--dsym <path>` resolves raw `0x…` frames; without it, dSYMs are auto-discovered by UUID via Spotlight, and frames with no match stay raw and are flagged (never invented)
- **Output envelope & exit codes** — `analyze` defaults to terse markdown (`--json` / `--both` for JSON); `record` and `doctor` default to compact JSON (`--human` for text). Exit `0` ok · `2` environment/usage error (xctrace missing, trace not found, bad args, refused gate) · `8` output-write error
- **The record honesty caveat** — an `xctrace record --launch` capture terminated at the time limit exits non-zero (it returns the killed target's status) while still saving a valid trace, so `record` trusts the saved bundle, not the exit code, and reports `ok: true` with an explanatory `notes` entry

## Recording Presets

`record --preset <name>` maps to a verified-on-Xcode-26 instrument set (names confirmed via `xctrace list instruments`). Use `--template` / `--instrument` instead for a narrow, ad-hoc capture.

| Preset | Instruments | Use |
|----------|-------------|-----|
| `cpu` | CPU Profiler | "slow" / CPU bottlenecks (the analyze round-trip target) |
| `memory` | Allocations, Leaks | growth, retain cycles |
| `network` | CPU Profiler, HTTP Traffic | API performance |
| `energy` | Power Profiler | battery (iOS/iPadOS) |
| `full` | CPU Profiler, Allocations, Leaks, HTTP Traffic | macOS "find everything" |
| `full-ios` | full + Power Profiler | iOS "find everything" |

```bash
xcprof record --preset cpu --attach MyApp --time-limit 10s       # attach (no gate)
xcprof record --allow-launch --time-limit 10s -- /path/to/MyApp  # launch from startup
xcprof record --preset cpu --attach MyApp --dry-run              # preview the exact xctrace command
xcprof analyze MyApp.trace --json                                # structured report
```

## Documentation Scope

This page documents the `xcprof-ref` reference skill — the bundled Axiom CLI for capturing and analyzing Instruments traces.

- For Axiom's higher-level profiling agent, see the [performance-profiler agent](/agents/performance-profiler)
- For the profiling slash command, see [/axiom:profile](/commands/debugging/profile)
- For GUI-side profiling decision trees and the raw `xctrace` CLI it wraps, see [performance-profiling](/skills/debugging/performance-profiling) and [xctrace](/reference/xctrace-ref)
- For field performance metrics from production users, see [metrickit-ref](/reference/metrickit-ref)
- For the sibling bundled tools, see [Console Capture (xclog)](/reference/xclog-ref), [Crash Symbolication (xcsym)](/reference/xcsym-ref), and [Simulator UI & Accessibility (xcui)](/reference/xcui-ref)
