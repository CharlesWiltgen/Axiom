import assert from "node:assert/strict";
import test from "node:test";
import { isCodexGeneratedPath } from "./codex-output.js";
import { isCursorGeneratedPath } from "./cursor-output.js";

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
