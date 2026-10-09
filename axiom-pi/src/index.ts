/**
 * axiom-pi — Axiom's commands and hooks for the Pi coding agent.
 *
 * Skills are installed separately (`npx skills add CharlesWiltgen/Axiom -a pi`).
 * This extension adds the two layers Pi can't get from skills alone:
 *   - the `/axiom-*` commands (trigger the matching skill inline), and
 *   - the SessionStart / tool hooks (version ground truth, Swift guardrails,
 *     crash-file routing, Bash skill hints).
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
import { detectToolchain } from "./version-context.ts";

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
  // Computed once from the session's initial cwd (the gate, PATH probe and
  // active Xcode are stable for a session) and chained onto the system prompt
  // each turn. Pi passes the freshly-rebuilt BASE prompt to this event every
  // turn (agent-session resets to base when no extension modifies it), so the
  // append is idempotent — it never accumulates. `undefined` = not yet started.
  let cachedContext: Promise<string | null> | undefined;

  async function computeAxiomContext(cwd: string): Promise<string | null> {
    if (!resolveContextDecision(cwd, process.env.AXIOM_SESSION_CONTEXT)) return null;
    const availableTools: ResolvedTool[] = [];
    for (const t of AXIOM_TOOLS) {
      const resolvedPath = findOnPath(t.name);
      if (resolvedPath) availableTools.push({ ...t, resolvedPath });
    }
    // detectToolchain never rejects; if that changes, lose only the toolchain line.
    const toolchain = await detectToolchain(process.env).catch(() => null);
    return buildAxiomContext({ now: new Date(), toolchain, availableTools });
  }

  pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx) => {
    // A rejected promise would stay cached and fail every turn; inject nothing instead.
    cachedContext ??= computeAxiomContext(ctx.cwd).catch((err: unknown) => {
      console.error("[axiom-pi] session context failed:", err);
      return null;
    });
    const context = await cachedContext;
    if (!context) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${context}` };
  });

  // --- Pre-read hook: route crash-file Reads to xcsym ----------------------
  // Fires before the Read executes (advisory, never blocks) so the agent is
  // told to symbolicate with xcsym before relying on the raw, unsymbolicated file.
  // Project detection is a synchronous filesystem scan, so it runs only once a
  // hint exists — never on the tool calls that produce nothing.
  pi.on("tool_call", (event: ToolCallEvent, ctx) => {
    if (event.toolName !== "read") return;
    const p = inputPath(event.input);
    const hint = p ? crashFileHint(p) : null;
    if (!hint || !resolveContextDecision(ctx.cwd, process.env.AXIOM_SESSION_CONTEXT)) return;
    pi.sendMessage({ customType: "axiom-crash-hint", content: hint, display: true });
  });

  // --- Post-tool hooks: Swift guardrails + Bash skill hints ----------------
  // Advisory only — Pi appends to the tool result; it can't block. Mirrors the
  // Claude Code / Codex guardrails minus format-on-save, which was retired as
  // agentically hazardous (a silent reformat desyncs the file from the model's
  // in-memory view and breaks its follow-up edits).
  pi.on("tool_result", (event: ToolResultEvent, ctx) => {
    const hint = toolResultHint(event, (p) => fs.readFileSync(p, "utf8"));
    if (!hint || !resolveContextDecision(ctx.cwd, process.env.AXIOM_SESSION_CONTEXT)) return;
    return { content: [...event.content, { type: "text", text: hint }] };
  });
}
