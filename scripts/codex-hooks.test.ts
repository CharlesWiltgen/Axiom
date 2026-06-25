/**
 * Tests for scripts/codex-hooks.js — translating Axiom's Claude Code hooks manifest
 * into the Codex plugin's hooks.json (bd axiom-25ll). Hermetic: a synthetic CC
 * hooks object, never touches real files. Run via
 * `node --test scripts/codex-hooks.test.ts` (auto-discovered by npm `test:unit`).
 *
 * Scope = layer 1 (the manifest transform): plugin-root var rename, dropping the
 * "Read"-matched crash-route group (no Codex Read tool), and structure fidelity.
 * The env->stdin rewrite of the $TOOL_INPUT_FILE_PATH shell hooks is layer 2.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { translateHooksToCodex, shouldCopyHookScript } from "./codex-hooks.js";

// Synthetic Claude Code hooks.json (subset of Axiom's real manifest) exercising:
// a Read-matched group (must drop), a Bash-matched group (must survive), and two
// matcherless events — all with ${CLAUDE_PLUGIN_ROOT} commands (must be rewritten).
const CC_HOOKS = {
  hooks: {
    PreToolUse: [
      { matcher: "Read", hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/pretool-crash-route.py"' }] },
    ],
    PostToolUse: [
      { matcher: "Bash", hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/posttool-bash-hints.py"' }] },
      // The production swift-guardrails path: a pipe-separated matcher (Codex aliases
      // Write/Edit to apply_patch) that must survive the transform unchanged.
      { matcher: "Write|Edit", hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/swift-guardrails.py"' }] },
    ],
    SessionStart: [
      { hooks: [{ type: "command", command: '"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"' }] },
    ],
    UserPromptSubmit: [
      { hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/user-prompt-submit.py"' }] },
    ],
  },
};

// The whole expected Codex manifest: PreToolUse gone (its only group was Read-matched),
// every ${CLAUDE_PLUGIN_ROOT} -> ${PLUGIN_ROOT}, working matchers (Bash, Write|Edit) preserved.
const EXPECTED_CODEX_HOOKS = {
  hooks: {
    PostToolUse: [
      { matcher: "Bash", hooks: [{ type: "command", command: 'python3 "${PLUGIN_ROOT}/hooks/posttool-bash-hints.py"' }] },
      { matcher: "Write|Edit", hooks: [{ type: "command", command: 'python3 "${PLUGIN_ROOT}/hooks/swift-guardrails.py"' }] },
    ],
    SessionStart: [
      { hooks: [{ type: "command", command: '"${PLUGIN_ROOT}/hooks/session-start.sh"' }] },
    ],
    UserPromptSubmit: [
      { hooks: [{ type: "command", command: 'python3 "${PLUGIN_ROOT}/hooks/user-prompt-submit.py"' }] },
    ],
  },
};

describe("translateHooksToCodex", () => {
  it("produces the full Codex manifest: root-var renamed, Read group dropped, structure preserved", () => {
    assert.deepEqual(translateHooksToCodex(CC_HOOKS), EXPECTED_CODEX_HOOKS);
  });

  it("leaves no ${CLAUDE_PLUGIN_ROOT} anywhere (Codex injects $PLUGIN_ROOT instead)", () => {
    const out = JSON.stringify(translateHooksToCodex(CC_HOOKS));
    assert.equal(out.includes("CLAUDE_PLUGIN_ROOT"), false);
  });

  it("drops the PreToolUse 'Read' group — Codex has no Read tool to fire it", () => {
    const out = translateHooksToCodex(CC_HOOKS);
    assert.equal(out.hooks.PreToolUse, undefined);
  });

  it("preserves a pipe-separated 'Write|Edit' matcher (the swift-guardrails path)", () => {
    const out = translateHooksToCodex(CC_HOOKS);
    const group = out.hooks.PostToolUse.find((g) => g.matcher === "Write|Edit");
    assert.ok(group, "Write|Edit group must survive into Codex");
    assert.match(group.hooks[0].command ?? "", /swift-guardrails\.py/);
  });

  it("strips a matcher on a matcherless event (Codex rejects it there)", () => {
    const withMatcher = {
      hooks: {
        UserPromptSubmit: [
          { matcher: "*", hooks: [{ type: "command", command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/user-prompt-submit.py"' }] },
        ],
      },
    };
    const out = translateHooksToCodex(withMatcher);
    assert.equal("matcher" in out.hooks.UserPromptSubmit[0], false);
  });

  it("does not mutate its input (pure transform)", () => {
    const before = structuredClone(CC_HOOKS);
    translateHooksToCodex(CC_HOOKS);
    assert.deepEqual(CC_HOOKS, before);
  });
});

describe("shouldCopyHookScript", () => {
  it("copies runtime .py and .sh hooks", () => {
    assert.equal(shouldCopyHookScript("swift-guardrails.py"), true);
    assert.equal(shouldCopyHookScript("session-start.sh"), true);
  });

  it("copies transitive-dep scripts absent from the manifest (session-start.py, project_detect.py)", () => {
    assert.equal(shouldCopyHookScript("session-start.py"), true);
    assert.equal(shouldCopyHookScript("project_detect.py"), true);
  });

  it("skips test files", () => {
    assert.equal(shouldCopyHookScript("user-prompt-submit_test.py"), false);
  });

  it("skips scripts that back a dropped hook (pretool-crash-route.py — no Codex Read tool)", () => {
    assert.equal(shouldCopyHookScript("pretool-crash-route.py"), false);
  });

  it("skips non-script files (metadata.txt, hooks.json)", () => {
    assert.equal(shouldCopyHookScript("metadata.txt"), false);
    assert.equal(shouldCopyHookScript("hooks.json"), false);
  });
});
