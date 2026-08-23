import {
  CURSOR_ALLOWED_AGENT_FIELDS,
  CURSOR_FORCED_FOREGROUND,
  classifyAgentTools,
} from "./contract.ts";
import {
  assertNoUnsupportedClaudeTokens,
  CURSOR_MCP_TOOL_BOUNDARY,
  CURSOR_XCUI_TOOL_BOUNDARY,
  rewriteCursorMcpWorkflows,
  rewriteCursorInvocations,
} from "./references.ts";
import type {
  AgentProfile,
  Authority,
  SourceAgent,
  TransformedAgent,
} from "./types.ts";

function yamlScalar(value: string): string {
  return /^[a-zA-Z0-9_.-]+$/.test(value) ? value : JSON.stringify(value);
}

export const CURSOR_AGENT_ADVISORIES = {
  "build-fixer": {
    event: "PreToolUse",
    matcher: "Bash",
    command: "bash -c 'if echo \"$TOOL_INPUT_COMMAND\" | grep -qE \"killall|rm -rf.*DerivedData|xcrun simctl erase\"; then echo \"Warning: Destructive command detected.\"; fi; exit 0'",
    advisory: "Before running a shell command containing `killall`, deleting DerivedData with `rm -rf`, or erasing a simulator with `xcrun simctl erase`, warn: \"Destructive command detected.\"",
  },
  "build-optimizer": {
    event: "PreToolUse",
    matcher: "Edit|Write",
    command: "bash -c 'if echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE \"\\.pbxproj$\"; then echo \"Warning: Modifying Xcode project file. Ensure backup exists.\"; fi; exit 0'",
    advisory: "Before editing or writing a `.pbxproj` file, warn: \"Modifying Xcode project file. Ensure backup exists.\"",
  },
  "iap-implementation": {
    event: "PreToolUse",
    matcher: "Edit|Write",
    command: "bash -c 'if echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE \"StoreKit|\\.storekit$\"; then echo \"Warning: Modifying StoreKit configuration.\"; fi; exit 0'",
    advisory: "Before editing or writing a StoreKit-related path or `.storekit` file, warn: \"Modifying StoreKit configuration.\"",
  },
  "simulator-tester": {
    event: "PreToolUse",
    matcher: "Bash",
    command: "bash -c 'if echo \"$TOOL_INPUT_COMMAND\" | grep -qE \"simctl.*(erase|delete|shutdown|boot)\"; then echo \"Warning: Simulator state change command.\"; fi; exit 0'",
    advisory: "Before running a `simctl` command that erases, deletes, shuts down, or boots simulator state, warn: \"Simulator state change command.\"",
  },
  "test-debugger": {
    event: "PreToolUse",
    matcher: "Bash",
    command: "bash -c 'if echo \"$TOOL_INPUT_COMMAND\" | grep -qE \"rm -rf.*xcresult\"; then echo \"Warning: About to delete test results.\"; fi; exit 0'",
    advisory: "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
  },
  "test-runner": {
    event: "PreToolUse",
    matcher: "Bash",
    command: "bash -c 'if echo \"$TOOL_INPUT_COMMAND\" | grep -qE \"rm -rf.*xcresult\"; then echo \"Warning: About to delete test results.\"; fi; exit 0'",
    advisory: "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
  },
} as const;

type AdvisoryOwner = keyof typeof CURSOR_AGENT_ADVISORIES;

export function normalizeAgentDescription(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("agent description must be a non-empty string");
  }
  const firstParagraph = value.trim().split(/\n[ \t]*\n/, 1)[0] ?? "";
  const normalizedParagraph = firstParagraph.replace(/\s+/g, " ").trim();
  const firstSentence = normalizedParagraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? normalizedParagraph;
  const description = rewriteCursorMcpWorkflows(rewriteCursorInvocations(firstSentence.replace(/\bCLI-based\b/g, "MCP-based")));
  assertNoUnsupportedClaudeTokens(description);
  return description;
}

function assertCanonicalAgent(agent: SourceAgent): void {
  if (agent.filename !== `${agent.name}.md`) {
    throw new Error(`agent filename must match name: ${agent.filename}`);
  }
  if (agent.frontmatter.name !== agent.name) {
    throw new Error(`agent frontmatter name must match name: ${agent.name}`);
  }
  for (const field of Object.keys(agent.frontmatter)) {
    if (!CURSOR_ALLOWED_AGENT_FIELDS.has(field)) {
      throw new Error(`unknown agent frontmatter field: ${field}`);
    }
  }
  if (!Array.isArray(agent.frontmatter.tools)) {
    throw new Error(`agent frontmatter tools must be an array: ${agent.name}`);
  }
  if (agent.frontmatter.tools.join("\0") !== agent.tools.join("\0")) {
    throw new Error(`agent tools disagree with frontmatter: ${agent.name}`);
  }
}

function requiredSkills(frontmatter: Record<string, unknown>): string[] {
  const skills = frontmatter.skills;
  if (skills === undefined) return [];
  if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== "string")) {
    throw new Error("agent skills must be a string array");
  }
  return skills;
}

function advisoryHook(agent: SourceAgent): (typeof CURSOR_AGENT_ADVISORIES)[AdvisoryOwner] | null {
  const hooks = agent.frontmatter.hooks;
  const expected = CURSOR_AGENT_ADVISORIES[agent.name as AdvisoryOwner];
  if (hooks === undefined) {
    if (expected) throw new Error(`agent advisory hook drift: ${agent.name}`);
    return null;
  }
  if (!expected) throw new Error(`unmapped agent advisory hooks: ${agent.name}`);
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) {
    throw new Error(`agent advisory hook drift: ${agent.name}`);
  }
  const events = Object.keys(hooks as Record<string, unknown>);
  const entries = (hooks as Record<string, unknown>)[expected.event];
  if (events.length !== 1 || events[0] !== expected.event || !Array.isArray(entries) || entries.length !== 1) {
    throw new Error(`agent advisory hook drift: ${agent.name}`);
  }
  const entry = entries[0];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`agent advisory hook drift: ${agent.name}`);
  }
  const matcher = (entry as { matcher?: unknown }).matcher;
  const commands = (entry as { hooks?: unknown }).hooks;
  if (matcher !== expected.matcher || !Array.isArray(commands) || commands.length !== 1) {
    throw new Error(`agent advisory hook drift: ${agent.name}`);
  }
  const command = commands[0];
  if (
    !command
    || typeof command !== "object"
    || Array.isArray(command)
    || (command as { type?: unknown }).type !== "command"
    || (command as { command?: unknown }).command !== expected.command
  ) {
    throw new Error(`agent advisory hook drift: ${agent.name}`);
  }
  return expected;
}

function promptPreamble(agent: SourceAgent): string {
  const sections: string[] = [];
  const skills = requiredSkills(agent.frontmatter);
  if (skills.length > 0) {
    sections.push(`## Required Skills\n\n${skills.map((skill) => `- \`${skill}\``).join("\n")}`);
  }
  const hook = advisoryHook(agent);
  if (hook) {
    sections.push(
      `## Advisory Hook Compatibility\n\n> The source ${hook.event} hook for \`${hook.matcher}\` is advisory in Cursor, not an enforceable permission boundary. ${hook.advisory}`,
    );
  }
  return sections.length === 0 ? "" : `${sections.join("\n\n")}\n\n`;
}

export function transformAgent(agent: SourceAgent, profile: AgentProfile): TransformedAgent {
  assertCanonicalAgent(agent);
  const authority = classifyAgentTools(agent.tools) as Authority;
  const sourceBackground = agent.frontmatter.background === true;
  // Apply the forced-foreground exclusion once, before it reaches frontmatter — emitting
  // `is_background: true` here while reporting foreground downstream ships inconsistent metadata.
  const releasedBackground = profile === "full"
    && authority === "readonly"
    && sourceBackground
    && !CURSOR_FORCED_FOREGROUND.has(agent.name);
  const description = normalizeAgentDescription(agent.frontmatter.description);
  const frontmatter = profile === "full"
    ? [
      `name: ${yamlScalar(agent.name)}`,
      `description: ${yamlScalar(description)}`,
      "model: inherit",
      `readonly: ${authority === "readonly"}`,
      `is_background: ${releasedBackground}`,
    ]
    : [
      `name: ${yamlScalar(agent.name)}`,
      `description: ${yamlScalar(description)}`,
    ];
  const translatedBody = rewriteCursorMcpWorkflows(rewriteCursorInvocations(agent.body));
  const hasMcpWorkflow = /\baxiom_(?:xclog|xcsym|xcprof)_/.test(translatedBody);
  const body = `${hasMcpWorkflow ? `${CURSOR_MCP_TOOL_BOUNDARY}\n\n` : ""}${agent.name === "simulator-tester" ? `${CURSOR_XCUI_TOOL_BOUNDARY}\n\n` : ""}${translatedBody}`;
  assertNoUnsupportedClaudeTokens(body);

  return {
    name: agent.name,
    authority,
    sourceBackground,
    releasedBackground,
    authorityExpansion: [...agent.tools],
    file: {
      path: `agents/${agent.filename}`,
      content: `---\n${frontmatter.join("\n")}\n---\n\n${promptPreamble(agent)}${body}`,
      mode: 0o644,
    },
  };
}
