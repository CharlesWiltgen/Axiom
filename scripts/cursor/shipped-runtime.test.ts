import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderCursorDistribution } from "./render.ts";

/**
 * `cursorRuntime` applies blind string substitutions over Python source before it ships.
 * Every other hook test stages the *pre*-transform bytes, so the files users actually
 * run were never executed. These tests exercise the post-transform artifact.
 */

const RUNTIME_FILES = [
  "scripts/cursor-hook-adapter.py",
  "scripts/posttool-bash-hints.py",
  "scripts/project_detect.py",
  "scripts/swift-guardrails.py",
];

function shippedRuntime(): Map<string, string> {
  const distribution = renderCursorDistribution(process.cwd(), { profile: "full" });
  return new Map(
    RUNTIME_FILES.map((relative) => {
      const file = distribution.plugin.get(relative);
      assert.ok(file, `expected ${relative} in the generated distribution`);
      return [relative, file.content.toString("utf8")];
    }),
  );
}

test("shipped Python runtime compiles after the Cursor string transforms", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-shipped-runtime-"));
  try {
    for (const [relative, content] of shippedRuntime()) {
      const filePath = path.join(directory, path.basename(relative));
      fs.writeFileSync(filePath, content);
      const result = spawnSync("python3", ["-c", "import ast,sys; ast.parse(open(sys.argv[1]).read())", filePath], {
        encoding: "utf8",
      });
      assert.equal(result.status, 0, `${relative} failed to parse:\n${result.stderr}`);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("shipped Python runtime carries no untransformed Claude tokens", () => {
  for (const [relative, content] of shippedRuntime()) {
    assert.doesNotMatch(content, /CLAUDE_TOOL_OUTPUT/, `${relative} kept a Claude env var name`);
    assert.doesNotMatch(content, /\/axiom:/, `${relative} kept a Claude command prefix`);
  }
});

test("the renamed environment variable agrees across writer and reader", () => {
  // cursorRuntime renames CLAUDE_TOOL_OUTPUT -> CURSOR_TOOL_OUTPUT by blind substitution.
  // The adapter sets it and posttool-bash-hints.py reads it; if the rename reached only
  // one side the hint would silently receive nothing, with no error anywhere.
  const runtime = shippedRuntime();
  const adapter = runtime.get("scripts/cursor-hook-adapter.py")!;
  const reader = runtime.get("scripts/posttool-bash-hints.py")!;
  assert.match(adapter, /CURSOR_TOOL_OUTPUT/, "the adapter must set the Cursor env var");
  assert.match(reader, /CURSOR_TOOL_OUTPUT/, "the reader must read the same Cursor env var");
});
