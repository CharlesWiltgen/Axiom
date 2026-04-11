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
let skillFilesChecked = 0;
let skillContentCount = 0; // Content units: standalone SKILL.md + references/*.md in skill suites

function checkSkillsIn(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) continue;

    const skillFile = path.join(fullPath, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      skillFilesChecked++;

      // Count content units: suites count references/, standalone count SKILL.md
      const refsDir = path.join(fullPath, "references");
      if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
        skillContentCount += fs.readdirSync(refsDir).filter((f: string) => f.endsWith(".md")).length;
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

heading("6. Agent Integrity");

const agentsDir = path.join(pluginDir, "agents");
let agentFilesChecked = 0;
const allAgentNames = new Set<string>();

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
  }
  console.log(`  ✓ ${agentFilesChecked} agent files checked`);
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
  const vMatch = configContent.match(/• v(\d+\.\d+\.\d+)/);
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

heading("10. Router Cross-References");

let crossRefChecked = 0;
let brokenRefs = 0;

const routerSkillNames = (claudeCode?.skills || []).map((s) => s.name);
for (const routerName of routerSkillNames) {
  const routerPath = path.join(pluginDir, "skills", routerName, "SKILL.md");
  if (!fs.existsSync(routerPath)) continue;

  const content = fs.readFileSync(routerPath, "utf8");
  const refs = content.matchAll(/\/skill (axiom-[\w-]+)/g);

  for (const ref of refs) {
    crossRefChecked++;
    const targetName = ref[1];
    if (!allSkillNames.has(targetName)) {
      error(
        "cross-ref",
        `Router "${routerName}" references non-existent skill "${targetName}"`,
      );
      brokenRefs++;
    }
  }
}

if (brokenRefs === 0) {
  console.log(
    `  ✓ ${crossRefChecked} cross-references validated across ${routerSkillNames.length} routers`,
  );
}

// Reverse check: every agent should be referenced by at least one router
const agentsExemptFromRouting = new Set(["health-check"]);
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

// ── 12. MCP Bundle Staleness ──

heading("12. MCP Bundle Staleness");

const bundlePath = path.join(root, "axiom-mcp/dist/bundle.json");
if (fs.existsSync(bundlePath)) {
  const bundleMtime = fs.statSync(bundlePath).mtimeMs;

  // Find the newest skill, agent, or command file
  let newestSource = 0;
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
        else if (entry.name.endsWith(".md")) {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > newestSource) newestSource = mtime;
        }
      }
    };
    walk(dir);
  }

  // Also check skill-annotations.json
  const annotationsPath = path.join(root, "axiom-mcp/skill-annotations.json");
  if (fs.existsSync(annotationsPath)) {
    const annotMtime = fs.statSync(annotationsPath).mtimeMs;
    if (annotMtime > newestSource) newestSource = annotMtime;
  }

  if (newestSource > bundleMtime) {
    const staleMinutes = Math.round((newestSource - bundleMtime) / 60000);
    error(
      "bundle-staleness",
      `MCP bundle is ${staleMinutes}min older than newest source file. Run: cd axiom-mcp && pnpm run build:bundle`,
    );
  } else {
    console.log("  ✓ MCP bundle is up-to-date with source files");
  }
} else {
  warn("bundle-staleness", "MCP bundle not found at axiom-mcp/dist/bundle.json — build with: cd axiom-mcp && pnpm run build:bundle");
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
    const CODEX_EXCLUDE = new Set([
      'axiom-ios-build', 'axiom-ios-testing', 'axiom-ios-data',
      'axiom-ios-concurrency', 'axiom-ios-performance', 'axiom-ios-networking',
      'axiom-ios-integration', 'axiom-ios-accessibility', 'axiom-ios-ai',
      'axiom-ios-ml', 'axiom-ios-vision', 'axiom-ios-graphics', 'axiom-ios-games',
      'axiom-apple-docs', 'axiom-xcode-mcp', 'axiom-shipping', 'axiom-using-axiom',
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

heading("15. VitePress Build");
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
console.log("  Phase 2: ✓ Build validation (MCP tests + bundle + Codex + VitePress)");

if (totalWarnings > 0) {
  console.log(`\n  ${totalWarnings} warning(s) — review above`);
}

console.log("\n✓ ALL CHECKS PASSED — safe to deploy\n");
