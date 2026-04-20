# Crash Symbolication (xcsym)

Reference for `xcsym`, an iOS/macOS crash symbolication tool that parses `.ips` (v1/v2), MetricKit (`MXCrashDiagnostic`), and Apple's legacy `.crash` text reports end-to-end and emits LLM-friendly JSON. Discovers dSYMs automatically, runs `atos`, categorizes crashes into a `pattern_tag`, and reports UUID/arch mismatches per image.

## When to Use This Reference

Use this reference when:
- You have an `.ips`, MetricKit, or legacy `.crash` text file that needs symbolication
- Xcode Organizer exposed an `.xccrashpoint` bundle via "Show in Finder" and you need the nested `Logs/*.crash` analyzed
- Diagnosing *why* a crash came back unsymbolicated (UUID/arch mismatch)
- Triaging TestFlight crashes downloaded from App Store Connect
- Inventorying which dSYMs are present on the local machine
- Scrubbing a real user's crash for safe use as a test fixture

**Core problem solved:** Apple's built-in tooling (`atos`, `symbolicatecrash`) gives raw text output geared for humans reading Xcode. `xcsym` layers dSYM discovery, pattern categorization, and structured JSON on top so an agent can triage a crash in one call.

## Example Prompts

- "Symbolicate this crash"
- "Why is my TestFlight crash unsymbolicated?"
- "What kind of crash is this?"
- "Find the dSYM for UUID ..."
- "Scrub this crash file so I can commit it as a fixture"

## What's Covered

- **Subcommand reference** — `crash`, `resolve`, `find-dsym`, `list-dsyms`, `verify`, `anonymize`
- **Output schema** — `CrashReport` structure with `pattern_tag`, `images`, `warnings`, and tier-aware sizing
- **Exit code table** — 0 / 2 missing / 3 UUID mismatch / 4 arch mismatch / 7 partial match
- **Pattern tag catalog** — 19 rules with tags like `swift_forced_unwrap`, `watchdog_termination`, `swift_concurrency_violation`
- **dSYM discovery order** — cache → explicit → Archives → DerivedData → Downloads → toolchain → frameworks → Spotlight
- **Troubleshooting** — common symptoms and which subcommand to reach for

## Documentation Scope

This page documents the `xcsym-ref` reference skill. For the end-to-end agent workflow that interprets `xcsym` output with fix guidance, use the [crash-analyzer agent](/agents/crash-analyzer). For hang analysis (`.ips` files with `bug_type=298`), `xcsym` intentionally rejects the input — see Hang Diagnostics instead.

- For automated TestFlight triage, see [TestFlight Triage](/skills/debugging/testflight-triage)
- For MetricKit-specific workflows, see the `metrickit-ref` reference
- For hangs (not crashes), see [Hang Diagnostics](/skills/debugging/hang-diagnostics)

## Key Concepts

- **`crash` is the default entry point** — parses format, discovers dSYMs, runs `atos`, categorizes, emits JSON. Only reach for `resolve`/`find-dsym`/`verify` when it fails.
- **Exit codes carry diagnosis** — non-zero codes name the reason symbolication was incomplete; don't treat them as "the tool failed"
- **Format tiers protect context** — `summary` ≤2KB, `standard` ≤12KB, `full` emits `size_warning` past 100KB
- **UUIDs are correlation keys** — `anonymize` preserves dSYM UUIDs so anonymized fixtures still symbolicate
- **Auto-detection** — `.ips` (v1 and v2), MetricKit JSON, and Apple's legacy `.crash` text format are all detected without flags

## Related

- [xclog](/skills/debugging/xclog) — captures live console logs; xcsym parses post-mortem crash files
- [Xcode Debugging](/skills/debugging/xcode-debugging) — environment-first build diagnostics
- [Hang Diagnostics](/skills/debugging/hang-diagnostics) — authoritative path for `.ips` hangs (`bug_type=298`)
- [TestFlight Triage](/skills/debugging/testflight-triage) — user-crash workflow that runs xcsym first
- [crash-analyzer](/agents/crash-analyzer) — agent that interprets xcsym output with pattern→fix guidance
- [/axiom:analyze-crash](/commands/debugging/analyze-crash) — command wrapper that invokes crash-analyzer
