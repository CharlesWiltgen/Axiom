import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * The installer's only job that can silently fail is PLACEMENT. It splices a
 * marker-delimited block into a hook file it does not own, so if it puts the
 * block after something that terminates the script — another tool's `exit`, an
 * `exec` — the Axiom gate never runs while the installer still reports success.
 *
 * This is not hypothetical. `.git/hooks/pre-commit` in this repo stacks three
 * blocks and the beads one carries `if [ $_bd_exit -ne 0 ]; then exit $_bd_exit; fi`.
 * An earlier installer appended, which put the Axiom block after that exit.
 *
 * So the tests below assert REACHABILITY — they run the installed hook and check
 * the block's effect happened — not merely that the block is present. Position is
 * asserted only as the mechanism that makes reachability true.
 */

const REPO = path.resolve(import.meta.dirname, "..");
const INSTALLER = path.join(REPO, "scripts/install-git-hooks.sh");
const TRACKED_BLOCK = path.join(REPO, "scripts/git-hooks/pre-commit-axiom.sh");

/**
 * The live hook, snapshotted. The installer writes to `.git/hooks/`, which is not
 * a temp directory, so a test whose root override silently failed would rewrite
 * the developer's real hooks instead of the fixture and still look like it ran.
 * `AXIOM_ROOT` is the override; the assertions in `install()` and the final test
 * below turn that failure mode into a loud one.
 */
const REAL_HOOK = path.join(REPO, ".git/hooks/pre-commit");
const REAL_HOOK_BEFORE = fs.existsSync(REAL_HOOK) ? fs.readFileSync(REAL_HOOK, "utf8") : null;

const BEGIN = "# --- BEGIN AXIOM PLUGIN VALIDATION ---";
const END = "# --- END AXIOM PLUGIN VALIDATION ---";

/** A stub block that proves it ran, for tests that execute the hook. */
const STUB_BLOCK = [
  "#!/bin/sh",
  "# --- BEGIN AXIOM PLUGIN VALIDATION ---",
  "echo AXIOM_BLOCK_RAN",
  "# --- END AXIOM PLUGIN VALIDATION ---",
].join("\n") + "\n";

/**
 * A throwaway checkout: the tracked block source (real or stubbed) plus an
 * optional pre-existing hook file.
 */
function fixture(hookBody: string | null, blockSource = fs.readFileSync(TRACKED_BLOCK, "utf8")): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "install-git-hooks-"));
  fs.mkdirSync(path.join(root, "scripts/git-hooks"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts/git-hooks/pre-commit-axiom.sh"), blockSource, { mode: 0o755 });
  fs.mkdirSync(path.join(root, ".git/hooks"), { recursive: true });
  if (hookBody !== null) {
    fs.writeFileSync(path.join(root, ".git/hooks/pre-commit"), hookBody, { mode: 0o755 });
  }
  return root;
}

function install(root: string): void {
  execFileSync("sh", [INSTALLER], {
    env: { ...process.env, AXIOM_ROOT: root },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // If the root override were ignored the installer would have written the REAL
  // `.git/hooks/pre-commit` instead of this fixture. Catch that here rather than
  // letting every assertion below pass or fail for the wrong reason.
  assert.ok(
    fs.existsSync(path.join(root, ".git/hooks/pre-commit")),
    "the installer ignored AXIOM_ROOT and did not write into the fixture — " +
      "it may have modified the real .git/hooks/pre-commit",
  );
}

const hookPath = (root: string): string => path.join(root, ".git/hooks/pre-commit");
const readHook = (root: string): string => fs.readFileSync(hookPath(root), "utf8");

/** Run the installed hook and return its stdout. */
function runHook(root: string): string {
  return execFileSync("sh", [hookPath(root)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// ── The regression ────────────────────────────────────────────────────────────

test("the block still runs when a foreign block exits early", () => {
  // The shape this repo actually has: beads first, `exit` inside it.
  const root = fixture("#!/bin/sh\n# another tool's block\nexit 0\n", STUB_BLOCK);
  install(root);
  assert.match(
    runHook(root),
    /AXIOM_BLOCK_RAN/,
    "a preceding `exit 0` must not make the Axiom block unreachable",
  );
});

test("the block precedes a foreign early exit", () => {
  const root = fixture("#!/bin/sh\n# beads-style block\nexit 0\n", STUB_BLOCK);
  install(root);
  const hook = readHook(root);
  assert.ok(hook.includes(BEGIN), "the block must be installed");
  assert.ok(
    hook.indexOf(BEGIN) < hook.indexOf("exit 0"),
    "placement is the mechanism: the block has to come before the exit",
  );
});

test("foreign hook content is preserved either side of the block", () => {
  const root = fixture("#!/bin/sh\necho before\nexit 0\n", STUB_BLOCK);
  install(root);
  const hook = readHook(root);
  assert.ok(hook.includes("echo before"), "the other tool's lines must survive");
  assert.ok(hook.includes("exit 0"), "including its early exit");
});

// ── Placement basics ──────────────────────────────────────────────────────────

test("the shebang stays on line 1", () => {
  const root = fixture("#!/bin/sh\nexit 0\n", STUB_BLOCK);
  install(root);
  assert.equal(readHook(root).split("\n")[0], "#!/bin/sh", "a shebang below line 1 is inert");
});

test("a hook with no shebang gets the block at the top", () => {
  const root = fixture("echo foreign\n", STUB_BLOCK);
  install(root);
  const hook = readHook(root);
  assert.ok(hook.indexOf(BEGIN) < hook.indexOf("echo foreign"));
});

test("a missing hook file is created with a shebang", () => {
  const root = fixture(null, STUB_BLOCK);
  install(root);
  const hook = readHook(root);
  assert.equal(hook.split("\n")[0], "#!/bin/sh");
  assert.ok(hook.includes(BEGIN));
});

// ── Idempotency ───────────────────────────────────────────────────────────────

test("re-running replaces the block instead of stacking copies", () => {
  const root = fixture("#!/bin/sh\nexit 0\n", STUB_BLOCK);
  install(root);
  install(root);
  const hook = readHook(root);
  assert.equal(hook.split(BEGIN).length - 1, 1, "exactly one block after two installs");
  assert.equal(hook.split(END).length - 1, 1, "exactly one end marker");
  assert.match(runHook(root), /AXIOM_BLOCK_RAN/, "and it still runs");
});

test("re-running does not duplicate foreign content", () => {
  const root = fixture("#!/bin/sh\necho once\nexit 0\n", STUB_BLOCK);
  install(root);
  install(root);
  assert.equal(readHook(root).split("echo once").length - 1, 1);
});

test("a block left in the wrong place by an older revision is moved, not kept", () => {
  // The first revision appended, so an already-installed hook can have the block
  // sitting after another tool's `exit`. Replacing in place would preserve that
  // position; the installer has to strip first and re-insert.
  const misplaced = [
    "#!/bin/sh",
    "# another tool's block",
    "exit 0",
    "",
    BEGIN,
    "echo AXIOM_BLOCK_RAN",
    END,
  ].join("\n") + "\n";
  const root = fixture(misplaced, STUB_BLOCK);
  install(root);
  const hook = readHook(root);
  assert.ok(
    hook.indexOf(BEGIN) < hook.indexOf("exit 0"),
    "the block must end up before the foreign exit",
  );
  assert.equal(hook.split(BEGIN).length - 1, 1, "and there must be exactly one");
  assert.match(runHook(root), /AXIOM_BLOCK_RAN/);
});

// ── The block itself ──────────────────────────────────────────────────────────

test("the tracked block source carries both markers", () => {
  // The splice reads between these markers; a missing one silently produces an
  // empty block, which installs fine and does nothing.
  const source = fs.readFileSync(TRACKED_BLOCK, "utf8");
  assert.ok(source.includes(BEGIN), `${path.basename(TRACKED_BLOCK)}: missing BEGIN marker`);
  assert.ok(source.includes(END), `${path.basename(TRACKED_BLOCK)}: missing END marker`);
});

test("the installed hook is valid shell", () => {
  const root = fixture("#!/bin/sh\nexit 0\n");
  install(root);
  execFileSync("sh", ["-n", hookPath(root)], { stdio: ["ignore", "pipe", "pipe"] });
});

// ── Guard ─────────────────────────────────────────────────────────────────────

test("this suite did not touch the real .git/hooks/pre-commit", () => {
  // Runs last by declaration order. The installer targets a path derived from
  // AXIOM_ROOT; if that ever stops working, every test above would be exercising
  // the developer's real hooks and this is the assertion that says so.
  const after = fs.existsSync(REAL_HOOK) ? fs.readFileSync(REAL_HOOK, "utf8") : null;
  assert.equal(
    after,
    REAL_HOOK_BEFORE,
    ".git/hooks/pre-commit changed during the test run — the AXIOM_ROOT override is broken",
  );
});
