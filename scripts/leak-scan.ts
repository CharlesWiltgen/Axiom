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

interface Surface {
  path: string;
  /**
   * `true` = only files git tracks. `false` = whatever is on disk, which is what
   * npm publishes for the MCP bundle: axiom-mcp/package.json ships `dist/`, and
   * everything in it except two JSON files is gitignored, so a tracked-only scan
   * never sees the JavaScript that actually gets published.
   */
  trackedOnly: boolean;
}

export const SURFACES: Surface[] = [
  { path: ".claude-plugin", trackedOnly: true },
  { path: ".cursor-plugin", trackedOnly: true },
  { path: ".agents", trackedOnly: true },
  { path: "axiom-codex", trackedOnly: true },
  { path: "axiom-cursor", trackedOnly: true },
  { path: "axiom-pi", trackedOnly: true },
  // BOTH entries are needed, and they cannot be collapsed into one.
  // `axiom-mcp` (tracked) covers src/, package.json, README.md and LICENSE — the
  // last two are published to npm. `axiom-mcp/dist` (disk) covers the build output
  // that npm actually ships and that git ignores.
  // An earlier revision replaced the first with the second, because a tracked-only
  // scan of `axiom-mcp` saw 2 of its 40 files and looked useless. That reasoning was
  // right about the problem and wrong about the fix: it left 38 tracked files in no
  // surface at all, and nothing noticed because a shrunken surface reads as clean.
  { path: "axiom-mcp", trackedOnly: true },
  { path: "axiom-mcp/dist", trackedOnly: false },
  { path: "docs", trackedOnly: true },
  { path: "tools", trackedOnly: true },
  { path: "scripts", trackedOnly: true },
];

/**
 * Root files are read from disk, not from the index: CHANGELOG.md is gitignored
 * here yet is rendered into the published site, so "tracked" is the wrong test
 * for them.
 */
const ROOT_FILES = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "marketplace.json",
  "package.json",
  "package-lock.json",
  "MARKETPLACE-SUBMISSION.md",
  "CURSOR-MARKETPLACE-SUBMISSION.md",
  "SUBMISSION-STATUS.md",
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
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    hint: "UUID or UDID — confirm it is a patterned placeholder",
  },
  {
    id: "issue-id",
    severity: "warn",
    // Contextual on purpose: an unanchored id pattern matches hardware and format
    // tokens (ARM-64, UTF-8) and produced hundreds of warnings nobody would read.
    // This fires where a tracker is actually being quoted, which is how the leaked
    // Sentry id appeared.
    pattern: /(?:issue_id"?\s*:\s*"?|\bsentry\b[^\n]{0,30}?)([A-Z]{2,8}-[0-9]{1,6}[A-Z]?)\b/i,
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
  {
    path: "tools/xcsym/normalized_test.go",
    rule: "issue-id",
    contains: "APP-3V",
    reason: "a fixture id the decoder test round-trips; not a tracker reference",
  },
  {
    path: "tools/xcsym/cmd_triage_test.go",
    rule: "issue-id",
    contains: "APP-3V",
    reason: "fixture id for the noise case the triage test asserts is deprioritised",
  },
  {
    path: "tools/xcsym/cmd_triage_test.go",
    rule: "issue-id",
    contains: "REAL-1",
    reason: "fixture id for the genuine-crash case, named to contrast with the noise fixture above",
  },
];

const PLACEHOLDER_OK = /\b(?:you|me|someone|yourname|example|user|test)\b/;

function isBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8192).includes(0);
}

/** Printable runs of a binary, each with a synthetic line number. */
function printableRuns(buf: Buffer): string[] {
  return (buf.toString("latin1").match(/[\x20-\x7e]{8,}/g) ?? []).map((s) => s);
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

function gitText(root: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function gitBuffer(root: string, args: string[]): Buffer | null {
  try {
    // stderr is discarded on purpose: asking git for the staged blob of a file
    // that ships from disk rather than the index (the published dist/ files) is
    // an expected miss, not something to print on every gate run.
    return execFileSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** A scan that finds almost nothing is broken, not clean. */
export const MIN_PLAUSIBLE_FILES = 200;

/**
 * What ships. Tracked files for the source surfaces, disk for the ones npm
 * publishes out of gitignored build output, and disk for root files (CHANGELOG.md
 * is gitignored yet rendered into the published site). Falls back to a filesystem
 * walk when git is unavailable, which is how tests scan a temp root.
 */
export function shippedFiles(root: string): string[] {
  const ls = gitText(root, ["ls-files"]);
  const tracked = ls ? new Set(ls.split("\n").filter(Boolean)) : null;
  const found: string[] = [];
  for (const surface of SURFACES) {
    if (surface.trackedOnly && tracked) {
      for (const rel of tracked) if (rel.startsWith(surface.path + "/")) found.push(rel);
    } else {
      walk(path.join(root, surface.path), root, found);
    }
  }
  for (const file of ROOT_FILES) {
    if (fs.existsSync(path.join(root, file))) found.push(file);
  }
  return [...new Set(found)].filter((rel) => !SELF_EXEMPT.has(rel)).sort();
}

/**
 * The content a commit would ship. The staged blob wins over the working tree:
 * stage a leaking revision, restore the clean one on disk, and a working-tree
 * scan reports clean while the commit ships the leak.
 */
function readShipped(root: string, rel: string): Buffer | null {
  const staged = gitBuffer(root, ["show", `:${rel}`]);
  if (staged && staged.length > 0) return staged;
  try {
    return fs.readFileSync(path.join(root, rel));
  } catch {
    return null;
  }
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
  const hex = uuid.replace(/-/g, "").toLowerCase();

  // RFC 4122 §4.4's canonical example. The most recognisable placeholder UUID
  // there is, and it ships in storekit-ref.md — so it warned on every run.
  if (hex === "550e8400e29b41d4a716446655440000") return true;

  // Eight of the same character: AAAAAAAA-…, 99999999-…
  if (/([0-9a-f])\1{7}/.test(hex)) return true;

  // Every character doubled: AABBCCDD-EEFF-0011-2233-445566778899. That is the
  // shape a person types when writing a fixture, and not one a generator produces
  // — the genuine UUIDs this repo ships (v3/v4/v5 dylib identifiers in the xcprof
  // and xcsym fixtures) fail it on their first pair. Verified against all 13
  // distinct values the tree produces: the three doubled shapes suppress, the
  // seven real ones do not.
  if (hex.length % 2 === 0) {
    let doubled = true;
    for (let i = 0; i < hex.length; i += 2) {
      if (hex[i] !== hex[i + 1]) {
        doubled = false;
        break;
      }
    }
    if (doubled) return true;
  }

  return /^(?:aaaa|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999|abcd|f1e2|1a2b|a1b2|dead|beef|1234)/.test(hex);
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
        // Test the CAPTURED id, not m[0]. m[0] carries the `issue_id": "` prefix or
        // the sentry URL, so an anchored id pattern tested against it can never
        // match — which made this guard dead code, and warned on the ACME-*/ASC-*
        // placeholders it exists for. Executed proof: m[0] → false, m[1] → true.
        if (rule.id === "issue-id" && /^(?:ACME|EXAMPLE|TEST|DEMO|FOO|BAR|ASC)-/i.test(m[1] ?? match)) continue;
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
  const buf = readShipped(root, rel);
  if (!buf) return [];
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
  // import.meta.dirname, not new URL(import.meta.url).pathname. The latter keeps
  // URL percent-encoding, so a checkout under a path containing a space resolved
  // to a directory that does not exist: every surface walked to nothing, and the
  // MIN_PLAUSIBLE_FILES guard then blocked EVERY commit with a diagnosis naming
  // the wrong cause. Every other script here uses import.meta.dirname or
  // fileURLToPath; this was the only site with the lossy idiom.
  const root = path.resolve(import.meta.dirname, "..");
  const files = shippedFiles(root);
  if (files.length < MIN_PLAUSIBLE_FILES) {
    console.error(
      `  ✗ only ${files.length} shipped files found — the scan is broken, not clean`,
    );
    process.exit(1);
  }
  const findings = scanRepo(root);
  console.log(report(findings, files.length));
  process.exit(findings.some((f) => f.severity === "error") ? 1 : 0);
}
