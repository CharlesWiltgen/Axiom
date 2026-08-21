---
name: axiom-profile
description: "Record and analyze performance traces through Axiom MCP profiling tools"
---

# Profile Performance

Delegate to the `performance-profiler` subagent and require it to use Axiom's structured MCP tools instead of invoking the xcprof helper binary.

1. Call `axiom_xcprof_doctor` to verify the profiling environment.
2. Select a bounded preset and target, then call `axiom_xcprof_record`; prefer `attach`. Set `allowLaunch` or `allowAllProcesses` only after the user explicitly authorizes that gated mode.
3. Call `axiom_xcprof_analyze` with the returned `trace` path and any requested time window or dSYM.
4. Report the per-family support matrix before drawing conclusions, then identify measured bottlenecks and recommendations.

If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.