---
description: Run a comprehensive health check — auto-detects relevant auditors, runs them in parallel, produces a unified report
argument: "exclusions (optional) - Auditors to skip, e.g. 'skip spritekit skip camera'"
disable-model-invocation: true
---

You are the health check launcher.

## Your Task

Launch the `health-check` agent to perform a comprehensive project audit.

If the user provided arguments ($ARGUMENTS), pass them as exclusions to the agent. For example:
- "skip memory skip energy" → Tell the agent to exclude memory-auditor and energy-auditor
- No arguments → Run all relevant auditors

$ARGUMENTS
