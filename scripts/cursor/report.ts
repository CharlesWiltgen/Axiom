import {
  CURSOR_FORCED_FOREGROUND,
  CURSOR_HOOK_DISPOSITIONS,
  CURSOR_HOOK_EXPECTATIONS,
  classifyAgentTools,
} from "./contract.ts";
import { CURSOR_AGENT_ADVISORIES } from "./agents.ts";
import { compareCursorPaths } from "./compare.ts";
import type {
  CapabilityReport,
  CursorSource,
  TransformedAgent,
} from "./types.ts";

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function hookDispositionKey(event: string, matcher: string | null, source: "global" | "agent"): string {
  if (source === "agent") return `per-agent ${event}`;
  return matcher ? `${event}(${matcher})` : event;
}

function agentHookWarning(command: string, owner: string | null): string {
  if (!owner) throw new Error("per-agent hook lacks an owner");
  const warnings = [...command.matchAll(/\becho "(Warning: [^"]+)"/g)].map((match) => match[1]);
  if (warnings.length !== 1) throw new Error(`per-agent hook warning differs from Cursor contract: ${owner}`);
  return warnings[0];
}

function agentHookAdvisory(hook: CursorSource["hooks"][number]): string {
  if (!hook.owner || !(hook.owner in CURSOR_AGENT_ADVISORIES)) {
    throw new Error(`per-agent hook advisory lacks a closed mapping: ${hook.owner ?? "unknown"}`);
  }
  const mapping = CURSOR_AGENT_ADVISORIES[hook.owner as keyof typeof CURSOR_AGENT_ADVISORIES];
  if (hook.event !== mapping.event || hook.matcher !== mapping.matcher || hook.command !== mapping.command) {
    throw new Error(`per-agent hook advisory differs from Cursor contract: ${hook.owner}`);
  }
  return mapping.advisory;
}

function hookId(hook: CursorSource["hooks"][number]): string {
  return [hook.source, hook.owner ?? "global", hook.event, hook.matcher ?? "*"].join(":");
}

export function buildCapabilityReport(source: CursorSource, agents: TransformedAgent[]): CapabilityReport {
  for (const agent of source.agents) {
    // A read-only foreground agent has no Cursor disposition — fail closed rather than ship it.
    if (classifyAgentTools(agent.tools) === "readonly" && agent.frontmatter.background !== true) {
      throw new Error(`unexpected source agent class: ${agent.name}`);
    }
  }
  // CURSOR_FORCED_FOREGROUND is the reviewed set of agents released foreground in Cursor.
  // Two-sided check: a writable background agent is downgraded to foreground by the authority
  // rule whether anyone decided so or not, so it must appear here to make that decision explicit;
  // and an entry that is not a canonical background agent is stale. A readonly background agent
  // may also be listed — that is a deliberate override, honored by transformAgent.
  const canonicalBackground = new Set(
    source.agents.filter((agent) => agent.frontmatter.background === true).map((agent) => agent.name),
  );
  const unacknowledged = source.agents
    .filter((agent) =>
      agent.frontmatter.background === true
      && classifyAgentTools(agent.tools) === "writable"
      && !CURSOR_FORCED_FOREGROUND.has(agent.name))
    .map((agent) => agent.name)
    .sort(compareCursorPaths);
  const stale = [...CURSOR_FORCED_FOREGROUND]
    .filter((name) => !canonicalBackground.has(name))
    .sort(compareCursorPaths);
  if (unacknowledged.length > 0 || stale.length > 0) {
    const problems: string[] = [];
    if (unacknowledged.length > 0) {
      problems.push(
        `writable background agents Cursor will release foreground without a reviewed decision (add to CURSOR_FORCED_FOREGROUND): ${unacknowledged.join(", ")}`,
      );
    }
    if (stale.length > 0) {
      problems.push(
        `CURSOR_FORCED_FOREGROUND names that are not canonical background agents (remove): ${stale.join(", ")}`,
      );
    }
    throw new Error(problems.join("; "));
  }

  if (agents.length !== source.agents.length) throw new Error("transformed agent inventory differs from source");
  const sourceNames = source.agents.map((agent) => agent.name).sort(compareCursorPaths);
  const transformedNames = agents.map((agent) => agent.name).sort(compareCursorPaths);
  if (sourceNames.join("\0") !== transformedNames.join("\0")) {
    throw new Error("transformed agent names differ from source");
  }
  const releasedReadonlyBackground = agents.filter((agent) => agent.authority === "readonly" && agent.releasedBackground).length;
  const releasedWritableForeground = agents.filter((agent) => agent.authority === "writable" && !agent.releasedBackground).length;

  const globalHookEntries = source.hooks.filter((hook) => hook.source === "global");
  const perAgentHooks = source.hooks.filter((hook) => hook.source === "agent");
  assertEqual(globalHookEntries.length, CURSOR_HOOK_EXPECTATIONS.globalHookEntries, "global hook entries");
  assertEqual(perAgentHooks.length, CURSOR_HOOK_EXPECTATIONS.perAgentHooks, "per-agent hooks");
  const dispositionKeys = new Set(source.hooks.map((hook) => hookDispositionKey(hook.event, hook.matcher, hook.source)));
  const expectedDispositionKeys = Object.keys(CURSOR_HOOK_DISPOSITIONS);
  if (dispositionKeys.size !== expectedDispositionKeys.length || expectedDispositionKeys.some((key) => !dispositionKeys.has(key))) {
    throw new Error("hook disposition coverage differs from Cursor contract");
  }

  return {
    routers: source.skills.length,
    agents: source.agents.length,
    commands: source.commands.length,
    excludedMirrors: source.excludedMirrors,
    globalHookEntries: globalHookEntries.length,
    perAgentHooks: perAgentHooks.length,
    releasedReadonlyBackground,
    releasedWritableForeground,
    authorityExpansions: [...agents]
      .sort((left, right) => compareCursorPaths(left.name, right.name))
      .map((agent) => ({
        agent: agent.name,
        sourceTools: [...agent.authorityExpansion],
        inherited: "Cursor agent inherits its host tool and MCP access.",
      })),
    dispositions: Object.fromEntries(
      expectedDispositionKeys.sort(compareCursorPaths).map((key) => [key, CURSOR_HOOK_DISPOSITIONS[key as keyof typeof CURSOR_HOOK_DISPOSITIONS]]),
    ),
    routerDispositions: source.skills
      .map((skill) => ({
        name: skill.name,
        disposition: "generated-native-skill" as const,
        listedInCanonicalManifest: source.manifestSkillNames.includes(skill.name),
      }))
      .sort((left, right) => compareCursorPaths(left.name, right.name)),
    agentDispositions: [...agents]
      .sort((left, right) => compareCursorPaths(left.name, right.name))
      .map((agent) => ({
        name: agent.name,
        disposition: "generated-native-subagent" as const,
        authority: agent.authority,
        sourceBackground: agent.sourceBackground,
        releasedBackground: agent.releasedBackground,
        sourceTools: [...agent.authorityExpansion],
        inheritedAuthority: "Cursor agent inherits its host tool and MCP access." as const,
      })),
    commandDispositions: source.commands
      .map((command) => ({
        canonicalName: command.name,
        generatedName: `axiom-${command.name}`,
        disposition: "generated-native-command" as const,
      }))
      .sort((left, right) => compareCursorPaths(left.canonicalName, right.canonicalName)),
    hookDispositions: source.hooks
      .map((hook) => ({
        id: hookId(hook),
        source: hook.source,
        owner: hook.owner,
        event: hook.event,
        matcher: hook.matcher,
        disposition: hook.source === "agent"
          ? "agent-prompt.advisory"
          : CURSOR_HOOK_DISPOSITIONS[hookDispositionKey(hook.event, hook.matcher, hook.source) as keyof typeof CURSOR_HOOK_DISPOSITIONS],
        warning: hook.source === "agent" ? agentHookWarning(hook.command, hook.owner) : null,
        advisory: hook.source === "agent" ? agentHookAdvisory(hook) : null,
      }))
      .sort((left, right) => compareCursorPaths(left.id, right.id)),
    mcpDispositions: [{
      name: "axiom",
      disposition: "external-runtime-mcp",
      command: "npx -y axiom-mcp",
      bundled: false,
    }],
    binaryDispositions: [
      { name: "xclog", disposition: "external-via-axiom-mcp" },
      { name: "xcprof", disposition: "external-via-axiom-mcp" },
      { name: "xcsym", disposition: "external-via-axiom-mcp" },
      { name: "xcui", disposition: "external-unbundled-no-mcp-wrapper" },
    ],
    cloudDispositions: [{
      name: "Cursor Cloud Agents",
      disposition: "unsupported",
    }],
  };
}
