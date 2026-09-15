import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { type LeakRule, RULES, scanRepo, shippedFiles } from "./leak-scan.ts";

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
    pattern: /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/,
    hint: "a UUID or UDID",
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
  const { root } = fixture(SKILL, "---\nname: x\n---\n--device 6C640744-3686-474B-9643-08FCF719DEC1\n");
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
