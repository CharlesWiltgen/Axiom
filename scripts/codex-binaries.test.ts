import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { HELPERS } from "./codex-doctor.mjs";

const helpers = Object.entries(HELPERS).map(([name, args]) => ({ name, args }));

describe("generated Codex helpers", () => {
  it("ships executable canonical helpers and the xcproject license", () => {
    for (const { name } of helpers) {
      const source = path.resolve(".claude-plugin/plugins/axiom/bin", name);
      const shipped = path.resolve("axiom-codex/bin", name);
      assert.equal(
        fs.existsSync(shipped),
        true,
        `${name} missing from Codex package`,
      );
      assert.deepEqual(fs.readFileSync(shipped), fs.readFileSync(source));
      assert.equal(
        fs.statSync(shipped).mode & 0o777,
        fs.statSync(source).mode & 0o777,
      );
      assert.ok(fs.statSync(shipped).mode & 0o111, `${name} is not executable`);
    }
    assert.deepEqual(
      fs.readFileSync("axiom-codex/licenses/xcproject.txt"),
      fs.readFileSync(".claude-plugin/plugins/axiom/licenses/xcproject.txt"),
    );
  });
  it("runs bundled help from outside the project", {
    skip: process.platform !== "darwin",
  }, () => {
    for (const { name, args } of helpers) {
      const shipped = path.resolve("axiom-codex/bin", name);
      const result = spawnSync(shipped, args, {
        cwd: "/private/tmp",
        encoding: "utf8",
        timeout: 10000,
      });
      assert.equal(
        result.status,
        0,
        `${name} help failed: ${result.error?.message ?? result.stderr}`,
      );
      assert.ok(
        (result.stdout + result.stderr).length > 0,
        `${name} help was empty`,
      );
    }
  });
});
