import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAskMd, manifestUpdates, readAgentsFromDisk } from "./manifest.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");
const agentsDir = path.join(pluginDir, "agents");
const claudeCodePath = path.join(pluginDir, "claude-code.json");

function committedManifest() {
  return JSON.parse(fs.readFileSync(claudeCodePath, "utf8"));
}

// The generator is what turns frontmatter into two committed files, and it had
// no test: the drift that took four CI runs to surface on 2026-09-17 was caught
// by a different test's assertion, not by anything covering this code.
test("ask.md lists the agents on disk rather than the empty manifest array", () => {
  // Regression guard for a shipped defect the source comments record: the
  // generator read `claudeCode.agents`, which is always empty because agents are
  // deliberately absent from claude-code.json, so /axiom:ask advertised "0
  // autonomous agents" with an empty Agents Reference and could not route to any.
  const agents = readAgentsFromDisk(agentsDir);
  assert.ok(agents.length > 0, "expected agent files on disk");

  const md = generateAskMd(committedManifest(), agentsDir);
  assert.ok(
    md.includes(`${agents.length} autonomous agents`),
    `prose should report ${agents.length} agents`,
  );
  for (const agent of agents) {
    assert.ok(md.includes(`**${agent.name}**`), `agent missing from ask.md: ${agent.name}`);
  }
});

test("ask.md covers every skill in the manifest", () => {
  const claudeCode = committedManifest();
  const skills = claudeCode.skills ?? [];
  assert.ok(skills.length > 0, "expected manifest skills");

  const md = generateAskMd(claudeCode, agentsDir);
  assert.ok(md.includes(`${skills.length} specialized Axiom skills`));
  const missing = skills.filter((s: { name: string }) => !md.includes(`**${s.name}**`));
  assert.deepEqual(missing.map((s: { name: string }) => s.name), []);
});

test("no template placeholder survives rendering", () => {
  // A missed replacement ships a literal {{skillCount}} into the one command
  // users are told to reach for when they don't know what they want.
  const md = generateAskMd(committedManifest(), agentsDir);
  assert.doesNotMatch(md, /\{\{\w+\}\}/);
});

test("generation is deterministic", () => {
  const claudeCode = committedManifest();
  assert.equal(
    generateAskMd(claudeCode, agentsDir),
    generateAskMd(committedManifest(), agentsDir),
  );
});

test("manifestUpdates regenerates the description from frontmatter, not the committed copy", () => {
  // This is the contract the drift gate depends on: `skills[]` is derived, so a
  // stale committed description must be replaced by the frontmatter's, and both
  // derived artifacts must be in the write set.
  const claudeCode = committedManifest();
  const first = claudeCode.skills?.[0]?.name;
  assert.ok(first, "expected at least one manifest skill");
  claudeCode.skills[0].description = "STALE — must be replaced by the frontmatter";

  const updates = manifestUpdates(claudeCode, pluginDir);
  const labels = updates.map((u) => u.label);
  assert.ok(labels.some((l) => l.endsWith("claude-code.json")), "manifest not in write set");
  assert.ok(labels.some((l) => l.endsWith("commands/ask.md")), "ask.md not in write set");

  const manifestUpdate = updates.find((u) => u.label.endsWith("claude-code.json"));
  assert.ok(manifestUpdate);
  const regenerated = JSON.parse(manifestUpdate.content);
  const entry = regenerated.skills.find((s: { name: string }) => s.name === first);
  assert.notEqual(
    entry.description,
    "STALE — must be replaced by the frontmatter",
    "stale description survived regeneration",
  );
  assert.equal(
    entry.description,
    committedManifest().skills.find((s: { name: string }) => s.name === first).description,
  );
});
