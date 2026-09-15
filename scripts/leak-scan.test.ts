import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanRepo, scanText, shippedFiles } from "./leak-scan.ts";

/** Build a throwaway repo with one shipped file at a chosen surface path. */
function fixture(rel: string, content: string): { root: string; file: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leak-scan-"));
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return { root, file };
}

const SKILL = ".claude-plugin/plugins/axiom/skills/axiom-example/SKILL.md";

test("flags the maintainer's project names in shipped content", () => {
  const { root } = fixture(SKILL, "---\nname: x\n---\nAn example app, like ExampleApp for the iPhone.\n");
  fs.writeFileSync(path.join(root, SKILL), "---\nname: x\n---\nScreenshotted from the ExampleApp build.\n");
  const findings = scanRepo(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, "project-name");
  assert.equal(findings[0]!.severity, "error");
  assert.equal(findings[0]!.line, 4, "line numbers must point at the offending line");
});

test("flags personal home paths but not the placeholders the corpus uses", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    "let a = \"/Users/you/Library/Application Support/MyApp\";",
    "let b = \"/Users/me/Crashes/Points/ABC.xccrashpoint\";",
    "let c = \"/Users/someone/Library/Logs\";",
    "let d = \"/Users/you/Library/Application Support/MyApp\";",
    "let e = \"/home/ci/build\";",
    "let f = \"/Users/REDACTED/Library\";",
  ].join("\n") + "\n");
  const hits = scanRepo(root).filter((f) => f.rule === "absolute-home-path");
  // ci accounts are shared infrastructure; REDACTED is the anonymizer's own
  // marker and appears in shipped docs on purpose. Both stay out of the report.
  assert.deepEqual(hits.map((f) => f.match), ["/Users/you"]);
});

test("flags Claude Code's encoded project path, which spells out a home directory", () => {
  const { root } = fixture(SKILL, 'cwd: "/private/placeholder/-Users-someone-Projects-Example/scratchpad"\n');
  const hits = scanRepo(root).filter((f) => f.rule === "encoded-home-path");
  assert.equal(hits.length, 1);
  assert.ok(hits[0]!.match.startsWith("-Users-"), "the encoded home segment is what leaks");
});

test("flags session temp paths and timestamp-shaped build stamps", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    "Version:             1.0.0 (1000000000)",
    "Version:             1.0.0 (1000000000)",
    'cwd: "/private/tmp/claude-501/session/scratchpad"',
  ].join("\n") + "\n");
  const rules = scanRepo(root).map((f) => f.rule).sort();
  assert.deepEqual(rules, ["claude-temp-session", "timestamp-build-stamp"]);
});

test("warns on UUID and tracker shapes, and leaves Axiom's own ids alone", () => {
  const { root } = fixture(SKILL, [
    "---", "name: x", "---",
    "--device 1A2B3C4D-5E6F-7890-ABCD-EF1234567890",
    "sentry issue APP-3V was closed",
    "see Axiom-2fa for the full story",
  ].join("\n") + "\n");
  const findings = scanRepo(root);
  const warnings = findings.filter((f) => f.severity === "warn").map((f) => f.rule).sort();
  assert.deepEqual(warnings, ["issue-id", "uuid-looks-real"]);
  assert.equal(findings.filter((f) => f.severity === "error").length, 1, "APP-3V is a project name too");
});

test("scans printable runs inside a binary, where a source path once shipped", () => {
  const { root } = fixture(".claude-plugin/plugins/axiom/bin/tool", "");
  fs.writeFileSync(
    path.join(root, ".claude-plugin/plugins/axiom/bin/tool"),
    Buffer.concat([
      Buffer.from([0x00, 0x01, 0x02]),
      Buffer.from("/Users/you/Projects/Axiom/tools/tool/main.go", "utf8"),
      Buffer.from([0x00]),
    ]),
  );
  const findings = scanRepo(root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.path, ".claude-plugin/plugins/axiom/bin/tool");
  assert.equal(findings[0]!.line, 0, "binaries report no line number");
});

test("an allow entry excuses an exact match and nothing else", () => {
  const rel = "tools/xcsym/anonymize.go";
  const { root } = fixture(rel, "// rewrites AWDL- to Interface\n");
  assert.deepEqual(scanRepo(root), [], "the documented example is allowed");
  fs.appendFileSync(path.join(root, rel), "// leftover APP-3V reference\n");
  const named = scanRepo(root).filter((f) => f.rule === "project-name");
  assert.equal(named.length, 1, "the allow entry must not bless an unrelated match");
});

test("shippedFiles covers the surfaces that ship and skips dev state", () => {
  const { root } = fixture(SKILL, "---\nname: x\n---\nclean\n");
  fs.mkdirSync(path.join(root, "scratch"), { recursive: true });
  fs.writeFileSync(path.join(root, "scratch/example-notes.md"), "ExampleApp\n");
  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(root, ".claude/CLAUDE.md"), "ExampleApp\n");
  fs.writeFileSync(path.join(root, "README.md"), "# Axiom\n");
  const files = shippedFiles(root);
  assert.ok(files.includes(SKILL));
  assert.ok(files.includes("README.md"));
  assert.ok(!files.some((f) => f.startsWith("scratch/")), "scratch is gitignored dev state");
  assert.ok(!files.some((f) => f.startsWith(".claude/")), ".claude is gitignored dev state");
  assert.deepEqual(scanRepo(root), []);
});
