#!/usr/bin/env node

/**
 * Axiom Pre-Deploy Validation Suite
 *
 * Comprehensive validation that thousands of developers depend on.
 * Run before every deploy: `npm run predeploy`
 *
 * Phase 1: Static validation (fast, no builds)
 * Phase 2: Build validation (slower, requires tools)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { VERSION_CORE } from "./version-regex.js";
import {
  shippedRouterCount,
  expectedCodexSkillCount,
  agentToSkillName,
  isEmittableAgent,
} from "./codex-exclude.js";
import {
  UNSUPPORTED_TOOL_MATCHERS,
  MATCHERLESS_EVENTS,
  CODEX_EXCLUDED_HOOK_SCRIPTS,
  shouldCopyHookScript,
} from "./codex-hooks.js";
import {
  DOC_STAT_FILES,
  docStatValues,
  extractDocStats,
  checkMarkerSpec,
} from "./doc-stats.js";
import { scanReferencedToolBinaries } from "../axiom-mcp/src/scripts/binary-coverage.ts";
import { MCP_TOOL_BINARIES } from "../axiom-mcp/src/tools/binaries.ts";
import {
  parseFrontmatterAreas,
  parseBodyTable,
  parseSidebarGroups,
  parseInlineAuditReferences,
  validateInlineReferences,
  validateAgentDescriptionParity,
  validateAdvertisedAreas,
  parseAdvertisedAuditAreas,
  validateAdvertisedCommands,
  AGENT_FRONTMATTER_KEYS,
} from "./audit-parity.ts";
import {
  MARKERS,
  renderArgumentList,
  renderBodyTable,
  renderDocsTables,
  spliceRegion,
  validateRegistry,
  validateSidebarAgainstRegistry,
  type AuditRegistry,
} from "./audit-areas.ts";
import {
  checkSkillInvocations,
  findSkillNameCollisions,
} from "./skill-invocations.ts";
import {
  AUDITOR_HOMES,
  auditAreaByAgent,
  deriveSuiteReferences,
  findInlineDrift,
  findRouterNoteDrift,
  generatedSourceAgent,
  isGeneratedSubSkill,
  isScanAgent,
  renderInlinedAuditor,
  renderRouterNote,
  routerNoteTargets,
  upsertRouterNote,
  validateHomeCoverage,
} from "./inline-auditors.ts";
import { parsePorcelain, resolveStaleness } from "./staleness.ts";
import { findDashViolations } from "./docs-dashes.ts";
import { renderCursorDistribution } from "./cursor/render.ts";
import { compareCursorPaths } from "./cursor/compare.ts";
import { validateCursorInventory } from "./cursor/inventory.ts";
import { CURSOR_AGENT_ADVISORIES } from "./cursor/agents.ts";

const root = path.resolve(import.meta.dirname!, "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");

let totalErrors = 0;
let totalWarnings = 0;
const errors: string[] = [];
const warnings: string[] = [];

function error(check: string, msg: string): void {
  totalErrors++;
  errors.push(`  ✗ [${check}] ${msg}`);
}

function warn(check: string, msg: string): void {
  totalWarnings++;
  warnings.push(`  ⚠ [${check}] ${msg}`);
}

function heading(title: string): void {
  console.log(`\n── ${title} ──`);
}

// One `git status --porcelain` for the whole repo, parsed into the set of
// dirty/untracked paths. Shared by the hybrid staleness checks (12b/12f) to
// confirm whether a source file that's newer-by-mtime than a derived artifact
// has ACTUALLY changed, vs. merely been rewritten by a git checkout/stash/
// rebase. Returns gitAvailable=false (e.g. no .git) so callers fall back to the
// conservative mtime verdict.
function gitDirtySet(cwd: string): { gitAvailable: boolean; dirty: Set<string> } {
  try {
    // `-c core.quotepath=false` makes git emit non-ASCII paths as literal UTF-8
    // instead of octal-escaped + quoted (its default). Without it, a dirty
    // `café.md` would arrive as `caf\303\251.md`, never match path.relative()'s
    // real UTF-8, get filtered out, and a genuinely-stale artifact would ship
    // green. Paths with spaces are still quoted — parsePorcelain unquotes those.
    const out = execSync("git -c core.quotepath=false status --porcelain", {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
    });
    return { gitAvailable: true, dirty: parsePorcelain(out) };
  } catch {
    return { gitAvailable: false, dirty: new Set<string>() };
  }
}

interface Frontmatter {
  [key: string]: string;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (kv) {
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      fm[kv[1]] = val;
    }
  }
  return fm;
}

interface PluginManifest {
  version: string;
  skills?: { name: string; description: string }[];
  commands?: string[];
}

interface MarketplaceManifest {
  plugins?: { name: string; version: string }[];
}

// ── Phase 1: Static Validation ──

heading("1. Plugin Validate (Claude Code)");
try {
  execSync("claude plugin validate .", {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
  });
  console.log("  ✓ claude plugin validate passed");
} catch (e: unknown) {
  // Deno's node-compat execSync error shape
  const err = e as Error & { status?: number; stderr?: string; stdout?: string; code?: string };
  const detail = err.stderr || err.stdout || err.message || `exit code ${err.status}`;
  error("plugin-validate", `claude plugin validate failed:\n${detail}`);
}

heading("2. JSON Syntax");
let claudeCode: PluginManifest | undefined;
let marketplace: MarketplaceManifest | undefined;
try {
  claudeCode = JSON.parse(
    fs.readFileSync(path.join(pluginDir, "claude-code.json"), "utf8"),
  );
  console.log("  ✓ claude-code.json valid");
} catch (e: unknown) {
  error("json", `claude-code.json parse error: ${(e as Error).message}`);
}
try {
  marketplace = JSON.parse(
    fs.readFileSync(
      path.join(root, ".claude-plugin/marketplace.json"),
      "utf8",
    ),
  );
  console.log("  ✓ marketplace.json valid");
} catch (e: unknown) {
  error("json", `marketplace.json parse error: ${(e as Error).message}`);
}

heading("3. Character Budget");
if (claudeCode) {
  let total = 0;
  const oversize: string[] = [];
  for (const skill of claudeCode.skills || []) {
    total += skill.description.length;
    if (skill.description.length > 300) {
      oversize.push(`${skill.name} (${skill.description.length} chars)`);
    }
  }
  if (total > 15000) {
    error(
      "budget",
      `Total ${total}/15,000 chars — EXCEEDS BUDGET (skills invisible to Claude)`,
    );
  } else if (total > 14000) {
    warn("budget", `Total ${total}/15,000 chars — dangerously close to budget`);
  } else {
    console.log(
      `  ✓ Budget OK: ${total}/15,000 chars (${15000 - total} headroom)`,
    );
  }
  for (const s of oversize) {
    warn("budget", `Router description over 300 chars: ${s}`);
  }
}

heading("4. Manifest ↔ Filesystem Sync");
if (claudeCode) {
  const skillsDir = path.join(pluginDir, "skills");
  for (const skill of claudeCode.skills || []) {
    const skillPath = path.join(skillsDir, skill.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      error(
        "manifest-sync",
        `Manifest skill "${skill.name}" has no SKILL.md at ${skill.name}/SKILL.md`,
      );
    }
  }
  console.log(
    `  ✓ ${claudeCode.skills!.length} manifest skills checked against filesystem`,
  );

  for (const cmdPath of claudeCode.commands || []) {
    const resolved = path.join(pluginDir, cmdPath);
    if (!fs.existsSync(resolved)) {
      error(
        "manifest-sync",
        `Manifest command path "${cmdPath}" does not exist`,
      );
    }
  }
  console.log(
    `  ✓ ${claudeCode.commands!.length} manifest commands checked against filesystem`,
  );
}

heading("5. Skill Integrity");

const allSkillNames = new Set<string>();
// Child sub-skill basename → path(s) it appears at. Keys are the child-skill
// namespace (fed into the /skill resolver, §10); multi-value entries are
// collisions (§5). Source of truth — supersedes a separate name Set.
const childOccurrences = new Map<string, string[]>();
let skillFilesChecked = 0;
let skillContentCount = 0; // Content units: standalone SKILL.md + skills/*.md in skill suites
let subSkillFilesChecked = 0; // skills/*.md files only (excludes routers + standalones); for MCP bundle fidelity

function checkSkillsIn(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) continue;

    const skillFile = path.join(fullPath, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      skillFilesChecked++;

      // Count content units: suites count skills/, standalone count SKILL.md
      const refsDir = path.join(fullPath, "skills");
      if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
        // Router-inlined auditors are generated mirrors of agents (counted in
        // the agent total) — excluded so the advertised skill count reflects
        // capability, not duplication. See scripts/inline-auditors.ts.
        const childMds = fs
          .readdirSync(refsDir)
          .filter((f: string) => f.endsWith(".md"))
          .filter(
            (f: string) =>
              !isGeneratedSubSkill(fs.readFileSync(path.join(refsDir, f), "utf8")),
          );
        skillContentCount += childMds.length;
        subSkillFilesChecked += childMds.length;
        for (const f of childMds) {
          const base = f.replace(/\.md$/, "");
          const rel = path.relative(pluginDir, path.join(refsDir, f));
          const seen = childOccurrences.get(base);
          if (seen) seen.push(rel);
          else childOccurrences.set(base, [rel]);
        }
      } else {
        skillContentCount++;
      }

      const content = fs.readFileSync(skillFile, "utf8");

      if (content.trim().length < 50) {
        error(
          "skill-integrity",
          `${name}/SKILL.md is effectively empty (${content.trim().length} chars)`,
        );
      }

      const fm = parseFrontmatter(content);
      if (!fm) {
        error("skill-integrity", `${name}/SKILL.md has no YAML frontmatter`);
      } else {
        if (!fm.name)
          error(
            "skill-integrity",
            `${name}/SKILL.md missing required frontmatter field: name`,
          );
        if (!fm.description)
          error(
            "skill-integrity",
            `${name}/SKILL.md missing required frontmatter field: description`,
          );
        if (!fm.license)
          warn("skill-integrity", `${name}/SKILL.md missing license field`);

        if (fm.name && fm.name !== name) {
          warn(
            "skill-integrity",
            `${name}/SKILL.md frontmatter name "${fm.name}" doesn't match directory "${name}"`,
          );
        }
      }

      if (allSkillNames.has(name)) {
        error("skill-integrity", `Duplicate skill name: "${name}"`);
      }
      allSkillNames.add(name);
    }

    checkSkillsIn(fullPath);
  }
}

checkSkillsIn(path.join(pluginDir, "skills"));
console.log(
  `  ✓ ${skillFilesChecked} skill files checked (frontmatter, duplicates, emptiness)`,
);

// Guard the /skill resolver's flat namespace (allSkillNames ∪ childOccurrences,
// §10): a child basename in two suites, or one equal to a top-level skill name,
// makes `/skill <name>` ambiguous about which file it reaches. Zero today; warn
// (not error) so a future collision surfaces for a human without blocking
// unrelated work (axiom-n7c4).
const skillNameCollisions = findSkillNameCollisions({
  topLevelNames: allSkillNames,
  childOccurrences,
});
for (const c of skillNameCollisions) {
  if (c.kind === "duplicate-child") {
    warn(
      "skill-namespace",
      `Child sub-skill basename "${c.name}" appears in ${c.locations.length} suites (${c.locations.join(", ")}) — /skill ${c.name} is ambiguous`,
    );
  } else {
    warn(
      "skill-namespace",
      `Child sub-skill "${c.name}" (${c.locations.join(", ")}) collides with the top-level skill "${c.name}" — /skill ${c.name} is ambiguous`,
    );
  }
}
if (skillNameCollisions.length === 0) {
  console.log(
    `  ✓ /skill namespace unambiguous (${childOccurrences.size} child basenames, none duplicated or shadowing a top-level skill)`,
  );
}

heading("6. Agent Integrity");

const agentsDir = path.join(pluginDir, "agents");
let agentFilesChecked = 0;
const allAgentNames = new Set<string>();
// Agents that opt out of the §10 "must be router-referenced" check via an
// `exempt-from-routing: true` frontmatter field — collected here, used there
// (axiom-6jea). Co-locating the exemption with the agent beats a hardcoded set
// that silently drifts as agents are added.
const agentsExemptFromRouting = new Set<string>();
// Every column-0 frontmatter key seen across agents — checked against
// AGENT_FRONTMATTER_KEYS below so the allowlist that drives
// parseAgentDescription's block-scalar terminator can't silently rot (axiom-2jf).
const seenAgentKeys = new Set<string>();

if (fs.existsSync(agentsDir)) {
  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith(".md")) continue;
    agentFilesChecked++;
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");

    const fm = parseFrontmatter(content);
    if (!fm) {
      error("agent-integrity", `${file} has no YAML frontmatter`);
    } else {
      if (!fm.description && !fm.name) {
        error(
          "agent-integrity",
          `${file} missing both name and description in frontmatter`,
        );
      }
    }

    const body = content.replace(/^---[\s\S]*?---\n?/, "").trim();
    if (body.length < 20) {
      error("agent-integrity", `${file} has effectively empty body`);
    }

    const agentName = file.replace(".md", "");
    if (allAgentNames.has(agentName)) {
      error("agent-integrity", `Duplicate agent name: "${agentName}"`);
    }
    allAgentNames.add(agentName);

    // Opt-in is the literal lowercase string `true` — anything else (yes/True/
    // typo) fails safe by leaving the agent subject to the §10 discovery check.
    if (fm?.["exempt-from-routing"] === "true") {
      agentsExemptFromRouting.add(agentName);
    }

    const fmBlock = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmBlock) {
      for (const line of fmBlock[1].split("\n")) {
        const k = line.match(/^([a-zA-Z][\w-]*):/);
        if (k) seenAgentKeys.add(k[1]);
      }
    }
  }
  console.log(
    `  ✓ ${agentFilesChecked} agent files checked` +
      (agentsExemptFromRouting.size
        ? ` (${agentsExemptFromRouting.size} routing-exempt)`
        : ""),
  );

  for (const k of seenAgentKeys) {
    if (!AGENT_FRONTMATTER_KEYS.has(k)) {
      warn(
        "agent-schema",
        `Agent frontmatter key "${k}" is not in AGENT_FRONTMATTER_KEYS (scripts/audit-parity.ts) — add it so parseAgentDescription terminates a description block at it instead of swallowing its value`,
      );
    }
  }
}

heading("7. Command Integrity");

const commandsDir = path.join(pluginDir, "commands");
let commandFilesChecked = 0;

if (fs.existsSync(commandsDir)) {
  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".md")) continue;
    commandFilesChecked++;
    const content = fs.readFileSync(path.join(commandsDir, file), "utf8");

    const fm = parseFrontmatter(content);
    if (!fm) {
      error("command-integrity", `${file} has no YAML frontmatter`);
    } else {
      if (!fm.description) {
        warn("command-integrity", `${file} missing description in frontmatter`);
      }
    }
  }
  console.log(`  ✓ ${commandFilesChecked} command files checked`);
}

heading("8. Version Consistency");

const versions: Record<string, string> = {};

if (claudeCode) versions["claude-code.json"] = claudeCode.version;

if (marketplace) {
  const plugin = marketplace.plugins?.find((p) => p.name === "axiom");
  if (plugin) versions["marketplace.json"] = plugin.version;
  else warn("version", "axiom plugin not found in marketplace.json");
}

const metadataPath = path.join(pluginDir, "hooks/metadata.txt");
if (fs.existsSync(metadataPath)) {
  const lines = fs.readFileSync(metadataPath, "utf8").trim().split("\n");
  versions["metadata.txt"] = lines[0];
}

const configPath = path.join(root, "docs/.vitepress/config.ts");
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, "utf8");
  const vMatch = configContent.match(new RegExp(`• v(${VERSION_CORE})`));
  if (vMatch) versions["config.ts"] = vMatch[1];
  else warn("version", "Version not found in docs/.vitepress/config.ts footer");
}

const mcpPkgPath = path.join(root, "axiom-mcp/package.json");
if (fs.existsSync(mcpPkgPath)) {
  const mcpPkg = JSON.parse(fs.readFileSync(mcpPkgPath, "utf8"));
  versions["axiom-mcp/package.json"] = mcpPkg.version;
}

const cursorPluginManifestPath = path.join(root, "axiom-cursor/.cursor-plugin/plugin.json");
if (fs.existsSync(cursorPluginManifestPath)) {
  const cursorPlugin = JSON.parse(fs.readFileSync(cursorPluginManifestPath, "utf8"));
  if (typeof cursorPlugin.version === "string") versions["axiom-cursor/.cursor-plugin/plugin.json"] = cursorPlugin.version;
  else error("version", "Cursor plugin manifest has no string version");
} else {
  error("version", "Cursor plugin manifest not found — run: npm run build:cursor");
}

const versionValues = Object.values(versions);
const allSame = versionValues.every((v) => v === versionValues[0]);

if (allSame && versionValues.length > 0) {
  console.log(
    `  ✓ All ${versionValues.length} files report version ${versionValues[0]}`,
  );
} else {
  error("version", "Version mismatch across files:");
  for (const [file, ver] of Object.entries(versions)) {
    const mark = ver === versionValues[0] ? "  " : "→ ";
    errors.push(`    ${mark}${file}: ${ver}`);
  }
}

// docs/index.md hero name carries only the MAJOR (e.g. "Axiom 27"), tracking the
// OS-cycle major. set-version.js does NOT maintain it, so it silently drifts —
// it rode the entire 3.x line frozen at "Axiom 3". Enforce major-parity here. A
// hero without a numeric suffix (branding intentionally dropped the number) is a
// warning, not an error, so a future rebrand doesn't hard-fail the gate.
const canonicalVersion = versions["claude-code.json"] ?? versionValues[0];
const indexPath = path.join(root, "docs/index.md");
if (canonicalVersion && fs.existsSync(indexPath)) {
  const canonicalMajor = canonicalVersion.split(".")[0];
  const heroMatch = fs
    .readFileSync(indexPath, "utf8")
    .match(/^\s*name:\s*["']?Axiom\s+(\d+)\b/m);
  if (!heroMatch) {
    warn(
      "version",
      `docs/index.md hero name is not in "Axiom <major>" form — skipping major-parity check (intentional rebrand?)`,
    );
  } else if (heroMatch[1] !== canonicalMajor) {
    error(
      "version",
      `docs/index.md hero "Axiom ${heroMatch[1]}" does not match canonical major ${canonicalMajor} (version ${canonicalVersion}) — update the hero name in docs/index.md`,
    );
  } else {
    console.log(
      `  ✓ docs/index.md hero "Axiom ${canonicalMajor}" matches canonical major`,
    );
  }
}

heading("9. Metadata Accuracy");

if (fs.existsSync(metadataPath)) {
  const lines = fs.readFileSync(metadataPath, "utf8").trim().split("\n");
  const metaSkills = parseInt(lines[1], 10);
  const metaAgents = parseInt(lines[2], 10);
  const metaCommands = parseInt(lines[3], 10);

  if (metaSkills !== skillContentCount) {
    error(
      "metadata",
      `metadata.txt says ${metaSkills} skills, filesystem has ${skillContentCount} content units`,
    );
  } else {
    console.log(`  ✓ Skill count matches: ${metaSkills}`);
  }

  if (metaAgents !== agentFilesChecked) {
    error(
      "metadata",
      `metadata.txt says ${metaAgents} agents, filesystem has ${agentFilesChecked}`,
    );
  } else {
    console.log(`  ✓ Agent count matches: ${metaAgents}`);
  }

  if (metaCommands !== commandFilesChecked) {
    error(
      "metadata",
      `metadata.txt says ${metaCommands} commands, filesystem has ${commandFilesChecked}`,
    );
  } else {
    console.log(`  ✓ Command count matches: ${metaCommands}`);
  }
}

heading("10. Skill Invocation Cross-References");

const routerSkillNames = (claudeCode?.skills || []).map((s) => s.name);

// A `/skill <name>` invocation must resolve to a real skill — a top-level
// router/standalone (allSkillNames) OR a child sub-skill (childOccurrences).
// Scanning ALL skill bodies (routers + children), agents, and commands — not
// just routers — and accepting both `/skill axiom-X` and `/skill axiom:X`
// forms. The original ios-ml dead end (`/skill coreml` in a sub-skill, no
// axiom- prefix) slipped through the old routers-only `/skill axiom-X` scan
// (axiom-39fb). Resolution logic lives in scripts/skill-invocations.ts.
const validSkillTargets = new Set<string>([
  ...allSkillNames,
  ...childOccurrences.keys(),
]);
let crossRefChecked = 0;
let brokenRefs = 0;

const invocationScanDirs = [
  path.join(pluginDir, "skills"),
  path.join(pluginDir, "agents"),
  path.join(pluginDir, "commands"),
];
for (const dir of invocationScanDirs) {
  if (!fs.existsSync(dir)) continue;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        const invocations = checkSkillInvocations(
          fs.readFileSync(full, "utf8"),
          validSkillTargets,
        );
        for (const inv of invocations) {
          crossRefChecked++;
          if (!inv.resolved) {
            error(
              "cross-ref",
              `${path.relative(pluginDir, full)}:${inv.line} invokes "/skill ${inv.raw}" but "${inv.name}" is not a known skill (router or child)`,
            );
            brokenRefs++;
          }
        }
      }
    }
  };
  walk(dir);
}

if (brokenRefs === 0) {
  console.log(
    `  ✓ ${crossRefChecked} /skill invocations validated across skills, agents, and commands`,
  );
}

// Reverse check: every agent should be referenced by at least one router,
// except those that declared `exempt-from-routing: true` (collected in §6).
const allRouterContent = routerSkillNames
  .map((name) => {
    const p = path.join(pluginDir, "skills", name, "SKILL.md");
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  })
  .join("\n");

let unreachableAgents = 0;
for (const agentName of allAgentNames) {
  if (agentsExemptFromRouting.has(agentName)) continue;
  if (!allRouterContent.includes(agentName)) {
    warn(
      "agent-routing",
      `Agent "${agentName}" is not referenced by any router skill — users can't discover it via natural language`,
    );
    unreachableAgents++;
  }
}

if (unreachableAgents === 0) {
  console.log(
    `  ✓ ${allAgentNames.size - agentsExemptFromRouting.size} agents reachable via routers (${agentsExemptFromRouting.size} exempt)`,
  );
} else {
  console.log(
    `  ⚠ ${unreachableAgents} agent(s) not reachable via any router`,
  );
}

heading("10b. Cross-Suite Reference Validation");

// check-cross-refs.js validates documentation cross-references across ALL skill
// files: structured `axiom-<suite> (skills/X.md)` refs, bare sibling
// `skills/X.md` paths, and bare axiom-* tokens. It complements section 10's
// `/skill axiom-X` invocation check (a different ref format — both run), and is
// the thorough sibling/child validator. It exits non-zero only on errors
// (warnings are informational), so a clean tree passes.
try {
  const refOut = execSync("node scripts/check-cross-refs.js", {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
  });
  const summary =
    refOut
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("✓")) ?? "all cross-references valid";
  console.log(`  ✓ ${summary.replace(/^✓\s*/, "")}`);
} catch (e: unknown) {
  const err = e as Error & { status?: number; stderr?: string; stdout?: string };
  const detail = (
    err.stdout ||
    err.stderr ||
    err.message ||
    `exit code ${err.status}`
  ).trim();
  error(
    "cross-refs",
    `check-cross-refs.js reported broken cross-references:\n${detail}`,
  );
}

heading("11. Hook Scripts");

try {
  execSync("command -v shellcheck", { stdio: "pipe" });
  try {
    execSync(`shellcheck ${path.join(pluginDir, "hooks")}/*.sh`, {
      stdio: "pipe",
      cwd: root,
    });
    console.log("  ✓ Shell scripts pass shellcheck");
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    error(
      "hooks",
      `shellcheck failures:\n${err.stdout?.toString() || err.stderr?.toString()}`,
    );
  }
} catch {
  warn(
    "hooks",
    "shellcheck not installed (brew install shellcheck) — skipping hook lint",
  );
}

// Validate Python hook scripts (syntax + functional)
const pyHooks = fs
  .readdirSync(path.join(pluginDir, "hooks"))
  .filter((f: string) => f.endsWith(".py"));

for (const pyFile of pyHooks) {
  const pyPath = path.join(pluginDir, "hooks", pyFile);
  try {
    execSync(`python3 -m py_compile "${pyPath}"`, { stdio: "pipe", cwd: root });
    console.log(`  ✓ ${pyFile} passes syntax check`);
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    error(
      "hooks",
      `${pyFile} syntax error:\n${err.stdout?.toString() || err.stderr?.toString()}`,
    );
  }
}

// Execute hook test suites (hooks/*_test.py). py_compile above only checks
// syntax — this actually runs the unittest suites so routing/heredoc/manifest
// regressions gate CI. Offline-only; safe under --static.
const hookTestFiles = fs
  .readdirSync(path.join(pluginDir, "hooks"))
  .filter((f: string) => f.endsWith("_test.py"))
  .sort();

if (hookTestFiles.length === 0) {
  warn("hooks", "no hooks/*_test.py suites found — expected routing/heredoc coverage");
} else {
  const hooksDir = path.join(pluginDir, "hooks");
  for (const testFile of hookTestFiles) {
    const moduleName = testFile.replace(/\.py$/, "");
    try {
      // unittest writes its dots + summary to stderr; merge it so we can
      // report the test count on success.
      const out = execSync(`python3 -m unittest "${moduleName}" 2>&1`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
        cwd: hooksDir,
      }).toString();
      const ran = out.match(/Ran \d+ tests?/)?.[0] ?? "ran";
      console.log(`  ✓ ${testFile} (${ran})`);
    } catch (e: unknown) {
      const err = e as { killed?: boolean; stdout?: Buffer; stderr?: Buffer };
      if (err.killed) {
        error("hooks", `${testFile} timed out`);
      } else {
        error(
          "hooks",
          `${testFile} FAILED:\n${err.stdout?.toString() || err.stderr?.toString()}`,
        );
      }
    }
  }
}

// Functional validation: run session-start.sh and validate JSON output
const sessionStartSh = path.join(pluginDir, "hooks/session-start.sh");
if (fs.existsSync(sessionStartSh)) {
  try {
    const hookOutput = execSync(`bash "${sessionStartSh}"`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
      cwd: root,
      env: { ...process.env, AXIOM_SESSION_CONTEXT: "always" },
    }).toString();
    const parsed = JSON.parse(hookOutput);
    const ctx = parsed?.hookSpecificOutput?.additionalContext;
    if (!ctx || typeof ctx !== "string") {
      error("hooks", "session-start.sh output missing hookSpecificOutput.additionalContext");
    } else if (!ctx.includes("EXTREMELY_IMPORTANT")) {
      error("hooks", "session-start.sh output missing EXTREMELY_IMPORTANT wrapper");
    } else {
      // Gate (GH #45): AXIOM_SESSION_CONTEXT=never must suppress injection.
      const skipOut = execSync(`bash "${sessionStartSh}"`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
        cwd: root,
        env: { ...process.env, AXIOM_SESSION_CONTEXT: "never" },
      }).toString();
      const skipCtx = JSON.parse(skipOut.trim() || "{}")?.hookSpecificOutput?.additionalContext;
      if (skipCtx) {
        error("hooks", "session-start.sh injected context despite AXIOM_SESSION_CONTEXT=never");
      } else {
        console.log("  ✓ session-start.sh injects (always) and skips (never) as gated");
      }
    }
  } catch (e: unknown) {
    const err = e as { message?: string; stdout?: Buffer; stderr?: Buffer; killed?: boolean };
    if (err.killed) {
      error("hooks", "session-start.sh timed out (possible heredoc deadlock)");
    } else {
      error(
        "hooks",
        `session-start.sh functional test failed:\n${err.message || err.stdout?.toString() || err.stderr?.toString()}`,
      );
    }
  }
}

heading("11b. Routing Accuracy");

// The user-prompt-submit hook is unit-tested above, but unit tests cover one
// keyword at a time. test-routing.ts replays real-world prompts (the messy,
// multi-keyword kind users actually send) against the hook and asserts the
// correct *combination* of routers fires. Catches regressions where adding a
// pattern shifts the matches[:3] cap and silently drops a needed router.
try {
  execSync("node scripts/test-routing.ts", {
    cwd: root,
    stdio: "pipe",
    timeout: 60000,
  });
  console.log("  ✓ Routing-accuracy harness passes");
} catch (e: unknown) {
  const err = e as { stdout?: Buffer; stderr?: Buffer };
  const out = err.stdout?.toString() || err.stderr?.toString() || "";
  // Surface the per-scenario failure detail so the operator can fix without re-running.
  const lines = out.split("\n");
  const detailStart = lines.findIndex((l: string) => l.includes("Failures detail:"));
  const summary = detailStart >= 0
    ? lines.slice(detailStart).join("\n")
    : out.slice(-1500);
  error("routing", `Routing harness FAILED:\n${summary}`);
}

heading("12a. Stale Skill Name References");

// Scan all skill content for ios-* references (v2.x names that should be axiom-*)
const staleIosPattern = /\bios-(build|ui|data|concurrency|performance|networking|integration|accessibility|ai|vision|testing|games|graphics|ml)\b/g;
let staleRefCount = 0;

function scanForStaleRefs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForStaleRefs(full);
    } else if (entry.name.endsWith(".md")) {
      const content = fs.readFileSync(full, "utf8");
      const relPath = path.relative(pluginDir, full);

      // Skip file path contexts (e.g. skills/ios-ml.md is a valid path)
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Find ios-* patterns not preceded by / (file path) or . (extension)
        const lineMatches = line.matchAll(staleIosPattern);
        for (const m of lineMatches) {
          // Skip if this is a file path reference (e.g., skills/ios-ml.md)
          const charBefore = m.index! > 0 ? line[m.index! - 1] : " ";
          if (charBefore === "/") continue;
          error("stale-refs", `"${m[0]}" in ${relPath}:${i + 1} — use axiom-* name instead`);
          staleRefCount++;
        }
      }
    }
  }
}

scanForStaleRefs(path.join(pluginDir, "skills"));
scanForStaleRefs(path.join(pluginDir, "agents"));

if (staleRefCount === 0) {
  console.log("  ✓ No stale ios-* references found in skill/agent content");
}

// ── 12b. MCP Bundle Staleness ──

heading("12b. MCP Bundle Staleness");

// Shared content-confirmation state for the hybrid staleness checks (12b/12f):
// one git call, reused. mtime is a fast pre-filter, but git checkout/stash/
// rebase rewrite files identically with fresh mtimes — so a source that's
// "newer" than the artifact is only really stale if git also sees it changed.
const gitStatus = gitDirtySet(root);

const bundlePath = path.join(root, "axiom-mcp/dist/bundle.json");
if (fs.existsSync(bundlePath)) {
  const bundleMtime = fs.statSync(bundlePath).mtimeMs;

  // Collect source files whose mtime is newer than the built bundle.
  const newerFiles: string[] = [];
  const sourceDirs = [
    path.join(pluginDir, "skills"),
    path.join(pluginDir, "agents"),
    path.join(pluginDir, "commands"),
  ];
  for (const dir of sourceDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".md") && fs.statSync(full).mtimeMs > bundleMtime) {
          newerFiles.push(path.relative(root, full));
        }
      }
    };
    walk(dir);
  }

  // skill-annotations.json also feeds the bundle.
  const annotationsPath = path.join(root, "axiom-mcp/skill-annotations.json");
  if (
    fs.existsSync(annotationsPath) &&
    fs.statSync(annotationsPath).mtimeMs > bundleMtime
  ) {
    newerFiles.push(path.relative(root, annotationsPath));
  }

  const dirtyFiles = newerFiles.filter((f) => gitStatus.dirty.has(f));
  const verdict = resolveStaleness({
    newerFiles,
    dirtyFiles,
    gitAvailable: gitStatus.gitAvailable,
  });
  if (verdict.stale) {
    error(
      "bundle-staleness",
      `MCP bundle is stale — ${verdict.reason}. Run: cd axiom-mcp && pnpm run build:bundle`,
    );
  } else {
    console.log(
      `  ✓ MCP bundle is up-to-date with source files${newerFiles.length ? ` (${verdict.reason})` : ""}`,
    );
  }
} else {
  warn("bundle-staleness", "MCP bundle not found at axiom-mcp/dist/bundle.json — build with: cd axiom-mcp && pnpm run build:bundle");
}

// ── 12c. Internal Planning Docs ──

heading("12c. Internal Planning Docs");

// Hard fail if internal planning content leaks into the published docs tree.
// These paths are gitignored AND VitePress-excluded (srcExclude in
// docs/.vitepress/config.ts), but that guardrail only triggers on the next
// commit — this check fails fast on any already-tracked file.
const internalPlanningDirs = [
  "docs/superpowers",
  "docs/plans",
  "docs/specs",
];

let planningLeaks = 0;
for (const rel of internalPlanningDirs) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const sub = path.join(d, entry.name);
      if (entry.isDirectory()) walk(sub);
      else if (entry.name.endsWith(".md")) {
        error(
          "internal-planning",
          `Internal planning doc leaked into published tree: ${path.relative(root, sub)} — move out of docs/ (see .gitignore for allowed paths)`,
        );
        planningLeaks++;
      }
    }
  };
  walk(full);
}

if (planningLeaks === 0) {
  console.log("  ✓ No internal planning docs under docs/superpowers, docs/plans, or docs/specs");
}

// ── 12d. /axiom:audit Source-of-Truth Parity ──
//
// /axiom:audit's list of audit areas lives in four places that must agree:
//   A — frontmatter `argument:` line in commands/audit.md (CLI dispatch)
//   B — body `## Available Audits` table column 1 (agent dispatch)
//   C — docs/commands/utility/audit.md "Available Audit Areas" code spans
//   D — docs/.vitepress/config.ts commands sidebar audit-* links
//
// Plus E — every agent name in B's column 2 must resolve to a real file
// under .claude-plugin/plugins/axiom/agents/<agent>.md.
//
// axiom-77g shipped a broken docs page because A↔C drifted silently.
// axiom-uk3 generalised to A↔B and dispatch-to-deleted-agent. Then we
// caught a sidebar count mismatch (5 in sidebar vs 8 in main page UI &
// Design) that the original 3-way check missed; D covers it.
//
// Parsing/validation logic lives in scripts/audit-parity.ts (pure
// functions, imported at the top of this file). Tests in
// scripts/audit-parity.test.ts run on every predeploy via `node --test`.

heading("12d. /axiom:audit Source-of-Truth Parity");

const auditCmdPath = path.join(pluginDir, "commands/audit.md");
const auditDocPath = path.join(root, "docs/commands/utility/audit.md");
const sidebarConfigPath = path.join(root, "docs/.vitepress/config.ts");

if (!fs.existsSync(auditCmdPath)) {
  error("audit-parity", `${auditCmdPath} not found`);
} else if (!fs.existsSync(auditDocPath)) {
  error("audit-parity", `${auditDocPath} not found`);
} else if (!fs.existsSync(sidebarConfigPath)) {
  error("audit-parity", `${sidebarConfigPath} not found`);
} else {
  const cmdContent = fs.readFileSync(auditCmdPath, "utf8");
  const docContent = fs.readFileSync(auditDocPath, "utf8");
  const cfgContent = fs.readFileSync(sidebarConfigPath, "utf8");

  // frontmatter is still parsed (not derived from the registry) so the
  // advertised-area check below validates against what the file actually
  // ships, not against what it was supposed to ship.
  const frontmatter = parseFrontmatterAreas(cmdContent);
  const bodyRows = parseBodyTable(cmdContent);

  // The frontmatter list, the body table, and the docs page are now
  // GENERATED from scripts/audit-areas.json, so they cannot disagree with
  // each other by construction — the old A↔B↔C set-parity and grouped-parity
  // checks are replaced by a single staleness check against the registry.
  // Same "generate in memory, diff against committed" pattern as the
  // inlined auditors (12d-bis) and the Codex variant (12f).
  const registryPath = path.join(root, "scripts/audit-areas.json");
  let auditRegistry: AuditRegistry | undefined;
  const parityErrors: string[] = [];
  try {
    auditRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (e: unknown) {
    parityErrors.push(`scripts/audit-areas.json unreadable: ${(e as Error).message}`);
  }

  if (auditRegistry) {
    for (const msg of validateRegistry(auditRegistry)) {
      parityErrors.push(`audit-areas.json: ${msg}`);
    }

    const generated: Array<[string, string, string, "html" | "hash", string]> = [
      [auditCmdPath, cmdContent, MARKERS.argument, "hash", renderArgumentList(auditRegistry)],
      [auditCmdPath, cmdContent, MARKERS.bodyTable, "html", renderBodyTable(auditRegistry)],
      [auditDocPath, docContent, MARKERS.docsTable, "html", renderDocsTables(auditRegistry)],
    ];
    for (const [file, content, marker, style, rendered] of generated) {
      const spliced = spliceRegion(content, marker, rendered, style);
      const rel = path.relative(root, file);
      if (spliced === null) {
        parityErrors.push(`${rel}: ${marker} markers missing or malformed`);
      } else if (spliced !== content) {
        parityErrors.push(
          `${rel} region ${marker} is stale relative to scripts/audit-areas.json — run \`npm run build:audit-areas\``,
        );
      }
    }
  }
  for (const msg of parityErrors) error("audit-parity", msg);

  // The sidebar is NOT generated — each of its groups interleaves audit
  // entries with unrelated commands, so the audit rows are not a
  // spliceable region. It stays hand-maintained and is checked against
  // the registry directly, which is what the old docs↔sidebar grouped
  // parity was approximating.
  const sidebarGroups = parseSidebarGroups(cfgContent);
  const groupedErrors = auditRegistry
    ? validateSidebarAgainstRegistry(auditRegistry, sidebarGroups)
    : [];
  for (const msg of groupedErrors) error("audit-parity", `(sidebar) ${msg}`);

  // E: agent file existence — needs filesystem access so it stays here.
  // Read agent file contents into a map so the description-parity check
  // (axiom-pop Gap 2) can reuse them without re-reading the disk.
  const agentsDirParity = path.join(pluginDir, "agents");
  const agentFileContents: Record<string, string> = {};
  let missingAgents = 0;
  for (const { area, agent } of bodyRows) {
    if (!agent) continue;
    const agentFile = path.join(agentsDirParity, `${agent}.md`);
    if (!fs.existsSync(agentFile)) {
      error(
        "audit-parity",
        `'${area}' dispatches to '${agent}' but agents/${agent}.md does not exist`,
      );
      missingAgents++;
    } else {
      agentFileContents[agent] = fs.readFileSync(agentFile, "utf8");
    }
  }

  // axiom-pop Gap 1: inline audit-area references in audit.md sections
  // beyond the canonical body table. Step 12d's main parity check covers
  // the body table and frontmatter; this catches drift in the prose
  // sections (Direct Dispatch examples, Priority Order bullets, Batch
  // Recommendations, Project Analysis triggers). A rename like
  // `core-data` → `core-data-v2` that updates the canonical list but
  // forgets the prose mentions would slip through the main check.
  const inlineSections = [
    "Direct Dispatch",
    "Batch Execution Guidance",
    "Project Analysis (No Area Specified)",
  ];
  let inlineDrifts = 0;
  for (const heading of inlineSections) {
    const refs = parseInlineAuditReferences(cmdContent, heading);
    if (refs.length === 0) continue;
    const inlineErrors = validateInlineReferences(frontmatter, refs, heading);
    for (const msg of inlineErrors) {
      error("audit-parity", `(inline) ${msg}`);
      inlineDrifts++;
    }
  }

  // axiom-pop Gap 2: body-table description ↔ agent file frontmatter
  // description drift. Both describe what the agent does; if they share
  // zero substantive vocabulary, one was likely renamed/repurposed
  // without the other being updated, leaving docs and MCP prompts
  // showing different things.
  const agentDescErrors = validateAgentDescriptionParity({
    rows: bodyRows,
    agentFiles: agentFileContents,
  });
  for (const msg of agentDescErrors) {
    error("audit-parity", `(agent-desc) ${msg}`);
  }

  // The inverse of validateParity: every `/axiom:audit <area>` an agent
  // advertises must resolve to a registered area. validateParity anchors
  // on the frontmatter list and diffs the other sources against it, so an
  // area missing from all four at once reads as a consistent world —
  // which is how `grdb-performance` and `test-failures` both shipped
  // advertising commands that dispatched nowhere, and how the generated
  // inline sub-skills silently lost their command lines.
  //
  // Reads EVERY agent, not just bodyRows — an agent with this bug is by
  // definition absent from the body table. Seeds from agentFileContents
  // so the 31 table-listed agents aren't read from disk twice.
  const allAgentFiles: Record<string, string> = { ...agentFileContents };
  if (fs.existsSync(agentsDirParity)) {
    for (const f of fs.readdirSync(agentsDirParity)) {
      if (!f.endsWith(".md")) continue;
      const name = f.replace(/\.md$/, "");
      if (name in allAgentFiles) continue;
      allAgentFiles[name] = fs.readFileSync(
        path.join(agentsDirParity, f),
        "utf8",
      );
    }
  } else {
    error("audit-parity", `${agentsDirParity} not found`);
  }

  // Exemptions are `<agent>:<area>` pairs — keying by agent alone would
  // silently bless every future unregistered area that agent advertises,
  // including typos unrelated to the reason the carve-out was granted.
  // validateAdvertisedAreas reports a stale entry, so an exemption cannot
  // outlive the violation it was granted for.
  //
  // Empty, and worth keeping that way: the two original entries were both
  // resolved rather than tolerated (Axiom-vi8). An entry here should mean
  // "decision pending", never "known-broken forever".
  const advertisedExempt: string[] = [];
  const advertisedErrors = validateAdvertisedAreas({
    registered: frontmatter,
    agentFiles: allAgentFiles,
    exempt: advertisedExempt,
  });
  for (const msg of advertisedErrors) {
    error("audit-parity", `(advertised) ${msg}`);
  }
  const advertisingAgents = Object.values(allAgentFiles).filter(
    (c) => parseAdvertisedAuditAreas(c).length > 0,
  ).length;

  // Same blind spot, one namespace over: `/axiom:audit <area>` validates
  // its argument above, but agents advertise a whole family of other
  // commands in the same "Explicit command:" convention and nothing
  // checked that the COMMAND itself exists. `/axiom:resolve-deps` and
  // `/axiom:modernize` both shipped as ghosts — promised by an agent,
  // registered nowhere, and one had already propagated into a skill that
  // told readers to type it.
  const registeredCommands = (claudeCode?.commands ?? []).map((c: string) =>
    path.basename(c, ".md"),
  );
  const advertisedCmdErrors = validateAdvertisedCommands({
    registered: registeredCommands,
    agentFiles: allAgentFiles,
  });
  for (const msg of advertisedCmdErrors) {
    error("audit-parity", `(advertised-cmd) ${msg}`);
  }

  if (
    parityErrors.length === 0 &&
    groupedErrors.length === 0 &&
    missingAgents === 0 &&
    inlineDrifts === 0 &&
    agentDescErrors.length === 0 &&
    advertisedErrors.length === 0
  ) {
    console.log(
      `  ✓ ${frontmatter.length} audit areas generated from scripts/audit-areas.json into ` +
        `frontmatter + body table + docs page; sidebar checked against it ` +
        `(${sidebarGroups.length} groups; ${bodyRows.length} agent refs resolve; ` +
        `${inlineSections.length} prose sections + ${bodyRows.length} agent descriptions verified; ` +
        `${advertisingAgents} agents advertise a command, ${advertisedExempt.length} exempt)`,
    );
  }
}

// ── 12d-bis. Router-Inlined Auditor Parity ──
//
// axiom-6gh: `npx skills add` discovers only the router skills, so every
// harness installing via the Agent-Skills spec (44 of 45 supported agents)
// gets routers pointing at audit agents it cannot resolve. The fix inlines
// each pure-scan agent's procedure at <router>/skills/<agent>.md, which DOES
// ride along on install.
//
// Those files are generated from agents/ by scripts/build-inlined-auditors.ts
// and committed — same convention as axiom-codex/. This check regenerates in
// memory and fails on any difference, so a hand-edit or an un-rebuilt agent
// change cannot ship. It also fails when a NEW pure-scan agent has no entry in
// AUDITOR_HOMES, which would otherwise leave it silently unreachable on those
// 44 harnesses — the exact bug this mechanism exists to fix.
//
// Logic lives in scripts/inline-auditors.ts (pure functions). Tests in
// scripts/inline-auditors.test.ts run on every predeploy via `node --test`.

heading("12d-bis. Router-Inlined Auditor Parity");

const inlineAgentsDir = path.join(pluginDir, "agents");
const inlineSkillsDir = path.join(pluginDir, "skills");

if (!fs.existsSync(inlineAgentsDir)) {
  error("auditor-inline", `${inlineAgentsDir} not found`);
} else {
  const agentContents: Record<string, string> = {};
  for (const file of fs.readdirSync(inlineAgentsDir)) {
    if (!file.endsWith(".md")) continue;
    agentContents[file.replace(/\.md$/, "")] = fs.readFileSync(
      path.join(inlineAgentsDir, file),
      "utf8",
    );
  }

  const coverageErrors = validateHomeCoverage(agentContents);
  for (const msg of coverageErrors) error("auditor-inline", `(coverage) ${msg}`);

  // The `/axiom:audit <area>` names come from the canonical table in
  // commands/audit.md — deriving them from the agent filename produced five
  // commands that do not exist.
  const auditAreas = fs.existsSync(auditCmdPath)
    ? auditAreaByAgent(parseBodyTable(fs.readFileSync(auditCmdPath, "utf8")))
    : {};

  const expected: Record<string, string> = {};
  for (const agentName of Object.keys(AUDITOR_HOMES)) {
    const content = agentContents[agentName];
    if (!content || !isScanAgent(content)) continue; // reported by coverage check
    expected[agentName] = renderInlinedAuditor(agentName, content, auditAreas);
  }

  // Walk the tree for files carrying the GENERATED marker and key them by the
  // agent each names in its own marker — NOT by AUDITOR_HOMES. Keying by the
  // map would make `actual` ⊆ `expected` by construction, so an orphan left
  // behind by a renamed or deleted agent could never be detected and would
  // ship indefinitely (invisible to the skill count too, which excludes
  // generated files).
  const actual: Record<string, string> = {};
  const suiteContents: Record<string, string[]> = {};
  const unattributable: string[] = [];
  for (const suite of fs.readdirSync(inlineSkillsDir)) {
    const suiteDir = path.join(inlineSkillsDir, suite);
    if (!fs.statSync(suiteDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    const files: string[] = [];
    const routerMd = path.join(suiteDir, "SKILL.md");
    if (fs.existsSync(routerMd)) files.push(fs.readFileSync(routerMd, "utf8"));
    const subDir = path.join(suiteDir, "skills");
    if (fs.existsSync(subDir)) {
      for (const f of fs.readdirSync(subDir)) {
        if (!f.endsWith(".md")) continue;
        const content = fs.readFileSync(path.join(subDir, f), "utf8");
        files.push(content);
        if (!isGeneratedSubSkill(content)) continue;
        const source = generatedSourceAgent(content);
        if (source) actual[source] = content;
        else unattributable.push(`${suite}/skills/${f}`);
      }
    }
    suiteContents[suite] = files;
  }
  for (const rel of unattributable) {
    error(
      "auditor-inline",
      `(orphan) ${rel} carries a GENERATED marker naming no readable source agent`,
    );
  }

  const driftErrors = findInlineDrift({ expected, actual });
  for (const msg of driftErrors) error("auditor-inline", `(drift) ${msg}`);

  // The generated files are only reachable if each suite tells a non-Claude-Code
  // reader they exist, so the note is part of the fix, not decoration. Targets
  // are DERIVED from what each suite actually mentions (router + sub-skills),
  // so a reference added anywhere earns a pointer without hand-maintaining a list.
  const noteTargets = routerNoteTargets(deriveSuiteReferences(suiteContents));
  const expectedNotes: Record<string, string> = {};
  const actualNotes: Record<string, string> = {};
  for (const suite of Object.keys(suiteContents)) {
    const routerPath = path.join(inlineSkillsDir, suite, "SKILL.md");
    if (!fs.existsSync(routerPath)) continue;
    const current = fs.readFileSync(routerPath, "utf8");
    actualNotes[suite] = current;
    const target = noteTargets[suite];
    if (!target) continue;
    expectedNotes[suite] = upsertRouterNote(current, renderRouterNote(target));
  }
  const noteErrors = findRouterNoteDrift(expectedNotes, actualNotes);
  for (const msg of noteErrors) error("auditor-inline", `(router-note) ${msg}`);

  if (
    coverageErrors.length === 0 &&
    driftErrors.length === 0 &&
    noteErrors.length === 0
  ) {
    console.log(
      `  ✓ ${Object.keys(expected).length} auditor procedures inlined into router suites, ` +
        `all matching agents/; ${Object.keys(noteTargets).length} routers carry the ` +
        `harness-awareness note (reachable on non-Claude-Code harnesses)`,
    );
  }
}

// ── 12e. README Stats-Block Parity ──
//
// README.md advertises skill/agent/command counts in prose. Before axiom-wz9k
// this drifted silently every release (175 vs 217, 217 vs 220, 231 vs 236)
// because scripts/set-version.js wrote 8 other files but not README. The
// auto-fix in set-version.js rewrites the marked block; this check enforces
// that no hand-edit slips drift through to a release.
//
// Source of truth: docs/.vitepress/theme/stats.json (also written by
// set-version.js from the live filesystem walk).

heading("12e. README Stats-Block Parity");

const statsPath = path.join(root, "docs/.vitepress/theme/stats.json");
const readmePath = path.join(root, "README.md");

if (!fs.existsSync(statsPath)) {
  error("readme-parity", `stats.json not found at ${statsPath} — cannot verify README parity`);
} else if (!fs.existsSync(readmePath)) {
  error("readme-parity", `README.md not found — cannot verify stats parity`);
} else {
  const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
  const expected = docStatValues(stats);
  const expectedSkills = expected.skills;
  const expectedAgents = expected.agents;
  const expectedCommands = expected.commands;

  const readme = fs.readFileSync(readmePath, "utf8");
  const beginIdx = readme.indexOf("<!-- AXIOM_STATS_BEGIN");
  const endIdx = readme.indexOf("<!-- AXIOM_STATS_END -->");

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    error(
      "readme-parity",
      `README.md missing AXIOM_STATS markers — set-version.js cannot maintain counts. ` +
        `Restore '<!-- AXIOM_STATS_BEGIN ... -->' / '<!-- AXIOM_STATS_END -->' around the counts block.`,
    );
  } else {
    const block = readme.slice(beginIdx, endIdx);
    const skillsMatch = block.match(/\*\*(\d+) skills\*\*/);
    const agentsMatch = block.match(/\*\*(\d+) agents\*\*/);
    const commandsMatch = block.match(/\*\*(\d+) commands\*\*/);

    const readmeSkills = skillsMatch ? Number(skillsMatch[1]) : NaN;
    const readmeAgents = agentsMatch ? Number(agentsMatch[1]) : NaN;
    const readmeCommands = commandsMatch ? Number(commandsMatch[1]) : NaN;

    let drifted = false;
    if (readmeSkills !== expectedSkills) {
      error(
        "readme-parity",
        `README skills count drift: README says ${readmeSkills}, stats.json says ${expectedSkills}. ` +
          `Run: node scripts/set-version.js <current-version>`,
      );
      drifted = true;
    }
    if (readmeAgents !== expectedAgents) {
      error(
        "readme-parity",
        `README agents count drift: README says ${readmeAgents}, stats.json says ${expectedAgents}. ` +
          `Run: node scripts/set-version.js <current-version>`,
      );
      drifted = true;
    }
    if (readmeCommands !== expectedCommands) {
      error(
        "readme-parity",
        `README commands count drift: README says ${readmeCommands}, stats.json says ${expectedCommands}. ` +
          `Run: node scripts/set-version.js <current-version>`,
      );
      drifted = true;
    }

    if (!drifted) {
      console.log(
        `  ✓ README counts match stats.json (${expectedSkills} skills, ${expectedAgents} agents, ${expectedCommands} commands)`,
      );
    }
  }
}

// ── 12f. Codex Variant Staleness ──

heading("12f. Codex Variant Staleness");

const codexManifest = path.join(root, "axiom-codex/.codex-plugin/plugin.json");
if (fs.existsSync(codexManifest)) {
  const codexMtime = fs.statSync(codexManifest).mtimeMs;

  // The Codex variant is rebuilt from skills + agents (npm run build:codex).
  // Same hybrid as 12b: collect sources newer-by-mtime, then confirm via git
  // (reusing the shared gitStatus) before declaring real staleness.
  const newerFiles: string[] = [];
  const codexSourceDirs = [
    path.join(pluginDir, "skills"),
    path.join(pluginDir, "agents"),
  ];
  for (const dir of codexSourceDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".md") && fs.statSync(full).mtimeMs > codexMtime) {
          newerFiles.push(path.relative(root, full));
        }
      }
    };
    walk(dir);
  }

  const dirtyFiles = newerFiles.filter((f) => gitStatus.dirty.has(f));
  const verdict = resolveStaleness({
    newerFiles,
    dirtyFiles,
    gitAvailable: gitStatus.gitAvailable,
  });
  if (verdict.stale) {
    error(
      "codex-staleness",
      `Codex variant is stale — ${verdict.reason}. Run: npm run build:codex`,
    );
  } else {
    console.log(
      `  ✓ Codex variant is up-to-date with source files${newerFiles.length ? ` (${verdict.reason})` : ""}`,
    );
  }
} else {
  warn(
    "codex-staleness",
    "Codex variant manifest not found at axiom-codex/.codex-plugin/plugin.json — build with: npm run build:codex",
  );
}

// ── 12g. Go Tool args.go Parity ──

heading("12g. Go Tool args.go Parity");

// The bundled Go tools are independent modules that can't share code, so each
// carries a byte-identical copy of args.go (the parseInterspersed helper). A fix
// applied to one copy can silently diverge — each module's own tests still pass
// (axiom-h34h, companion to v9in). Discover the copies dynamically (a 5th tool is
// auto-covered) and group by content: more than one group means drift. Mirrors
// the manual `diff` documented in tools/README.md.
const toolsRoot = path.join(root, "tools");
const argsGoFiles = fs.existsSync(toolsRoot)
  ? fs
      .readdirSync(toolsRoot, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory())
      .map((d: fs.Dirent) => path.join(toolsRoot, d.name, "args.go"))
      .filter((p: string) => fs.existsSync(p))
  : [];

if (argsGoFiles.length < 2) {
  console.log(
    `  ✓ args.go parity: ${argsGoFiles.length} cop${argsGoFiles.length === 1 ? "y" : "ies"} — nothing to compare`,
  );
} else {
  const argsGoByContent = new Map<string, string[]>();
  for (const p of argsGoFiles) {
    // latin1 maps each byte 1:1 to a char (no lossy UTF-8 decode), so the
    // comparison is genuinely byte-for-byte — matching the "byte-identical"
    // contract even for hypothetical invalid-UTF-8 bytes.
    const content = fs.readFileSync(p, "latin1");
    const rel = path.relative(root, p);
    const group = argsGoByContent.get(content);
    if (group) group.push(rel);
    else argsGoByContent.set(content, [rel]);
  }
  if (argsGoByContent.size === 1) {
    console.log(
      `  ✓ ${argsGoFiles.length} tools/*/args.go copies are byte-identical`,
    );
  } else {
    const groups = [...argsGoByContent.values()];
    error(
      "args-parity",
      `tools/*/args.go has diverged into ${groups.length} versions — the copies must stay ` +
        `byte-identical (see tools/README.md). Versions: ` +
        groups.map((g) => `[${g.join(", ")}]`).join(" ≠ "),
    );
  }
}

// ── 12h. MCP Tool Binary Coverage ──

heading("12h. MCP Tool Binary Coverage");

// The MCP bundler (axiom-mcp/src/scripts/bundle.ts) copies exactly the binaries
// in MCP_TOOL_BINARIES. Independently of the bundle build (step 13) and the
// vitest coverage test (step 12), verify (a) the list matches the bin/<name> the
// MCP tools actually resolve, and (b) each listed binary is a committed file in
// the plugin bin/. Imports the list directly and shares the scanner with the
// vitest test (src/scripts/binary-coverage.ts) so nothing can drift. axiom-gtqk.
const mcpToolsDir = path.join(root, "axiom-mcp/src/tools");
const mcpListed = new Set<string>(MCP_TOOL_BINARIES);
const mcpReferenced = scanReferencedToolBinaries(mcpToolsDir);
const mcpMissingFromList = [...mcpReferenced].filter((b) => !mcpListed.has(b));
const mcpUnusedInList = [...mcpListed].filter((b) => !mcpReferenced.has(b));
const mcpMissingBinaries = [...mcpListed].filter((b) => !fs.existsSync(path.join(pluginDir, "bin", b)));
if (mcpMissingFromList.length) {
  error("mcp-binary-coverage", `tools resolve bin/<name> not in MCP_TOOL_BINARIES (bundler won't ship them): ${mcpMissingFromList.join(", ")}`);
}
if (mcpUnusedInList.length) {
  error("mcp-binary-coverage", `MCP_TOOL_BINARIES lists binaries no tool references: ${mcpUnusedInList.join(", ")}`);
}
if (mcpMissingBinaries.length) {
  error("mcp-binary-coverage", `MCP_TOOL_BINARIES entries missing from committed plugin bin/: ${mcpMissingBinaries.join(", ")}`);
}
if (!mcpMissingFromList.length && !mcpUnusedInList.length && !mcpMissingBinaries.length) {
  console.log(`  ✓ MCP tool binaries consistent (${[...mcpListed].join(", ") || "none"}) — list ↔ tool refs ↔ plugin bin/`);
}

// ── 12i. Docs Dash Convention ──

heading("12i. Docs Dash Convention");

// Enforce the codified docs dash rule (.claude/rules/documentation-style.md
// §Dashes): a list-led inline-heading separator — a **bold** / [link] / `code`
// head at the start of a bullet or numbered list item, immediately followed by
// the separator — uses a spaced EN-dash " – ", NOT an EM-dash. Running prose keeps
// the spaced EM-dash, so this anchored pattern only flags the separator position
// and never touches prose. Same pattern as the one-time sweep, so once docs
// conform the check stays at zero and only future drift trips it. docs/ only —
// for-LLM skill files are exempt (not human reading material).
// Matches inline links in the `[text](url)` form only — not reference links
// (`[text][ref]`) or bare `[text]`. That's exhaustive for VitePress docs (which
// use inline links); widen the alternation if reference-link heads ever appear.
//
// The pattern + scanner live in scripts/docs-dashes.ts so they are UNIT-TESTABLE
// (scripts/docs-dashes.test.ts). They were inline and untested here, flagging only the
// em-dash — so an ASCII hyphen in the separator position passed silently and six
// violations shipped on a docs page, straight through this check. Do not re-inline them.
const dashViolations: string[] = [];
function scanDocsDashes(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Generated output holds no authored markdown; skip it (and save ~1,263 stats).
    if (entry.name === ".vitepress") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDocsDashes(full);
    } else if (entry.name.endsWith(".md")) {
      for (const lineNo of findDashViolations(fs.readFileSync(full, "utf8"))) {
        dashViolations.push(`${path.relative(root, full)}:${lineNo}`);
      }
    }
  }
}
scanDocsDashes(path.join(root, "docs"));
if (dashViolations.length === 0) {
  console.log("  ✓ Docs use en-dash \" – \" for list-led inline-heading separators");
} else {
  const CAP = 25;
  for (const v of dashViolations.slice(0, CAP)) {
    error("docs-dash", `${v} uses a wrong separator (em-dash or hyphen) on a list-led inline-heading — use en-dash " – " (.claude/rules/documentation-style.md §Dashes)`);
  }
  if (dashViolations.length > CAP) {
    error("docs-dash", `…and ${dashViolations.length - CAP} more (${dashViolations.length} total) — see documentation-style.md §Dashes`);
  }
}

// ── 12j. Doc Count-Marker Parity ──
//
// docs/ pages embed skill/agent/command counts in prose (install.md, index.md,
// xcode-setup.md, …). They drifted for months (184 vs 254, 133 vs 254) because
// set-version.js wrote stats.json/README but never touched these pages. They are
// now auto-maintained via invisible <!--ax:KEY-->N<!--/ax--> markers
// (scripts/doc-stats.js); this gate fails the release if any marker drifts from
// stats.json. statsPath is the same module-level const declared in 12e.

heading("12j. Doc Count-Marker Parity");

if (!fs.existsSync(statsPath)) {
  error("doc-stats-parity", `stats.json not found at ${statsPath} — cannot verify doc count parity`);
} else {
  const docStats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
  const expected = docStatValues(docStats);
  let docDrift = false;
  let markerCount = 0;

  for (const { file: relPath, markers: spec } of DOC_STAT_FILES) {
    const docPath = path.join(root, relPath);
    if (!fs.existsSync(docPath)) {
      error("doc-stats-parity", `${relPath} is listed in DOC_STAT_FILES but missing on disk — fix scripts/doc-stats.js`);
      docDrift = true;
      continue;
    }
    const content = fs.readFileSync(docPath, "utf8");

    // Structural: the file must carry exactly its expected marker multiset —
    // catches a single marker deleted during a reword, not just total removal.
    const problems = checkMarkerSpec(content, spec);
    if (problems.length) {
      error(
        "doc-stats-parity",
        `${relPath} markers don't match spec — ${problems.join("; ")}. Restore them, or update scripts/doc-stats.js.`,
      );
      docDrift = true;
      continue;
    }

    // Value: each marker's number must match the live stats.json.
    for (const { key, value } of extractDocStats(content)) {
      markerCount += 1;
      const want = expected[key as keyof typeof expected];
      if (value !== want) {
        error(
          "doc-stats-parity",
          `${relPath} ${key} count drift: doc says ${value}, stats.json says ${want}. Run: node scripts/set-version.js <current-version>`,
        );
        docDrift = true;
      }
    }
  }

  if (!docDrift) {
    console.log(`  ✓ ${markerCount} doc count markers across ${DOC_STAT_FILES.length} pages match stats.json`);
  }
}

// ── 12k. Pi Install Manifest ──

// The root package.json `pi` manifest is what makes
// `pi install git:github.com/CharlesWiltgen/Axiom` deliver both the skills
// and the axiom-pi extension (pi.skills + pi.extensions). Nothing else
// references those paths, so a moved skills dir or a renamed extension entry
// would silently break the Pi install with no other check catching it.
// Verify each declared path resolves on disk. axiom-aofx.
heading("12k. Pi Install Manifest");
{
  // Existence-only by design: Pi resolves both file and directory entries for
  // pi.skills/pi.extensions, so the guard is "the declared path resolves", not
  // its kind. Loadability of the extension entry is covered by step 17's
  // typecheck against the real Pi types.
  let rootPkg: { pi?: { skills?: string[]; extensions?: string[] } } | undefined;
  try {
    rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch (e: unknown) {
    error("pi-manifest", `could not parse root package.json: ${(e as Error).message}`);
  }
  if (rootPkg) {
    const pi = rootPkg.pi;
    if (!pi || typeof pi !== "object") {
      error("pi-manifest", "root package.json has no `pi` manifest — `pi install git:` won't deliver skills or the extension");
    } else {
      const declared: Array<[kind: string, relPath: string]> = [
        ...(pi.skills ?? []).map((p) => ["pi.skills", p] as [string, string]),
        ...(pi.extensions ?? []).map((p) => ["pi.extensions", p] as [string, string]),
      ];
      if (declared.length === 0) {
        error("pi-manifest", "`pi` manifest declares no skills or extensions");
      }
      const missing = declared.filter(([, relPath]) => !fs.existsSync(path.join(root, relPath)));
      for (const [kind, relPath] of missing) {
        error("pi-manifest", `${kind} path does not resolve: ${relPath}`);
      }
      if (declared.length > 0 && missing.length === 0) {
        console.log(`  ✓ Pi manifest paths resolve (${declared.map(([, p]) => p).join(", ")})`);
      }
    }
  }
}

// ── 12l. Codex Hooks Fidelity ──

// The Codex variant ports Axiom's Claude Code lifecycle hooks (bd axiom-25ll).
// 12f only checks mtime staleness against skills/agents *.md, so it can't catch a
// hooks regression. This gate independently re-derives what the Codex hooks.json
// MUST contain — event coverage from the source manifest minus the documented
// exclusions, plus schema/portability invariants — and verifies the copied scripts
// are byte-identical to source. Sibling to 12f/g/h.
heading("12l. Codex Hooks Fidelity");
{
  const srcHooksDir = path.join(pluginDir, "hooks");
  const codexHooksDir = path.join(root, "axiom-codex/hooks");
  const srcHooksPath = path.join(srcHooksDir, "hooks.json");
  const codexHooksPath = path.join(codexHooksDir, "hooks.json");

  if (!fs.existsSync(codexHooksPath)) {
    error("codex-hooks", "axiom-codex/hooks/hooks.json missing — run: npm run build:codex");
  } else {
    type HookEntry = { type?: string; command?: string };
    type HookGroup = { matcher?: string; hooks?: HookEntry[] };
    type HooksManifest = { hooks?: Record<string, HookGroup[]> };
    const src = JSON.parse(fs.readFileSync(srcHooksPath, "utf8")) as HooksManifest;
    const emitted = JSON.parse(fs.readFileSync(codexHooksPath, "utf8")) as HooksManifest;

    // (1) Event coverage. A source event survives into Codex iff at least one of
    // its groups can fire there (no matcher, or a matcher Codex supports). Re-derived
    // from the source manifest rather than by calling translateHooksToCodex(), so a
    // translator *logic* regression is caught. (The shared exclusion constants are the
    // one common dependency — the group/guardrail checks below backstop that vector.)
    const expectedEvents = Object.entries(src.hooks ?? {})
      .filter(([, groups]) =>
        groups.some((g) => g.matcher === undefined || !UNSUPPORTED_TOOL_MATCHERS.has(g.matcher)),
      )
      .map(([event]) => event)
      .sort();
    const emittedEvents = Object.keys(emitted.hooks ?? {}).sort();
    if (JSON.stringify(expectedEvents) !== JSON.stringify(emittedEvents)) {
      error(
        "codex-hooks",
        `event coverage drift — expected [${expectedEvents.join(", ")}], emitted [${emittedEvents.join(", ")}]. Run: npm run build:codex`,
      );
    } else {
      console.log(`  ✓ Codex hook events match source minus exclusions (${emittedEvents.join(", ")})`);
    }

    // (1b) Group/command survival. Event-key equality alone is vacuous: if a firable
    // group is dropped from an event that survives via another group (e.g. Write|Edit
    // lost while Bash keeps PostToolUse alive), check (1) stays green. So assert every
    // source group Codex CAN fire reappears under its event with its commands present
    // (PLUGIN_ROOT-rewritten). matcher is stripped on matcherless events.
    let groupsOk = true;
    for (const [event, groups] of Object.entries(src.hooks ?? {})) {
      for (const g of groups) {
        if (g.matcher !== undefined && UNSUPPORTED_TOOL_MATCHERS.has(g.matcher)) continue;
        const wantMatcher =
          g.matcher !== undefined && !MATCHERLESS_EVENTS.has(event) ? g.matcher : undefined;
        const emittedGroup = (emitted.hooks?.[event] ?? []).find((eg) => eg.matcher === wantMatcher);
        if (!emittedGroup) {
          error("codex-hooks", `${event} group (matcher=${wantMatcher ?? "none"}) missing from emitted Codex hooks`);
          groupsOk = false;
          continue;
        }
        const emittedCmds = new Set((emittedGroup.hooks ?? []).map((h) => h.command));
        for (const h of g.hooks ?? []) {
          const want = (h.command ?? "").replaceAll("CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT");
          if (!emittedCmds.has(want)) {
            error("codex-hooks", `${event} command dropped from emitted Codex hooks: ${want}`);
            groupsOk = false;
          }
        }
      }
    }
    // Targeted backstop for the shared-constant blind spot: the @State guardrail is the
    // payload of this port, so assert it survived regardless of the exclusion sets.
    const guardrailLives = (emitted.hooks?.PostToolUse ?? []).some((g) =>
      (g.hooks ?? []).some((h) => (h.command ?? "").includes("swift-guardrails.py")),
    );
    if (!guardrailLives) {
      error("codex-hooks", "swift-guardrails.py (@State guardrail) is missing from emitted Codex PostToolUse hooks");
      groupsOk = false;
    }
    if (groupsOk) {
      console.log("  ✓ Every firable source hook group + the @State guardrail survive into Codex");
    }

    // (2) Schema + harness-portability invariants on every emitted entry, and
    // collect the scripts each command references for the copy check below.
    let schemaOk = true;
    const referencedScripts = new Set<string>();
    for (const [event, groups] of Object.entries(emitted.hooks ?? {})) {
      for (const g of groups) {
        if (g.matcher !== undefined && MATCHERLESS_EVENTS.has(event)) {
          error("codex-hooks", `${event} carries a matcher Codex rejects on this event: ${g.matcher}`);
          schemaOk = false;
        }
        if (g.matcher !== undefined && UNSUPPORTED_TOOL_MATCHERS.has(g.matcher)) {
          error("codex-hooks", `${event} group uses a matcher with no Codex tool: ${g.matcher}`);
          schemaOk = false;
        }
        for (const h of g.hooks ?? []) {
          if (h.type !== "command" || typeof h.command !== "string") {
            error("codex-hooks", `${event} has a non-command or malformed hook entry`);
            schemaOk = false;
            continue;
          }
          if (h.command.includes("CLAUDE_PLUGIN_ROOT")) {
            error("codex-hooks", `${event} command still references CLAUDE_PLUGIN_ROOT (should be PLUGIN_ROOT)`);
            schemaOk = false;
          }
          if (h.command.includes("TOOL_INPUT_")) {
            error("codex-hooks", `${event} command reads a $TOOL_INPUT_* env var — Codex delivers tool_input on stdin only`);
            schemaOk = false;
          }
          const ref = h.command.match(/\$\{PLUGIN_ROOT\}\/hooks\/([A-Za-z0-9._-]+)/);
          if (ref) referencedScripts.add(ref[1]);
        }
      }
    }
    if (schemaOk) {
      console.log("  ✓ Emitted hooks pass schema + portability invariants (PLUGIN_ROOT, stdin tool_input, valid matchers)");
    }

    // (3) Script copy fidelity. Every referenced script must be present in the
    // Codex hooks dir; every source script that should ship (shouldCopyHookScript,
    // incl. transitive deps) must be byte-identical there; every excluded script
    // (e.g. crash-route, no Codex Read tool) must be absent.
    let copyOk = true;
    for (const s of referencedScripts) {
      if (!fs.existsSync(path.join(codexHooksDir, s))) {
        error("codex-hooks", `hooks.json references a script that was not copied: ${s}`);
        copyOk = false;
      }
    }
    let copiedChecked = 0;
    for (const file of fs.readdirSync(srcHooksDir)) {
      if (!shouldCopyHookScript(file)) continue;
      copiedChecked++;
      const codexScript = path.join(codexHooksDir, file);
      if (!fs.existsSync(codexScript)) {
        error("codex-hooks", `expected hook script not copied to Codex variant: ${file}. Run: npm run build:codex`);
        copyOk = false;
      } else if (
        fs.readFileSync(codexScript, "utf8") !== fs.readFileSync(path.join(srcHooksDir, file), "utf8")
      ) {
        error("codex-hooks", `copied hook script drifted from source: ${file}. Run: npm run build:codex`);
        copyOk = false;
      }
    }
    for (const s of CODEX_EXCLUDED_HOOK_SCRIPTS) {
      if (fs.existsSync(path.join(codexHooksDir, s))) {
        error("codex-hooks", `excluded hook script was copied into Codex variant: ${s}`);
        copyOk = false;
      }
    }
    if (copyOk) {
      console.log(`  ✓ ${copiedChecked} hook scripts copied byte-identical; ${CODEX_EXCLUDED_HOOK_SCRIPTS.size} excluded script(s) absent`);
    }
  }
}

// ── 12m. Codex Marketplace Manifest ──

// Codex installs plugins from a MARKETPLACE: `codex plugin marketplace add <repo>`
// then `codex plugin add axiom@axiom-marketplace`. That needs a manifest at the repo
// root `.agents/plugins/marketplace.json` pointing at the built plugin — Codex reads it
// at the marketplace/clone root. Without it the Codex variant ships but is
// uninstallable (bd axiom-adzg). This gate keeps the manifest present and in sync with
// the plugin it targets.
heading("12m. Codex Marketplace Manifest");
{
  const mfPath = path.join(root, ".agents/plugins/marketplace.json");
  if (!fs.existsSync(mfPath)) {
    error(
      "codex-marketplace",
      "missing .agents/plugins/marketplace.json — Codex users cannot install axiom-codex",
    );
  } else {
    type MarketplacePlugin = { name?: string; source?: { path?: string } };
    type Marketplace = { name?: string; plugins?: MarketplacePlugin[] };
    let mf: Marketplace | undefined;
    try {
      mf = JSON.parse(fs.readFileSync(mfPath, "utf8")) as Marketplace;
    } catch (e: unknown) {
      error("codex-marketplace", `.agents/plugins/marketplace.json is not valid JSON: ${(e as Error).message}`);
    }
    if (mf) {
      // The marketplace name is load-bearing: the documented install command is
      // `codex plugin add axiom@axiom-marketplace`. If it drifts, install breaks.
      if (mf.name !== "axiom-marketplace") {
        error(
          "codex-marketplace",
          `marketplace name "${mf.name}" != "axiom-marketplace" — install command would change to: codex plugin add axiom@${mf.name}`,
        );
      }
      const plugins = Array.isArray(mf.plugins) ? mf.plugins : [];
      const entry = plugins.find((p) => p?.name === "axiom");
      if (!entry) {
        const names = plugins.map((p) => p?.name).filter(Boolean).join(", ") || "none";
        error("codex-marketplace", `marketplace.json lists no plugin named "axiom" (found: ${names})`);
      } else if (typeof entry.source?.path !== "string") {
        error("codex-marketplace", "axiom plugin entry has no source.path");
      } else {
        const srcPath = entry.source.path;
        const pluginJsonPath = path.join(root, srcPath, ".codex-plugin/plugin.json");
        if (!fs.existsSync(pluginJsonPath)) {
          error(
            "codex-marketplace",
            `source.path "${srcPath}" does not resolve to a Codex plugin (no .codex-plugin/plugin.json). Run: npm run build:codex`,
          );
        } else {
          let pjName: string | undefined;
          try {
            pjName = (JSON.parse(fs.readFileSync(pluginJsonPath, "utf8")) as { name?: string }).name;
          } catch (e: unknown) {
            error("codex-marketplace", `${srcPath}/.codex-plugin/plugin.json is not valid JSON: ${(e as Error).message}`);
          }
          if (pjName !== undefined && pjName !== entry.name) {
            error(
              "codex-marketplace",
              `marketplace plugin name "${entry.name}" != plugin.json name "${pjName}" — the install selector would be wrong`,
            );
          } else if (pjName !== undefined) {
            console.log(
              `  ✓ Codex marketplace manifest points axiom → ${srcPath}; plugin.json name matches (install: codex plugin add axiom@${mf.name})`,
            );
          }
        }
      }
    }
    // The git-install path (`codex plugin marketplace add CharlesWiltgen/Axiom`)
    // clones the COMMITTED tree, so the manifest and the plugin's hooks must be
    // git-tracked — fs.existsSync above only sees the working tree. Warn (not error)
    // because committing is a release step done outside this gate.
    if (gitStatus.gitAvailable) {
      for (const rel of [".agents/plugins/marketplace.json", "axiom-codex/hooks/hooks.json"]) {
        try {
          execSync(`git ls-files --error-unmatch "${rel}"`, { cwd: root, stdio: "pipe" });
        } catch {
          warn(
            "codex-marketplace",
            `${rel} is untracked — commit it, or the GitHub install path ships without it`,
          );
        }
      }
    }
  }
}

// ── 12n. xcsym Noise-Rule Contract Parity ──

// xcsym emits noise_flags[].{class,deprioritize_safety}, but nothing in the Go
// reads the safety back — so the ONLY thing
// tying the Go values to the skill's noise-class table (which is what an LLM
// reads to interpret the output) was a maintainer remembering to edit both.
// Axiom-pfp changed one safety value and had to hand-check the table; Axiom-417
// asked for this gate. It ASSERTS, never generates: the table's Action column is
// editorial guidance the tool must not own.
//
// Second half: the three standing notes carry the do-not-close-on-shape
// warnings. triage-analyzer.md inlines them because axiom-shipping (which owns
// production-triage.md) was excluded from the Codex build, so a cross-reference
// there dangled and dropped exactly the safety text (Axiom-dtq). Inlining trades a
// dangling pointer for a drift risk; this check pays that off.
//
// axiom-shipping SHIPS to Codex as of Axiom-ky1, so the dangling-pointer half of
// that rationale is gone — Axiom-dtq treated the symptom, and the root cause was an
// inherited suite exclusion nobody re-examined. Keep the inlining anyway: safety
// text is worth carrying at the point of use, and this gate keeps the copies honest.
heading("12n. xcsym Noise-Rule Contract Parity");
{
  const noiseGoPath = path.join(root, "tools/xcsym/triage_noise.go");
  const triageSkillPath = path.join(
    root,
    ".claude-plugin/plugins/axiom/skills/axiom-shipping/skills/production-triage.md",
  );
  const triageAgentPath = path.join(
    root,
    ".claude-plugin/plugins/axiom/agents/triage-analyzer.md",
  );

  if (!fs.existsSync(noiseGoPath) || !fs.existsSync(triageSkillPath)) {
    console.log("  ⊘ xcsym triage sources not present — skipped");
  } else {
    const goSrc = fs.readFileSync(noiseGoPath, "utf8");
    const skillSrc = fs.readFileSync(triageSkillPath, "utf8");

    // Each rule is one `noiseRules = append(noiseRules, NoiseRule{...})` block
    // carrying a Class and returning `true, "<confidence>"` on its firing path.
    const goRules = new Map<string, string>();
    for (const block of goSrc.split("noiseRules = append(noiseRules, NoiseRule{").slice(1)) {
      const cls = block.match(/Class:\s*"([^"]+)"/)?.[1];
      const safety = block.match(/return\s+true,\s*"([^"]+)"/)?.[1];
      if (cls && safety) goRules.set(cls, safety);
    }

    // Table rows look like: | `class` | Meaning | deprioritize safety | Action |
    const tableRows = new Map<string, string>();
    for (const line of skillSrc.split("\n")) {
      const m = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|[^|]*\|\s*([a-z]+)\s*\|/);
      if (m) tableRows.set(m[1], m[2]);
    }

    if (goRules.size === 0) {
      error("noise-parity", `could not parse any noise rules out of ${path.relative(root, noiseGoPath)} — the parser needs updating`);
    } else {
      let mismatches = 0;
      for (const [cls, safety] of goRules) {
        const documented = tableRows.get(cls);
        if (documented === undefined) {
          error("noise-parity", `noise class "${cls}" is emitted by xcsym but has no row in the production-triage.md noise-class table`);
          mismatches++;
        } else if (documented !== safety) {
          error("noise-parity", `noise class "${cls}": Go emits deprioritize_safety "${safety}" but the noise-class table documents "${documented}"`);
          mismatches++;
        }
      }
      for (const cls of tableRows.keys()) {
        if (!goRules.has(cls)) {
          error("noise-parity", `the noise-class table documents "${cls}", but no xcsym rule emits it`);
          mismatches++;
        }
      }
      if (mismatches === 0) {
        console.log(`  ✓ ${goRules.size} xcsym noise classes match the production-triage.md table (class + deprioritize_safety)`);
      }
    }

    // Standing notes: the skill states them as **Standing note for `x`:** "…";
    // the agent inlines them as > **`x`:** "…". Compare the quoted body.
    if (!fs.existsSync(triageAgentPath)) {
      console.log("  ⊘ triage-analyzer.md not present — standing-note parity skipped");
    } else {
      const agentSrc = fs.readFileSync(triageAgentPath, "utf8");
      const quoted = (src: string, re: RegExp): string | undefined =>
        src.match(re)?.[1]?.trim();
      let noteMismatches = 0;
      let notesChecked = 0;
      for (const cls of ["third_party_or_system_only", "anr_suspension_false_positive", "fixed_in_newer_build"]) {
        const inSkill = quoted(skillSrc, new RegExp(`\\*\\*Standing note for \`${cls}\`:\\*\\*[^"]*"([\\s\\S]*?)"\\s*(?:\\n|$)`));
        const inAgent = quoted(agentSrc, new RegExp(`>\\s*\\*\\*\`${cls}\`:\\*\\*\\s*"([\\s\\S]*?)"\\s*(?:\\n|$)`));
        if (!inSkill) {
          error("noise-parity", `standing note for "${cls}" not found in production-triage.md`);
          noteMismatches++;
        } else if (!inAgent) {
          error("noise-parity", `standing note for "${cls}" is not inlined in triage-analyzer.md — Codex ships the agent without axiom-shipping, so a cross-reference there drops the warning`);
          noteMismatches++;
        } else if (inSkill !== inAgent) {
          error("noise-parity", `standing note for "${cls}" has drifted between production-triage.md and triage-analyzer.md`);
          noteMismatches++;
        } else {
          notesChecked++;
        }
      }
      if (noteMismatches === 0) {
        console.log(`  ✓ ${notesChecked} standing notes inlined in triage-analyzer.md match production-triage.md verbatim`);
      }
    }
  }
}

// ── 12o. Codex Pointer Resolution ──

// Every "see `axiom-suite (skills/file.md)`" pointer inside the EMITTED Codex tree
// must resolve to a file the build actually wrote, and every `axiom-verb-*` skill
// name it cites must be a directory that exists.
//
// This is the gate for Axiom-ky1. Suite-level exclusion had been aiming 41 pointers
// at files the build never wrote — axiom-tools' entry was inherited from a suite
// that held only discipline text and never re-examined after five tool references
// landed in it. Nothing detected that, because both halves looked locally correct:
// the source cross-reference is valid, and the exclusion list is valid; only the
// emitted tree shows the break. Check the artifact, not the inputs.
heading("12o. Codex Pointer Resolution");
{
  const codexSkills = path.join(root, "axiom-codex/skills");
  if (!fs.existsSync(codexSkills)) {
    console.log("  ⊘ axiom-codex not built — skipped");
  } else {
    const suiteDirs = new Set(fs.readdirSync(codexSkills));
    const mdFiles: string[] = [];
    (function walk(dir: string): void {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".md")) mdFiles.push(p);
      }
    })(codexSkills);

    let subPointers = 0;
    let namePointers = 0;
    const unresolved = new Map<string, number>();
    const bump = (k: string) => unresolved.set(k, (unresolved.get(k) ?? 0) + 1);

    for (const f of mdFiles) {
      const text = fs.readFileSync(f, "utf8");
      for (const m of text.matchAll(/(axiom-[a-z0-9-]+)\s*[(/]\s*skills\/([a-z0-9._-]+\.md)/gi)) {
        subPointers++;
        if (!fs.existsSync(path.join(codexSkills, m[1], "skills", m[2]))) {
          bump(`${m[1]}/skills/${m[2]}`);
        }
      }
      for (const m of text.matchAll(
        /`(axiom-(?:audit|analyze|scan|fix|test|run|debug|profile|validate|resolve|implement|optimize|modernize|health)[a-z0-9-]*)`/g,
      )) {
        namePointers++;
        if (!suiteDirs.has(m[1])) bump(m[1]);
      }
    }

    // Bare agent names and /axiom: commands. Neither exists on Codex, and neither
    // carries the `axiom-` prefix the pointer regexes above key on — so the original
    // 12o passed a tree whose PRIMARY invoke instructions ("Launch `build-fixer`
    // agent or `/axiom:fix-build`") all dangled, while every cross-reference
    // resolved. Check the instruction, not just the citation.
    const sourceAgents = new Set(
      fs.existsSync(path.join(root, ".claude-plugin/plugins/axiom/agents"))
        ? fs
            .readdirSync(path.join(root, ".claude-plugin/plugins/axiom/agents"))
            .filter((f) => f.endsWith(".md"))
            .map((f) => path.basename(f, ".md"))
        : [],
    );
    for (const f of mdFiles) {
      const text = fs.readFileSync(f, "utf8");
      for (const m of text.matchAll(/Launch `([a-z0-9-]+)` agent/g)) {
        if (sourceAgents.has(m[1])) {
          bump(`Launch \`${m[1]}\` agent (no agents on Codex; use ${agentToSkillName(m[1])})`);
        }
      }
      for (const m of text.matchAll(/`\/axiom:[a-z0-9 -]+`(?! \(Claude Code only\))/g)) {
        bump(`${m[0]} (Codex ships no /axiom: commands)`);
      }
    }

    if (unresolved.size > 0) {
      for (const [target, count] of [...unresolved].sort((a, b) => b[1] - a[1])) {
        error(
          "codex-pointers",
          `${count} Codex pointer(s) target "${target}", which the build never emitted — withhold the pointer or ship the target`,
        );
      }
    } else {
      console.log(
        `  ✓ ${subPointers} sub-skill pointers + ${namePointers} skill-name references resolve across ${mdFiles.length} emitted Codex files`,
      );
    }
  }
}

// ── 12q. Command Invocation Policy (Claude Code) ──

// Every /axiom:* command must be user-invoked only. They are escape hatches and
// actions, not routing surfaces — the 27 routers do the routing.
//
// ask.md and status.md were missing the key (found 2026-08-15). /axiom:ask is the
// worst case: 7.5 KB listing all 26 routers, so a model invocation loads the whole
// routing table to redo routing the routers already did, and competes with the very
// routers it exists to backstop. ask.md is GENERATED from
// scripts/templates/ask.md.template, so the template is checked too — fixing only
// the output would regress on the next version bump.
heading("12q. Command Invocation Policy");
{
  const cmdDir = path.join(root, ".claude-plugin/plugins/axiom/commands");
  const template = path.join(root, "scripts/templates/ask.md.template");
  let checked = 0;
  let missing = 0;

  const hasKey = (p: string): boolean => {
    const fm = fs.readFileSync(p, "utf8").split("---")[1] ?? "";
    return /^\s*disable-model-invocation:\s*true\s*$/m.test(fm);
  };

  if (!fs.existsSync(cmdDir)) {
    console.log("  ⊘ commands/ not found — skipped");
  } else {
    for (const f of fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md")).sort()) {
      if (hasKey(path.join(cmdDir, f))) {
        checked++;
      } else {
        error("command-policy", `commands/${f} lacks disable-model-invocation: true — Claude could invoke it unprompted`);
        missing++;
      }
    }
    if (fs.existsSync(template) && !hasKey(template)) {
      error("command-policy", "scripts/templates/ask.md.template lacks disable-model-invocation: true — the next version bump would regenerate ask.md without it");
      missing++;
    }
    if (missing === 0) {
      console.log(`  ✓ all ${checked} commands are user-invoked only (template included)`);
    }
  }
}

// ── 12r. Cursor Generated Distribution ──
//
// Cursor installs from a repository-root marketplace and a nested plugin root.
// Re-render in memory and compare every byte so a stale generated tree, a changed
// report hash, or a source-file mtime quirk cannot bypass the release gate.
heading("12r. Cursor Generated Distribution");
{
  const cursorRoot = path.join(root, "axiom-cursor");
  const cursorMarketplacePath = path.join(root, ".cursor-plugin", "marketplace.json");
  type CursorDiskFile = { content: Buffer; mode: number };
  const readTree = (directory: string): Map<string, CursorDiskFile> => {
    const files = new Map<string, CursorDiskFile>();
    const walk = (current: string, prefix: string): void => {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`symlinked generated directory: ${current}`);
      if (!stat.isDirectory()) throw new Error(`generated path is not a directory: ${current}`);
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => compareCursorPaths(a.name, b.name))) {
        const absolute = path.join(current, entry.name);
        const relative = path.posix.join(prefix, entry.name);
        const entryStat = fs.lstatSync(absolute);
        if (entryStat.isSymbolicLink()) throw new Error(`symlinked generated file: ${relative}`);
        if (entryStat.isDirectory()) walk(absolute, relative);
        else if (entryStat.isFile()) files.set(relative, { content: fs.readFileSync(absolute), mode: entryStat.mode & 0o777 });
        else throw new Error(`unsupported generated entry: ${relative}`);
      }
    };
    walk(directory, "");
    return files;
  };
  try {
    if (!fs.existsSync(cursorMarketplacePath) || !fs.existsSync(cursorRoot)) {
      throw new Error("generated marketplace or nested plugin root is missing — run: npm run build:cursor");
    }
    const expected = renderCursorDistribution(root, { profile: "full" });
    const actual = readTree(cursorRoot);
    const expectedFiles = new Map(expected.plugin);
    const added = [...actual.keys()].filter((file) => !expectedFiles.has(file)).sort(compareCursorPaths);
    const removed = [...expectedFiles.keys()].filter((file) => !actual.has(file)).sort(compareCursorPaths);
    const changed = [...expectedFiles.keys()].filter((file) => {
      const disk = actual.get(file);
      const rendered = expectedFiles.get(file)!;
      return !disk || disk.mode !== 0o644 || !disk.content.equals(Buffer.from(rendered.content, "utf8"));
    }).sort(compareCursorPaths);
    const marketplaceStat = fs.lstatSync(cursorMarketplacePath);
    if (marketplaceStat.isSymbolicLink() || !marketplaceStat.isFile()) {
      throw new Error("generated marketplace is not a regular file");
    }
    const marketplaceMode = marketplaceStat.mode & 0o777;
    const marketplaceActual = fs.readFileSync(cursorMarketplacePath);
    if (marketplaceMode !== 0o644 || !marketplaceActual.equals(Buffer.from(expected.marketplace.content, "utf8"))) {
      changed.push("marketplace.json");
      changed.sort(compareCursorPaths);
    }
    if (added.length || removed.length || changed.length) {
      error("cursor-staleness", `generated Cursor output differs from a full render (added: ${added.join(", ") || "none"}; removed: ${removed.join(", ") || "none"}; changed: ${changed.join(", ") || "none"}). Run: npm run build:cursor`);
    } else {
      console.log(`  ✓ Cursor output matches deterministic full render (${expectedFiles.size} plugin files + marketplace)`);
    }

    const marketplace = JSON.parse(marketplaceActual.toString("utf8")) as { plugins?: Array<{ name?: string; source?: string }> };
    const entry = marketplace.plugins?.find((plugin) => plugin.name === "axiom");
    if (!entry || entry.source !== "./axiom-cursor") {
      error("cursor-marketplace", "marketplace must resolve axiom from nested source ./axiom-cursor");
    } else if (path.resolve(root, entry.source) !== cursorRoot) {
      error("cursor-marketplace", "marketplace nested source does not resolve to axiom-cursor");
    }
    const plugin = JSON.parse(actual.get(".cursor-plugin/plugin.json")!.content.toString("utf8")) as { name?: string; mcpServers?: unknown };
    if (plugin.name !== "axiom" || "mcpServers" in plugin || !actual.has("mcp.json")) {
      error("cursor-marketplace", "Cursor plugin must be named axiom, omit plugin mcpServers, and provide plugin-root mcp.json");
    }

    const count = (prefix: string, suffix: string) => [...actual.keys()].filter((file) => file.startsWith(prefix) && file.endsWith(suffix)).length;
    const canonicalManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "claude-code.json"), "utf8")) as { commands?: unknown[] };
    const canonicalRouters = fs.readdirSync(path.join(pluginDir, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(pluginDir, "skills", entry.name, "SKILL.md")))
      .map((entry) => entry.name);
    const canonicalAgents = fs.readdirSync(path.join(pluginDir, "agents"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => path.basename(file, ".md"));
    const canonicalCommands = (canonicalManifest.commands ?? [])
      .map((entry) => path.posix.basename(String(entry), ".md"));
    if (
      count("skills/", "/SKILL.md") !== canonicalRouters.length
      || count("agents/", ".md") !== canonicalAgents.length
      || count("commands/", ".md") !== canonicalCommands.length
    ) {
      error("cursor-inventory", `Cursor component totals drifted from the canonical tree (skills ${count("skills/", "/SKILL.md")}/${canonicalRouters.length}, agents ${count("agents/", ".md")}/${canonicalAgents.length}, commands ${count("commands/", ".md")}/${canonicalCommands.length})`);
    }
    const mcp = JSON.parse(actual.get("mcp.json")!.content.toString("utf8"));
    const hooks = JSON.parse(actual.get("hooks/hooks.json")!.content.toString("utf8"));
    if (mcp?.mcpServers?.axiom?.command !== "npx" || JSON.stringify(mcp?.mcpServers?.axiom?.args) !== JSON.stringify(["-y", "axiom-mcp"]) || !hooks?.hooks?.sessionStart || !hooks?.hooks?.postToolUse) {
      error("cursor-hooks-mcp", "Cursor MCP or native hook manifest no longer matches the required release contract");
    }
    const disposition = JSON.parse(actual.get("reports/capability-disposition.json")!.content.toString("utf8"));
    const exactStrings = (left: unknown, right: readonly string[]): boolean =>
      Array.isArray(left)
      && left.every((value) => typeof value === "string")
      && new Set(left).size === left.length
      && [...left].sort(compareCursorPaths).join("\0") === [...right].sort(compareCursorPaths).join("\0");
    const routerNames = [...actual.keys()]
      .filter((file) => file.startsWith("skills/") && file.endsWith("/SKILL.md"))
      .map((file) => file.split("/")[1]);
    const agentNames = [...actual.keys()]
      .filter((file) => file.startsWith("agents/") && file.endsWith(".md"))
      .map((file) => path.basename(file, ".md"));
    const commandNames = [...actual.keys()]
      .filter((file) => file.startsWith("commands/") && file.endsWith(".md"))
      .map((file) => path.basename(file, ".md"));
    const routerRows = Array.isArray(disposition.routerDispositions) ? disposition.routerDispositions : [];
    const agentRows = Array.isArray(disposition.agentDispositions) ? disposition.agentDispositions : [];
    const commandRows = Array.isArray(disposition.commandDispositions) ? disposition.commandDispositions : [];
    const hookRows = Array.isArray(disposition.hookDispositions) ? disposition.hookDispositions : [];
    const advisoryEntries = Object.entries(CURSOR_AGENT_ADVISORIES);
    const expectedHookWarnings: Record<string, string> = Object.fromEntries(
      advisoryEntries.map(([owner, mapping]) => {
        const warnings = [...mapping.command.matchAll(/\becho "(Warning: [^"]+)"/g)].map((match) => match[1]);
        if (warnings.length !== 1) throw new Error(`per-agent advisory lacks exactly one warning: ${owner}`);
        return [`agent:${owner}:${mapping.event}:${mapping.matcher}`, warnings[0]];
      }),
    );
    const expectedHookAdvisories: Record<string, string> = Object.fromEntries(
      advisoryEntries.map(([owner, mapping]) => [`agent:${owner}:${mapping.event}:${mapping.matcher}`, mapping.advisory]),
    );
    const expectedGlobalHookIds = [
      "global:global:PostToolUse:Bash",
      "global:global:PostToolUse:Write|Edit",
      "global:global:PreToolUse:Read",
      "global:global:SessionStart:*",
      "global:global:SubagentStart:*",
      "global:global:UserPromptSubmit:*",
    ];
    const capabilityOkay = disposition.routers === canonicalRouters.length
      && disposition.agents === canonicalAgents.length
      && disposition.commands === canonicalCommands.length
      && Number.isSafeInteger(disposition.excludedMirrors)
      && disposition.excludedMirrors >= 0
      && Array.isArray(disposition.authorityExpansions)
      && exactStrings(routerNames, canonicalRouters)
      && exactStrings(agentNames, canonicalAgents)
      && exactStrings(commandNames, canonicalCommands.map((name) => `axiom-${name}`))
      && exactStrings(disposition.authorityExpansions.map((row: { agent?: unknown }) => row.agent), canonicalAgents)
      && Object.keys(disposition.dispositions ?? {}).length === 7
      && exactStrings(routerRows.map((row: { name?: unknown }) => row.name), canonicalRouters)
      && routerRows.every((row: { disposition?: unknown; listedInCanonicalManifest?: unknown }) =>
        row.disposition === "generated-native-skill" && typeof row.listedInCanonicalManifest === "boolean")
      && exactStrings(agentRows.map((row: { name?: unknown }) => row.name), canonicalAgents)
      && agentRows.every((row: { disposition?: unknown; authority?: unknown; sourceBackground?: unknown; releasedBackground?: unknown; sourceTools?: unknown; inheritedAuthority?: unknown }) =>
        row.disposition === "generated-native-subagent"
        && (row.authority === "readonly" || row.authority === "writable")
        && typeof row.sourceBackground === "boolean"
        && typeof row.releasedBackground === "boolean"
        && Array.isArray(row.sourceTools)
        && row.sourceTools.length > 0
        && row.inheritedAuthority === "Cursor agent inherits its host tool and MCP access.")
      && agentRows.filter((row: { authority?: unknown; releasedBackground?: unknown }) => row.authority === "readonly" && row.releasedBackground === true).length === disposition.releasedReadonlyBackground
      && agentRows.filter((row: { authority?: unknown; releasedBackground?: unknown }) => row.authority === "writable" && row.releasedBackground === false).length === disposition.releasedWritableForeground
      && exactStrings(commandRows.map((row: { generatedName?: unknown }) => row.generatedName), canonicalCommands.map((name) => `axiom-${name}`))
      && exactStrings(commandRows.map((row: { canonicalName?: unknown }) => row.canonicalName), canonicalCommands)
      && commandRows.every((row: { disposition?: unknown }) => row.disposition === "generated-native-command")
      && exactStrings(hookRows.map((row: { id?: unknown }) => row.id), [...expectedGlobalHookIds, ...Object.keys(expectedHookWarnings)])
      && hookRows.filter((row: { source?: unknown }) => row.source === "agent").every((row: { id: string; disposition?: unknown; warning?: unknown; advisory?: unknown }) =>
        row.disposition === "agent-prompt.advisory"
        && row.warning === expectedHookWarnings[row.id]
        && row.advisory === expectedHookAdvisories[row.id])
      && JSON.stringify(disposition.mcpDispositions) === JSON.stringify([{ name: "axiom", disposition: "external-runtime-mcp", command: "npx -y axiom-mcp", bundled: false }])
      && JSON.stringify(disposition.binaryDispositions) === JSON.stringify([
        { name: "xclog", disposition: "external-via-axiom-mcp" },
        { name: "xcprof", disposition: "external-via-axiom-mcp" },
        { name: "xcsym", disposition: "external-via-axiom-mcp" },
        { name: "xcui", disposition: "external-unbundled-no-mcp-wrapper" },
      ])
      && JSON.stringify(disposition.cloudDispositions) === JSON.stringify([{ name: "Cursor Cloud Agents", disposition: "unsupported" }]);
    if (!capabilityOkay) {
      error("cursor-capability-ledger", "Cursor capability ledger lacks required full-profile inventory, authority, or hook disposition coverage");
    }
    const inventory = JSON.parse(actual.get("reports/inventory-sha256.json")!.content.toString("utf8"));
    try {
      validateCursorInventory(inventory, actual);
    } catch (inventoryError) {
      error("cursor-report-hash", (inventoryError as Error).message);
    }

    for (const [relative, file] of actual) {
      const text = file.content.toString("utf8");
      if (file.mode !== 0o644 || file.content.includes(0) || /CLAUDE_PLUGIN_ROOT|\$ARGUMENTS|\{\{args\.|\/axiom:|TaskOutput|AskUserQuestion/.test(text)) {
        error("cursor-artifact-safety", `${relative} has an unsafe mode, binary byte, or stale Claude token`);
      }
    }
    if (marketplaceMode !== 0o644) {
      error("cursor-artifact-safety", "marketplace.json has an unsafe mode");
    }
  } catch (e: unknown) {
    error("cursor-distribution", (e as Error).message);
  }
}

// ── 12p. Codex Invocation Policy ──

// Codex decides implicit invocation from `policy.allow_implicit_invocation` in the
// agents/openai.yaml sidecar, defaulting to TRUE when absent
// (codex-rs/skills/src/model.rs — allows_implicit_invocation().unwrap_or(true)).
// The `disable-model-invocation: true` frontmatter key Axiom also emits is NOT read
// by Codex: its frontmatter struct takes name/description/metadata and carries no
// deny_unknown_fields, so serde drops it silently. For a year that left every
// auditor implicitly invocable — the routing regression the design meant to prevent
// — failing quietly in both directions (Axiom-izi). Assert the emitted artifact.
//
// Routers are deliberately the other way: they are the discovery surface, so they
// must NOT carry the policy block. A gate that only checked "auditors are false"
// would pass a build that silenced the routers too.
heading("12p. Codex Invocation Policy");
{
  const codexSkills = path.join(root, "axiom-codex/skills");
  const agentsSrc = path.join(root, ".claude-plugin/plugins/axiom/agents");

  // Derive the agent-skill set from the source agents through the SAME naming
  // function the builder uses. A name-shaped guess misclassifies both ways:
  // axiom-health and axiom-testing are routers that read verb-first, and
  // axiom-swift-simplifier is an agent-skill that does not.
  const agentSkillNames = new Set(
    fs.existsSync(agentsSrc)
      ? fs
          .readdirSync(agentsSrc)
          .filter((f) => f.endsWith(".md"))
          .map((f) => agentToSkillName(path.basename(f, ".md")))
      : [],
  );

  if (!fs.existsSync(codexSkills) || agentSkillNames.size === 0) {
    console.log("  ⊘ axiom-codex not built — skipped");
  } else {
    let explicitOnly = 0;
    let discoverable = 0;
    let violations = 0;

    for (const dir of fs.readdirSync(codexSkills)) {
      const yamlPath = path.join(codexSkills, dir, "agents/openai.yaml");
      if (!fs.existsSync(yamlPath)) continue;
      const yaml = fs.readFileSync(yamlPath, "utf8");
      const isAgentSkill = agentSkillNames.has(dir);
      const isExplicit = /allow_implicit_invocation:\s*false/.test(yaml);

      if (isAgentSkill) {
        if (!isExplicit) {
          error("codex-policy", `${dir} lacks policy.allow_implicit_invocation: false — Codex defaults it to implicitly invocable`);
          violations++;
        } else if (!yaml.includes(`$${dir}`)) {
          error("codex-policy", `${dir} is explicit-invoke-only but its default_prompt does not name $${dir}, so nothing tells a user how to reach it`);
          violations++;
        } else {
          explicitOnly++;
        }
      } else if (isExplicit) {
        error("codex-policy", `router ${dir} is marked explicit-invoke-only — routers are the discovery surface and must stay implicitly invocable`);
        violations++;
      } else {
        discoverable++;
      }
    }

    // Guards the sentence-splitter: a period inside a file extension (`.ips`) used to
    // end the sentence, emitting "Use when the user has a crash log (." as the string
    // Codex routes on. An unbalanced trailing "(" is that bug's fingerprint.
    let truncated = 0;
    for (const dir of fs.readdirSync(codexSkills)) {
      const skillPath = path.join(codexSkills, dir, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      const desc = fs.readFileSync(skillPath, "utf8").match(/^description: (.*)$/m)?.[1];
      if (!desc) continue;
      const opens = (desc.match(/\(/g) ?? []).length;
      const closes = (desc.match(/\)/g) ?? []).length;
      if (opens > closes) {
        error("codex-policy", `${dir} description ends mid-parenthetical ("${desc.slice(-40)}") — the sentence splitter cut at a file extension`);
        truncated++;
      }
    }

    // Codex's own plugin validator REJECTS this frontmatter key outright:
    //   if disable_model_invocation not in (None, False): errors.append("must be false")
    //   — codex-rs/skills/src/assets/samples/plugin-creator/scripts/validate_plugin.py
    // Emitting it failed validation on all 42 agent-skills against Codex 0.147.0.
    // The Claude Code plugin still carries it (there it is the supported mechanism);
    // this check is scoped to the emitted Codex tree only.
    let rejectedKey = 0;
    for (const dir of fs.readdirSync(codexSkills)) {
      const skillPath = path.join(codexSkills, dir, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      const fm = fs.readFileSync(skillPath, "utf8").split("---")[1] ?? "";
      if (/disable-model-invocation/.test(fm)) {
        error("codex-policy", `${dir} carries disable-model-invocation in frontmatter — Codex's plugin validator rejects it ("must be false"); explicit-invoke-only belongs in openai.yaml's policy block`);
        rejectedKey++;
      }
    }

    if (violations === 0 && truncated === 0 && rejectedKey === 0) {
      console.log(`  ✓ ${explicitOnly} agent-skills explicit-invoke-only with a $-named default_prompt; ${discoverable} routers left discoverable`);
      console.log(`  ✓ no emitted description truncated at a file-extension period`);
      console.log(`  ✓ no emitted skill carries the frontmatter key Codex's validator rejects`);
    }
  }
}

// ── Phase 1 Summary ──

heading("Phase 1 Summary (Static)");
console.log(
  `  Skills: ${skillFilesChecked} | Agents: ${agentFilesChecked} | Commands: ${commandFilesChecked}`,
);
console.log(
  `  Cross-refs: ${crossRefChecked} | Routers: ${routerSkillNames.length}`,
);

if (errors.length > 0) {
  console.log(`\n  ERRORS (${totalErrors}):`);
  for (const e of errors) console.log(e);
}
if (warnings.length > 0) {
  console.log(`\n  WARNINGS (${totalWarnings}):`);
  for (const w of warnings) console.log(w);
}

if (totalErrors > 0) {
  console.log(
    `\n✗ Phase 1 FAILED with ${totalErrors} error(s). Fix before deploying.`,
  );
  process.exit(1);
}

console.log("\n✓ Phase 1 PASSED — static validation clean\n");

// ── Phase 2: Build Validation ──

heading("Phase 2: Build Validation");

if (process.argv.slice(2).includes("--static")) {
  console.log("  ⊘ Skipped (--static flag)");
  process.exit(0);
}

heading("11z. Codex Plugin Validator (upstream)");
{
  // Gate 12p asserts ONE rule that Codex's validator enforces, transcribed by hand
  // from validate_plugin.py. That catches the rule we already know about; running
  // the validator itself catches the next one. It is the sample script Codex ships
  // for plugin authors and is what a submission is checked against — a Codex the
  // user has installed carries it, so this needs no network.
  //
  // Skipped, never failed, when its inputs are absent: python3 + PyYAML + a Codex
  // install. It is defense in depth, not a hard dependency.
  const codexDir = path.join(root, "axiom-codex");
  let validator = "";
  const home = process.env.HOME ?? "";
  // Codex extracts its bundled samples here on first run, so this is the reliable
  // location — the script is otherwise embedded in the native binary as an asset.
  const extracted = path.join(home, ".codex/skills/.system/plugin-creator/scripts/validate_plugin.py");
  if (fs.existsSync(extracted)) validator = extracted;

  for (const base of validator
    ? []
    : [
        path.join(home, ".local/share/mise/installs/node"),
        "/opt/homebrew/lib/node_modules",
        "/usr/local/lib/node_modules",
      ]) {
    if (!fs.existsSync(base)) continue;
    const found = execSync(
      `find ${JSON.stringify(base)} -name validate_plugin.py -path '*plugin-creator*' 2>/dev/null | head -1`,
      { encoding: "utf8", shell: "/bin/bash" },
    ).trim();
    if (found) {
      validator = found;
      break;
    }
  }

  // Prefer a venv the maintainer already created; fall back to system python3.
  // PEP 668 blocks `pip install` into a Homebrew/mise python, so a venv is the
  // realistic way to have PyYAML available at all.
  let py = "python3";
  const venvPy = path.join(home, ".cache/axiom-validator/bin/python");
  if (fs.existsSync(venvPy)) py = venvPy;

  let hasYaml = false;
  try {
    execSync(`${JSON.stringify(py)} -c 'import yaml'`, { stdio: "pipe" });
    hasYaml = true;
  } catch {
    hasYaml = false;
  }

  if (!fs.existsSync(codexDir)) {
    console.log("  ⊘ axiom-codex not built — skipped");
  } else if (!validator) {
    console.log("  ⊘ Codex's validate_plugin.py not found locally — skipped (12p still asserts the known rule)");
  } else if (!hasYaml) {
    // A plain `pip install` fails under PEP 668 on a Homebrew/mise python, so name
    // the form that actually works rather than one that errors.
    console.log(
      "  ⊘ python3 has no PyYAML — skipped. Enable with:\n" +
        "      python3 -m venv ~/.cache/axiom-validator && ~/.cache/axiom-validator/bin/pip install pyyaml\n" +
        "      (then re-run; 12p still asserts the known rule meanwhile)",
    );
  } else {
    try {
      execSync(`${JSON.stringify(py)} ${JSON.stringify(validator)} ${JSON.stringify(codexDir)}`, {
        stdio: "pipe",
        timeout: 60000,
      });
      console.log("  ✓ axiom-codex passes Codex's own plugin validator");
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      const out = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
      const lines = out.split("\n").filter((l) => l.startsWith("- ")).slice(0, 8);
      error(
        "codex-validator",
        `axiom-codex fails Codex's plugin validator:\n    ${lines.join("\n    ") || out.trim().slice(0, 400)}`,
      );
    }
  }
}

heading("12. MCP Server Tests");
try {
  execSync("pnpm test", {
    cwd: path.join(root, "axiom-mcp"),
    stdio: "pipe",
    timeout: 60000,
  });
  console.log("  ✓ MCP server tests pass");
} catch (e: unknown) {
  const err = e as { stdout?: Buffer; stderr?: Buffer };
  const output = err.stdout?.toString() || err.stderr?.toString() || "";
  const summary = output.match(/Tests\s+\d+.*|FAIL.*|✗.*/gm);
  error(
    "mcp-tests",
    `MCP server tests failed${summary ? ":\n    " + summary.join("\n    ") : ""}`,
  );
  console.log("\n✗ Phase 2 FAILED. Fix MCP tests before deploying.");
  process.exit(1);
}

heading("13. MCP Bundle Build + Validation");
try {
  execSync("pnpm run build:bundle", {
    cwd: path.join(root, "axiom-mcp"),
    stdio: "pipe",
    timeout: 120000,
  });
  const bundlePath = path.join(root, "axiom-mcp/dist/bundle.json");
  if (!fs.existsSync(bundlePath)) {
    error("mcp-bundle", "bundle.json not generated");
  } else {
    const bundleSize = fs.statSync(bundlePath).size;
    if (bundleSize < 1000) {
      error("mcp-bundle", `bundle.json suspiciously small (${bundleSize} bytes)`);
    } else {
      const bundleKB = Math.round(bundleSize / 1024);
      console.log(`  ✓ MCP bundle built (${bundleKB} KB)`);
    }

    // Validate bundle contents match source
    const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    const bundleSkillCount = Object.keys(bundle.skills || {}).length;
    const bundleAgentCount = Object.keys(bundle.agents || {}).length;
    const bundleCommandCount = Object.keys(bundle.commands || {}).length;

    // The bundle keys one entry per skill markdown file: every SKILL.md (routers +
    // standalones = skillFilesChecked) plus every skills/*.md sub-skill
    // (subSkillFilesChecked). NOT skillContentCount, which folds standalone SKILL.md
    // into the sub-skill tally and would over-count standalones here.
    const expectedBundleSkills = skillFilesChecked + subSkillFilesChecked;
    if (bundleSkillCount !== expectedBundleSkills) {
      error("mcp-fidelity", `bundle has ${bundleSkillCount} skills, source has ${expectedBundleSkills} (${skillFilesChecked} SKILL.md + ${subSkillFilesChecked} sub-skills)`);
    } else {
      console.log(`  ✓ MCP bundle skills match source (${bundleSkillCount})`);
    }
    if (bundleAgentCount !== agentFilesChecked) {
      error("mcp-fidelity", `bundle has ${bundleAgentCount} agents, source has ${agentFilesChecked}`);
    } else {
      console.log(`  ✓ MCP bundle agents match source (${bundleAgentCount})`);
    }
    if (bundleCommandCount !== commandFilesChecked) {
      error("mcp-fidelity", `bundle has ${bundleCommandCount} commands, source has ${commandFilesChecked}`);
    } else {
      console.log(`  ✓ MCP bundle commands match source (${bundleCommandCount})`);
    }

    // Validate search index
    if (bundle.searchIndex) {
      console.log(`  ✓ MCP search index present`);
    } else {
      error("mcp-fidelity", "search index missing from bundle");
    }
  }
} catch (e: unknown) {
  const err = e as { stderr?: Buffer };
  error(
    "mcp-bundle",
    `MCP bundle build failed: ${err.stderr?.toString()?.slice(0, 200) || "unknown error"}`,
  );
  console.log("\n✗ Phase 2 FAILED. Fix MCP bundle before deploying.");
  process.exit(1);
}

heading("14. Codex Plugin Build + Validation");
try {
  execSync("npm run build:codex", {
    cwd: root,
    stdio: "pipe",
    timeout: 60000,
  });

  const codexDir = path.join(root, "axiom-codex");
  const codexManifest = path.join(codexDir, ".codex-plugin/plugin.json");

  // Validate manifest
  if (!fs.existsSync(codexManifest)) {
    error("codex-manifest", ".codex-plugin/plugin.json not generated");
  } else {
    const manifest = JSON.parse(fs.readFileSync(codexManifest, "utf8"));
    if (!manifest.name || !manifest.version || !manifest.skills) {
      error("codex-manifest", "plugin.json missing required fields (name, version, skills)");
    } else {
      console.log(`  ✓ Codex manifest valid (v${manifest.version})`);
    }

    // Version must match Claude Code manifest
    const ccManifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, "claude-code.json"), "utf8"),
    );
    if (manifest.version !== ccManifest.version) {
      error("codex-version", `Codex version ${manifest.version} != Claude Code version ${ccManifest.version}`);
    }
  }

  // Validate skill count (source minus excluded routers)
  const codexSkillsDir = path.join(codexDir, "skills");
  if (!fs.existsSync(codexSkillsDir)) {
    error("codex-skills", "skills/ directory not generated");
  } else {
    const codexSkillDirs = fs.readdirSync(codexSkillsDir, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory());
    const codexSkillCount = codexSkillDirs.length;

    // build-codex emits TWO kinds of dir under skills/: shipped router suites
    // (source routers minus CODEX_EXCLUDED_SUITES) AND one generated skill per
    // source agent. The gate must span that SAME universe — comparing all codex
    // dirs against a router-only expected count is why this check could never
    // match (65 vs 24) and silently passed. Exclude list + math are shared with
    // build-codex via scripts/codex-exclude.js so they can't drift (axiom-altb).
    const sourceRouterNames = fs.readdirSync(path.join(pluginDir, "skills"), { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory() && fs.existsSync(path.join(pluginDir, "skills", d.name, "SKILL.md")))
      .map((d: fs.Dirent) => d.name);
    // Count agents the way build-codex EMITS them — only those whose frontmatter
    // has both name and description (isEmittableAgent, shared with build-codex).
    // A raw .md count would include a description-less agent that build-codex skips,
    // failing a correct build. Note Phase 1 §6 only errors when BOTH are missing,
    // so it does not cover the name-only case — the gate must filter here too.
    const sourceAgentsDir = path.join(pluginDir, "agents");
    const sourceAgentCount = fs.existsSync(sourceAgentsDir)
      ? fs.readdirSync(sourceAgentsDir)
          .filter((f: string) => f.endsWith(".md"))
          .filter((f: string) =>
            isEmittableAgent(parseFrontmatter(fs.readFileSync(path.join(sourceAgentsDir, f), "utf8"))),
          ).length
      : 0;
    const shippedRouters = shippedRouterCount(sourceRouterNames);
    const expectedCount = expectedCodexSkillCount(sourceRouterNames, sourceAgentCount);

    if (codexSkillCount !== expectedCount) {
      error("codex-fidelity", `Codex has ${codexSkillCount} skills, expected ${expectedCount} (${shippedRouters} shipped routers + ${sourceAgentCount} agent-skills)`);
    } else {
      console.log(`  ✓ Codex skill count matches source (${codexSkillCount} = ${shippedRouters} routers + ${sourceAgentCount} agent-skills)`);
    }

    // Validate every skill has SKILL.md and agents/openai.yaml
    let missingSkillMd = 0;
    let missingYaml = 0;
    for (const dir of codexSkillDirs) {
      if (!fs.existsSync(path.join(codexSkillsDir, dir.name, "SKILL.md"))) missingSkillMd++;
      if (!fs.existsSync(path.join(codexSkillsDir, dir.name, "agents/openai.yaml"))) missingYaml++;
    }
    if (missingSkillMd > 0) {
      error("codex-fidelity", `${missingSkillMd} Codex skill(s) missing SKILL.md`);
    } else {
      console.log(`  ✓ All ${codexSkillCount} Codex skills have SKILL.md`);
    }
    if (missingYaml > 0) {
      error("codex-fidelity", `${missingYaml} Codex skill(s) missing agents/openai.yaml`);
    } else {
      console.log(`  ✓ All ${codexSkillCount} Codex skills have agents/openai.yaml`);
    }
  }
} catch (e: unknown) {
  const err = e as { stderr?: Buffer; stdout?: Buffer };
  error(
    "codex-build",
    `Codex build failed: ${err.stderr?.toString()?.slice(0, 200) || err.stdout?.toString()?.slice(0, 200) || "unknown error"}`,
  );
}

// Step 15: bundled Go tools (every tools/*/ Go module — currently xclog,
// xcsym, xcui, xcprof) ship as compiled binaries in bin/. Their source lives
// in tools/<name>/ as independent Go modules, discovered dynamically below.
// A regression that breaks tests but still compiles would land in the
// shipped binary without any other Phase 2 step catching it. axiom-y4z.
heading("15. Go Tool Tests (all tools/* Go modules)");
const goAvailable = (() => {
  try {
    execSync("go version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();
if (!goAvailable) {
  warn(
    "go-tests",
    "Go toolchain not found — skipping bundled-tool test step (install Go to enable this check before deploy)",
  );
} else {
  const toolsDir = path.join(root, "tools");
  // Discover modules dynamically so a future tools/* addition is picked up
  // without editing this file.
  const goModules = fs.existsSync(toolsDir)
    ? fs
        .readdirSync(toolsDir, { withFileTypes: true })
        .filter((d: fs.Dirent) => d.isDirectory())
        .map((d: fs.Dirent) => d.name)
        .filter((name: string) => fs.existsSync(path.join(toolsDir, name, "go.mod")))
    : [];
  if (goModules.length === 0) {
    warn("go-tests", "no Go modules found under tools/ — nothing to test");
  }
  for (const module of goModules) {
    const moduleDir = path.join(toolsDir, module);
    try {
      execSync("go vet ./...", { cwd: moduleDir, stdio: "pipe", timeout: 60000 });
      console.log(`  ✓ ${module}: go vet clean`);
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      const out = err.stdout?.toString() || err.stderr?.toString() || "";
      error("go-vet", `${module} go vet failed: ${out.slice(0, 300)}`);
      console.log("\n✗ Phase 2 FAILED. Fix Go tool issues before deploying.");
      process.exit(1);
    }
    try {
      execSync("go test -count=1 -timeout 15m ./...", {
        cwd: moduleDir,
        stdio: "pipe",
        // xcsym's full test suite runs ~550s. Go's default test timeout is 10m,
        // so -timeout 15m is required; the JS timeout must exceed it.
        timeout: 1000000,
      });
      console.log(`  ✓ ${module}: go test passes`);
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      const out = err.stdout?.toString() || err.stderr?.toString() || "";
      // Surface the test framework's own summary lines so the operator
      // sees which tests failed without having to re-run manually.
      const summary = out.match(/--- FAIL.*|FAIL\s+\S+.*|^\s*\S+\.go:\d+:.*$/gm);
      error(
        "go-test",
        `${module} tests failed${summary ? ":\n    " + summary.slice(0, 8).join("\n    ") : ""}`,
      );
      console.log("\n✗ Phase 2 FAILED. Fix Go tool tests before deploying.");
      process.exit(1);
    }
  }
}

heading("16. VitePress Build");
try {
  execSync("npm run docs:build", {
    cwd: root,
    stdio: "pipe",
    timeout: 120000,
  });
  console.log("  ✓ VitePress build succeeds (dead links validated)");
} catch (e: unknown) {
  const err = e as { stdout?: Buffer; stderr?: Buffer };
  const output = err.stdout?.toString() || err.stderr?.toString() || "";
  const deadLinks = output.match(/dead link.*|404.*|DEAD_LINKS.*/gim);
  error(
    "vitepress",
    `VitePress build failed${deadLinks ? ":\n    " + deadLinks.slice(0, 5).join("\n    ") : ""}`,
  );
  console.log("\n✗ Phase 2 FAILED. Fix VitePress build before deploying.");
  process.exit(1);
}

// Step 17: the axiom-pi Pi extension (commands + hooks) ships as source that
// Pi runs directly. Its pure logic has a vitest suite and it typechecks against
// the real @earendil-works/pi-coding-agent types — neither is exercised by the
// MCP/Codex steps, so wire both into the gate here (parallels step 12 for MCP).
// axiom-aofx.
heading("17. axiom-pi Extension Tests");
{
  const axiomPiDir = path.join(root, "axiom-pi");
  const fail = (check: string, label: string, output: string): never => {
    const summary = output.match(/Tests\s+\d+.*|FAIL.*|error TS\d+.*|✗.*/gm);
    // Fall back to a tail of raw output when no summary line matches (e.g. an
    // `npm ci` failure), so the operator always gets a diagnostic, not a bare line.
    const detail = summary ? summary.slice(0, 8).join("\n    ") : output.trim().slice(-300);
    error(check, `axiom-pi ${label} failed${detail ? ":\n    " + detail : ""}`);
    console.log(`\n✗ Phase 2 FAILED. Fix axiom-pi ${label} before deploying.`);
    process.exit(1);
  };
  const run = (check: string, label: string, cmd: string, timeout: number): void => {
    try {
      execSync(cmd, { cwd: axiomPiDir, stdio: "pipe", timeout });
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      fail(check, label, err.stdout?.toString() || err.stderr?.toString() || "");
    }
  };
  // Install deps when absent so a fresh CI checkout can run them (a dev tree
  // already has them, like the MCP step). The resulting axiom-pi/node_modules
  // is intentional — it's gitignored. Install/test/typecheck are reported
  // separately so a failure is attributed to the right phase, not lumped together.
  if (!fs.existsSync(path.join(axiomPiDir, "node_modules"))) {
    run("axiom-pi-install", "dependency install", "npm ci --ignore-scripts", 180000);
  }
  run("axiom-pi-tests", "tests", "npm test", 120000);
  run("axiom-pi-typecheck", "typecheck", "npm run typecheck", 120000);
  console.log("  ✓ axiom-pi tests pass + typecheck clean");
}

// ── Phase 2 Gate ──
// Phase-2 error() calls accumulate into totalErrors/errors[] but were never gated:
// the only error gate ran at the end of Phase 1 (which process.exit's before Phase 2),
// so the Final Summary printed "ALL CHECKS PASSED" even when a Phase-2 check
// (codex-fidelity, Go tests, …) failed. Gate here so any Phase-2 error blocks the
// deploy. Reaching this line means Phase 1 was clean, so totalErrors is Phase-2-only.
// axiom-altb.
if (totalErrors > 0) {
  console.log(`\n  ERRORS (${totalErrors}):`);
  for (const e of errors) console.log(e);
  console.log(
    `\n✗ Phase 2 FAILED with ${totalErrors} error(s). Fix before deploying.`,
  );
  process.exit(1);
}

// ── Final Summary ──

heading("Final Summary");
console.log(
  `  Phase 1: ✓ Static validation (${skillFilesChecked} skills, ${agentFilesChecked} agents, ${commandFilesChecked} commands)`,
);
console.log("  Phase 2: ✓ Build validation (MCP tests + bundle + Codex + Go tools + VitePress + axiom-pi)");

if (totalWarnings > 0) {
  console.log(`\n  ${totalWarnings} warning(s) — review above`);
}

console.log("\n✓ ALL CHECKS PASSED — safe to deploy\n");
