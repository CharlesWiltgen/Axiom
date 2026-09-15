/**
 * Content scan for private or identifying data in what Axiom ships.
 *
 * Why this exists: Axiom-1z8m. The identifier class leaked four separate times —
 * skill examples, xcsym/xcui fixtures, then a Cursor hook fixture carrying a real
 * session path and UUID, a committed crash fixture carrying a real app version and
 * build stamp, and all four bundled binaries embedding the maintainer's source
 * path. Not one round was caught by a gate; every one was found by a human or an
 * ad-hoc review. The existing pre-commit hooks only match file NAMES and
 * directories, so they cannot see any of it.
 *
 * What counts as "ships": the tracked plugin, its generated variants, the npm
 * bundle, the docs site, and the tool and script trees that carry fixtures. Files
 * are scanned as UTF-8; anything with a NUL in its first block is treated as a
 * binary and its printable runs are scanned instead, so bundled binaries are
 * covered by the same rules.
 *
 * Two tiers, matching the hook convention elsewhere in the repo: `error` fails the
 * gate, `warn` prints and passes. The fuzzy shapes — UUIDs, tracker-style ids —
 * warn, because legitimate placeholders and public issue references are common.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type Severity = "error" | "warn";

export interface LeakRule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  hint: string;
}

export interface LeakFinding {
  path: string;
  line: number;
  rule: string;
  severity: Severity;
  match: string;
  hint: string;
}

/** A finding this file deliberately tolerates, with the reason it is tolerated. */
export interface AllowEntry {
  /** Path substring (repo-relative, POSIX separators). */
  path: string;
  rule: string;
  /** Substring the match must contain, so an exemption cannot bless a new leak. */
  contains: string;
  reason: string;
}

const SURFACES = [
  ".claude-plugin",
  "axiom-codex",
  "axiom-cursor",
  "axiom-mcp",
  "docs",
  "tools",
  "scripts",
];

const ROOT_FILES = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "marketplace.json",
  "package.json",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".beads",
  ".superpowers",
  "venv",
  ".venv",
  "__pycache__",
  "scratch",
  "notes",
]);

/**
 * This module and its test contain the patterns themselves, so they are the one
 * legitimate place for the strings to appear. Exempting them by name is narrower
 * than weakening a pattern to avoid matching its own source.
 */
const SELF_EXEMPT = new Set(["scripts/leak-scan.ts", "scripts/leak-scan.test.ts"]);

export const RULES: LeakRule[] = [
  {
    id: "project-name",
    severity: "error",
    // The maintainer's own apps. Public libraries he also maintains (SFBAudioEngine,
    // TagLib) are legitimate references in technical content and stay out of the list.
    pattern: /\b(?:Pop{2}y|Alp{2}ca|ExampleMusicApp|ExamplePodApp|ExampleWebApp|ExampleNoteApp|ExampleTuneApp)\b/i,
    hint: "the maintainer's own project name in shipped content",
  },
  {
    id: "encoded-home-path",
    severity: "error",
    pattern: /-Users-(?!you-|me-|someone-|yourname-|example-)[A-Za-z0-9._-]+-/,
    hint: "Claude Code's encoded project path, which spells out a real home directory",
  },
  {
    id: "absolute-home-path",
    severity: "error",
    pattern: /(?:\/Users|\/home)\/(?!you\b|me\b|someone\b|yourname\b|example\b|user\b|test\b|johndoe\b|dev\b|john\b|jane\b|alice\b|bob\b|ci\b|REDACTED)[A-Za-z0-9._-]+/,
    hint: "personal home path — use /Users/you, /Users/me or another neutral placeholder",
  },
  {
    id: "claude-temp-session",
    severity: "error",
    pattern: /\/private\/tmp\/claude-[0-9]/,
    hint: "Claude Code session temp path — a real session's scratch directory",
  },
  {
    id: "timestamp-build-stamp",
    severity: "error",
    pattern: /\(20\d{10}\)/,
    hint: "build stamp shaped like a real timestamp — use an obviously synthetic value",
  },
  {
    id: "uuid-looks-real",
    severity: "warn",
    pattern: /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/,
    hint: "UUID or UDID — confirm it is a patterned placeholder",
  },
  {
    id: "issue-id",
    severity: "warn",
    // Contextual on purpose: an unanchored id pattern matches hardware and format
    // tokens (ARM-64, UTF-8) and produced hundreds of warnings nobody would read.
    // This fires where a tracker is actually being quoted, which is how the leaked
    // Sentry id appeared.
    pattern: /(?:issue_id"?\s*:\s*"?|\bsentry\b[^\n]{0,30}?)(?!ACME|EXAMPLE|TEST|DEMO|FOO|BAR)([A-Z]{2,8}-[0-9]{1,6}[A-Z]?)\b/i,
    hint: "a tracker identifier is quoted here — confirm it is a public one",
  },
];

export const ALLOW: AllowEntry[] = [
  {
    path: "scripts/cursor/fixtures/cursor-3.17.8-hook-payloads.json",
    rule: "claude-temp-session",
    contains: "-Users-someone-",
    reason:
      "the fixture must be shaped like a real session path to exercise the hook; the user and UUID segments are placeholders",
  },
];

const PLACEHOLDER_OK = /\b(?:you|me|someone|yourname|example|user|test)\b/;

function isBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8192).includes(0);
}

/** Printable runs of a binary, each with a synthetic line number. */
function printableRuns(buf: Buffer): string[] {
  return (buf.toString("latin1").match(/[\x20-\x7e]{16,}/g) ?? []).map((s) => s);
}

function walk(dir: string, root: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, root, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

/**
 * What ships = what git tracks. A build artifact sitting in tools/ (every tool
 * writes arch-specific binaries there) is not shipped, and scanning it produced
 * hundreds of meaningless matches. Falls back to a filesystem walk when git is
 * unavailable, so tests can scan a temp root.
 */
export function shippedFiles(root: string): string[] {
  let tracked: string[] | null = null;
  try {
    tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    tracked = null;
  }
  const onSurface = (rel: string): boolean =>
    ROOT_FILES.includes(rel) || SURFACES.some((s) => rel.startsWith(s + "/"));
  let files: string[];
  if (tracked) {
    files = tracked.filter(onSurface);
  } else {
    const walked: string[] = [];
    for (const surface of SURFACES) walk(path.join(root, surface), root, walked);
    for (const file of ROOT_FILES) {
      if (fs.existsSync(path.join(root, file))) walked.push(file);
    }
    files = walked;
  }
  return files.filter((rel) => !SELF_EXEMPT.has(rel)).sort();
}

function allowed(rel: string, rule: string, line: string): boolean {
  // Tested against the whole line rather than the matched token: an exemption for
  // "a placeholder user on this line" cannot be expressed as a token match.
  return ALLOW.some(
    (a) => rel.includes(a.path) && a.rule === rule && line.includes(a.contains),
  );
}


/**
 * Placeholder UUIDs are everywhere in fixtures on purpose (AAAA…, 0000…, the
 * 1A2B3C4D family). Warning about those would train the reader to ignore the tier,
 * so only unpatterned values — the shape that actually leaked — reach it.
 */
export function isObviousPlaceholderUuid(uuid: string): boolean {
  const hex = uuid.replace(/-/g, "");
  if (/([0-9A-F])\1{7}/i.test(hex)) return true;
  return /^(?:AAAA|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999|ABCD|F1E2|1A2B|A1B2|DEAD|BEEF|1234)/i.test(hex);
}

export function scanText(rel: string, text: string, rules: LeakRule[] = RULES): LeakFinding[] {
  const lines = text.split("\n");
  const findings: LeakFinding[] = [];
  for (const rule of rules) {
    for (const [i, line] of lines.entries()) {
      for (const m of line.matchAll(new RegExp(rule.pattern, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g"))) {
        const match = m[0];
        if (rule.id === "absolute-home-path" && PLACEHOLDER_OK.test(match.split("/").pop() ?? "")) continue;
        if (rule.id === "uuid-looks-real" && isObviousPlaceholderUuid(match)) continue;
        if (allowed(rel, rule.id, line)) continue;
        findings.push({
          path: rel,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          match,
          hint: rule.hint,
        });
      }
    }
  }
  return findings;
}

export function scanFile(root: string, rel: string, rules: LeakRule[] = RULES): LeakFinding[] {
  const buf = fs.readFileSync(path.join(root, rel));
  if (isBinary(buf)) {
    // Pack the printable runs into one blob so a rule that spans a run boundary
    // still matches; line numbers are meaningless for a binary, so report 0.
    return scanText(rel, printableRuns(buf).join("\n"), rules).map((f) => ({ ...f, line: 0 }));
  }
  return scanText(rel, buf.toString("utf8"), rules);
}

export function scanRepo(root: string, rules: LeakRule[] = RULES): LeakFinding[] {
  return shippedFiles(root).flatMap((rel) => scanFile(root, rel, rules));
}

export function report(findings: LeakFinding[], scannedFiles: number): string {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const lines: string[] = [];
  for (const f of [...errors, ...warns]) {
    const where = f.line > 0 ? `${f.path}:${f.line}` : `${f.path} (binary)`;
    lines.push(`  ${f.severity === "error" ? "✗" : "!"} [${f.rule}] ${where} — ${f.match}`);
    lines.push(`      ${f.hint}`);
  }
  lines.push(
    `  ${errors.length} error(s), ${warns.length} warning(s) across ${scannedFiles} shipped files`,
  );
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("leak-scan.ts")) {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
  const findings = scanRepo(root);
  console.log(report(findings, shippedFiles(root).length));
  process.exit(findings.some((f) => f.severity === "error") ? 1 : 0);
}
