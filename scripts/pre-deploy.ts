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
  parseDocAreas,
  parseSidebarAreas,
  parseSidebarGroups,
  parseDocGroups,
  validateParity,
  validateGroupedParity,
  parseInlineAuditReferences,
  validateInlineReferences,
  validateAgentDescriptionParity,
  AGENT_FRONTMATTER_KEYS,
} from "./audit-parity.ts";
import {
  checkSkillInvocations,
  findSkillNameCollisions,
} from "./skill-invocations.ts";
import { parsePorcelain, resolveStaleness } from "./staleness.ts";
import { findDashViolations } from "./docs-dashes.ts";

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
        const childMds = fs.readdirSync(refsDir).filter((f: string) => f.endsWith(".md"));
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

  const frontmatter = parseFrontmatterAreas(cmdContent);
  const bodyRows = parseBodyTable(cmdContent);
  const body = bodyRows.map((r) => r.area);
  const docAreas = parseDocAreas(docContent);
  const sidebar = parseSidebarAreas(cfgContent);

  const parityErrors = validateParity({
    frontmatter,
    body,
    docs: docAreas,
    sidebar,
  });
  for (const msg of parityErrors) error("audit-parity", msg);

  // Grouped parity: enforce same group names, same group order, same
  // items per group, same item order. Catches drifts that set parity
  // doesn't (e.g. axiom-imz: 27=27 set parity but 5-vs-8 group counts).
  const sidebarGroups = parseSidebarGroups(cfgContent);
  const docGroups = parseDocGroups(docContent);
  const groupedErrors = validateGroupedParity(sidebarGroups, docGroups);
  for (const msg of groupedErrors) error("audit-parity", `(grouped) ${msg}`);

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

  if (
    parityErrors.length === 0 &&
    groupedErrors.length === 0 &&
    missingAgents === 0 &&
    inlineDrifts === 0 &&
    agentDescErrors.length === 0
  ) {
    console.log(
      `  ✓ ${frontmatter.length} audit areas in sync across frontmatter, body table, docs page, sidebar ` +
        `(${sidebarGroups.length} groups, same order; ${bodyRows.length} agent refs resolve; ` +
        `${inlineSections.length} prose sections + ${bodyRows.length} agent descriptions verified)`,
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
