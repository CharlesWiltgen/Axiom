import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { compareDirectories } from "./compare.ts";

const root = process.cwd();
const cli = path.join(root, "scripts", "build-cursor.ts");

function snapshot(directory: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const visit = (current: string, prefix: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(current, entry.name);
      assert.equal(fs.lstatSync(absolute).isSymbolicLink(), false, `symlink: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else files.set(relative, fs.readFileSync(absolute));
    }
  };
  visit(directory, "");
  return files;
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

test("check preserves committed Cursor output byte-for-byte", () => {
  const before = new Map([
    ...snapshot(path.join(root, ".cursor-plugin")),
    ...[...snapshot(path.join(root, "axiom-cursor")).entries()].map(([file, content]) => [`axiom-cursor/${file}`, content] as const),
  ]);
  const result = run("--check");
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = new Map([
    ...snapshot(path.join(root, ".cursor-plugin")),
    ...[...snapshot(path.join(root, "axiom-cursor")).entries()].map(([file, content]) => [`axiom-cursor/${file}`, content] as const),
  ]);
  assert.deepEqual(after, before);
});

test("compares added, removed, and changed files in sorted diagnostics", () => {
  const expected = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-expected-"));
  const actual = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-actual-"));
  try {
    fs.writeFileSync(path.join(expected, "changed.txt"), "before");
    fs.writeFileSync(path.join(expected, "removed.txt"), "removed");
    fs.writeFileSync(path.join(actual, "added.txt"), "added");
    fs.writeFileSync(path.join(actual, "changed.txt"), "after");
    assert.deepEqual(compareDirectories(expected, actual), {
      added: ["added.txt"],
      removed: ["removed.txt"],
      changed: ["changed.txt"],
    });
  } finally {
    fs.rmSync(expected, { recursive: true, force: true });
    fs.rmSync(actual, { recursive: true, force: true });
  }
});

test("reports a mode-only file mismatch as changed", () => {
  const expected = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-mode-expected-"));
  const actual = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-mode-actual-"));
  try {
    const expectedFile = path.join(expected, "marketplace.json");
    const actualFile = path.join(actual, "marketplace.json");
    fs.writeFileSync(expectedFile, "identical bytes\n");
    fs.writeFileSync(actualFile, "identical bytes\n");
    fs.chmodSync(expectedFile, 0o644);
    fs.chmodSync(actualFile, 0o755);

    assert.deepEqual(compareDirectories(expected, actual), {
      added: [],
      removed: [],
      changed: ["marketplace.json"],
    });
  } finally {
    fs.rmSync(expected, { recursive: true, force: true });
    fs.rmSync(actual, { recursive: true, force: true });
  }
});

test("rejects unsafe Cursor CLI argument combinations and relative outputs", () => {
  for (const args of [["--output", "relative"], ["--output"], ["--profile", "minimal"], ["--unknown"], ["--check", "--output", os.tmpdir()]]) {
    const result = run(...args);
    assert.notEqual(result.status, 0, `${args.join(" ")} unexpectedly succeeded`);
  }
});

test("writes both generated roots under an absolute output directory", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-output-"));
  try {
    const result = run("--output", destination);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(path.join(destination, ".cursor-plugin", "marketplace.json")));
    assert.ok(fs.existsSync(path.join(destination, "axiom-cursor", ".cursor-plugin", "plugin.json")));
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test("creates a missing absolute output directory", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-missing-output-"));
  const destination = path.join(parent, "missing", "nested");
  try {
    assert.equal(fs.existsSync(destination), false);
    const result = run("--output", destination);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(path.join(destination, ".cursor-plugin", "marketplace.json")));
    assert.ok(fs.existsSync(path.join(destination, "axiom-cursor", ".cursor-plugin", "plugin.json")));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
