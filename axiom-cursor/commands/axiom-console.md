---
name: axiom-console
description: "Capture iOS simulator console output through Axiom MCP logging tools"
---

# Capture Simulator Console

Use Axiom's structured MCP tools instead of invoking the xclog helper binary.

1. Read `.axiom/preferences.yaml` when present and use valid saved simulator and bundle identifiers.
2. If app discovery is needed, call `axiom_xclog_list` with the selected simulator `device`.
3. Ask the user which app to capture when no unambiguous saved or supplied bundle identifier exists.
4. Call `axiom_xclog_launch` with `bundleId`, a bounded `timeout`, and `maxLines`; pass `filter`, `subsystem`, or `output` only when requested.
5. Present the structured output and highlight errors and faults. Update preferences only with normal repository write authorization.

If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.