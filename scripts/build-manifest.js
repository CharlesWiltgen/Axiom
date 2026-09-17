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
 *
 * Those two files are themselves embedded in three generated distributions (the
 * Cursor plugin, the Codex plugin, the MCP bundle), which is why this cascades.
 * The cascade is keyed on whether the distributions can be *stale*, not on
 * whether this run wrote anything: a body-only edit to any SKILL.md changes
 * neither generated file, yet still invalidates all three.
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

/** Sources whose content feeds at least one generated distribution. */
const DISTRIBUTION_SOURCES = ["skills", "agents", "commands"].map((d) =>
  path.join(pluginDir, d),
);

function runCascade() {
  console.log("\nUpdating distributions that embed the generated files:");
  for (const [script, label] of [
    ["scripts/build-cursor.ts", "Cursor"],
    ["scripts/build-codex.ts", "Codex"],
  ]) {
    execFileSync(process.execPath, [path.join(root, script)], {
      stdio: "inherit",
      cwd: root,
    });
    console.log(`  ✓ ${label}`);
  }
  try {
    execFileSync("pnpm", ["run", "build:bundle"], {
      stdio: "inherit",
      cwd: path.join(root, "axiom-mcp"),
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        "pnpm is not on PATH, so the MCP bundle could not be rebuilt. " +
          "Install pnpm, or run `npm run build:mcp` yourself — until then the " +
          "bundle is stale and `npm run check:ci` will fail on it.",
      );
    }
    throw new Error(`MCP bundle build failed: ${err.message}`);
  }
  console.log("  ✓ MCP bundle");
}

function main() {
  if (!fs.existsSync(claudeCodePath)) {
    throw new Error(`Plugin manifest not found: ${claudeCodePath}`);
  }

  const claudeCode = JSON.parse(fs.readFileSync(claudeCodePath, "utf8"));
  const updates = manifestUpdates(claudeCode, pluginDir);

  // Write to a temp file and rename, as set-version.js does: an interrupted run
  // then leaves the previous manifest and ask.md together, rather than a
  // regenerated manifest beside a stale ask.md — a skew nothing detects.
  const pending = [];
  let askMdChanged = false;
  for (const update of updates) {
    const current = fs.existsSync(update.path)
      ? fs.readFileSync(update.path, "utf8")
      : null;
    if (current === update.content) {
      console.log(`  = ${update.label} (already current)`);
      continue;
    }
    if (update.path.endsWith(path.join("commands", "ask.md"))) askMdChanged = true;
    const temp = `${update.path}.tmp`;
    fs.writeFileSync(temp, update.content);
    pending.push([temp, update.path]);
    console.log(`  ✓ ${update.label}`);
  }
  for (const [temp, dest] of pending) fs.renameSync(temp, dest);

  console.log(
    pending.length === 0
      ? "  (manifest and ask.md already match the frontmatter)"
      : `  regenerated ${pending.length} file(s)`,
  );

  // What makes a distribution stale is its *inputs*, and those are the plugin's
  // skill/agent/command files — including ask.md, which they embed.
  // `claude-code.json` is not one of them, so a manifest-only hand-edit that this
  // command simply repairs must not trigger a rebuild: the tracked 22 MB bundle
  // would be rewritten for its build timestamp alone.
  //
  // Neither is "this run wrote something" a sufficient signal — a body-only edit
  // to any SKILL.md changes neither generated file and still invalidates all
  // three distributions, which is why the working tree is consulted too.
  let stale = askMdChanged;
  if (!stale) {
    try {
      const dirty = execFileSync(
        "git",
        ["status", "--porcelain", "--", ...DISTRIBUTION_SOURCES],
        { cwd: root, encoding: "utf8" },
      );
      stale = dirty.trim().length > 0;
    } catch {
      // No git, or not a repository: cannot tell. The staleness gate will.
      stale = false;
    }
  }

  if (!stale) {
    console.log("\nDistributions are current — nothing to rebuild.");
    return;
  }
  runCascade();
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}
