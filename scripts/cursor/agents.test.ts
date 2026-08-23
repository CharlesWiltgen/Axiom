import assert from "node:assert/strict";
import { test } from "node:test";
import matter from "gray-matter";
import { CURSOR_AGENT_ADVISORIES, transformAgent } from "./agents.ts";
import { buildCapabilityReport } from "./report.ts";
import { CURSOR_HOOK_EXPECTATIONS } from "./contract.ts";
import { loadCursorSource } from "./source.ts";
import type { SourceAgent } from "./types.ts";

const readonlyAgent: SourceAgent = {
  name: "readonly-auditor",
  filename: "readonly-auditor.md",
  frontmatter: {
    name: "readonly-auditor",
    description: "Reads source files.",
    model: "sonnet",
    background: true,
    tools: ["Glob", "Grep", "Read"],
    skills: ["axiom-testing"],
  },
  body: "# Readonly Auditor\n",
  tools: ["Glob", "Grep", "Read"],
};

const screenshotValidator: SourceAgent = {
  name: "screenshot-validator",
  filename: "screenshot-validator.md",
  frontmatter: {
    name: "screenshot-validator",
    description: "Validates screenshots.",
    background: true,
    tools: ["Glob", "Read", "Bash"],
  },
  body: "# Screenshot Validator\n",
  tools: ["Glob", "Read", "Bash"],
};

test("full profile maps read-only background authority", () => {
  const result = transformAgent(readonlyAgent, "full");
  assert.equal(result.authority, "readonly");
  assert.equal(result.releasedBackground, true);
  assert.match(result.file.content, /model: inherit/);
  assert.match(result.file.content, /readonly: true/);
  assert.match(result.file.content, /is_background: true/);
});

test("writable screenshot-validator is forced foreground", () => {
  const result = transformAgent(screenshotValidator, "full");
  assert.equal(result.authority, "writable");
  assert.equal(result.releasedBackground, false);
  assert.match(result.file.content, /is_background: false/);
});

test("minimal profile omits enforcement fields and never ships", () => {
  const result = transformAgent(readonlyAgent, "minimal");
  assert.equal(result.releasedBackground, false);
  assert.doesNotMatch(result.file.content, /model:|readonly:|is_background:/);
});

test("preserves required skills and turns source hooks into an advisory warning", () => {
  const source = loadCursorSource(process.cwd());
  const buildFixer = source.agents.find((agent) => agent.name === "build-fixer");
  assert.ok(buildFixer);
  const result = transformAgent(buildFixer, "full");
  assert.match(result.file.content, /## Required Skills/);
  assert.match(result.file.content, /`axiom-build`/);
  assert.match(result.file.content, /## Advisory Hook Compatibility/);
});

test("maps all six canonical agent hooks to exact owner-specific Cursor advisories", () => {
  const expected = {
    "build-fixer": {
      event: "PreToolUse",
      matcher: "Bash",
      advisory: "Before running a shell command containing `killall`, deleting DerivedData with `rm -rf`, or erasing a simulator with `xcrun simctl erase`, warn: \"Destructive command detected.\"",
    },
    "build-optimizer": {
      event: "PreToolUse",
      matcher: "Edit|Write",
      advisory: "Before editing or writing a `.pbxproj` file, warn: \"Modifying Xcode project file. Ensure backup exists.\"",
    },
    "iap-implementation": {
      event: "PreToolUse",
      matcher: "Edit|Write",
      advisory: "Before editing or writing a StoreKit-related path or `.storekit` file, warn: \"Modifying StoreKit configuration.\"",
    },
    "simulator-tester": {
      event: "PreToolUse",
      matcher: "Bash",
      advisory: "Before running a `simctl` command that erases, deletes, shuts down, or boots simulator state, warn: \"Simulator state change command.\"",
    },
    "test-debugger": {
      event: "PreToolUse",
      matcher: "Bash",
      advisory: "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
    },
    "test-runner": {
      event: "PreToolUse",
      matcher: "Bash",
      advisory: "Before deleting `.xcresult` test results with `rm -rf`, warn: \"About to delete test results.\"",
    },
  } as const;

  assert.deepEqual(Object.keys(CURSOR_AGENT_ADVISORIES), Object.keys(expected));
  const source = loadCursorSource(process.cwd());
  for (const [owner, contract] of Object.entries(expected)) {
    const agent = source.agents.find((candidate) => candidate.name === owner);
    assert.ok(agent, owner);
    const mapping = CURSOR_AGENT_ADVISORIES[owner as keyof typeof CURSOR_AGENT_ADVISORIES];
    assert.deepEqual(
      { event: mapping.event, matcher: mapping.matcher, advisory: mapping.advisory },
      contract,
      owner,
    );
    assert.match(transformAgent(agent, "full").file.content, new RegExp(escapeRegExp(contract.advisory)), owner);
  }
});

test("fails closed when a mapped per-agent hook drifts or an unmapped owner gains hooks", () => {
  const source = loadCursorSource(process.cwd());
  const buildFixer = source.agents.find((agent) => agent.name === "build-fixer");
  assert.ok(buildFixer);
  const drifted = structuredClone(buildFixer);
  const hooks = drifted.frontmatter.hooks as Record<string, Array<{ matcher: string; hooks: Array<{ command: string }> }>>;
  hooks.PreToolUse![0]!.hooks[0]!.command = "printf 'different warning'";
  assert.throws(() => transformAgent(drifted, "full"), /agent advisory hook drift: build-fixer/);

  assert.throws(
    () => transformAgent({
      ...readonlyAgent,
      frontmatter: {
        ...readonlyAgent.frontmatter,
        hooks: { PreToolUse: [{ matcher: "Read", hooks: [{ command: "printf warning" }] }] },
      },
    }, "full"),
    /unmapped agent advisory hooks: readonly-auditor/,
  );
});

test("reduces agent descriptions to the first concise routing paragraph", () => {
  const result = transformAgent({
    ...readonlyAgent,
    frontmatter: {
      ...readonlyAgent.frontmatter,
      description: [
        "Use this agent when source files need a focused read-only audit. This second sentence is implementation detail, not routing metadata.",
        "",
        "<example>",
        "assistant: [Launches readonly-auditor agent]",
        "</example>",
      ].join("\n"),
    },
  }, "full");

  assert.equal(
    matter(result.file.content).data.description,
    "Use this agent when source files need a focused read-only audit.",
  );
});

test("renders every canonical agent with native Cursor delegation language", () => {
  const files = loadCursorSource(process.cwd()).agents.map((agent) => transformAgent(agent, "full").file);
  const forbidden = /subagent_type|run_in_background|\bAgent calls?\b|delegated subagent result(?: tool)?|\b(?:agent|auditor)s?['’]s? launch\b|\b(?:automatically\s+)?launch(?:es|ed|ing)?\b(?=[^\n.]{0,120}\b(?:agent|subagent|auditor)s?\b)/i;

  for (const file of files) {
    const parsed = matter(file.content);
    assert.equal(typeof parsed.data.description, "string", file.path);
    assert.ok(parsed.data.description.length <= 250, `${file.path}: ${parsed.data.description.length}`);
    assert.doesNotMatch(parsed.data.description, /<example>|\bClaude\b|CLI-based|\b(?:automatically\s+)?launch(?:es|ed|ing)?\b(?=[^\n.]{0,120}\b(?:agent|subagent|auditor)s?\b)/i, file.path);
    assert.doesNotMatch(file.content, forbidden, file.path);
  }
});

test("routes agent binary workflows through Axiom MCP tools and gives xcui a degraded path", () => {
  const transformed = new Map(loadCursorSource(process.cwd()).agents.map((agent) => [
    agent.name,
    transformAgent(agent, "full").file.content,
  ]));
  const expectedTools = {
    "performance-profiler": ["axiom_xcprof_doctor", "axiom_xcprof_record", "axiom_xcprof_analyze", "axiom_xcprof_compare"],
    "crash-analyzer": ["axiom_xcsym_crash", "axiom_xcsym_verify", "axiom_xcsym_find_dsym"],
    "triage-analyzer": ["axiom_xcsym_triage"],
    "test-failure-analyzer": ["axiom_xcsym_crash"],
    "memory-auditor": ["axiom_xcsym_crash"],
    "energy-auditor": ["axiom_xcsym_crash"],
  } as const;

  for (const [agent, tools] of Object.entries(expectedTools)) {
    const content = transformed.get(agent);
    assert.ok(content, agent);
    for (const tool of tools) assert.match(content, new RegExp(`\\b${tool}\\b`), `${agent}: ${tool}`);
    assert.match(content, /If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing/);
    assert.doesNotMatch(content, /fall back to (?:the )?(?:raw CLI|legacy manual parsing)|(?:xcsym|xcprof) not found|If (?:`xcprof`|xcsym) is (?:NOT )?(?:absent|present)/i, agent);
    assert.doesNotMatch(content, /XCSYM_DSYM_PATHS=[^\n]*`axiom_(?:xclog|xcsym|xcprof)_/, agent);
  }
  for (const [agent, content] of transformed) {
    assert.doesNotMatch(content, /command -v (?:xclog|xcsym|xcprof)\b|^\s*(?:xclog|xcsym|xcprof)\s+(?:list|show|launch|attach|doctor|record|analyze|compare|crash|triage|resolve|find-dsym|list-dsyms|verify|anonymize)\b/gm, agent);
  }

  const simulator = transformed.get("simulator-tester");
  assert.ok(simulator);
  assert.match(simulator, /`xcui` is an external tool and is not bundled with the Cursor plugin/);
  assert.match(simulator, /check `command -v xcui`/);
  assert.match(simulator, /check `command -v axe`/);
  assert.match(simulator, /If neither tool is available, stop UI automation/);
});

test("preserves concrete profiling arguments in emitted MCP guidance", () => {
  const source = loadCursorSource(process.cwd());
  const profiler = source.agents.find((agent) => agent.name === "performance-profiler");
  assert.ok(profiler);
  const content = transformAgent(profiler, "full").file.content;

  assert.match(content, /axiom_xcprof_record[^\n]*preset: "cpu"[^\n]*attach: "<app>"[^\n]*timeLimit: "10s"/);
  assert.match(content, /axiom_xcprof_record[^\n]*instruments: \["SwiftUI", "CPU Profiler"\][^\n]*attach: "<app>"[^\n]*timeLimit: "10s"/);
  assert.match(content, /axiom_xcprof_analyze[^\n]*trace: "<trace>"[^\n]*startMs: <milliseconds>[^\n]*endMs: <milliseconds>/);
  assert.match(content, /axiom_xcprof_compare[^\n]*baseline: "<baseline>"[^\n]*current: "<current>"/);
  assert.match(content, /failOnRegression: true/);
  assert.match(content, /dsym: "<path>"/);
  assert.doesNotMatch(content, /axiom_xcprof_record` MCP tool[^\n]*--(?:preset|instrument|attach|time-limit)/);
});

test("describes xcui as external and limits AXe fallback to compatible input verbs", () => {
  const source = loadCursorSource(process.cwd());
  const simulator = source.agents.find((agent) => agent.name === "simulator-tester");
  assert.ok(simulator);
  const content = transformAgent(simulator, "full").file.content;

  assert.match(content, /`xcui` is an external tool and is not bundled with the Cursor plugin/);
  assert.match(content, /AXe fallback is limited to compatible input verbs/);
  assert.match(content, /AXe cannot replace `wait`, `assert`, `a11y`, `dialog`, `voiceover`, `resize`, or `doctor`/);
  assert.doesNotMatch(content, /on PATH automatically only on Claude Code|`xcui` \(bundled\)|\*\*xcui\*\*: bundled/i);
  assert.doesNotMatch(content, /use AXe directly with equivalent arguments/);
});

test("rejects agents whose filename does not match their canonical name", () => {
  assert.throws(
    () => transformAgent({ ...readonlyAgent, filename: "other.md" }, "full"),
    /agent filename must match name: other.md/,
  );
});

test("builds the reviewed capability report from canonical source", () => {
  const source = loadCursorSource(process.cwd());
  const report = buildCapabilityReport(source, source.agents.map((agent) => transformAgent(agent, "full")));
  assert.deepEqual({
    routers: report.routers,
    agents: report.agents,
    commands: report.commands,
    excludedMirrors: report.excludedMirrors,
    globalHookEntries: report.globalHookEntries,
    perAgentHooks: report.perAgentHooks,
  }, {
    routers: source.skills.length,
    agents: source.agents.length,
    commands: source.commands.length,
    excludedMirrors: source.excludedMirrors,
    globalHookEntries: CURSOR_HOOK_EXPECTATIONS.globalHookEntries,
    perAgentHooks: CURSOR_HOOK_EXPECTATIONS.perAgentHooks,
  });
  assert.equal(
    report.releasedReadonlyBackground + report.releasedWritableForeground,
    source.agents.length,
    "every released agent is either read-only background or writable foreground",
  );
  assert.equal(report.authorityExpansions.length, source.agents.length);
});

test("reports the observed generated-mirror count without pinning it", () => {
  const source = loadCursorSource(process.cwd());
  const agents = source.agents.map((agent) => transformAgent(agent, "full"));
  assert.ok(Number.isSafeInteger(source.excludedMirrors) && source.excludedMirrors >= 0);
  assert.equal(buildCapabilityReport(source, agents).excludedMirrors, source.excludedMirrors);
  assert.equal(
    buildCapabilityReport({ ...source, excludedMirrors: source.excludedMirrors + 1 }, agents).excludedMirrors,
    source.excludedMirrors + 1,
    "the mirror count is reported from source, not asserted against a frozen literal",
  );
});

test("rejects duplicate transformed names that omit a canonical agent", () => {
  const source = loadCursorSource(process.cwd());
  const transformed = source.agents.map((agent) => transformAgent(agent, "full"));
  const duplicateAccessibility = transformed.map((agent) =>
    agent.name === "camera-auditor" ? { ...agent, name: "accessibility-auditor" } : agent,
  );
  assert.throws(
    () => buildCapabilityReport(source, duplicateAccessibility),
    /transformed agent names differ from source/,
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
