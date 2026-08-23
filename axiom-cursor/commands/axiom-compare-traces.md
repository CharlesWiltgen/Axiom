---
name: axiom-compare-traces
description: "Compare two performance traces for regressions with Axiom MCP profiling tools"
---

# Compare Performance Traces

Use Axiom's structured MCP tools instead of invoking the xcprof helper binary.

1. Call `axiom_xcprof_doctor` to verify the profiling environment.
2. Obtain baseline and current traces that exercise the same workload. If capture is needed, call `axiom_xcprof_record` for each run with a bounded `timeLimit`; prefer `attach`. Set `allowLaunch` or `allowAllProcesses` only after the user explicitly authorizes that gated mode.
3. Call `axiom_xcprof_compare` with `baseline`, `current`, and any requested `thresholdPct`, `failOnRegression`, or `dsym` values.
4. Report regressions and improvements separately, including unsymbolicated frames and workload-comparability limits.

If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.