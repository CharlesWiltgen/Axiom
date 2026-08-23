/**
 * The reviewed Cursor release contract.
 *
 * This file holds *policy* — decisions a human made about how canonical Axiom
 * capabilities are ported to Cursor. It deliberately does NOT hold inventory:
 * router, agent, and command names and counts are derived from the canonical
 * tree at build time, so adding a capability is not a contract edit. See
 * `build-codex.ts`, which derives its agent list for the same reason.
 *
 * A change to anything in this file should require review. A change to the
 * canonical inventory should not.
 */

/** Hook porting is a closed, reviewed decision — drift here must fail the build. */
export const CURSOR_HOOK_EXPECTATIONS = Object.freeze({
  globalHookEventTypes: 5,
  globalHookEntries: 6,
  perAgentHooks: 6,
});

export const CURSOR_INJECTED_ROUTER = "axiom-tools";
export const CURSOR_RELEASE_PROFILE = "full" as const;
export const CURSOR_FORCED_FOREGROUND = new Set(["screenshot-validator"]);
export const CURSOR_READONLY_TOOLS = new Set(["Glob", "Grep", "Read"]);
export const CURSOR_ALLOWED_AGENT_TOOLS = new Set([
  "Glob",
  "Grep",
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Agent",
]);

const CURSOR_ROUTER_NAME = /^axiom-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURSOR_SLUG_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertDerivedInventory(
  actual: readonly string[],
  pattern: RegExp,
  label: string,
): void {
  if (actual.length === 0) {
    throw new Error(`Cursor ${label} inventory is empty`);
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error(`Cursor ${label} inventory contains a duplicate name`);
  }
  for (const name of actual) {
    if (!pattern.test(name)) {
      throw new Error(`Cursor ${label} inventory contains an unusable name: ${name}`);
    }
  }
}

/**
 * Validate the shape of a derived inventory without pinning its membership.
 * Fails closed on empty, duplicate, and non-slug names — the properties the
 * renderer and the Cursor manifests actually depend on.
 */
export function assertCursorCapabilityInventory(inventory: {
  routers: readonly string[];
  agents: readonly string[];
  commands: readonly string[];
}): void {
  assertDerivedInventory(inventory.routers, CURSOR_ROUTER_NAME, "router");
  assertDerivedInventory(inventory.agents, CURSOR_SLUG_NAME, "agent");
  assertDerivedInventory(inventory.commands, CURSOR_SLUG_NAME, "command");
}

export const CURSOR_ALLOWED_AGENT_FIELDS = new Set([
  "name",
  "description",
  "model",
  "background",
  "color",
  "tools",
  "skills",
  "hooks",
  "mcp",
  "exempt-from-routing",
]);

export const CURSOR_HOOK_DISPOSITIONS = Object.freeze({
  SessionStart: "sessionStart.additional_context",
  UserPromptSubmit: "omitted",
  "PreToolUse(Read)": "omitted",
  "PostToolUse(Bash)": "postToolUse.additional_context",
  "PostToolUse(Write|Edit)": "postToolUse.additional_context",
  SubagentStart: "prompt",
  "per-agent PreToolUse": "advisory",
});

export type AgentToolClass = "readonly" | "writable";

export function classifyAgentTools(tools: string[]): AgentToolClass {
  if (tools.length === 0) {
    throw new Error("empty agent tool list");
  }

  for (const tool of tools) {
    if (!CURSOR_ALLOWED_AGENT_TOOLS.has(tool)) {
      throw new Error(`unknown agent tool: ${tool}`);
    }
  }

  return tools.every((tool) => CURSOR_READONLY_TOOLS.has(tool))
    ? "readonly"
    : "writable";
}
