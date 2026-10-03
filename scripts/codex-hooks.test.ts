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
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
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
      { matcher: "Bash", hooks: [{ type: "command", command: 'AXIOM_HARNESS=codex python3 "${PLUGIN_ROOT}/hooks/posttool-bash-hints.py"', statusMessage: "Axiom: PostToolUse terminal hints" }] },
      { matcher: "Write|Edit", hooks: [{ type: "command", command: 'AXIOM_HARNESS=codex python3 "${PLUGIN_ROOT}/hooks/swift-guardrails.py"', statusMessage: "Axiom: PostToolUse Swift guardrails" }] },
    ],
    SessionStart: [
      { hooks: [{ type: "command", command: 'AXIOM_HARNESS=codex "${PLUGIN_ROOT}/hooks/session-start.sh"', statusMessage: "Axiom: SessionStart onboarding" }] },
    ],
    UserPromptSubmit: [
      { hooks: [{ type: "command", command: 'AXIOM_HARNESS=codex python3 "${PLUGIN_ROOT}/hooks/user-prompt-submit.py"', statusMessage: "Axiom: UserPromptSubmit routing" }] },
    ],
  },
};

describe("translateHooksToCodex", () => {
  it("selects Codex protocol explicitly without mutating canonical commands", () => {
    const input = structuredClone(CC_HOOKS);
    const commands = Object.values(translateHooksToCodex(input).hooks).flatMap(groups => groups.flatMap(group => group.hooks.map(hook => hook.command)));
    assert.equal(commands.every(command => command?.startsWith("AXIOM_HARNESS=codex ")), true);
    assert.deepEqual(input, CC_HOOKS);
  });
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


describe("generated Codex terminal hook", () => {
  it("keeps terminal hints silent outside Apple projects unless overridden", () => {
    const pluginRoot = path.resolve("axiom-codex");
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
    const command = manifest.hooks.PostToolUse.find(group => group.matcher === "Bash").hooks[0].command;
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-terminal-scope-"));
    const hints = "💡 Database migration issue. Try: skill axiom-data\n💡 Memory issue detected. Try: skill axiom-performance";
    try {
      fs.mkdirSync(path.join(workspace, ".git"));
      for (const testCase of [
        { apple: false, override: "", context: null },
        { apple: false, override: "always", context: hints },
        { apple: true, override: "never", context: null },
        { apple: true, override: "", context: hints },
      ]) {
        if (testCase.apple) fs.writeFileSync(path.join(workspace, "Package.swift"), "// swift-tools-version: 6.0\n");
        const result = spawnSync("sh", ["-lc", command], {
          cwd: workspace, encoding: "utf8",
          input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "swift build" },
            tool_response: { output: "CoreData: error during migration\nLeaks: memory leak in MyClass", exit_code: 0 } }),
          env: { ...process.env, PLUGIN_ROOT: pluginRoot, AXIOM_SESSION_CONTEXT: testCase.override },
        });
        const context = result.stdout ? JSON.parse(result.stdout).hookSpecificOutput.additionalContext : null;
        assert.deepEqual({ status: result.status, stderr: result.stderr, context },
          { status: 0, stderr: "", context: testCase.context }, JSON.stringify(testCase));
      }
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
  it("delivers stdin hints through the generated command from root and nested cwd", () => {
    const pluginRoot = path.resolve("axiom-codex");
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
    const command = manifest.hooks.PostToolUse.find(group => group.matcher === "Bash").hooks[0].command;
    const payload = { tool_name: "Bash", tool_input: { command: "swift build" }, tool_response: "data race detected" };
    for (const cwd of [process.cwd(), path.resolve("docs")]) {
      const result = spawnSync("sh", ["-lc", command], {
        cwd, input: JSON.stringify(payload), encoding: "utf8",
        env: { ...process.env, PLUGIN_ROOT: pluginRoot, CLAUDE_TOOL_OUTPUT: "linker command failed" },
      });
      assert.deepEqual({ status: result.status, stderr: result.stderr, output: JSON.parse(result.stdout) }, {
        status: 0, stderr: "", output: { hookSpecificOutput: {
          hookEventName: "PostToolUse", additionalContext: "💡 Concurrency issue. Try: skill axiom-concurrency",
        } },
      });
    }
  });
});

describe("startup shell fallback", () => {
  for (const harness of ["codex", "claude"]) {
    it(`provides usable ${harness} guidance after child failure from root and nested cwd`, () => {
      const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-startup-failure-"));
      try {
        const pluginRoot = path.join(fixture, 'package with "quotes"');
        const hooks = path.join(pluginRoot, "hooks");
        const nested = path.join(fixture, "workspace", "nested");
        fs.mkdirSync(hooks, { recursive: true });
        fs.mkdirSync(nested, { recursive: true });
        const source = harness === "codex" ? "axiom-codex" : ".claude-plugin/plugins/axiom";
        fs.copyFileSync(path.join(source, "hooks/session-start.sh"), path.join(hooks, "session-start.sh"));
        fs.chmodSync(path.join(hooks, "session-start.sh"), 0o755);
        fs.writeFileSync(path.join(hooks, "session-start.py"), "import sys\nsys.exit(23)\n");
        const manifest = JSON.parse(fs.readFileSync(path.join(source, "hooks/hooks.json"), "utf8"));
        const command = manifest.hooks.SessionStart[0].hooks[0].command;
        for (const cwd of [path.dirname(nested), nested]) {
          const env: NodeJS.ProcessEnv = { ...process.env, PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_ROOT: pluginRoot, CODEX_HOME: fixture };
          delete env.AXIOM_HARNESS;
          const result = spawnSync("sh", ["-lc", command], { cwd, env, input: "{}", encoding: "utf8", timeout: 5000 });
          assert.equal(result.status, 0, result.stderr);
          assert.match(result.stderr, /Python script failed \(exit 23\)/);
          const response = JSON.parse(result.stdout);
          const context = response.hookSpecificOutput.additionalContext;
          assert.equal(response.hookSpecificOutput.hookEventName, "SessionStart");
          if (harness === "codex") {
            assert.match(context, /skills\/<router>\/SKILL\.md/);
            assert.match(context, /file or terminal tools/);
            assert.match(context, /MCP/);
            assert.doesNotMatch(context, /via the Skill tool/);
          } else {
            assert.equal(context, "Axiom hook failed to initialize. Skills are still available via the Skill tool.");
          }
        }
      } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
      }
    });
  }
});

describe("generated Codex hook diagnostics", () => {
  it("records every generated handler lifecycle without changing protocol output", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-generated-diagnostics-"));
    try {
      const pluginRoot = path.resolve("axiom-codex");
      const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
      const payload = JSON.stringify({ prompt: "Swift concurrency Sendable", agent_type: "general-purpose", tool_name: "Bash", tool_input: { command: "swift build" }, tool_response: "data race detected" });
      let index = 0;
      for (const [event, groups] of Object.entries(manifest.hooks) as [string, { hooks: { command: string }[] }[]][]) {
        for (const { command } of groups.flatMap(group => group.hooks)) {
          const env: NodeJS.ProcessEnv = { ...process.env, PLUGIN_ROOT: pluginRoot, AXIOM_SESSION_CONTEXT: "always" };
          delete env.AXIOM_HOOK_DIAGNOSTICS_DIR;
          const baseline = spawnSync("sh", ["-lc", command], { cwd: fixture, env, input: payload, encoding: "utf8", timeout: 5000 });
          const destination = path.join(fixture, `diagnostics-${index++}`);
          env.AXIOM_HOOK_DIAGNOSTICS_DIR = destination;
          const enabled = spawnSync("sh", ["-lc", command], { cwd: fixture, env, input: payload, encoding: "utf8", timeout: 5000 });
          assert.deepEqual({ status: enabled.status, stdout: enabled.stdout, stderr: enabled.stderr }, { status: baseline.status, stdout: baseline.stdout, stderr: baseline.stderr });
          assert.equal(enabled.status, 0);
          const records = fs.readFileSync(path.join(destination, "axiom-hooks.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
          assert.deepEqual(records.map(record => [record.event, record.phase, record.outcome]), [[event, "start", "running"], [event, "end", "success"]]);
        }
      }
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
