import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const script = fileURLToPath(new URL("./check-links.sh", import.meta.url));

function checkLinks(source: string, otherSource = "# Exists\n") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-check-links-"));
  try {
    fs.mkdirSync(path.join(root, "docs"));
    fs.mkdirSync(path.join(root, ".claude-plugin/plugins/axiom"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/index.md"), source);
    fs.writeFileSync(path.join(root, "docs/exists.md"), otherSource);
    return spawnSync("bash", [script], { cwd: root, encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("documentation link checker", () => {
  it("fails and counts a broken link", () => {
    const result = checkLinks("[Broken](./missing)\n");
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Found 1 broken link\(s\) out of 1 checked/);
    assert.doesNotMatch(result.stdout, /All .* links are valid/);
  });

  it("succeeds and counts valid internal links while skipping external links and anchors", () => {
    const result = checkLinks(
      "[Exists](./exists)\n[Web](https://example.com)\n[Anchor](#section)\n[Mail](mailto:test@example.com)\n",
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /All 1 links are valid/);
  });

  it("keeps totals across files and continues after a broken link", () => {
    const result = checkLinks(
      "[Broken](./missing)\n[Exists](./exists)\n",
      "[Home](./index)\n",
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Found 1 broken link\(s\) out of 3 checked/);
  });
});
