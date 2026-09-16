import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { type LeakRule, ROOT_FILES, RULES, SELF_EXEMPT, SURFACES, isObviousPlaceholderUuid, scanRepo, shippedFiles } from "./leak-scan.ts";

/**
 * The engine is tested with its own rules, not the shipped list. Two reasons: a
 * test may not assert on private values (they are exactly what the scanner looks
 * for), and the shipped list is data that changes without the engine changing.
 * The shipped list gets its own structural test below.
 */
const TEST_RULES: LeakRule[] = [
  {
    id: "project-name",
    severity: "error",
    pattern: /\b(?:AcmeWidge|ZetaGadget)\b/i,
    hint: "an owner's project name",
  },
  {
    id: "absolute-home-path",
    severity: "error",
    pattern: /(?:\/Users|\/home)\/(?!you\b|me\b|someone\b|yourname\b|example\b)[A-Za-z0-9._-]+/,
    hint: "a personal home path",
  },
  {
    id: "encoded-home-path",
    severity: "error",
    pattern: /-Users-(?!someone-|you-)[A-Za-z0-9._-]+-/,
    hint: "an encoded project path",
  },
  {
    id: "claude-temp-session",
    severity: "error",
    pattern: /\/private\/tmp\/claude-[0-9]/,
    hint: "a session temp path",
  },
  {
    id: "timestamp-build-stamp",
    severity: "error",
    pattern: /\(20\d{10}\)/,
    hint: "a timestamp-shaped build stamp",
  },
  {
    id: "uuid-looks-real",
    severity: "warn",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    hint: "a UUID or UDID",
  },
  {
    // Mirrors the shipped pattern. The suppression logic is keyed on the rule id,
    // so a rule with a different id would not exercise it.
    id: "issue-id",
    severity: "warn",
    pattern: /(?:issue_id"?\s*:\s*"?|\bsentry\b[^\n]{0,30}?)([A-Z]{2,8}-[0-9]{1,6}[A-Z]?)\b/i,
    hint: "a tracker identifier is quoted here",
  },
];

function fixture(rel: string, content: string): { root: string; file: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leak-scan-"));
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return { root, file };
}

const SKILL = ".claude-plugin/plugins/axiom/skills/axiom-example/SKILL.md";
const scan = (root: string) => scanRepo(root, TEST_RULES);

/**
 * A well-formed UUID the suppressor must NOT recognize, assembled from parts.
 *
 * No unpatterned UUID literal belongs in this file: it is shipped content and the
 * scanner reads it like any other, so a literal here becomes a value the gate has
 * to carry — and a real one from a fixture becomes a value it has to exempt. The
 * test only needs the SHAPE to be well-formed; a captured value buys nothing the
 * shape does not.
 */
const unpatternedUuid = (...parts: string[]): string => parts.join("-");

test("flags an owner's project name in shipped content, with its line", () => {
  const { root } = fixture(SKILL, "---\nname: x\n---\nScreenshotted from the ZetaGadget build.\n");
  const findings = scan(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, "project-name");
  assert.equal(findings[0]!.severity, "error");
  assert.equal(findings[0]!.line, 4, "line numbers must point at the offending line");
});

test("flags personal home paths but not the placeholders the corpus uses", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    'let a = "/Users/you/Library/Application Support/MyApp";',
    'let b = "/Users/me/Crashes/Points/ABC.xccrashpoint";',
    'let c = "/Users/someone/Library/Logs";',
    'let d = "/Users/nonplaceholder/Library/Application Support/MyApp";',
  ].join("\n") + "\n");
  const hits = scan(root).filter((f) => f.rule === "absolute-home-path");
  assert.deepEqual(hits.map((f) => f.match), ["/Users/nonplaceholder"]);
});

test("flags an encoded project path that spells out a home directory", () => {
  const { root } = fixture(SKILL, 'cwd: "/private/placeholder/-Users-nonplaceholder-Projects-Example/scratchpad"\n');
  const hits = scan(root).filter((f) => f.rule === "encoded-home-path");
  assert.equal(hits.length, 1);
  assert.ok(hits[0]!.match.startsWith("-Users-"));
});

test("flags session temp paths and timestamp-shaped build stamps", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    "Version:             1.2.3 (202601011234)",
    "Version:             1.0.0 (1000000000)",
    'cwd: "/private/tmp/claude-501/session/scratchpad"',
  ].join("\n") + "\n");
  assert.deepEqual(scan(root).map((f) => f.rule).sort(), ["claude-temp-session", "timestamp-build-stamp"]);
});

test("warns on UUID shapes without failing the gate", () => {
  const uuid = unpatternedUuid("0f3a1c9e", "5b2d", "4e77", "9a10", "c4b8e6d21f03");
  const { root } = fixture(SKILL, `---\nname: x\n---\n--device ${uuid}\n`);
  const findings = scan(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.severity, "warn");
});

test("scans printable runs inside a binary, where a source path once shipped", () => {
  const { root } = fixture(".claude-plugin/plugins/axiom/bin/tool", "");
  fs.writeFileSync(
    path.join(root, ".claude-plugin/plugins/axiom/bin/tool"),
    Buffer.concat([
      Buffer.from([0x00, 0x01, 0x02]),
      Buffer.from("/Users/nonplaceholder/Projects/Axiom/tools/tool/main.go", "utf8"),
      Buffer.from([0x00]),
    ]),
  );
  const findings = scan(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.path, ".claude-plugin/plugins/axiom/bin/tool");
  assert.equal(findings[0]!.line, 0, "binaries report no line number");
});

test("shippedFiles covers the surfaces that ship and skips dev state", () => {
  const { root } = fixture(SKILL, "---\nname: x\n---\nclean\n");
  fs.mkdirSync(path.join(root, "scratch"), { recursive: true });
  fs.writeFileSync(path.join(root, "scratch/ZetaGadget-notes.md"), "ZetaGadget\n");
  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(root, ".claude/CLAUDE.md"), "ZetaGadget\n");
  fs.writeFileSync(path.join(root, "README.md"), "# Axiom\n");
  const files = shippedFiles(root);
  assert.ok(files.includes(SKILL));
  assert.ok(files.includes("README.md"));
  assert.ok(!files.some((f) => f.startsWith("scratch/")), "scratch is gitignored dev state");
  assert.ok(!files.some((f) => f.startsWith(".claude/")), ".claude is gitignored dev state");
  assert.deepEqual(scan(root), []);
});

test("the shipped rule list keeps the coverage the gate depends on", () => {
  // Structural, not value-based: the private values themselves must not appear in
  // a test file. Each rule id here is a class that has actually leaked.
  const ids = RULES.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "absolute-home-path",
    "claude-temp-session",
    "encoded-home-path",
    "issue-id",
    "project-name",
    "timestamp-build-stamp",
    "uuid-looks-real",
  ]);
  assert.equal(RULES.filter((r) => r.severity === "error").length, 5, "five classes fail the gate");
  for (const rule of RULES) {
    assert.ok(rule.pattern instanceof RegExp, `${rule.id}: pattern must be a RegExp`);
    assert.ok(rule.hint.length > 10, `${rule.id}: hint must explain the fix`);
  }
});

test("every surface resolves to files, and the shipped anchors are scanned", () => {
  // Structural, against the real checkout — the counterpart to the rules test
  // above. MIN_PLAUSIBLE_FILES is one global floor, so a surface that shrinks to
  // nothing is invisible to the scan itself: it walks the path, finds no files,
  // and the run still reports "no private data". That is exactly how 38 tracked
  // files under axiom-mcp left every surface without anything noticing.
  const root = path.resolve(import.meta.dirname, "..");
  const files = new Set(shippedFiles(root));

  for (const surface of SURFACES) {
    const hits = [...files].filter(
      (f) => f === surface.path || f.startsWith(surface.path + "/"),
    );
    assert.ok(
      hits.length > 0,
      `surface "${surface.path}" (trackedOnly: ${surface.trackedOnly}) resolves to no files — ` +
        `the scan is blind there and will report clean`,
    );
  }

  // Anchors: paths whose disappearance from the scanned set has happened, or
  // whose contents make them the reason this gate exists. A surface-wide count
  // cannot notice a single dropped prefix; these can.
  for (const anchor of [
    "axiom-mcp/src/index.ts", // the MCP server entry point
    "axiom-mcp/package.json",
    "axiom-mcp/README.md", // published to npm
    "axiom-mcp/LICENSE", // published to npm
    ".claude-plugin/plugins/axiom/claude-code.json",
    "docs/index.md",
    "tools/xcsym/main.go",
    // Not scripts/leak-scan.ts — that path is deliberately SELF_EXEMPT, since the
    // scanner's own source contains the patterns it searches for.
    "scripts/pre-deploy.ts",
  ]) {
    assert.ok(files.has(anchor), `${anchor} is not scanned — it is in no surface`);
  }
});

// ── The warn tier's suppressions ──────────────────────────────────────────────
// These existed but were never exercised, which is how two of them silently
// stopped working: a test that asserts rule PRESENCE cannot tell that a
// suppression no longer suppresses anything.

test("placeholder UUID shapes are suppressed and real ones are not", () => {
  const placeholder = [
    "AABBCCDD-EEFF-0011-2233-445566778899", // every character doubled
    "11223344-5566-7788-99AA-BBCCDDEEFF00", // every character doubled
    "11111111-2222-3333-4444-555555555555", // eight of a kind
    "550e8400-e29b-41d4-a716-446655440000", // RFC 4122 §4.4's canonical example
    "4C4C44EF-5555-3144-A1B5-0562264D518F", // the 4C4C44 toolchain marker
    "4c4c44ef55553144a1b50562264d518f",     // same value, unpunctuated and lowercased
  ];
  const real = [
    // Built from parts — see unpatternedUuid. These must stay unpatterned so the
    // assertion below keeps testing the suppressor rather than a spelling.
    unpatternedUuid("0f3a1c9e", "5b2d", "4e77", "9a10", "c4b8e6d21f03"),
    unpatternedUuid("7d5e2b94", "a1c3", "3f88", "b2d4", "0e6f9a1c3b57"),
    unpatternedUuid("b91f4d02", "6c58", "3a1e", "8f27", "d5c0e39b7a46"),
  ];
  for (const uuid of placeholder) {
    assert.ok(isObviousPlaceholderUuid(uuid), `${uuid} is a typed-placeholder shape`);
  }
  for (const uuid of real) {
    assert.ok(!isObviousPlaceholderUuid(uuid), `${uuid} must keep warning`);
  }
});

test("a doubled-character UUID in content produces no finding", () => {
  const { root } = fixture(SKILL, "---\nname: x\n---\n--device AABBCCDD-EEFF-0011-2233-445566778899\n");
  assert.deepEqual(scan(root), [], "the tier is only useful if its placeholders stay quiet");
});

test("a placeholder tracker id is suppressed, but a quoted id is not", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    '{"provider":"sentry","issue_id":"ACME-3V","kind":"hang"}',
    '{"provider":"sentry","issue_id":"AB-1234","kind":"hang"}',
  ].join("\n") + "\n");
  const hits = scan(root).filter((f) => f.rule === "issue-id");
  // The suppression tests the CAPTURED id. Testing m[0] instead — which carries the
  // `issue_id": "` prefix — can never match an anchored id pattern, and made the
  // guard dead code.
  assert.equal(hits.length, 1, "only the unlisted id should warn");
  assert.ok(hits[0]!.match.includes("AB-1234"));
});

test("no script derives its root from a percent-encoded URL pathname", () => {
  // new URL(import.meta.url).pathname keeps URL percent-encoding, so a checkout
  // under a path containing a space resolves to a directory that does not exist.
  // In the CLI that meant every surface walked to nothing and the
  // MIN_PLAUSIBLE_FILES guard blocked every commit, naming the wrong cause.
  // import.meta.dirname and fileURLToPath both decode correctly; this is a lint
  // so the lossy idiom cannot come back in a new script.
  const dir = path.join(path.resolve(import.meta.dirname, ".."), "scripts");
  const scripts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const offenders = scripts.filter((f) =>
    fs
      .readFileSync(path.join(dir, f), "utf8")
      .split("\n")
      // Skip comment lines: the fix's own explanatory comment names the idiom,
      // and a lint that trips on its own documentation is not a lint.
      .some(
        (line) =>
          line.includes("new URL(import.meta.url).pathname") &&
          !line.trimStart().startsWith("//") &&
          !line.trimStart().startsWith("*"),
      ),
  );
  assert.deepEqual(offenders, [], "use import.meta.dirname or fileURLToPath instead");
});

test("the CI paths filter covers every surface the scan reads", () => {
  // The filter decides whether CI runs at all. A surface the scanner reads but the
  // filter omits means a PR that leaks into that surface starts no job — which is
  // the fresh-clone / --no-verify case this workflow exists to backstop. The two
  // lists live in different files and drifted once already.
  const workflow = fs.readFileSync(
    path.join(path.resolve(import.meta.dirname, ".."), ".github/workflows/test-suite.yml"),
    "utf8",
  );
  // Quoted block-list items only: this workflow uses that form for path entries
  // and nothing else, so no YAML parser is needed (js-yaml is a transitive dep
  // here, not a declared one).
  const entries = [...workflow.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1]!);
  assert.ok(
    entries.length >= SURFACES.length,
    `parsed only ${entries.length} path entries — the extraction or the workflow changed shape`,
  );

  const covered = (target: string): boolean =>
    entries.some((entry) => {
      const base = entry.replace(/\/\*\*$/, "");
      return target === base || target.startsWith(base + "/");
    });

  for (const surface of SURFACES) {
    assert.ok(covered(surface.path), `surface "${surface.path}" is not in the CI paths filter`);
  }
  for (const file of ROOT_FILES) {
    assert.ok(entries.includes(file), `root file "${file}" is not in the CI paths filter`);
  }
});

test("every tracked file is scanned, or exempt with a reason", () => {
  // The surface model enumerates what to read, so anything outside the enumeration is
  // invisible — and an unread file reads as a clean one. That has shipped twice: 38
  // axiom-mcp files (Axiom-77q9) and later .gitignore, .gitattributes, .mise.toml and
  // .github/**. Both were found by hand. This asserts the property instead, so the
  // third omission fails here rather than waiting for someone to notice a gap.
  const root = path.resolve(import.meta.dirname, "..");
  const tracked = execFileSync("git", ["-c", "core.quotepath=false", "ls-files"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const scanned = new Set(shippedFiles(root));

  const unread = tracked.filter((rel) => !scanned.has(rel) && !SELF_EXEMPT.has(rel));
  assert.deepEqual(
    unread,
    [],
    `tracked file(s) in no scanned surface: ${unread.join(", ")}. Add the directory to ` +
      `SURFACES or the file to ROOT_FILES in scripts/leak-scan.ts, and add it to the ` +
      `workflow's paths filter — an unscanned file reads as a clean one.`,
  );
});
