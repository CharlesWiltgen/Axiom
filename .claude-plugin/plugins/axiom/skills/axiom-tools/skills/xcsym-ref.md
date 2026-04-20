---
name: xcsym-ref
description: Use when symbolicating an .ips or MetricKit crash, diagnosing dSYM UUID mismatches, inventorying dSYMs, or anonymizing a crash for fixture use. Reference for the xcsym CLI that ships with Axiom.
license: MIT
---

# xcsym Reference (iOS/macOS Crash Symbolication)

xcsym symbolicates `.ips` (v1/v2) and MetricKit (`MXCrashDiagnostic`) crash reports end-to-end and emits LLM-friendly JSON. It auto-detects format, discovers dSYMs from Archives/DerivedData/downloads, symbolicates frames via `atos`, categorizes the crash into a `pattern_tag`, and reports UUID/arch mismatches per image. Single binary, no dependencies beyond Xcode CLT.

## Binary Location

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xcsym
```

## When to Use

- **Triaging a new `.ips`** — full pipeline in one call, structured JSON out
- **TestFlight crashes** — paired with `xcsym verify` to diagnose UUID mismatches
- **MetricKit crashes** — write `MXCrashDiagnostic.jsonRepresentation()` to disk and run `crash`
- **Explaining why a crash is unsymbolicated** — `verify` tells you per-image UUID/arch mismatch
- **Inventorying local dSYMs** — `list-dsyms` enumerates archives + DerivedData
- **Scrubbing a user's crash for a fixture** — `anonymize` preserves dSYM UUIDs (correlation keys) while scrubbing PII

**Do not use for hangs.** `xcsym crash` rejects `.ips` files with `bug_type=298` (hangs have a different workflow; see `axiom-performance` skills).

## Critical Best Practices

**Start with `crash`.** It runs the full pipeline (parse → discover dSYMs → symbolicate → categorize → emit JSON). Only reach for `resolve`, `find-dsym`, or `verify` when `crash` surfaces a specific problem.

**Read `pattern_tag` first.** It's the most compact signal about what kind of crash you're looking at. Map it to the agent's fix-guidance table before reading frames.

**Trust exit codes.** Non-zero codes say *why* symbolication was incomplete — don't assume a crashed call means the tool failed.

**Anonymize before committing a fixture.** The `anonymize` subcommand is format-aware (handles `.ips` v1/v2 and MetricKit) and intentionally preserves dSYM UUIDs so anonymized fixtures still symbolicate against your dSYMs.

## Subcommands

### crash — Full Pipeline

```bash
xcsym crash <file>                              # standard tier, JSON to stdout
xcsym crash <file> --format=summary             # small tier (≤2KB), top frames only
xcsym crash <file> --format=standard            # default (≤12KB)
xcsym crash <file> --format=full                # all threads (emits size_warning past 100KB)
xcsym crash <file> --from-metrickit             # force MetricKit (skip auto-detect)
xcsym crash <file> --dsym <path>                # explicit dSYM for the main app
xcsym crash <file> --dsym-paths <a>:<b>         # extra dSYM search roots
xcsym crash <file> --no-symbolicate             # skip atos; keep raw frames
xcsym crash <file> --no-cache                   # bypass UUID cache
xcsym crash <file> --no-spotlight               # skip mdfind lookups
xcsym crash <file> --output <path>              # write JSON to file
```

### verify — dSYM Match Diagnostics

```bash
xcsym verify <file>
xcsym verify <file> --dsym <path>
xcsym verify <file> --dsym-paths <a>:<b>
xcsym verify <file> --no-cache
xcsym verify <file> --no-spotlight
```

Reports which images are matched, mismatched (UUID or arch), and missing. Use when `crash` exits non-zero to pinpoint *which* dSYM is wrong.

### resolve — Single-Address Resolution

```bash
xcsym resolve --dsym <path> --load-addr <hex> <addr>...
xcsym resolve --dsym /bin/ls --load-addr 0x100000000 0x10000aabb 0x10000bbcc
xcsym resolve --dsym <path> --load-addr <hex> --arch arm64 <addr>...
```

Hands raw addresses to `atos` against a specific dSYM. Useful for one-off address resolution outside a crash context.

### find-dsym — Locate dSYM by UUID

```bash
xcsym find-dsym <uuid>
xcsym find-dsym <uuid> --arch arm64
xcsym find-dsym <uuid> --dsym-paths <a>:<b>
xcsym find-dsym <uuid> --no-cache
xcsym find-dsym <uuid> --no-spotlight
```

Walks the discovery chain: cache → explicit paths → Archives → DerivedData → `~/Downloads` → Xcode toolchain → system frameworks → Spotlight.

### list-dsyms — Inventory

```bash
xcsym list-dsyms
xcsym list-dsyms --source=archives      # only Archives
xcsym list-dsyms --source=deriveddata   # only DerivedData
xcsym list-dsyms --source=downloads
xcsym list-dsyms --source=toolchain
xcsym list-dsyms --source=frameworks
xcsym list-dsyms --source=env
xcsym list-dsyms --source=all           # default
xcsym list-dsyms --dsym-paths <a>:<b>
```

### anonymize — Scrub PII for Fixtures

```bash
xcsym anonymize <file>                   # anonymized JSON to stdout
xcsym anonymize <file> --output <path>   # write to file
```

Scrubs bundle IDs, user paths, `.app`/`.framework` names, IPs, device names, session IDs. Preserves dSYM UUIDs (`slice_uuid`, `usedImages[].uuid`, MetricKit `binaryUUID`) so anonymized output still symbolicates against matching dSYMs.

## Output Schema

Top-level JSON emitted by `crash`:

```json
{
  "tool": "xcsym",
  "version": "0.1.0-dev",
  "format": "standard",
  "environment": {
    "atos_version": "...",
    "clt_version": "...",
    "xcode_path": "/Applications/Xcode.app"
  },
  "input": {
    "path": "testdata/crashes/ips_v2/swift_forced_unwrap.ips",
    "format": "ips_json_v2"
  },
  "crash": {
    "app": { "name": "...", "version": "...", "bundle_id": "..." },
    "os": { "platform": "iOS", "version": "17.5", "is_simulator": false },
    "arch": "arm64",
    "exception": { "type": "EXC_BREAKPOINT", "codes": "0x1", "subtype": "...", "signal": "SIGTRAP" },
    "termination": { "namespace": "SIGNAL", "code": "0x5" },
    "pattern_tag": "swift_forced_unwrap",
    "pattern_confidence": "high",
    "pattern_rule_id": "R-swift-unwrap-01",
    "pattern_reason": "exception.subtype matched '...unexpectedly found nil...'",
    "crashed_thread": { "index": 0, "triggered": true, "frames": [...] },
    "other_threads_top_frames": [...],
    "all_threads": [...]
  },
  "images": { "matched": [...], "mismatched": [...], "missing": [...] },
  "images_summary": { "matched_count": 1, "mismatched_count": 0, "missing_count": 0 },
  "warnings": [],
  "size_warning": "report exceeded 100KB (standard tier)..."
}
```

### Tiers

| Tier | Budget | Contains |
|---|---|---|
| `summary` | ≤2KB | App, OS, exception, pattern_tag, crashed-thread top 3 frames, `images_summary` |
| `standard` | ≤12KB | + full crashed thread, other threads' top frames, `images` |
| `full` | n/a (emits `size_warning` past 100KB) | + `all_threads` (every thread, every frame) |

## Exit Codes

| Code | Meaning | First thing to do |
|---|---|---|
| 0 | Success, all images matched | — |
| 2 | Main app dSYM missing | Build the archive or download the dSYM; re-run |
| 3 | Main app UUID mismatch | Find the archive that matches the crashed build's UUID |
| 4 | Main app arch mismatch | User is on a different slice (arm64e vs arm64); use `find-dsym --arch` |
| 7 | Main matched, some other images missing/mismatched | Partial success — frames in the main binary symbolicate, others won't |

Exit codes apply to `crash` and `verify`. Other subcommands use 0/1 only.

## Pattern Tag Catalog

Every `pattern_tag` xcsym can emit, with the rule that fires it:

| pattern_tag | Rule ID | Confidence | Signal |
|---|---|---|---|
| `swift_forced_unwrap` | R-swift-unwrap-01 | high | Subtype contains "unexpectedly found nil..." |
| `swift_concurrency_violation` | R-swift-conc-01 | high | `_swift_task_isCurrentExecutor` in subtype |
| `swift_fatal_error` | R-swift-fatal-01 | high | Swift runtime failure + `swift_preconditionFailure` or `fatalError` sentinel frame |
| `zombie_or_heap_corruption` | R-zombie-01 | heuristic | `_NSZombie_*` frame or poison-pattern address |
| `stack_overflow` | R-stack-overflow-01 | heuristic | `KERN_PROTECTION_FAILURE` with fault within 1 page of SP |
| `bad_memory_access` | R-bad-access-01 | high | `EXC_BAD_ACCESS` with `KERN_INVALID_ADDRESS` |
| `illegal_instruction` | R-illegal-inst-01 | high | `EXC_BAD_INSTRUCTION` |
| `exc_guard` | R-exc-guard-01 | high | `EXC_GUARD` |
| `objc_exception` | R-objc-exc-01 | high | `EXC_CRASH`/SIGABRT with `objc_exception_throw` frame |
| `main_thread_checker_violation` | R-mtc-01 | high | `main_thread_checker.dylib` in crashed frames |
| `abort` | R-abort-01 | high | SIGABRT with `abort`/`__abort_with_payload` frame |
| `watchdog_termination` | R-watchdog-01 | high | Termination namespace=FRONTBOARD, code=0x8BADF00D |
| `user_force_quit` | R-user-quit-01 | high | FRONTBOARD + 0xDEADFA11 |
| `background_task_expired` | R-bg-expired-01 | high | FRONTBOARD + 0xBAADCA11 |
| `data_protection_violation` | R-data-prot-01 | high | RUNNINGBOARD + 0xdead10cc |
| `code_signing_killed` | R-code-sign-01 | high | CODESIGNING + 0xc51bad0[0-f] |
| `jetsam_oom` | R-jetsam-01 | high | `EXC_RESOURCE` MEMORY (fatal) or JETSAM namespace |
| `cpu_resource_fatal` | R-cpu-fatal-01 | high | `EXC_RESOURCE` CPU/WAKEUPS FATAL (excludes NON-FATAL) |
| `swiftui_update_loop` | R-swiftui-loop-01 | low | ≥100 consecutive `AG::Graph::update_*` frames from the top |
| `unclassified` | — | low | No rule matched — raw fields are in `pattern_reason` |

## dSYM Discovery Order

When the main app dSYM isn't explicitly passed, xcsym walks sources in this order (first hit wins):

1. UUID cache (`~/Library/Caches/xcsym/uuid-index.json`, unless `--no-cache`)
2. Explicit `--dsym` / `--dsym-paths` (including `XCSYM_DSYM_PATHS` env var)
3. `~/Library/Developer/Xcode/Archives/**` (most recent first)
4. `~/Library/Developer/Xcode/DerivedData/**/Build/Products/**`
5. `~/Downloads/**` (for drag-and-dropped `App.dSYM.zip` files)
6. Current Xcode toolchain (system Swift dylibs)
7. System framework dSYMs bundled with CLT
8. Spotlight (`mdfind kMDItemContentType == com.apple.xcode.dsym`, unless `--no-spotlight`)

`find-dsym` follows the same order. `list-dsyms --source=<name>` restricts scanning to one root.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Exit 2, "main dSYM missing" | No archive for that UUID on this machine | Download the archive from App Store Connect; or set `XCSYM_DSYM_PATHS` to its location |
| Exit 3, main UUID mismatch | Crash came from a different build than the archive on disk | `xcsym find-dsym <uuid>` against the exact UUID from the crash |
| Exit 4, main arch mismatch | arm64 vs arm64e slice mismatch | Pass `--arch` to `find-dsym`; verify the archive contains the slice |
| Exit 7, "main matched, others missing" | Third-party frameworks shipped without dSYMs | Expected for stripped dependencies; main app frames symbolicate |
| `pattern_tag="unclassified"` | No rule matched | Read `pattern_reason` for inspected fields; file a gap report |
| `size_warning` in output | Full tier exceeded 100KB budget | Switch to `--format=standard` or `--format=summary` |
| `HangError: bug_type=298` | `.ips` is a hang, not a crash | Use hang-diagnostics skill instead; `crash` rejects hangs |

## Resources

**Skills**: axiom-tools (skills/xclog-ref.md), axiom-build (skills/xcode-debugging.md), axiom-performance (skills/metrickit-ref.md, skills/hang-diagnostics.md), axiom-shipping (skills/testflight-triage.md)

**Agents**: crash-analyzer (interprets xcsym JSON with pattern_tag → fix guidance), simulator-tester (auto-runs xcsym on crashes during test runs)

**Commands**: `/axiom:analyze-crash`
