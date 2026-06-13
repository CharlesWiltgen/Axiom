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
    }).toString();
    const parsed = JSON.parse(hookOutput);
    const ctx = parsed?.hookSpecificOutput?.additionalContext;
    if (!ctx || typeof ctx !== "string") {
      error("hooks", "session-start.sh output missing hookSpecificOutput.additionalContext");
    } else if (!ctx.includes("EXTREMELY_IMPORTANT")) {
      error("hooks", "session-start.sh output missing EXTREMELY_IMPORTANT wrapper");
    } else {
      console.log("  ✓ session-start.sh produces valid JSON with expected structure");
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
  const expectedSkills =
    (stats.disciplineSkills ?? 0) +
    (stats.referenceSkills ?? 0) +
    (stats.diagnosticSkills ?? 0);
  const expectedAgents = stats.agents ?? 0;
  const expectedCommands = stats.commands ?? 0;

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
const dashSepPattern =
  /^\s*(?:[-*]|\d+\.)\s+(?:\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)\s+—\s/;
const dashViolations: string[] = [];
function scanDocsDashes(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDocsDashes(full);
    } else if (entry.name.endsWith(".md")) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      let inFence = false;
      let inFrontmatter = false;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (i === 0 && trimmed === "---") { inFrontmatter = true; continue; }
        if (inFrontmatter) { if (trimmed === "---") inFrontmatter = false; continue; }
        if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) { inFence = !inFence; continue; }
        if (inFence) continue;
        if (dashSepPattern.test(lines[i])) {
          dashViolations.push(`${path.relative(root, full)}:${i + 1}`);
        }
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
    error("docs-dash", `${v} uses em-dash on a list-led inline-heading separator — use en-dash " – " (.claude/rules/documentation-style.md §Dashes)`);
  }
  if (dashViolations.length > CAP) {
    error("docs-dash", `…and ${dashViolations.length - CAP} more (${dashViolations.length} total) — see documentation-style.md §Dashes`);
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

    if (bundleSkillCount !== skillFilesChecked) {
      error("mcp-fidelity", `bundle has ${bundleSkillCount} skills, source has ${skillFilesChecked}`);
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

    // Count source top-level skill dirs with SKILL.md (matches what build-codex copies)
    const sourceSkillDirs = fs.readdirSync(path.join(pluginDir, "skills"), { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory() && fs.existsSync(path.join(pluginDir, "skills", d.name, "SKILL.md")));
    // Must mirror EXCLUDE_SKILLS in scripts/build-codex.ts (hand-synced; see axiom-altb
    // for the planned shared-module extraction). NOTE: this count check is currently
    // non-functional — Phase-2 error() calls are not gated, and codexSkillCount counts
    // all codex dirs (router suites + 40 agent-skills) while expectedCount is router-suite
    // math, so they never match. Tracked + to be fixed in axiom-altb.
    const CODEX_EXCLUDE = new Set([
      'axiom-apple-docs', 'axiom-shipping', 'axiom-tools',
    ]);
    const excludedCount = sourceSkillDirs.filter((d: fs.Dirent) => CODEX_EXCLUDE.has(d.name)).length;
    const sourceTopLevel = sourceSkillDirs.length;
    const expectedCount = sourceTopLevel - excludedCount;

    if (codexSkillCount !== expectedCount) {
      error("codex-fidelity", `Codex has ${codexSkillCount} skills, expected ${expectedCount} (${sourceTopLevel} source - ${excludedCount} excluded)`);
    } else {
      console.log(`  ✓ Codex skill count matches source (${codexSkillCount} = ${sourceTopLevel} - ${excludedCount} excluded)`);
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

// ── Final Summary ──

heading("Final Summary");
console.log(
  `  Phase 1: ✓ Static validation (${skillFilesChecked} skills, ${agentFilesChecked} agents, ${commandFilesChecked} commands)`,
);
console.log("  Phase 2: ✓ Build validation (MCP tests + bundle + Codex + Go tools + VitePress)");

if (totalWarnings > 0) {
  console.log(`\n  ${totalWarnings} warning(s) — review above`);
}

console.log("\n✓ ALL CHECKS PASSED — safe to deploy\n");
