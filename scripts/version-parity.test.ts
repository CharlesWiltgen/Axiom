import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every file in the repo that carries the Axiom plugin version.
 *
 * This list is the CLASS, and it exists because the class kept leaking one
 * member at a time. Two independent instances were found on 2026-09-05, both
 * fully green under the whole gate suite while desynced:
 *
 *   - `axiom-codex/.codex-plugin/plugin.json` — written only by build-codex.ts,
 *     which set-version.js did not run. Gate 12f (Codex staleness) compares
 *     skill/agent mtimes against the manifest and a version bump touches
 *     neither, so it could not fire.
 *   - `package.json` (root) — written by set-version.js, but pre-deploy read it
 *     only for the `pi` manifest block, never into the version-parity map.
 *     `pi install git:github.com/CharlesWiltgen/Axiom` resolves against it.
 *
 * A file that carries the version but is absent from pre-deploy's check 8 is
 * invisible to every gate. This test fails when the two drift.
 */
const VERSION_CARRYING_FILES = [
  ".claude-plugin/plugins/axiom/claude-code.json",
  ".claude-plugin/plugins/axiom/.claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".claude-plugin/plugins/axiom/hooks/metadata.txt",
  "docs/.vitepress/config.ts",
  "axiom-mcp/package.json",
  "axiom-cursor/.cursor-plugin/plugin.json",
  "axiom-codex/.codex-plugin/plugin.json",
  "package.json",
] as const;

function canonicalVersion(): string {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, ".claude-plugin/plugins/axiom/claude-code.json"), "utf8"),
  );
  return manifest.version;
}

/** Read the version out of a file, whatever shape it stores it in. */
function versionOf(relPath: string): string | undefined {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return undefined;
  const raw = fs.readFileSync(abs, "utf8");

  if (relPath.endsWith("metadata.txt")) return raw.trim().split("\n")[0];
  if (relPath.endsWith("config.ts")) return raw.match(/• v([0-9][^\s"'`<]*)/)?.[1];
  if (relPath === ".claude-plugin/marketplace.json") {
    return JSON.parse(raw).plugins?.find((p: { name: string }) => p.name === "axiom")?.version;
  }
  return JSON.parse(raw).version;
}

test("every version-carrying file exists", () => {
  for (const relPath of VERSION_CARRYING_FILES) {
    assert.ok(
      fs.existsSync(path.join(root, relPath)),
      `${relPath} is missing — regenerate the variant that owns it`,
    );
  }
});

test("every version-carrying file matches the canonical version", () => {
  const canonical = canonicalVersion();
  for (const relPath of VERSION_CARRYING_FILES) {
    assert.equal(
      versionOf(relPath),
      canonical,
      `${relPath} is out of sync with claude-code.json (${canonical})`,
    );
  }
});

test("pre-deploy check 8 covers exactly the version-carrying files", () => {
  // The guard that actually closes the class: a carrier added to the list above
  // without a matching read in check 8 — or dropped from check 8 — fails here
  // rather than shipping green.
  //
  // Check 8 populates `versions` two ways, so count both: direct literal-key
  // assignments (`versions["claude-code.json"] = …`, which use short display
  // labels rather than repo paths, so a path-substring match cannot see them),
  // plus the VERSION_CARRYING_FILES table it loops over.
  const preDeploy = fs.readFileSync(path.join(root, "scripts/pre-deploy.ts"), "utf8");

  const directKeys = [...preDeploy.matchAll(/\bversions\[\s*"([^"]+)"\s*\]\s*=/g)].map((m) => m[1]);
  const tableBlock = preDeploy.match(
    /const VERSION_CARRYING_FILES[\s\S]*?\n\];/,
  )?.[0];
  assert.ok(tableBlock, "pre-deploy.ts no longer declares VERSION_CARRYING_FILES");
  const tableEntries = [...tableBlock.matchAll(/\[\s*"[^"]+",\s*"([^"]+)"/g)].map((m) => m[1]);

  const covered = new Set([...directKeys, ...tableEntries]);
  assert.equal(
    covered.size,
    VERSION_CARRYING_FILES.length,
    `check 8 reads ${covered.size} version carriers but this test lists ` +
      `${VERSION_CARRYING_FILES.length}. Covered: ${[...covered].sort().join(", ")}`,
  );

  // The table half must match by real repo path; the direct half uses labels.
  for (const relPath of tableEntries) {
    assert.ok(
      (VERSION_CARRYING_FILES as readonly string[]).includes(relPath),
      `check 8 reads ${relPath}, which this test does not list as a version carrier`,
    );
  }
});
