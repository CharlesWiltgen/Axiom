import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.join(import.meta.dirname, "check-cross-refs.js");
const run = (skillsRoot?: string) =>
  spawnSync("node", [script, ...(skillsRoot ? [skillsRoot] : [])], { encoding: "utf8" });

// Axiom-ayow: the checker printed "all cross-references valid" without checking
// that it had scanned any file or resolved any reference, so a broken walk or
// regex read as a clean tree.
test("fails when the skills tree holds no skill files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cross-refs-empty-"));
  try {
    const result = run(dir);
    assert.deepEqual([result.status, /no skill files/.test(result.stdout + result.stderr)], [1, true]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when the skill files contain no cross-references to check", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cross-refs-none-"));
  try {
    fs.mkdirSync(path.join(dir, "axiom-a", "skills"), { recursive: true });
    fs.writeFileSync(path.join(dir, "axiom-a", "SKILL.md"), "---\nname: axiom-a\n---\n\n# A\n\nNo references here.\n");
    const result = run(dir);
    assert.deepEqual([result.status, /no `skills\/\*\.md` references/.test(result.stdout + result.stderr)], [1, true], result.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function suiteFixture(skillMd: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cross-refs-fixture-"));
  fs.mkdirSync(path.join(dir, "axiom-a", "skills"), { recursive: true });
  fs.writeFileSync(path.join(dir, "axiom-a", "skills", "guide.md"), "# Guide\n");
  fs.writeFileSync(path.join(dir, "axiom-a", "SKILL.md"), `---\nname: axiom-a\n---\n\n${skillMd}\n`);
  return dir;
}

test("passes a fixture whose only reference resolves, and counts it", () => {
  const dir = suiteFixture("See `skills/guide.md`.");
  try {
    const result = run(dir);
    assert.deepEqual([result.status, /1 references checked/.test(result.stdout)], [0, true], result.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A parenthesized ref whose path names no .md file was skipped silently, so a
// broken CHILD_PATH regex turned every such ref into a no-op and still passed.
test("fails on a parenthesized ref that names no skill file", () => {
  const dir = suiteFixture("See axiom-a (skills/guide) for more.");
  try {
    const result = run(dir);
    assert.deepEqual([result.status, /malformed/.test(result.stdout)], [1, true], result.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("passes on the real plugin and reports how many references it checked", () => {
  const result = run();
  assert.deepEqual([result.status, /\d+ references checked/.test(result.stdout)], [0, true]);
});
