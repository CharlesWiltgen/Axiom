import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkCodexOutput,
  compareWithRender,
  diffTrees,
  gitVisiblePaths,
  isCodexGeneratedPath,
  isShippedSubSkillFile,
  readTree,
  stagedDifferences,
} from "./codex-output.js";
import { isCursorGeneratedPath } from "./cursor-output.js";

const root = path.join(import.meta.dirname!, "..");
const buildCodex = (args: string[]) =>
  spawnSync(process.execPath, [path.join(root, "scripts/build-codex.ts"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
const tempDir = (label: string) => fs.mkdtempSync(path.join(os.tmpdir(), `axiom-${label}-`));
const write = (dir: string, rel: string, content: string, mode = 0o644) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
  fs.chmodSync(path.join(dir, rel), mode);
};

test("recognises every path the Codex build regenerates", () => {
  for (const generated of [
    "axiom-codex/README.md",
    "axiom-codex/.codex-plugin/plugin.json",
    "axiom-codex/skills/axiom-swiftui/SKILL.md",
    "axiom-codex/skills/axiom-media/skills/music-library.md",
    "axiom-codex/hooks/user-prompt-submit.py",
  ]) {
    assert.equal(isCodexGeneratedPath(generated), true, generated);
  }
});

test("does not absolve unrelated working-tree changes", () => {
  // The --tag preflight exists to refuse tagging a dirty tree. Widening it for
  // generated output must not turn it into a blanket pass.
  for (const unrelated of [
    "scripts/set-version.js",
    "docs/start/codex-install.md",
    ".claude-plugin/plugins/axiom/agents/build-fixer.md",
    "axiom-codex-notes.md",
    // build-codex.ts does NOT write the Codex marketplace manifest — it is
    // version-free and hand-maintained (see .claude/rules/version-management.md).
    ".agents/plugins/marketplace.json",
    "",
  ]) {
    assert.equal(isCodexGeneratedPath(unrelated), false, unrelated);
  }
});

test("normalises Windows separators", () => {
  assert.equal(isCodexGeneratedPath("axiom-codex\\README.md"), true);
});

test("the two generated-output predicates are disjoint", () => {
  // set-version's --tag preflight ORs these. If they ever overlapped, a path
  // could be absolved by the wrong owner and the narrowing intent would rot.
  for (const p of [
    "axiom-cursor/.cursor-plugin/plugin.json",
    ".cursor-plugin/marketplace.json",
    "axiom-codex/.codex-plugin/plugin.json",
    "axiom-codex/skills/axiom-media/SKILL.md",
  ]) {
    assert.equal(
      isCursorGeneratedPath(p) && isCodexGeneratedPath(p),
      false,
      `${p} claimed by both predicates`,
    );
  }
});

test("diffTrees reports added, removed and changed files, including a mode change", () => {
  const expected = tempDir("expected");
  const actual = tempDir("actual");
  try {
    write(expected, "same.md", "same");
    write(actual, "same.md", "same");
    write(expected, "skills/edited.md", "rendered");
    write(actual, "skills/edited.md", "hand-edited");
    write(expected, "bin/tool", "binary", 0o755);
    write(actual, "bin/tool", "binary", 0o644);
    write(expected, "missing.md", "only rendered");
    write(actual, "stray.md", "only committed");
    assert.deepEqual(diffTrees(readTree(expected), readTree(actual)), {
      added: ["stray.md"],
      removed: ["missing.md"],
      changed: ["bin/tool", "skills/edited.md"],
    });
  } finally {
    fs.rmSync(expected, { recursive: true, force: true });
    fs.rmSync(actual, { recursive: true, force: true });
  }
});

test("checkCodexOutput finds the committed axiom-codex tree identical to a fresh render", () => {
  const { files, differences } = checkCodexOutput(root);
  assert.deepEqual(differences, []);
  assert.ok(files > 0);
});

test("build-codex --check exits 0 on the committed tree", () => {
  const result = buildCodex(["--check"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("build-codex refuses an --output it would have to delete or cannot resolve", () => {
  const occupied = tempDir("codex-occupied");
  try {
    write(occupied, "keep.txt", "user data");
    for (
      const args of [
        ["--output", occupied],
        ["--output", "relative/dir"],
        ["--output"],
        ["--unknown"],
        ["--check", "--output", occupied],
      ]
    ) {
      assert.equal(buildCodex(args).status, 2, args.join(" "));
    }
    assert.equal(fs.readFileSync(path.join(occupied, "keep.txt"), "utf8"), "user data");
  } finally {
    fs.rmSync(occupied, { recursive: true, force: true });
  }
});

test("gitVisiblePaths lists tracked and unignored files, not ignored ones", () => {
  const repo = tempDir("visible");
  try {
    const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    write(repo, ".gitignore", "__pycache__/\n");
    write(repo, "hooks/hook.py", "print()");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
    write(repo, "hooks/__pycache__/hook.cpython-314.pyc", "bytecode");
    write(repo, "notes.md", "untracked but not ignored");
    assert.deepEqual([...(gitVisiblePaths(repo) ?? [])].sort(), [".gitignore", "hooks/hook.py", "notes.md"]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("diffTrees compares only the executable bit, as git does", () => {
  const expected = tempDir("mode-expected");
  const actual = tempDir("mode-actual");
  try {
    write(expected, "hook.py", "print()", 0o644);
    write(actual, "hook.py", "print()", 0o666);
    write(expected, "tool", "binary", 0o755);
    write(actual, "tool", "binary", 0o700);
    assert.deepEqual(diffTrees(readTree(expected), readTree(actual)), {
      added: [],
      removed: [],
      changed: [],
    });
  } finally {
    fs.rmSync(expected, { recursive: true, force: true });
    fs.rmSync(actual, { recursive: true, force: true });
  }
});

test("stagedDifferences catches staged changes the working tree no longer shows", () => {
  const repo = tempDir("staged");
  const rendered = tempDir("staged-render");
  try {
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    };
    git("init", "-q");
    for (const dir of [repo, rendered]) {
      write(dir, "out/kept.md", "rendered");
      write(dir, "out/edited.md", "rendered");
      write(dir, "out/removed.md", "rendered");
      write(dir, "out/hook.py", "print()");
    }
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
    // A: a hand edit staged, then the disk copy restored
    write(repo, "out/edited.md", "hand edit");
    git("add", "out/edited.md");
    write(repo, "out/edited.md", "rendered");
    // B: a generated file deleted from the index only
    git("rm", "-q", "--cached", "out/removed.md");
    // C: a stray file staged, then removed from disk
    write(repo, "out/stray.md", "stray");
    git("add", "out/stray.md");
    fs.rmSync(path.join(repo, "out/stray.md"));
    // D: an executable bit set in the index only
    git("update-index", "--chmod=+x", "out/hook.py");
    assert.deepEqual(stagedDifferences(repo, "out", readTree(path.join(rendered, "out"))), [
      "staged change differs from the build: edited.md",
      "staged change differs from the build: hook.py",
      "staged deletion of a generated file: removed.md",
      "staged file the build does not produce: stray.md",
    ]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(rendered, { recursive: true, force: true });
  }
});

test("isShippedSubSkillFile copies Markdown sub-skills, not editor or OS files", () => {
  for (const [name, shipped] of [
    ["build-debugging.md", true],
    [".build-debugging.md.swp", false],
    [".DS_Store", false],
    ["._build-debugging.md", false],
    ["notes.txt", false],
    ["build-debugging.md~", false],
  ] as const) {
    assert.equal(isShippedSubSkillFile(name), shipped, name);
  }
});

test("compareWithRender reports working-tree and staged differences together", () => {
  const repo = tempDir("compare");
  const rendered = tempDir("compare-render");
  try {
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    };
    git("init", "-q");
    write(repo, ".gitignore", "__pycache__/\n");
    for (const dir of [repo, rendered]) {
      write(dir, "out/staged.md", "rendered");
      write(dir, "out/disk.md", "rendered");
    }
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
    write(repo, "out/staged.md", "hand edit");
    git("add", "out/staged.md");
    write(repo, "out/staged.md", "rendered");
    write(repo, "out/disk.md", "hand edit, unstaged");
    write(repo, "out/__pycache__/hook.pyc", "ignored");
    assert.deepEqual(compareWithRender(repo, "out", readTree(path.join(rendered, "out"))), [
      "changed: disk.md",
      "staged change differs from the build: staged.md",
    ]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(rendered, { recursive: true, force: true });
  }
});
