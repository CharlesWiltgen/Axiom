/**
 * Router-inlined auditor content — pure parsing, mapping & rendering.
 *
 * PROBLEM (axiom-6gh): `npx skills add CharlesWiltgen/Axiom` discovers only the
 * 27 router skills. The audit *agents* are Claude-Code-plugin-specific, so every
 * harness that installs via the Agent-Skills spec (Codex, Cursor, Gemini CLI,
 * Copilot, Windsurf — 44 of 45 supported agents) gets routers that say
 * "Launch `memory-auditor` agent" and cannot resolve it. Worse than absent: a
 * dead instruction.
 *
 * FIX: a router's `skills/` subfolder DOES ride along on install (verified:
 * 292 files across 27 routers). So the auditor procedure placed at
 * `<router>/skills/<agent>.md` reaches every harness.
 *
 * SOURCE OF TRUTH: `.claude-plugin/plugins/axiom/agents/<agent>.md`. These
 * files are GENERATED — same source that `build-codex.ts` already converts into
 * the Codex `axiom-audit-*` skills. Never hand-edit the generated copies;
 * `pre-deploy.ts` regenerates and fails the build on drift.
 *
 * This module is I/O free. Callers read files and pass strings in; the caller
 * (build-inlined-auditors.ts / pre-deploy.ts) handles disk and error reporting.
 * Tests in inline-auditors.test.ts exercise these functions.
 */

/** Tools that a pure-scan agent may declare. An agent whose tool list is a
 * subset of these needs nothing but file reading and search, so its procedure
 * transfers to any harness verbatim. Anything declaring Bash/Write/Edit/Agent
 * is execution-model-bound (it shells out, mutates files, or fans out
 * subagents) and is deliberately NOT inlined. */
export const SCAN_TOOLS = new Set(["Glob", "Grep", "Read"]);

/**
 * Canonical router home for each inlined auditor.
 *
 * Derived from what the live routers actually reference — NOT from the stale
 * list in axiom-6gh's description, which predates several moves (energy-auditor
 * migrated to axiom-performance; textkit-auditor to axiom-swiftui).
 *
 * `ux-flow-auditor` is homed in axiom-swiftui rather than axiom-accessibility
 * on purpose: accessibility already ships a hand-written `ux-flow-audit.md`
 * (principle-anchored discipline content, no phase structure), and
 * `ux-flow-auditor.md` beside it differs by two letters. The agent scans
 * SwiftUI/UIKit view code, so axiom-swiftui is the better home regardless.
 *
 * Secondary routers are NOT listed here — they are derived by scanning suite
 * content for references (see `deriveSuiteReferences`), so a new mention in any
 * router or sub-skill picks up a pointer automatically instead of waiting for
 * someone to remember to update a hand-maintained list.
 */
export const AUDITOR_HOMES: Record<string, string> = {
  "accessibility-auditor": "axiom-accessibility",
  "camera-auditor": "axiom-media",
  "codable-auditor": "axiom-data",
  "concurrency-auditor": "axiom-concurrency",
  "core-data-auditor": "axiom-data",
  "database-schema-auditor": "axiom-data",
  "energy-auditor": "axiom-performance",
  "foundation-models-auditor": "axiom-ai",
  "grdb-performance-auditor": "axiom-data",
  "iap-auditor": "axiom-integration",
  "icloud-auditor": "axiom-data",
  "liquid-glass-auditor": "axiom-design",
  "memory-auditor": "axiom-performance",
  "modernization-helper": "axiom-build",
  "networking-auditor": "axiom-networking",
  "security-privacy-scanner": "axiom-security",
  "spritekit-auditor": "axiom-games",
  "storage-auditor": "axiom-data",
  "swift-performance-analyzer": "axiom-performance",
  "swift-simplifier": "axiom-swift",
  "swiftdata-auditor": "axiom-data",
  "swiftui-architecture-auditor": "axiom-swiftui",
  "swiftui-layout-auditor": "axiom-swiftui",
  "swiftui-nav-auditor": "axiom-swiftui",
  "swiftui-performance-analyzer": "axiom-swiftui",
  "test-failure-analyzer": "axiom-testing",
  "testing-auditor": "axiom-testing",
  "textkit-auditor": "axiom-swiftui",
  "ux-flow-auditor": "axiom-swiftui",
};

/** Marker written into every generated file. `pre-deploy.ts` also uses it to
 * distinguish generated sub-skills from hand-written ones. */
export const GENERATED_MARKER =
  "<!-- GENERATED from agents/{agent}.md by scripts/build-inlined-auditors.ts — do not edit. -->";

export function generatedMarkerFor(agentName: string): string {
  return GENERATED_MARKER.replace("{agent}", agentName);
}

/** Stable prefix of every generated sub-skill's first line. */
export const GENERATED_PREFIX = "<!-- GENERATED from agents/";

/**
 * True for a sub-skill file this generator produced.
 *
 * Component counters (set-version.js, pre-deploy.ts) use this to EXCLUDE these
 * files from the advertised skill count. They are mirrors of agents that are
 * already counted in the agent total — counting them too would inflate the
 * headline number with duplicated content rather than new capability.
 */
export function isGeneratedSubSkill(content: string): boolean {
  return content.startsWith(GENERATED_PREFIX);
}

/** Recover the source agent name from a generated file's marker line. Returns
 * null for hand-written files. Lets callers detect ORPHANS — generated files
 * whose source agent was renamed or deleted. */
export function generatedSourceAgent(content: string): string | null {
  const m = content.match(/^<!-- GENERATED from agents\/(.+?)\.md by /);
  return m ? m[1] : null;
}

/**
 * Result of reading an agent's `tools:` declaration.
 *
 * The three cases are kept distinct because conflating them is how the
 * classifier fails OPEN. `unparseable` must never be treated as "no dangerous
 * tools" — an agent whose tool list we cannot read is one we must not publish
 * under a preamble promising it needs only file search and read.
 */
export type ToolsParse =
  | { kind: "none" }
  | { kind: "ok"; tools: string[] }
  | { kind: "unparseable"; reason: string };

/** Strip a trailing YAML comment that is not inside quotes. */
function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function unquote(v: string): string {
  const m = v.match(/^(['"])([\s\S]*)\1$/);
  return m ? m[2] : v;
}

/**
 * Parse an agent's `tools:` declaration.
 *
 * Handles both YAML sequence forms, and tolerates trailing comments — a
 * `- Bash  # needed for xcodebuild` line MUST still register as Bash. An
 * earlier version required the item to be the whole line, so a commented entry
 * silently vanished and a Bash-dependent agent classified as pure-scan. That is
 * the one safety property this entire mechanism rests on, so anything we cannot
 * read is reported rather than dropped.
 */
export function parseAgentTools(content: string): ToolsParse {
  const inline = content.match(/^tools:[ \t]*\[(.*?)\][ \t]*$/m);
  if (inline) {
    const tools = inline[1]
      .split(",")
      .map((s) => unquote(stripComment(s).trim()))
      .filter((s) => s.length > 0);
    return tools.length > 0
      ? { kind: "ok", tools }
      : { kind: "unparseable", reason: "empty inline tools sequence" };
  }

  const scalar = content.match(/^tools:[ \t]+(\S.*)$/m);
  if (scalar && !scalar[1].trim().startsWith("[")) {
    return {
      kind: "unparseable",
      reason: `tools: is a scalar (${scalar[1].trim()}), not a sequence`,
    };
  }

  const block = content.match(/^tools:[ \t]*\r?$([\s\S]*?)^(?=\S)/m);
  if (!block) return { kind: "none" };

  const lines = block[1].split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { kind: "unparseable", reason: "tools: block is empty" };
  }

  const tools: string[] = [];
  for (const raw of lines) {
    const line = stripComment(raw).trimEnd();
    if (line.trim() === "") continue; // comment-only line
    const m = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!m) {
      return {
        kind: "unparseable",
        reason: `cannot read tools entry: ${raw.trim()}`,
      };
    }
    tools.push(unquote(m[1]));
  }
  return tools.length > 0
    ? { kind: "ok", tools }
    : { kind: "unparseable", reason: "tools: block yielded no entries" };
}

/**
 * True when the agent needs nothing but read+search, so its procedure can be
 * followed inline on any harness. Fails CLOSED: anything unreadable or absent
 * is not inlinable.
 */
export function isScanAgent(content: string): boolean {
  const parsed = parseAgentTools(content);
  return (
    parsed.kind === "ok" && parsed.tools.every((t) => SCAN_TOOLS.has(t))
  );
}

/** Strip the leading YAML frontmatter block, returning the body. Tolerates
 * CRLF so a `core.autocrlf` checkout cannot publish the raw frontmatter. */
export function stripFrontmatter(content: string): string {
  const m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return m ? content.slice(m[0].length) : content;
}

/**
 * Human title for the inlined file. Agent bodies open with
 * `# Memory Auditor Agent`; "Agent" is Claude-Code vocabulary that means
 * nothing on a harness reading the file inline.
 */
export function inlinedTitle(agentBody: string): string | null {
  const m = agentBody.match(/^#\s+(.+?)\s*\r?$/m);
  if (!m) return null;
  return m[1].replace(/\s+Agent$/, "");
}

/**
 * Build the reverse map from agent name → `/axiom:audit <area>`.
 *
 * The canonical area list is the `## Available Audits` table in
 * `commands/audit.md`, NOT anything derivable from the agent's filename.
 * Deriving it by stripping a suffix produced five wrong commands — including
 * `/axiom:audit swift` for swift-simplifier, whose real area is `swift-simplify`
 * and where `swift` falls through to audit.md's "treat as a filename" path.
 *
 * Callers pass the parsed rows (audit-parity.ts already exports parseBodyTable).
 */
export function auditAreaByAgent(
  rows: Array<{ area: string; agent: string }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { area, agent } of rows) {
    if (agent && area && !(agent in map)) map[agent] = area;
  }
  return map;
}

/**
 * Render the harness-aware preamble that replaces the agent's H1. Names both
 * paths so a Claude Code reader still gets the isolated-subagent benefit and
 * every other harness knows the file itself is the procedure.
 *
 * The slash-command clause is omitted entirely when the agent has no registered
 * audit area — advertising a command that does not exist is worse than saying
 * nothing.
 */
export function renderPreamble(
  agentName: string,
  title: string,
  auditArea?: string,
): string {
  const command = auditArea ? `, or run \`/axiom:audit ${auditArea}\`` : "";
  return [
    generatedMarkerFor(agentName),
    "",
    `# ${title}`,
    "",
    `**Claude Code** — launch the \`${agentName}\` agent${command}. It runs this procedure in an isolated context with its own model tier.`,
    "",
    "**Every other harness** — follow this file inline. It is the same procedure, and it needs only file search and read.",
  ].join("\n");
}

/**
 * Build the full generated file for one agent.
 *
 * The body transfers essentially verbatim: an auditor's content is already
 * harness-neutral (glob/grep/read instructions, pattern tables, a severity
 * rubric, an output format). Only the H1 is rewritten — replaced by the
 * harness-aware preamble.
 */
export function renderInlinedAuditor(
  agentName: string,
  agentContent: string,
  auditAreas: Record<string, string> = {},
): string {
  const body = stripFrontmatter(agentContent).trim();
  const title = inlinedTitle(body) ?? agentName;
  const preamble = renderPreamble(agentName, title, auditAreas[agentName]);
  // Drop the original H1 line; the preamble supplies its own.
  const withoutH1 = body.replace(/^#\s+.+?\s*\r?$/m, "").trimStart();
  return `${preamble}\n\n${withoutH1}\n`;
}

/** Repo-relative path of the generated file for an agent. */
export function inlinedPathFor(agentName: string): string | null {
  const router = AUDITOR_HOMES[agentName];
  if (!router) return null;
  return `${router}/skills/${agentName}.md`;
}

export const NOTE_BEGIN =
  "<!-- AXIOM_AUDITOR_INLINE_BEGIN — auto-maintained by scripts/build-inlined-auditors.ts; do not hand-edit -->";
export const NOTE_END = "<!-- AXIOM_AUDITOR_INLINE_END -->";

export interface RouterNoteTarget {
  /** Auditors homed in this router — referenced as `skills/<agent>.md`. */
  local: string[];
  /** Auditors this router references but that are homed elsewhere. */
  remote: Array<{ agent: string; suite: string }>;
}

/**
 * Find which auditors each suite mentions, by scanning its own content.
 *
 * Scans the router SKILL.md AND its hand-written sub-skills: a reference inside
 * `axiom-watchos/skills/modernization.md` leaves a reader just as stranded as
 * one in a router. Generated files are excluded — they would otherwise make
 * every suite "reference" itself.
 *
 * `suiteContents` maps suite name → list of file contents.
 */
export function deriveSuiteReferences(
  suiteContents: Record<string, string[]>,
): Record<string, string[]> {
  const refs: Record<string, string[]> = {};
  const agentNames = Object.keys(AUDITOR_HOMES);
  for (const [suite, files] of Object.entries(suiteContents)) {
    const found = new Set<string>();
    for (const content of files) {
      if (isGeneratedSubSkill(content)) continue;
      for (const agent of agentNames) {
        // `\b` is not enough: agent names contain hyphens, and `-` is a
        // non-word character, so /\bmemory-auditor\b/ happily matches inside
        // `memory-auditor-v2`. Exclude an adjacent word char OR hyphen.
        if (new RegExp(`(?<![\\w-])${escapeRegExp(agent)}(?![\\w-])`).test(content)) {
          found.add(agent);
        }
      }
    }
    if (found.size > 0) refs[suite] = [...found].sort();
  }
  return refs;
}

/**
 * Which routers need the harness-awareness note, and what each should list.
 *
 * A router earns a note if it hosts an inlined auditor OR mentions one homed in
 * another suite — in both cases a reader on a non-Claude-Code harness needs to
 * know that "Launch `X` agent" has an inline equivalent.
 */
export function routerNoteTargets(
  suiteReferences: Record<string, string[]>,
): Record<string, RouterNoteTarget> {
  const targets: Record<string, RouterNoteTarget> = {};
  const ensure = (router: string): RouterNoteTarget =>
    (targets[router] ??= { local: [], remote: [] });

  for (const [agent, canonical] of Object.entries(AUDITOR_HOMES)) {
    ensure(canonical).local.push(agent);
  }
  for (const [suite, agents] of Object.entries(suiteReferences)) {
    for (const agent of agents) {
      const canonical = AUDITOR_HOMES[agent];
      if (!canonical || canonical === suite) continue;
      ensure(suite).remote.push({ agent, suite: canonical });
    }
  }
  for (const t of Object.values(targets)) {
    t.local.sort();
    t.remote.sort((a, b) => a.agent.localeCompare(b.agent));
  }
  return targets;
}

/**
 * Render the note for one router.
 *
 * Deliberately states a RULE covering all ~119 "Launch `X` agent" sites rather
 * than rewriting each one: fewer edit points, no per-line drift, and it can be
 * honest that Bash-dependent agents have no inline equivalent instead of
 * implying every reference has one.
 */
export function renderRouterNote(target: RouterNoteTarget): string {
  const lines = [
    NOTE_BEGIN,
    `> **Not on Claude Code?** Where this router says "Launch \`some-auditor\` agent", read that auditor's file in this suite and follow it inline — the same procedure, needing only file search and read.`,
    ">",
  ];
  if (target.local.length > 0) {
    lines.push(
      `> Available here: ${target.local.map((a) => `\`skills/${a}.md\``).join(", ")}.`,
    );
  }
  if (target.remote.length > 0) {
    lines.push(
      `> Homed in another suite: ${target.remote
        .map(({ agent, suite }) => `\`${suite}/skills/${agent}.md\``)
        .join(", ")}.`,
    );
  }
  lines.push(
    ">",
    "> Agents that need Bash — builds, tests, simulators, crash symbolication — stay Claude Code-only; there is no inline equivalent for those.",
    NOTE_END,
  );
  return lines.join("\n");
}

/** Index of the first `## ` heading that is NOT inside a fenced code block. */
export function firstTopLevelH2Index(content: string): number {
  const lines = content.split("\n");
  let inFence = false;
  let offset = 0;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence && /^## /.test(line)) return offset;
    offset += line.length + 1;
  }
  return -1;
}

/**
 * Insert or replace the marked note block in a router SKILL.md.
 *
 * Anchors before the first `## ` heading OUTSIDE any code fence: router
 * structure is heterogeneous (only 6 of 27 have "## Routing Logic", 7 have
 * "## Automated Scanning"), but every router has an H1 intro followed by an H2,
 * and placing the rule ahead of all routing instructions is where a reader
 * needs it. Fence-awareness matters because routers carry fenced dot diagrams
 * whose content can contain heading-shaped lines.
 */
export function upsertRouterNote(content: string, note: string): string {
  const existing = new RegExp(
    `${escapeRegExp(NOTE_BEGIN)}[\\s\\S]*?${escapeRegExp(NOTE_END)}`,
  );
  if (existing.test(content)) return content.replace(existing, note);

  const idx = firstTopLevelH2Index(content);
  if (idx < 0) return `${content.trimEnd()}\n\n${note}\n`;
  return content.slice(0, idx) + note + "\n\n" + content.slice(idx);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface DriftInput {
  /** agentName → freshly rendered content. */
  expected: Record<string, string>;
  /** agentName → content currently on disk (absent key = file missing). */
  actual: Record<string, string>;
}

/**
 * Compare regenerated content against what is committed. Any difference means
 * someone edited a generated file by hand or changed an agent without
 * rebuilding — both are drift the release must not ship.
 *
 * Callers MUST build `actual` by scanning the skills tree for generated files,
 * not by iterating AUDITOR_HOMES — otherwise `actual` ⊆ `expected` by
 * construction and the orphan branch below can never fire.
 */
export function findInlineDrift({ expected, actual }: DriftInput): string[] {
  const errors: string[] = [];
  for (const agentName of Object.keys(expected).sort()) {
    const target = inlinedPathFor(agentName);
    if (!(agentName in actual)) {
      errors.push(
        `${target} is missing — run \`npm run build:auditors\` (source: agents/${agentName}.md)`,
      );
      continue;
    }
    if (actual[agentName] !== expected[agentName]) {
      errors.push(
        `${target} is stale relative to agents/${agentName}.md — run \`npm run build:auditors\``,
      );
    }
  }
  for (const agentName of Object.keys(actual).sort()) {
    if (!(agentName in expected)) {
      errors.push(
        `an orphaned generated file claims source agents/${agentName}.md, which is no longer an inlinable scan agent — delete it`,
      );
    }
  }
  return errors;
}

/** Drift check for router notes. Reports both stale/missing notes and notes
 * left behind in a suite that no longer references any auditor. */
export function findRouterNoteDrift(
  expected: Record<string, string>,
  actual: Record<string, string>,
): string[] {
  const errors: string[] = [];
  for (const router of Object.keys(expected).sort()) {
    if (!(router in actual)) {
      errors.push(`${router}/SKILL.md not found`);
    } else if (actual[router] !== expected[router]) {
      errors.push(
        `${router}/SKILL.md harness-awareness note is missing or stale — run \`npm run build:auditors\``,
      );
    }
  }
  for (const router of Object.keys(actual).sort()) {
    if (!(router in expected) && actual[router].includes(NOTE_BEGIN)) {
      errors.push(
        `${router}/SKILL.md carries a harness-awareness note but no longer references any inlined auditor — run \`npm run build:auditors\``,
      );
    }
  }
  return errors;
}

/**
 * Validate that AUDITOR_HOMES agrees with the agents actually on disk: every
 * mapped agent must exist and still be pure-scan, and every pure-scan agent
 * must be mapped. Catches a new auditor being added without a home — which
 * would silently leave it unreachable on 44 of 45 harnesses, the exact bug
 * this whole mechanism exists to fix.
 *
 * Also reports agents whose `tools:` block cannot be parsed. Those are neither
 * generated nor flagged by the coverage loops, so without this they would fail
 * silently — the same invisible-gap failure mode in a different disguise.
 */
export function validateHomeCoverage(
  agentContents: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const name of Object.keys(agentContents).sort()) {
    const parsed = parseAgentTools(agentContents[name]);
    if (parsed.kind === "unparseable") {
      errors.push(
        `agents/${name}.md has an unreadable tools: declaration (${parsed.reason}) — cannot classify it as inlinable or not`,
      );
      continue;
    }
    if (parsed.kind === "none") {
      errors.push(
        `agents/${name}.md declares no tools: block — cannot classify it as inlinable or not`,
      );
      continue;
    }
    if (parsed.tools.every((t) => SCAN_TOOLS.has(t)) && !AUDITOR_HOMES[name]) {
      errors.push(
        `agents/${name}.md is a pure-scan agent with no entry in AUDITOR_HOMES (scripts/inline-auditors.ts) — add one so non-Claude-Code harnesses can reach it`,
      );
    }
  }

  for (const name of Object.keys(AUDITOR_HOMES).sort()) {
    if (!(name in agentContents)) {
      errors.push(
        `AUDITOR_HOMES maps '${name}' but agents/${name}.md does not exist`,
      );
    } else if (!isScanAgent(agentContents[name])) {
      errors.push(
        `AUDITOR_HOMES maps '${name}' but it does not declare exactly ${[...SCAN_TOOLS].join("/")} — it is execution-bound and cannot be followed inline`,
      );
    }
  }
  return errors;
}
