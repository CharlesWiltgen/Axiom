import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

it("retains lifecycle failures and attributes only host-exposed outcomes", () => {
  const result = spawnSync("python3", ["scripts/codex-lifecycle_test.py"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
