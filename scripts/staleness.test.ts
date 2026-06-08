/**
 * Tests for scripts/staleness.ts.
 *
 * Run via `node --test scripts/staleness.test.ts` (Node 24 native, no extra
 * deps). Wired into npm `test:unit` via the scripts/*.test.ts glob.
 *
 * Both functions are pure — the caller (pre-deploy.ts) does the fs walk and the
 * single `git status` call, then passes strings/arrays in.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePorcelain, resolveStaleness } from "./staleness.ts";

describe("parsePorcelain", () => {
  it("returns an empty set for clean output", () => {
    assert.deepEqual(parsePorcelain(""), new Set());
  });

  it("extracts a modified path", () => {
    assert.deepEqual(
      parsePorcelain(" M scripts/pre-deploy.ts"),
      new Set(["scripts/pre-deploy.ts"]),
    );
  });

  it("extracts an untracked path", () => {
    assert.deepEqual(
      parsePorcelain("?? scripts/new.ts"),
      new Set(["scripts/new.ts"]),
    );
  });

  it("takes the destination path of a rename", () => {
    assert.deepEqual(
      parsePorcelain("R  old/a.md -> new/b.md"),
      new Set(["new/b.md"]),
    );
  });

  it("unquotes paths git quotes for special chars", () => {
    assert.deepEqual(
      parsePorcelain('?? "weird name.md"'),
      new Set(["weird name.md"]),
    );
  });

  it("keeps a literal non-ASCII path (caller forces core.quotepath=false)", () => {
    assert.deepEqual(parsePorcelain(" M café.md"), new Set(["café.md"]));
  });

  it("parses multiple lines and ignores blanks", () => {
    const out = " M a.md\n?? b.md\n\nMM c.md\n";
    assert.deepEqual(parsePorcelain(out), new Set(["a.md", "b.md", "c.md"]));
  });
});

describe("resolveStaleness", () => {
  it("is not stale when nothing is newer than the artifact", () => {
    const v = resolveStaleness({
      newerFiles: [],
      dirtyFiles: [],
      gitAvailable: true,
    });
    assert.equal(v.stale, false);
  });

  it("is not stale when newer files are all git-clean (mtime skew)", () => {
    const v = resolveStaleness({
      newerFiles: ["skills/a/SKILL.md", "skills/b/SKILL.md"],
      dirtyFiles: [],
      gitAvailable: true,
    });
    assert.equal(v.stale, false);
    assert.match(v.reason, /content matches HEAD|git-clean|mtime/i);
  });

  it("is stale when at least one newer file is dirty/untracked", () => {
    const v = resolveStaleness({
      newerFiles: ["skills/a/SKILL.md", "skills/b/SKILL.md"],
      dirtyFiles: ["skills/b/SKILL.md"],
      gitAvailable: true,
    });
    assert.equal(v.stale, true);
    assert.match(v.reason, /1 source file/);
  });

  it("falls back to stale (conservative) when git is unavailable", () => {
    const v = resolveStaleness({
      newerFiles: ["skills/a/SKILL.md"],
      dirtyFiles: [],
      gitAvailable: false,
    });
    assert.equal(v.stale, true);
    assert.match(v.reason, /git unavailable/i);
  });
});
