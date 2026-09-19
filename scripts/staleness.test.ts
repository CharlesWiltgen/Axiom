/**
 * Tests for scripts/staleness.ts.
 *
 * Run via `node --test scripts/staleness.test.ts` (Node 24 native, no extra
 * deps). Wired into npm `test:unit` via the scripts/*.test.ts glob.
 *
 * All three exported functions are pure — the caller (pre-deploy.ts) does the fs
 * walk and the single `git status` call, then passes strings/arrays in.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePorcelain, resolveGoBinaryStaleness, resolveStaleness } from "./staleness.ts";

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

describe("resolveGoBinaryStaleness", () => {
  const dirty = (...p: string[]) => new Set(p);

  it("reports a tool stale when a changed .go source is newer than its binary", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 100,
        binaryDirty: true,   // rebuilt once, then left behind by a further edit
        sources: [
          { path: "tools/xcui/sim.go", mtimeMs: 200 },
          { path: "tools/xcui/main.go", mtimeMs: 50 },
        ],
      }],
      dirty("tools/xcui/sim.go"),
      true,
    );
    assert.equal(verdicts.length, 1);
    assert.equal(verdicts[0].state, "stale");
    assert.match(verdicts[0].reason, /1 source file\(s\) changed/);
  });

  it("ignores _test.go files — go build does not compile them into the binary", () => {
    // A test-only edit leaves the shipped binary correct. Flagging it would train
    // the reader to rebuild (and re-commit a 6 MB binary) for nothing.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 100,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/sim_test.go", mtimeMs: 900 }],
      }],
      dirty("tools/xcui/sim_test.go"),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("treats go.mod and go.sum as compiled inputs — a dependency change rebuilds the binary", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcsym",
        binaryMtimeMs: 100,
        binaryDirty: true,
        sources: [{ path: "tools/xcsym/go.mod", mtimeMs: 900 }, { path: "tools/xcsym/go.sum", mtimeMs: 900 }],
      }],
      dirty("tools/xcsym/go.mod"),
      true,
    );
    assert.equal(verdicts[0].state, "stale");
  });

  it("is not stale when mtimes are newer but every file matches HEAD (fresh clone)", () => {
    // A clone gives every file the checkout time, so mtime alone would fail a
    // tree nobody has edited.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 100,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 900 }],
      }],
      new Set<string>(),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
    assert.match(verdicts[0].reason, /mtime skew/);
  });

  it("is stale without git, where content cannot be confirmed", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 100,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 900 }],
      }],
      new Set<string>(),
      false,
    );
    assert.equal(verdicts[0].state, "stale");
  });

  it("reports a module with no shipped binary — the tool cannot reach users", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{ tool: "xcnew", binaryMtimeMs: null, binaryDirty: false, sources: [{ path: "tools/xcnew/main.go", mtimeMs: 10 }] }],
      new Set<string>(),
      true,
    );
    assert.equal(verdicts[0].state, "missing-binary");
  });

  it("is stale when source is dirty but the committed binary is not — the `touch` bypass", () => {
    // mtime alone cannot see this: `touch bin/xcui` makes the binary the newest
    // file, so the mtime clause reports ok on a binary nobody rebuilt. git content
    // can: a rebuilt binary has different bytes, so it would be dirty too.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,               // binary "newer" than every source
        binaryDirty: false,                 // …but its bytes never changed
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 100 }],
      }],
      dirty("tools/xcui/sim.go"),
      true,
    );
    assert.equal(verdicts[0].state, "stale");
    assert.match(verdicts[0].reason, /not rebuilt/);
  });

  it("is ok when source and binary are both dirty — the binary was rebuilt", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: true,
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 100 }],
      }],
      dirty("tools/xcui/sim.go", ".claude-plugin/plugins/axiom/bin/xcui"),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("ignores a dirty _test.go for the rebuild check too", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/sim_test.go", mtimeMs: 100 }],
      }],
      dirty("tools/xcui/sim_test.go"),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("is stale when an already-rebuilt binary is left behind by a further edit (clause 2's own job)", () => {
    // Pins the mtime clause on the case clause 1 cannot see: the binary is dirty
    // (rebuilt once), so only the mtime comparison can catch the later edit. A
    // mutation making binaryDirty short-circuit to ok passed every other test.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 500,
        binaryDirty: true,
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 900 }],
      }],
      dirty("tools/xcui/sim.go", ".claude-plugin/plugins/axiom/bin/xcui"),
      true,
    );
    assert.equal(verdicts[0].state, "stale");
  });

  it("is stale when a compiled source was DELETED — it cannot appear in the fs walk", () => {
    // git reports " D tools/xcui/helper.go", but the walker can never list a file
    // that is gone, so the deletion has to arrive separately or it is invisible.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/main.go", mtimeMs: 100 }],
        deletedSources: ["tools/xcui/helper.go"],
      }],
      dirty("tools/xcui/helper.go"),
      true,
    );
    assert.equal(verdicts[0].state, "stale");
    assert.match(verdicts[0].reason, /not rebuilt/);
  });

  it("ignores a deleted _test.go — go build never compiled it", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: false,
        sources: [{ path: "tools/xcui/main.go", mtimeMs: 100 }],
        deletedSources: ["tools/xcui/helper_test.go"],
      }],
      dirty("tools/xcui/helper_test.go"),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("flags source staged for commit without the rebuilt binary — HEAD would ship the old tool", () => {
    // The gate reads the WORKING TREE, but what ships is HEAD. Staging sim.go alone
    // (binary rebuilt but left unstaged) lands a commit whose source and binary
    // disagree, and every worktree-based clause reads green.
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: true,
        binaryStaged: false,
        stagedSources: ["tools/xcui/sim.go"],
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 100 }],
      }],
      dirty("tools/xcui/sim.go", ".claude-plugin/plugins/axiom/bin/xcui"),
      true,
    );
    assert.equal(verdicts[0].state, "binary-not-staged");
  });

  it("is ok when source and binary are staged together", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: true,
        binaryStaged: true,
        stagedSources: ["tools/xcui/sim.go"],
        sources: [{ path: "tools/xcui/sim.go", mtimeMs: 100 }],
      }],
      dirty("tools/xcui/sim.go", ".claude-plugin/plugins/axiom/bin/xcui"),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("ignores a staged _test.go — it changes no binary, so it needs no binary staged", () => {
    const verdicts = resolveGoBinaryStaleness(
      [{
        tool: "xcui",
        binaryMtimeMs: 9_000,
        binaryDirty: false,
        binaryStaged: false,
        stagedSources: ["tools/xcui/sim_test.go"],
        sources: [{ path: "tools/xcui/main.go", mtimeMs: 100 }],
      }],
      new Set<string>(),
      true,
    );
    assert.equal(verdicts[0].state, "ok");
  });

  it("returns one verdict per tool, in the order given", () => {
    const verdicts = resolveGoBinaryStaleness(
      [
        { tool: "xclog", binaryMtimeMs: 100, binaryDirty: false, sources: [{ path: "tools/xclog/main.go", mtimeMs: 10 }] },
        { tool: "xcui", binaryMtimeMs: 100, binaryDirty: true, sources: [{ path: "tools/xcui/main.go", mtimeMs: 900 }] },
      ],
      dirty("tools/xcui/main.go"),
      true,
    );
    assert.deepEqual(verdicts.map((v) => [v.tool, v.state]), [["xclog", "ok"], ["xcui", "stale"]]);
  });
});
