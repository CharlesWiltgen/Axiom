import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, it } from "node:test";

// Packages whose suites run under their own runner in the release gate:
// axiom-mcp under vitest (Phase 2 MCP tests), axiom-pi in the Pi validation install.
const OWN_RUNNERS = ["axiom-mcp/", "axiom-pi/"];

describe("test:unit", () => {
  it("should match every repository test file outside packages with their own runner", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const globs = [...pkg.scripts["test:unit"].matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const covered = new Set(globs.flatMap((glob) => fs.globSync(glob)));
    const listed = spawnSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "*.test.ts",
        "*.test.js",
        "*.test.mjs",
      ],
      { encoding: "utf8" },
    );
    assert.equal(listed.status, 0, listed.stderr);
    const uncovered = listed.stdout
      .split("\n")
      .filter(Boolean)
      .filter((file) => !OWN_RUNNERS.some((root) => file.startsWith(root)))
      .filter((file) => !covered.has(file));
    assert.deepEqual(uncovered, []);
  });
});
