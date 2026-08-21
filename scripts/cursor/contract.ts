export const CURSOR_EXPECTED = Object.freeze({
  filesystemRouters: 27,
  manifestRouters: 26,
  agents: 42,
  commands: 17,
  generatedMirrors: 30,
  globalHookEventTypes: 5,
  globalHookEntries: 6,
  perAgentHooks: 6,
  releasedReadonlyBackground: 30,
  releasedWritableForeground: 12,
});

export const CURSOR_ROUTER_NAMES = Object.freeze([
  "axiom-accessibility",
  "axiom-ai",
  "axiom-apple-docs",
  "axiom-build",
  "axiom-concurrency",
  "axiom-data",
  "axiom-design",
  "axiom-games",
  "axiom-graphics",
  "axiom-health",
  "axiom-integration",
  "axiom-location",
  "axiom-macos",
  "axiom-media",
  "axiom-networking",
  "axiom-payments",
  "axiom-performance",
  "axiom-security",
  "axiom-shipping",
  "axiom-swift",
  "axiom-swiftui",
  "axiom-testing",
  "axiom-tools",
  "axiom-uikit",
  "axiom-vision",
  "axiom-watchos",
  "axiom-xcode-mcp",
]);

export const CURSOR_AGENT_NAMES = Object.freeze([
  "accessibility-auditor",
  "build-fixer",
  "build-optimizer",
  "camera-auditor",
  "codable-auditor",
  "concurrency-auditor",
  "core-data-auditor",
  "crash-analyzer",
  "database-schema-auditor",
  "energy-auditor",
  "foundation-models-auditor",
  "grdb-performance-auditor",
  "health-check",
  "iap-auditor",
  "iap-implementation",
  "icloud-auditor",
  "liquid-glass-auditor",
  "memory-auditor",
  "modernization-helper",
  "networking-auditor",
  "performance-profiler",
  "resize-auditor",
  "screenshot-validator",
  "security-privacy-scanner",
  "simulator-tester",
  "spm-conflict-resolver",
  "spritekit-auditor",
  "storage-auditor",
  "swift-performance-analyzer",
  "swift-simplifier",
  "swiftdata-auditor",
  "swiftui-architecture-auditor",
  "swiftui-layout-auditor",
  "swiftui-nav-auditor",
  "swiftui-performance-analyzer",
  "test-debugger",
  "test-failure-analyzer",
  "test-runner",
  "testing-auditor",
  "textkit-auditor",
  "triage-analyzer",
  "ux-flow-auditor",
]);

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

export const CURSOR_COMMAND_FILES = Object.freeze([
  "analyze-crash.md",
  "ask.md",
  "audit.md",
  "compare-traces.md",
  "console.md",
  "fix-build.md",
  "health-check.md",
  "modernize.md",
  "optimize-build.md",
  "profile.md",
  "resolve-deps.md",
  "run-tests.md",
  "screenshot.md",
  "status.md",
  "test-simulator.md",
  "triage.md",
  "ui.md",
]);

export const CURSOR_COMMAND_NAMES = Object.freeze(
  CURSOR_COMMAND_FILES.map((filename) => filename.replace(/\.md$/, "")),
);

function assertExactInventory(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  const sorted = [...actual].sort();
  if (
    new Set(actual).size !== actual.length
    || sorted.join("\0") !== expected.join("\0")
  ) {
    throw new Error(`Cursor ${label} inventory differs from reviewed contract`);
  }
}

export function assertCursorCapabilityInventory(inventory: {
  routers: readonly string[];
  agents: readonly string[];
  commands: readonly string[];
}): void {
  assertExactInventory(inventory.routers, CURSOR_ROUTER_NAMES, "router");
  assertExactInventory(inventory.agents, CURSOR_AGENT_NAMES, "agent");
  assertExactInventory(inventory.commands, CURSOR_COMMAND_NAMES, "command");
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
