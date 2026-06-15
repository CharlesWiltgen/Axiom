/**
 * axiom-pi — Axiom's commands and hooks for the Pi coding agent.
 *
 * Skills are installed separately (`npx skills add CharlesWiltgen/Axiom -a pi`).
 * This extension adds the two layers Pi can't get from skills alone:
 *   - the `/axiom-*` commands (trigger the matching skill inline), and
 *   - the SessionStart / tool hooks (version ground truth, Swift guardrail,
 *     swiftformat, crash-file routing, Bash skill hints).
 */

import type {
  ExtensionAPI,
  BeforeAgentStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";

import { AXIOM_COMMANDS } from "./commands.ts";
import {
  AXIOM_TOOLS,
  buildAxiomContext,
  findOnPath,
  resolveContextDecision,
  type ResolvedTool,
} from "./session.ts";
import { crashFileHint, inputPath, toolResultHint } from "./guardrails.ts";

export default function axiomPi(pi: ExtensionAPI): void {
  // --- Commands: /axiom-<name> → trigger the matching skill ----------------
  for (const cmd of AXIOM_COMMANDS) {
    pi.registerCommand(cmd.name, {
      description: cmd.description,
      getArgumentCompletions: (prefix) => {
        if (!cmd.completions) return null;
        const matches = cmd.completions.filter((c) => c.startsWith(prefix));
        return matches.length ? matches.map((value) => ({ value, label: value })) : null;
      },
      handler: async (args) => {
        try {
          pi.sendUserMessage(cmd.prompt(args)); // synchronous; queues the prompt
        } catch (err) {
          console.error(`[axiom-pi] /${cmd.name} failed to dispatch:`, err);
        }
      },
    });
  }

  // --- Session hook: version ground truth + tool availability --------------
  // Computed once from the session's initial cwd (the gate + PATH probe are
  // stable for a session) and chained onto the system prompt each turn. Pi
  // passes the freshly-rebuilt BASE prompt to this event every turn
  // (agent-session resets to base when no extension modifies it), so the
  // append is idempotent — it never accumulates. `undefined` = not yet computed.
  let cachedContext: string | null | undefined;

  function axiomContextForSession(cwd: string): string | null {
    if (cachedContext !== undefined) return cachedContext;
    if (!resolveContextDecision(cwd, process.env.AXIOM_SESSION_CONTEXT)) {
      cachedContext = null;
      return null;
    }
    const availableTools: ResolvedTool[] = [];
    for (const t of AXIOM_TOOLS) {
      const resolvedPath = findOnPath(t.name);
      if (resolvedPath) availableTools.push({ ...t, resolvedPath });
    }
    cachedContext = buildAxiomContext({ now: new Date(), availableTools });
    return cachedContext;
  }

  pi.on("before_agent_start", (event: BeforeAgentStartEvent, ctx) => {
    const context = axiomContextForSession(ctx.cwd);
    if (!context) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${context}` };
  });

  // --- Pre-read hook: route crash-file Reads to xcsym ----------------------
  // Fires before the Read executes (advisory, never blocks) so the agent is
  // told to symbolicate with xcsym before relying on the raw, unsymbolicated file.
  pi.on("tool_call", (event: ToolCallEvent) => {
    if (event.toolName !== "read") return;
    const p = inputPath(event.input);
    const hint = p ? crashFileHint(p) : null;
    if (hint) pi.sendMessage({ customType: "axiom-crash-hint", content: hint, display: true });
  });

  // --- Post-tool hooks: Swift guardrail + swiftformat, Bash skill hints -----
  pi.on("tool_result", async (event: ToolResultEvent) => {
    // Compute the advisory first (reads the pre-format file, so the @State
    // warning's line numbers match what the model wrote), then format.
    const hint = toolResultHint(event, (p) => fs.readFileSync(p, "utf8"));

    if (event.toolName === "write" || event.toolName === "edit") {
      const p = inputPath(event.input);
      if (p && p.endsWith(".swift") && findOnPath("swiftformat")) {
        try {
          await pi.exec("swiftformat", [p, "--quiet"]);
        } catch {
          // Formatting is best-effort — never fail the write.
        }
      }
    }

    if (hint) return { content: [...event.content, { type: "text", text: hint }] };
  });
}
