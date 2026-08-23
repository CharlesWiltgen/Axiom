import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { compareCursorPaths } from "./compare.ts";
import { loadCursorSource } from "./source.ts";

/**
 * Independent raw scan of the canonical tree, deliberately NOT using loadCursorSource.
 *
 * Inventories are derived rather than pinned to a reviewed list, which keeps routine
 * capability additions from breaking the build. The cost is that a loader defect —
 * a filter that silently drops an agent, a manifest entry that never resolves — would
 * otherwise be invisible: generation, `check:cursor`, and every other Cursor test all
 * read the same loader, so they agree with each other while the output is wrong.
 * pre-deploy §12r catches it, but the Cursor CI workflow does not run pre-deploy.
 */

const pluginRoot = path.join(process.cwd(), ".claude-plugin", "plugins", "axiom");

function rawRouters(): string[] {
  return fs.readdirSync(path.join(pluginRoot, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()
      && fs.existsSync(path.join(pluginRoot, "skills", entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort(compareCursorPaths);
}

function rawAgents(): string[] {
  return fs.readdirSync(path.join(pluginRoot, "agents"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.basename(file, ".md"))
    .sort(compareCursorPaths);
}

function rawManifestCommands(): string[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, "claude-code.json"), "utf8"),
  ) as { commands?: unknown[] };
  return (manifest.commands ?? [])
    .map((entry) => path.posix.basename(String(entry), ".md"))
    .sort(compareCursorPaths);
}

test("loadCursorSource reports every router on disk, and no others", () => {
  const loaded = loadCursorSource(process.cwd()).skills
    .map((skill) => skill.name)
    .sort(compareCursorPaths);
  assert.deepEqual(loaded, rawRouters());
});

test("loadCursorSource reports every agent file on disk, and no others", () => {
  const loaded = loadCursorSource(process.cwd()).agents
    .map((agent) => agent.name)
    .sort(compareCursorPaths);
  assert.deepEqual(loaded, rawAgents());
});

test("loadCursorSource reports every command the canonical manifest declares", () => {
  const loaded = loadCursorSource(process.cwd()).commands
    .map((command) => command.filename.replace(/\.md$/, ""))
    .sort(compareCursorPaths);
  assert.deepEqual(loaded, rawManifestCommands());
});

test("a command whose frontmatter name diverges from its filename is rejected", () => {
  // transformCommand derives the emitted path from the filename and the emitted
  // `name:` from frontmatter, so a divergence would ship a mismatched command.
  const commands = loadCursorSource(process.cwd()).commands;
  for (const command of commands) {
    assert.equal(
      command.name,
      command.filename.replace(/\.md$/, ""),
      `${command.filename} must declare a name matching its filename`,
    );
  }
  assert.ok(commands.length > 0);
});
