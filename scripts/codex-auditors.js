import { agentToSkillName } from "./codex-exclude.js";

export function adaptHealthCheckForCodex(content, agents) {
  const replacements = [
    [
      "You are an orchestrator that launches specialized Axiom auditors in parallel, collects their findings, deduplicates by file:line, and produces a unified health report.",
      "Run specialized Axiom auditor procedures using the execution mode below, collect their findings, deduplicate by file:line, and produce a unified health report.",
    ],
    ["## Phase 2: Launch Auditors in Parallel", "## Phase 2: Run Selected Auditor Procedures"],
    [
      "Dispatch one Agent call per auditor selected in Phase 1. Do not merge auditors, skip them, or run their scans inline. N selected → N Agent calls in parallel.\n\nUse the Agent tool with `run_in_background: true` for each selected auditor. Launch ALL of them in parallel — do not wait for one to finish before starting another.",
      "Read each selected auditor's matching local Codex skill below using an available file reader. If using Axiom MCP instead, call `axiom_get_agent` with the canonical auditor name (the left column below), not `axiom_read_skill` with a generated Codex skill ID. Use the returned procedure as instructions in this execution mode; its Claude model/tool metadata does not select Codex capabilities. Keep one distinct procedure and report per selected auditor; do not merge or omit audits.\n\nChoose execution mode from actual host capabilities and delegation policy:\n\n- If delegation is permitted and `spawn_agent` plus completion tools such as `wait_agent` are available, delegate each procedure with its skill path, Phase 0 scope, exclusions, emphasis, and report destination. Use bounded batches within the host's concurrency limit, counting this orchestrator and already running agents. Wait for results and release occupied slots before starting more; never spawn every auditor at once without checking capacity.\n- If delegation is unavailable or prohibited, run the matching skills sequentially in this session, writing each distinct report before the next procedure. Do not invent tools or silently skip audits.\n- Preserve the user's requested model and reasoning effort. Otherwise inherit the current model; do not substitute a Claude model label. If the requested model cannot run, report that limitation instead of substituting another model.\n\nAuditor-to-skill mapping:\n\n" + agents.filter(name => name !== "health-check" && content.includes(name)).sort().map(name => `- \`${name}\` → \`${agentToSkillName(name)}\` (\`../${agentToSkillName(name)}/SKILL.md\`)`).join("\n"),
    ],
    [
      "1. Use TaskOutput to collect the summary from each background agent launched in Phase 2. Wait for all agents to return before proceeding.",
      "1. Collect each delegated result using the available completion tools, or collect each sequential procedure's summary. Wait for all selected audits to finish or have a recorded failure before proceeding. A failure or unavailable capability is not a passed audit.",
    ],
    [
      "Orchestrates multiple specialized auditors in parallel, deduplicates findings, and produces a unified report.",
      "Runs all selected specialized auditor procedures through bounded delegation or sequential execution, deduplicates findings, and produces a unified report.",
    ],
  ];
  let adapted = content;
  for (const [before, after] of replacements) {
    if (adapted.split(before).length !== 2) {
      throw new Error(`Codex health-check orchestration drift: expected one occurrence of ${before.slice(0, 80)}`);
    }
    adapted = adapted.replace(before, after);
  }
  return adapted;
}
