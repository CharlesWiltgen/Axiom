---
name: xcsym-ref
description: Complete reference for the `xcsym` CLI that ships with Axiom — crash/resolve/find-dsym/list-dsyms/verify/anonymize subcommands, output schema, exit codes, pattern catalog, dSYM discovery order
---

# xcsym Reference (iOS/macOS Crash Symbolication)

Complete reference for `xcsym`, the Axiom-bundled CLI that symbolicates `.ips` (v1/v2), MetricKit (`MXCrashDiagnostic`), Apple's legacy `.crash` text, and Xcode Organizer `.xccrashpoint` bundles. Auto-detects format, discovers dSYMs, symbolicates via `atos`, categorizes crashes into a `pattern_tag`, and reports UUID/arch mismatches per image.

## When to Use This Reference

Use this reference when:
- Looking up `xcsym crash` / `verify` / `resolve` / `find-dsym` / `list-dsyms` / `anonymize` subcommand flags
- Checking the JSON output schema emitted by `crash` (`tool`, `version`, `format`, `input`, `crash`, `images`, `images_summary`, `warnings`, `size_warning`)
- Interpreting an exit code (0 / 1 usage / 2 input or main-dSYM missing / 3 UUID mismatch / 4 arch mismatch / 5 tool error / 6 timeout / 7 partial match / 8 output error)
- Mapping a `pattern_tag` to its rule ID, confidence, and signal
- Understanding the dSYM discovery order (explicit-by-UUID → explicit paths → cache → Spotlight → Archives → DerivedData → Frameworks → Downloads → Toolchain → env paths)
- Handling `.xccrashpoint` bundles (`--filter`, `--prefer-locally-symbolicated`, `empty_bundle` vs `unsupported_format`)
- Reading the routing JSON xcsym emits on hang input (`bug_type=298`) or unsupported formats
- Configuring `--format=summary` / `standard` / `full` and the tier-aware size warnings
- Scrubbing a crash for fixture use (what `anonymize` scrubs vs preserves — dSYM UUIDs are preserved so anonymized fixtures still symbolicate)

## Example Prompts

- "What does `xcsym crash` return?"
- "What pattern tags can xcsym emit?"
- "Why did xcsym exit with code 3?"
- "How does xcsym find dSYMs?"
- "What does anonymize preserve so the fixture still symbolicates?"
- "How do I handle an `.xccrashpoint` bundle with multiple builds?"
- "What's the difference between `crash` and `verify` exit codes?"

## What's Covered

- **Invocation** — `xcsym` is on PATH as a bare command (Claude Code 2.1.91+ resolves plugin `bin/` entries automatically); no prefix or path lookup needed
- **`crash` subcommand** — full pipeline (parse → discover dSYMs → symbolicate → categorize → emit JSON); `--format`, `--from-metrickit`, `--dsym`, `--dsym-paths`, `--no-symbolicate`, `--no-cache`, `--no-spotlight`, `--output`, stdin support, `.xccrashpoint` flags
- **`verify` subcommand** — per-image UUID/arch match diagnostics, different exit-code semantics than `crash`
- **`resolve` subcommand** — single-address resolution via `atos` against an explicit dSYM
- **`find-dsym` subcommand** — UUID-driven dSYM lookup across the full discovery chain
- **`list-dsyms` subcommand** — inventory by source (Archives, DerivedData, downloads, toolchain, frameworks, env, all)
- **`anonymize` subcommand** — what it scrubs (bundle IDs, process names, user paths, IPs, device names, account IDs, foreign UUIDs in freeform strings) versus preserves (dSYM UUIDs, thread names, library identifiers, structural fields)
- **Output schema** — top-level JSON shape with `pattern_tag`, `pattern_confidence`, `pattern_rule_id`, `pattern_reason`, `crashed_thread`, `images` matched/mismatched/missing
- **Format tiers** — `summary` (~2 KB / warn 4 KB), `standard` (~12 KB / warn 50 KB), `full` (warn 100 KB)
- **Exit codes** — shared codes (0/1/5/6/8) plus subcommand-specific symbolication codes (2/3/4/7), including the `crash` vs `verify` divergence on code 7
- **Pattern tag catalog** — all 19 tags Apple has surfaced via xcsym (`swift_forced_unwrap`, `swift_concurrency_violation`, `swift_fatal_error`, `zombie_or_heap_corruption`, `stack_overflow`, `bad_memory_access`, `illegal_instruction`, `exc_guard`, `objc_exception`, `main_thread_checker_violation`, `abort`, `watchdog_termination`, `user_force_quit`, `background_task_expired`, `data_protection_violation`, `code_signing_killed`, `jetsam_oom`, `cpu_resource_fatal`, `swiftui_update_loop`, `unclassified`) with their rule IDs and confidence levels
- **dSYM discovery order** — ten-step chain with the `XCSYM_FRAMEWORK_SCAN_TIMEOUT` and `XCSYM_DSYM_PATHS` environment-variable hooks
- **Hang and unsupported input routing** — JSON reject shapes (`hang_report`, `unsupported_format`, `empty_bundle`) so agents route on the error field instead of scraping stderr
- **Troubleshooting table** — symptom → cause → fix for the common exit codes and bundle errors

## Documentation Scope

This page documents the `xcsym-ref` reference skill — the bundled Axiom CLI for static crash analysis.

- For end-to-end usage guidance, see [Crash Symbolication (xcsym)](/skills/debugging/xcsym)
- For the agent that interprets xcsym JSON with pattern → fix guidance, see the [crash-analyzer agent](/agents/crash-analyzer)
- For the `/axiom:analyze-crash` command wrapper, see [/axiom:analyze-crash](/commands/debugging/analyze-crash)
- For hang `.ips` files (`bug_type=298`), xcsym rejects them by design — see [Hang Diagnostics](/skills/debugging/hang-diagnostics) instead
- For live console capture (the runtime counterpart to xcsym's post-mortem analysis), see [Console Capture (xclog)](/skills/debugging/xclog)
- For TestFlight crash triage workflows that run xcsym first, see [TestFlight Triage](/skills/debugging/testflight-triage)
