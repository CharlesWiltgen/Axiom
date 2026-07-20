/**
 * Generate router-inlined auditor sub-skills (axiom-6gh).
 *
 *   npm run build:auditors          # write
 *   npm run build:auditors -- --check   # verify only, non-zero on drift
 *
 * Reads every agent under `.claude-plugin/plugins/axiom/agents/`, keeps the
 * pure-scan ones (tools ⊆ Glob/Grep/Read), and writes each as
 * `<router>/skills/<agent>.md` so harnesses that install via the Agent-Skills
 * spec can follow the audit procedure inline.
 *
 * Generated output is COMMITTED — same convention as `axiom-codex/`, which
 * build-codex.ts generates from this same `agents/` source. `pre-deploy.ts`
 * regenerates in memory and fails the build if a committed file drifts.
 *
 * Parsing/rendering logic lives in scripts/inline-auditors.ts (I/O free, unit
 * tested). This file is the disk layer.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { parseBodyTable } from "./audit-parity.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(root, ".claude-plugin/plugins/axiom");
const AGENTS_DIR = path.join(PLUGIN, "agents");
const SKILLS_DIR = path.join(PLUGIN, "skills");
const AUDIT_CMD = path.join(PLUGIN, "commands/audit.md");

const check = process.argv.includes("--check");

const agentContents: Record<string, string> = {};
for (const file of fs.readdirSync(AGENTS_DIR)) {
  if (!file.endsWith(".md")) continue;
  agentContents[file.replace(/\.md$/, "")] = fs.readFileSync(
    path.join(AGENTS_DIR, file),
    "utf8",
  );
}

// A new auditor with no home would be silently unreachable on 44 of 45
// harnesses — the exact bug this mechanism exists to fix. Fail loudly.
const coverageErrors = validateHomeCoverage(agentContents);
if (coverageErrors.length > 0) {
  for (const msg of coverageErrors) console.error(`  ✗ ${msg}`);
  process.exit(1);
}

// The `/axiom:audit <area>` names come from the canonical table in
// commands/audit.md — deriving them from the agent filename produced five
// commands that do not exist.
const auditAreas = auditAreaByAgent(parseBodyTable(fs.readFileSync(AUDIT_CMD, "utf8")));

/** Every suite's files, so references can be derived instead of hand-listed. */
function readSuites(): {
  contents: Record<string, string[]>;
  generatedOnDisk: Array<{ suite: string; file: string; content: string }>;
} {
  const contents: Record<string, string[]> = {};
  const generatedOnDisk: Array<{ suite: string; file: string; content: string }> = [];
  for (const suite of fs.readdirSync(SKILLS_DIR)) {
    const suiteDir = path.join(SKILLS_DIR, suite);
    if (!fs.statSync(suiteDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    const files: string[] = [];
    const skillMd = path.join(suiteDir, "SKILL.md");
    if (fs.existsSync(skillMd)) files.push(fs.readFileSync(skillMd, "utf8"));
    const subDir = path.join(suiteDir, "skills");
    if (fs.existsSync(subDir)) {
      for (const f of fs.readdirSync(subDir)) {
        if (!f.endsWith(".md")) continue;
        const content = fs.readFileSync(path.join(subDir, f), "utf8");
        files.push(content);
        if (isGeneratedSubSkill(content)) {
          generatedOnDisk.push({ suite, file: f, content });
        }
      }
    }
    contents[suite] = files;
  }
  return { contents, generatedOnDisk };
}

const { contents: suiteContents, generatedOnDisk } = readSuites();

// --- Generated auditor files ---
const expected: Record<string, string> = {};
for (const agentName of Object.keys(AUDITOR_HOMES)) {
  const content = agentContents[agentName];
  if (!content || !isScanAgent(content)) continue;
  expected[agentName] = renderInlinedAuditor(agentName, content, auditAreas);
}

// Keyed by the agent named in each file's own marker, NOT by AUDITOR_HOMES —
// otherwise `actual` ⊆ `expected` by construction and an orphaned file left
// behind by a renamed agent could never be detected.
const actual: Record<string, string> = {};
const unattributable: string[] = [];
for (const { suite, file, content } of generatedOnDisk) {
  const source = generatedSourceAgent(content);
  if (!source) {
    unattributable.push(`${suite}/skills/${file}`);
    continue;
  }
  actual[source] = content;
}

const stale: string[] = [];
let written = 0;
let unchanged = 0;

for (const agentName of Object.keys(expected).sort()) {
  const rel = `${AUDITOR_HOMES[agentName]}/skills/${agentName}.md`;
  const dest = path.join(SKILLS_DIR, rel);
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
  if (existing === expected[agentName]) {
    unchanged++;
    continue;
  }
  if (check) {
    stale.push(rel);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, expected[agentName]);
  written++;
}

// Orphans: a generated file whose source agent no longer qualifies. Reported in
// both modes — writing fresh files does not remove a stale one.
const orphanErrors = findInlineDrift({ expected, actual }).filter((e) =>
  e.includes("orphaned"),
);
for (const rel of unattributable) {
  orphanErrors.push(`${rel} carries a GENERATED marker naming no readable source agent`);
}

// --- Harness-awareness note in each affected router ---
const noteTargets = routerNoteTargets(deriveSuiteReferences(suiteContents));
let routersWritten = 0;
let routersUnchanged = 0;
const expectedNotes: Record<string, string> = {};
const actualNotes: Record<string, string> = {};

for (const suite of Object.keys(suiteContents).sort()) {
  const routerPath = path.join(SKILLS_DIR, suite, "SKILL.md");
  if (!fs.existsSync(routerPath)) continue;
  const current = fs.readFileSync(routerPath, "utf8");
  actualNotes[suite] = current;
  const target = noteTargets[suite];
  if (!target) continue;
  const updated = upsertRouterNote(current, renderRouterNote(target));
  expectedNotes[suite] = updated;
  if (updated === current) {
    routersUnchanged++;
    continue;
  }
  if (check) {
    stale.push(`${suite}/SKILL.md (harness-awareness note)`);
    continue;
  }
  fs.writeFileSync(routerPath, updated);
  routersWritten++;
}

const noteErrors = findRouterNoteDrift(expectedNotes, actualNotes).filter((e) =>
  e.includes("no longer references"),
);

const hardErrors = [...orphanErrors, ...noteErrors];
if (hardErrors.length > 0) {
  for (const msg of hardErrors) console.error(`  ✗ ${msg}`);
  process.exit(1);
}

if (check) {
  if (stale.length > 0) {
    console.error(
      `✗ ${stale.length} inlined auditor artifact(s) stale or missing — run \`npm run build:auditors\`:`,
    );
    for (const rel of stale) console.error(`    ${rel}`);
    process.exit(1);
  }
  console.log(
    `✓ inlined auditors up to date (${unchanged} files, ${routersUnchanged} router notes)`,
  );
} else {
  console.log(
    `inlined auditors built: ${written} written, ${unchanged} unchanged (${Object.keys(expected).length} mapped); ` +
      `router notes: ${routersWritten} written, ${routersUnchanged} unchanged`,
  );
}
