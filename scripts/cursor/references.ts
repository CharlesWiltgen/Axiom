import path from "node:path";
import type { VirtualFile } from "./types.ts";

export const CURSOR_INVOCATION_REWRITES: ReadonlyArray<[RegExp, string]> = [
  [/`\/axiom:([a-z0-9-]+)`/g, "`/axiom-$1`"],
  [/\b(?:Automatically\s+)?Launch(?:es|ed|ing)?\s+the\s+\*\*([a-z0-9-]+)\*\*\s+agent\b/gi, "Delegate to the **$1** subagent"],
  [/\b(?:Automatically\s+)?Launch(?:es|ed|ing)?\s+(?:the\s+)?`([a-z0-9-]+)`\s+agent\b/gi, "Delegate to the `$1` subagent"],
  [/\b(?:Automatically\s+)?Launch(?:es|ed|ing)?\s+(?:the\s+)?(?!(?:that|each|appropriate|corresponding|specific)\b)([a-z0-9-]+)\s+agent\b/gi, "Delegate to the `$1` subagent"],
  [/\bTaskOutput tool\b/g, "subagent completion results"],
  [/\bTaskOutput\b/g, "the returned subagent result"],
  [/\bTask tool\b/g, "Cursor subagent delegation"],
  [/\bAgent tool\b/g, "Cursor subagent delegation"],
  [/\bAgent calls\b/g, "subagent delegations"],
  [/\bAgent call\b/g, "subagent delegation"],
  [/\bthe agent's launch prompt\b/gi, "the subagent delegation prompt"],
  [/\b(?:the\s+)?auditors?['’]s? launch prompt\b/gi, "the auditor subagent delegation prompt"],
  [/\bagent launch prompt\b/gi, "subagent delegation prompt"],
  [/\blaunch prompt\b/gi, "delegation prompt"],
  [/\bsubagent_type set to the agent name\b/g, "the matching subagent name"],
  [/`run_in_background:\s*true`(?: parameter)?/g, "background subagent execution"],
  [/\brun_in_background:\s*true(?: parameter)?/g, "background subagent execution"],
  [/\bLaunch each agent in background\b/gi, "Delegate to each agent as a background subagent"],
  [/\bLaunch Auditors\b/g, "Delegate to Auditor Subagents"],
  [/\blaunches specialized Axiom auditors\b/gi, "delegates to specialized Axiom auditor subagents"],
  [/\blaunching agents\b/gi, "delegating to subagents"],
  [/\blaunch(?:es|ed|ing)? that specific audit agent\b/gi, "delegate to that specific audit subagent"],
  [/\blaunch(?:es|ed|ing)? the (appropriate|corresponding|specific) agent(?:\(s\)|s)?\b/gi, "delegate to the $1 subagent(s)"],
  [/\blaunch(?:es|ed|ing)? (that|each|the) agent\b/gi, "delegate to $1 subagent"],
  [/\blaunch ALL of them\b/g, "delegate to all of them"],
  [/\bauditors were launched\b/gi, "auditors were delegated to"],
  [/\bAskUserQuestion tool\b/g, "ask the user directly"],
];

const UNSUPPORTED_TOKENS: ReadonlyArray<[RegExp, string]> = [
  [/\/axiom:/, "/axiom:"],
  [/\bTaskOutput\b/, "TaskOutput"],
  [/\bAskUserQuestion\b/, "AskUserQuestion"],
  [/CLAUDE_PLUGIN_ROOT/, "CLAUDE_PLUGIN_ROOT"],
  [/\$ARGUMENTS/, "$ARGUMENTS"],
  [/(?<!\$)\{\{/, "double-brace template marker"],
  [/<\/?Task>/, "<Task>"],
  [/\bsubagent_type\b/, "subagent_type"],
  [/\brun_in_background\b/, "run_in_background"],
  [/\bAgent calls?\b/, "Agent call"],
  [/\bdelegated subagent result(?: tool)?\b/, "delegated subagent result"],
  [/^\s*prompt\s*:\s*\|/m, "prompt: |"],
];

const MCP_SUBCOMMANDS = new Map<string, string>([
  ["xclog attach", "axiom_xclog_attach"],
  ["xclog launch", "axiom_xclog_launch"],
  ["xclog list", "axiom_xclog_list"],
  ["xclog show", "axiom_xclog_show"],
  ["xcprof analyze", "axiom_xcprof_analyze"],
  ["xcprof compare", "axiom_xcprof_compare"],
  ["xcprof doctor", "axiom_xcprof_doctor"],
  ["xcprof record", "axiom_xcprof_record"],
  ["xcsym anonymize", "axiom_xcsym_anonymize"],
  ["xcsym crash", "axiom_xcsym_crash"],
  ["xcsym find-dsym", "axiom_xcsym_find_dsym"],
  ["xcsym list-dsyms", "axiom_xcsym_list_dsyms"],
  ["xcsym resolve", "axiom_xcsym_resolve"],
  ["xcsym triage", "axiom_xcsym_triage"],
  ["xcsym verify", "axiom_xcsym_verify"],
]);

const MCP_COMMAND_PATTERN = "(?:xclog\\s+(?:attach|launch|list|show)|xcprof\\s+(?:analyze|compare|doctor|record)|xcsym\\s+(?:anonymize|crash|find-dsym|list-dsyms|resolve|triage|verify))";

export const CURSOR_MCP_MISSING_TOOL_BOUNDARY = "If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.";

export const CURSOR_MCP_TOOL_BOUNDARY = "## Cursor MCP Tool Boundary\n\nThe `xclog`, `xcsym`, and `xcprof` examples below are reference syntax, not executable commands for Cursor. Map each subcommand to the same-named MCP tool—for example, `xclog launch` to `axiom_xclog_launch`, `xcsym crash` to `axiom_xcsym_crash`, and `xcprof record` to `axiom_xcprof_record`—and preserve its arguments as structured fields. Do not run a bare helper binary. " + CURSOR_MCP_MISSING_TOOL_BOUNDARY;

export const CURSOR_XCUI_TOOL_BOUNDARY = "## Cursor UI Tool Availability\n\n`xcui` is an external tool and is not bundled with the Cursor plugin; it has no Axiom MCP wrapper. Before UI automation, check `command -v xcui`. If it is absent, AXe fallback is limited to compatible input verbs: `tap`, `slider`, `type`, `swipe`, `drag`, `touch`, `gesture`, `button`, `key`, `key-sequence`, `key-combo`, and `screenshot`. Then check `command -v axe` before that fallback and handle `DEVELOPER_DIR` explicitly if AXe reports a SimulatorKit loading error. AXe cannot replace `wait`, `assert`, `a11y`, `dialog`, `voiceover`, `resize`, or `doctor`. If neither tool is available, stop UI automation, explain the external setup requirement, and continue only with non-UI simulator and log checks. If AXe exists but the requested workflow requires an xcui-only capability, stop that UI workflow and report the limitation.";

function mcpToolFor(command: string): string {
  const tool = MCP_SUBCOMMANDS.get(command.replace(/\s+/g, " ").trim().toLowerCase());
  if (!tool) throw new Error(`unsupported Axiom binary workflow: ${command}`);
  return tool;
}

interface HostClaimRewrite {
  id: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Rewrites that strip Claude-host capability claims ("xclog is on PATH, just run it")
 * from canonical prose. Each pattern is pinned to current canonical wording, so a
 * reword upstream would silently stop matching and ship Cursor users instructions to
 * run a binary the plugin does not install. `assertHostClaimRewritesFired` turns that
 * silent rot into a build failure.
 */
const HOST_CLAIM_REWRITES: ReadonlyArray<HostClaimRewrite> = [
  { id: "xclog-on-path", pattern: /`xclog` is on PATH as a bare command \(Claude Code[^\n]*\)\. Just run `xclog <subcommand>` — no prefix, no path lookup\./g, replacement: "In Cursor, the bare `xclog` binary is unavailable; map the reference examples below to the corresponding `axiom_xclog_*` MCP tools." },
  { id: "xcsym-on-path", pattern: /`xcsym` is on PATH as a bare command \(Claude Code[^\n]*\)\. Just run `xcsym <subcommand>` — no prefix, no path lookup\./g, replacement: "In Cursor, the bare `xcsym` binary is unavailable; map the reference examples below to the corresponding `axiom_xcsym_*` MCP tools." },
  { id: "xcprof-front-ends", pattern: /xcprof has two front-ends over the same engine — use whichever your harness provides:\n\n- \*\*Claude Code\*\*[^\n]*\n- \*\*MCP clients[^\n]*/g, replacement: "In Cursor, use the `axiom_xcprof_*` MCP tools. The plugin does not provide a bare `xcprof` executable on `PATH`." },
  { id: "xcui-on-path", pattern: /On \*\*Claude Code\*\*, `xcui` is already on PATH[^\n]*\n\nOn \*\*Codex, Pi, and MCP installs there is no bundled binary\*\*:[^\n]*/g, replacement: "In Cursor, `xcui` is external and is not placed on `PATH` by the plugin. Check `command -v xcui` before following an `xcui` workflow." },
  { id: "xcui-check-first", pattern: /\*\*Check first: `command -v xcui`\.\*\* It is on PATH automatically only on Claude Code\.[^\n]*/g, replacement: "**Check first: `command -v xcui`.** In Cursor it is external. If absent, use AXe only for compatible input verbs; do not substitute AXe for xcui-only test-harness workflows." },
  { id: "xcui-bundled-semantics", pattern: /`xcui` \(bundled\) adds the test-harness semantics AXe lacks\./g, replacement: "When installed externally, `xcui` adds the test-harness semantics AXe lacks." },
  { id: "xcui-bundled-bullet", pattern: /- \*\*xcui\*\*: bundled —/g, replacement: "- **xcui**: external —" },
];

const hostClaimHits = new Map<string, number>(HOST_CLAIM_REWRITES.map((rewrite) => [rewrite.id, 0]));

export function resetHostClaimRewriteTracking(): void {
  for (const rewrite of HOST_CLAIM_REWRITES) hostClaimHits.set(rewrite.id, 0);
}

/** Fail the build when a host-claim rewrite matched nothing across the whole corpus. */
export function assertHostClaimRewritesFired(): void {
  const dead = HOST_CLAIM_REWRITES
    .filter((rewrite) => (hostClaimHits.get(rewrite.id) ?? 0) === 0)
    .map((rewrite) => rewrite.id);
  if (dead.length > 0) {
    throw new Error(
      `Cursor host-claim rewrite matched no canonical text (the canonical wording likely changed — update the pattern): ${dead.join(", ")}`,
    );
  }
}

function rewriteCursorHostClaims(content: string): string {
  let rewritten = content;
  for (const rewrite of HOST_CLAIM_REWRITES) {
    const before = rewritten;
    rewritten = rewritten.replace(rewrite.pattern, rewrite.replacement);
    if (rewritten !== before) hostClaimHits.set(rewrite.id, (hostClaimHits.get(rewrite.id) ?? 0) + 1);
  }
  return rewritten;
}

function referenceCall(command: string, argumentsText: string, inline: boolean): string {
  const tool = mcpToolFor(command);
  const reference = argumentsText.trim();
  if (!reference) return inline ? `the \`${tool}\` MCP tool` : `Call the \`${tool}\` MCP tool.`;
  const detail = `with structured inputs matching reference arguments \`${reference}\``;
  return inline ? `the \`${tool}\` MCP tool ${detail}` : `Call the \`${tool}\` MCP tool ${detail}.`;
}

/** Translate executable helper workflows used by agent and command prompts. */
export function rewriteCursorMcpWorkflows(content: string): string {
  let rewritten = rewriteCursorHostClaims(content)
    .replace(/`XCSYM_DSYM_PATHS=\/path\/to\/downloads xcsym crash <file>`/g, "the `axiom_xcsym_crash` MCP tool with `file: \"<file>\"` and `dsymPaths: \"/path/to/downloads\"`")
    .replace(/command -v xcprof\s*&&\s*xcprof doctor/g, "call the `axiom_xcprof_doctor` MCP tool")
    .replace(/command -v (?:xclog|xcsym|xcprof)\b/g, "confirm the required Axiom MCP tool is available")
    .replace(/If `xcprof` is absent[^\n]*/g, CURSOR_MCP_MISSING_TOOL_BOUNDARY)
    .replace(/If xcsym is NOT present[^\n]*/g, CURSOR_MCP_MISSING_TOOL_BOUNDARY)
    .replace(/Do not hand-parse `\.ips` JSON unless xcsym is unavailable\./g, CURSOR_MCP_MISSING_TOOL_BOUNDARY)
    .replace(/^1\. Check for xcsym:$/gm, "1. Use the `axiom_xcsym_crash` MCP tool:")
    .replace(/^export XCPROF_TRACE_ROOT="\$\(mktemp -d\)"$/gm, "Use the MCP server's default trace sandbox, or pass a reviewed path in `output`.")
    .replace(/CLAUDE\.md S-3/g, "the repository safety policy")
    .replace(/Recording into `XCPROF_TRACE_ROOT` keeps traces contained\./g, "The MCP server's default trace sandbox keeps traces contained.")
    .replace(/\(A safe, preview-first `xcprof cleanup` is a later xcprof phase\.\)/g, "(No cleanup MCP tool is exposed; leave trace deletion to explicit user action.)")
    .replace(/`xcprof record --preset ([a-z-]+) --attach '<app>' --time-limit ([^`]+)`/g, "`axiom_xcprof_record` with `preset: \"$1\"`, `attach: \"<app>\"`, and `timeLimit: \"$2\"`")
    .replace(/`xcprof record --instrument 'SwiftUI' --instrument 'CPU Profiler' --attach '<app>' --time-limit 10s`/g, "`axiom_xcprof_record` with `instruments: [\"SwiftUI\", \"CPU Profiler\"]`, `attach: \"<app>\"`, and `timeLimit: \"10s\"`")
    .replace(/`xcprof record --instrument 'Swift Tasks' --instrument 'Swift Actors' --instrument 'CPU Profiler' --attach '<app>' --time-limit 10s`/g, "`axiom_xcprof_record` with `instruments: [\"Swift Tasks\", \"Swift Actors\", \"CPU Profiler\"]`, `attach: \"<app>\"`, and `timeLimit: \"10s\"`")
    .replace(/`xcprof record --preset full --attach '<app>'`/g, "`axiom_xcprof_record` with `preset: \"full\"` and `attach: \"<app>\"`")
    .replace(/`--preset full-ios`/g, "`preset: \"full-ios\"`")
    .replace(/^- \*\*Launch from startup\*\*[^\n]*/gm, "- **Launch from startup** — call `axiom_xcprof_record` with `launch: [\"<app-path>\"]` and `allowLaunch: true`; add `device: \"<booted-udid>\"` for a simulator. Launch is gated, so follow the consent rule below.")
    .replace(/^xcprof analyze "<trace>" --json$/gm, "Call the `axiom_xcprof_analyze` MCP tool with `trace: \"<trace>\"`.")
    .replace(/`xcprof analyze "<trace>" --start-ms <start> --end-ms <end> --json`/g, "`axiom_xcprof_analyze` with `trace: \"<trace>\"`, `startMs: <milliseconds>`, and `endMs: <milliseconds>`")
    .replace(/Use `xcprof compare <baseline> <current> --json`/g, "Use `axiom_xcprof_compare` with `baseline: \"<baseline>\"` and `current: \"<current>\"`")
    .replace(/Add `--fail-on-regression` to exit 3 for CI gating, and `--dsym` to symbolicate both traces\./g, "Set `failOnRegression: true` for CI gating, and pass `dsym: \"<path>\"` to symbolicate both traces.");

  rewritten = rewritten.replace(
    new RegExp(`\\\`(${MCP_COMMAND_PATTERN})([^\\\`\\n]*)\\\``, "gi"),
    (_inline, command: string, argumentsText: string) => referenceCall(command, argumentsText, true),
  );
  rewritten = rewritten.replace(
    new RegExp(`^([ \\t]*)(${MCP_COMMAND_PATTERN})([^\\n]*)$`, "gim"),
    (_line, indentation: string, command: string, argumentsText: string) => `${indentation}${referenceCall(command, argumentsText, false)}`,
  );
  return rewritten.replace(
    new RegExp(`\\b(${MCP_COMMAND_PATTERN})\\b`, "gi"),
    (_phrase, command: string) => `\`${mcpToolFor(command)}\` MCP tool`,
  ).replace(/\bthe the (`axiom_[a-z0-9_]+` MCP tool)\b/g, "the $1");
}

/** Preserve detailed CLI examples as reference syntax while fixing Cursor host claims. */
export function rewriteCursorSkillReferences(content: string): string {
  return rewriteCursorHostClaims(rewriteCursorInvocations(content));
}

export function rewriteCursorInvocations(content: string): string {
  const commandArgumentsSeparated = content.replace(
    /`\/axiom:([a-z0-9-]+)\s+([^`]+)`/g,
    "`/axiom:$1` $2",
  ).replace(/\/axiom:([a-z0-9-]+)/g, "/axiom-$1");
  return CURSOR_INVOCATION_REWRITES.reduce(
    (rewritten, [pattern, replacement]) => rewritten.replace(pattern, replacement),
    commandArgumentsSeparated,
  );
}

export function assertNoUnsupportedClaudeTokens(content: string): void {
  for (const [pattern, token] of UNSUPPORTED_TOKENS) {
    if (pattern.test(content)) {
      throw new Error(`unsupported Claude token: ${token}`);
    }
  }
}

function isExternalPointer(pointer: string): boolean {
  return pointer.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(pointer);
}

function assertSafeVirtualPath(filePath: string): void {
  if (!filePath || path.posix.isAbsolute(filePath) || filePath.split("/").includes("..")) {
    throw new Error(`unsafe virtual path: ${filePath}`);
  }
}

function pointerCandidates(filePath: string, pointer: string): string[] {
  const clean = pointer.split(/[?#]/, 1)[0] ?? "";
  if (!clean || isExternalPointer(clean)) return [];

  const candidates = [path.posix.normalize(path.posix.join(path.posix.dirname(filePath), clean))];
  if (clean.startsWith("skills/")) {
    const segments = filePath.split("/");
    if (segments[0] === "skills" && segments.length >= 3) {
      candidates.push(path.posix.normalize(path.posix.join(segments[0], segments[1] ?? "", clean)));
    }
  } else if (/^axiom-[a-z0-9-]+\/(?:skills|references|scripts|assets)\//.test(clean)) {
    candidates.push(`skills/${clean}`);
  } else {
    candidates.push(path.posix.normalize(clean));
  }
  return [...new Set(candidates)];
}

function localPointers(content: string): string[] {
  const pointers: string[] = [];
  for (const match of content.matchAll(/\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    pointers.push(match[1] ?? "");
  }
  for (const match of content.matchAll(/^[ \t]{0,3}\[[^\]]+\]:[ \t]*(?:<([^>]+)>|(\S+))/gm)) {
    pointers.push(match[1] ?? match[2] ?? "");
  }
  for (const match of content.matchAll(/`((?:skills|references|scripts|assets)\/[^`\s]+|axiom-[a-z0-9-]+\/(?:skills|references|scripts|assets)\/[^`\s]+)`/g)) {
    pointers.push(match[1] ?? "");
  }
  return pointers;
}

export function validateCursorReferences(files: ReadonlyMap<string, VirtualFile>): void {
  for (const [filePath, file] of files) {
    assertSafeVirtualPath(filePath);
    if (file.path !== filePath) {
      throw new Error(`virtual file path key mismatch: ${filePath}`);
    }
  }

  for (const [filePath, file] of files) {
    for (const pointer of localPointers(file.content)) {
      const candidates = pointerCandidates(filePath, pointer);
      const clean = pointer.split(/[?#]/, 1)[0] ?? "";
      const crossSuiteMatches = clean.startsWith("skills/")
        ? [...files.keys()].filter((candidate) => candidate.endsWith(`/${clean}`))
        : [];
      if (
        candidates.length > 0
        && !candidates.some((candidate) => files.has(candidate))
        && crossSuiteMatches.length !== 1
      ) {
        throw new Error(`unresolved local reference from ${filePath}: ${pointer}`);
      }
    }
  }
}
