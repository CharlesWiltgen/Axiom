#!/usr/bin/env node
/**
 * Regenerate the artifacts derived from SKILL.md frontmatter.
 *
 *   npm run build:manifest
 *
 * Two committed files are generated rather than hand-written: the `skills[]`
 * array in `claude-code.json`, and the `/axiom:ask` built from that array plus
 * the agents on disk. Editing any router's description invalidates both.
 *
 * Versions are deliberately not touched here — stamping is `set-version.js`'s
 * job, and it calls the same `manifestUpdates()` this does, so a content-only
 * regeneration and a release run one implementation and cannot diverge.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manifestUpdates } from "./manifest.ts";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptsDir, "..");
const pluginDir = path.join(root, ".claude-plugin/plugins/axiom");
const claudeCodePath = path.join(pluginDir, "claude-code.json");

if (!fs.existsSync(claudeCodePath)) {
  throw new Error(`Plugin manifest not found: ${claudeCodePath}`);
}

const claudeCode = JSON.parse(fs.readFileSync(claudeCodePath, "utf8"));
const updates = manifestUpdates(claudeCode, pluginDir);

let written = 0;
for (const update of updates) {
  const current = fs.existsSync(update.path)
    ? fs.readFileSync(update.path, "utf8")
    : null;
  if (current === update.content) {
    console.log(`  = ${update.label} (already current)`);
    continue;
  }
  fs.writeFileSync(update.path, update.content);
  console.log(`  ✓ ${update.label}`);
  written++;
}

console.log(
  written === 0
    ? "\nNothing to do — manifest and ask.md already match the frontmatter."
    : `\nRegenerated ${written} file(s).`,
);

// ask.md is embedded in three generated distributions, so regenerating it makes
// them stale. Leaving that to the caller meant following this command and then
// failing the gate on staleness it had just created — the same shape of trap as
// the version-script entry point this file exists to replace. `set-version.js`
// already cascades Cursor and Codex for the same reason; the MCP bundle embeds
// commands too, so it belongs here even though the release path omits it.
if (written > 0) {
  console.log("\nUpdating distributions that embed ask.md:");
  const builds = [
    ["scripts/build-cursor.ts", "Cursor"],
    ["scripts/build-codex.ts", "Codex"],
  ];
  for (const [script, label] of builds) {
    try {
      execFileSync(process.execPath, [path.join(root, script)], {
        stdio: "inherit",
        cwd: root,
      });
    } catch (err) {
      throw new Error(`${label} output is stale: ${err.message}`);
    }
  }
  try {
    execFileSync("pnpm", ["run", "build:bundle"], {
      stdio: "inherit",
      cwd: path.join(root, "axiom-mcp"),
    });
  } catch (err) {
    throw new Error(`MCP bundle is stale: ${err.message}`);
  }
}
