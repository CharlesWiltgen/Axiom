import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");
const manifestPath = path.join(pluginDir, ".claude-plugin/plugin.json");

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

// Claude Code reads .claude-plugin/plugin.json and has never read claude-code.json.
// Without this file the plugin name falls back to the INSTALL DIRECTORY, which in a
// marketplace cache is the version — reproduced on CC 2.1.241 as
// `27.0.0-beta.99:axiom-swiftui`, with /axiom:health-check answering "Unknown command".
// Today the marketplace entry's name masks it; nothing guarantees it keeps doing so.
test("ships a plugin manifest naming the plugin", () => {
  assert.ok(fs.existsSync(manifestPath), ".claude-plugin/plugin.json must exist");
  assert.equal(read(manifestPath).name, "axiom");
});

test("plugin manifest version tracks the canonical manifest", () => {
  assert.equal(
    read(manifestPath).version,
    read(path.join(pluginDir, "claude-code.json")).version,
    "set-version.js must write plugin.json alongside claude-code.json",
  );
});

test("plugin manifest declares no hooks, leaving hooks.json discovery intact", () => {
  // Hooks are found by convention at hooks/hooks.json. Declaring a `hooks` key
  // here would override that; the SessionStart injection would stop firing.
  assert.equal("hooks" in read(manifestPath), false);
  assert.ok(fs.existsSync(path.join(pluginDir, "hooks/hooks.json")));
});
