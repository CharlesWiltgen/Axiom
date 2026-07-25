/**
 * Generate the /axiom:audit area surfaces from scripts/audit-areas.json.
 *
 *   npm run build:audit-areas            # write
 *   npm run build:audit-areas -- --check # verify only, non-zero on drift
 *
 * Three regions, each delimited by BEGIN/END markers so the surrounding
 * hand-authored prose is untouched:
 *
 *   commands/audit.md          `argument:` line  (hash markers, in frontmatter)
 *   commands/audit.md          body table        (html markers)
 *   docs/commands/utility/audit.md  grouped tables (html markers)
 *
 * The docs sidebar is NOT generated: each of its groups interleaves audit
 * entries with unrelated commands, so the audit rows are not a spliceable
 * region. It stays hand-maintained and is checked against the registry by
 * validateSidebarAgainstRegistry in pre-deploy.
 *
 * Generated output is COMMITTED — same convention as axiom-codex/ and the
 * inlined auditors. pre-deploy.ts runs this in --check mode and fails the
 * build if a committed file has drifted from the registry.
 *
 * Rendering logic lives in scripts/audit-areas.ts (I/O free, unit tested).
 * This file is the disk layer.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MARKERS,
  renderArgumentList,
  renderBodyTable,
  renderDocsTables,
  spliceRegion,
  validateRegistry,
  type AuditRegistry,
} from "./audit-areas.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(root, ".claude-plugin/plugins/axiom");

const check = process.argv.includes("--check");

const registryPath = path.join(root, "scripts/audit-areas.json");
const registry: AuditRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const registryErrors = validateRegistry(registry);
if (registryErrors.length > 0) {
  console.error("audit-areas.json is invalid:");
  for (const e of registryErrors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

interface Target {
  file: string;
  marker: string;
  style: "html" | "line" | "hash";
  render: () => string;
  label: string;
}

const targets: Target[] = [
  {
    file: path.join(PLUGIN, "commands/audit.md"),
    marker: MARKERS.argument,
    style: "hash",
    render: () => renderArgumentList(registry),
    label: "commands/audit.md argument: line",
  },
  {
    file: path.join(PLUGIN, "commands/audit.md"),
    marker: MARKERS.bodyTable,
    style: "html",
    render: () => renderBodyTable(registry),
    label: "commands/audit.md body table",
  },
  {
    file: path.join(root, "docs/commands/utility/audit.md"),
    marker: MARKERS.docsTable,
    style: "html",
    render: () => renderDocsTables(registry),
    label: "docs/commands/utility/audit.md grouped tables",
  },
];

let written = 0;
let unchanged = 0;
const drift: string[] = [];
const errors: string[] = [];

// Group by file so two regions in one file compose rather than clobber.
const byFile = new Map<string, Target[]>();
for (const t of targets) {
  const list = byFile.get(t.file) ?? [];
  list.push(t);
  byFile.set(t.file, list);
}

for (const [file, fileTargets] of byFile) {
  if (!fs.existsSync(file)) {
    errors.push(`${path.relative(root, file)} not found`);
    continue;
  }
  const original = fs.readFileSync(file, "utf8");
  let content = original;

  for (const t of fileTargets) {
    const next = spliceRegion(content, t.marker, t.render(), t.style);
    if (next === null) {
      errors.push(
        `${t.label}: markers ${t.marker}_BEGIN / ${t.marker}_END not found or malformed`,
      );
      continue;
    }
    content = next;
  }

  if (content === original) {
    unchanged += fileTargets.length;
    continue;
  }
  if (check) {
    drift.push(path.relative(root, file));
  } else {
    fs.writeFileSync(file, content);
    written += fileTargets.length;
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

if (check) {
  if (drift.length > 0) {
    console.error(
      `audit-area surfaces are stale relative to scripts/audit-areas.json: ${drift.join(", ")}`,
    );
    console.error("  Run: npm run build:audit-areas");
    process.exit(1);
  }
  console.log(
    `audit areas: ${registry.areas.length} areas across ${registry.groupOrder.length} groups; all 3 surfaces up to date`,
  );
} else {
  console.log(
    `audit areas: ${registry.areas.length} areas across ${registry.groupOrder.length} groups; ${written} region(s) written, ${unchanged} unchanged`,
  );
}
