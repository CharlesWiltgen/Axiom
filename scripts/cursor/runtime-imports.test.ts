// Every canonical hook module a shipped Cursor runtime script imports must ship
// beside it. Several imports are guarded (subagent-start.py's version context,
// user-prompt-submit.py's project detector), so a module missing from the Cursor
// package fails soft and silently drops guidance instead of erroring. Codex has
// the same guarantee from the doctor's derived-closure test (codex-doctor.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderCursorHooks } from "./hooks.ts";

const HOOKS_DIR = path.resolve(import.meta.dirname, "../../.claude-plugin/plugins/axiom/hooks");

function importedModules(source: string): string[] {
  const names: string[] = [];
  for (const line of source.split("\n")) {
    const from = line.match(/^\s*from\s+([A-Za-z_]\w*)\s+import\b/);
    if (from) {
      names.push(from[1]);
      continue;
    }
    const plain = line.match(/^\s*import\s+([^#]+)/);
    if (plain) {
      for (const part of plain[1].split(",")) {
        const name = part.trim().match(/^([A-Za-z_]\w*)/)?.[1];
        if (name) names.push(name);
      }
    }
  }
  return names;
}

test("every canonical hook module a shipped Cursor script imports ships with it", () => {
  const canonical = new Set(
    fs
      .readdirSync(HOOKS_DIR)
      .filter((name) => name.endsWith(".py") && !name.endsWith("_test.py"))
      .map((name) => name.slice(0, -".py".length)),
  );
  const scripts = renderCursorHooks().filter((file) => /^scripts\/[^/]+\.py$/.test(file.path));
  const shipped = new Set(scripts.map((file) => path.basename(file.path, ".py")));
  const missing = scripts.flatMap((file) =>
    importedModules(file.content)
      .filter((name) => canonical.has(name) && !shipped.has(name))
      .map((name) => `${file.path} imports ${name}.py`),
  );
  assert.deepEqual(missing, []);
});
