import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { examinedGuard, trackedFilesIn } from "./examined.ts";

// Axiom-nta1: checks printed ✓ over an empty or partial walk. The guard is what
// stops that, so it is tested on its own rather than only through pre-deploy.
test("examinedGuard passes at or above the floor and records nothing", () => {
  const errors: string[] = [];
  const guard = examinedGuard((check, msg) => errors.push(`${check}: ${msg}`));
  assert.deepEqual([guard("c", "files", 5, 5), guard("c", "files", 6, 5), errors], [true, true, []]);
});

test("examinedGuard fails below the floor, and treats a floor of 0 as 1", () => {
  const errors: string[] = [];
  const guard = examinedGuard((check, msg) => errors.push(`${check}: ${msg}`));
  assert.deepEqual([guard("c", "files", 3, 5), guard("d", "pages", 0, 0), errors], [
    false,
    false,
    [
      "c: examined 3 files, expected at least 5, so this check can't vouch for anything",
      "d: examined 0 pages, expected at least 1, so this check can't vouch for anything",
    ],
  ]);
});

test("trackedFilesIn lists tracked files that exist on disk", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "examined-git-"));
  try {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    git("init", "-q");
    for (const f of ["a.md", "b.md"]) fs.writeFileSync(path.join(root, f), "x");
    git("add", "a.md", "b.md");
    fs.rmSync(path.join(root, "b.md"));   // tracked, deleted on disk: excluded
    fs.writeFileSync(path.join(root, "c.md"), "x");   // untracked: excluded
    assert.deepEqual(trackedFilesIn(root), ["a.md"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// git lists an unmerged path once per stage, which inflated every floor during a
// merge or rebase conflict and failed checks that had examined everything.
test("trackedFilesIn lists a conflicted file once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "examined-conflict-"));
  try {
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: root, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    fs.writeFileSync(path.join(root, "a.md"), "base\n");
    git("add", "a.md");
    git("commit", "-q", "-m", "base");
    git("checkout", "-q", "-b", "other");
    fs.writeFileSync(path.join(root, "a.md"), "other\n");
    git("commit", "-q", "-am", "other");
    git("checkout", "-q", "main");
    fs.writeFileSync(path.join(root, "a.md"), "main\n");
    git("commit", "-q", "-am", "main");
    try { git("merge", "-q", "other"); } catch { /* the conflict is the point */ }
    assert.deepEqual(trackedFilesIn(root), ["a.md"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("trackedFilesIn returns null outside a git checkout instead of throwing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "examined-nogit-"));
  // Hermetic: stop git's repository search at the temp dir's parent, in case the
  // temp directory itself sits inside a checkout.
  const prior = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = path.dirname(root);
  try {
    assert.equal(trackedFilesIn(root), null);
  } finally {
    if (prior === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = prior;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
