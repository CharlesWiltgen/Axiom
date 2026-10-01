import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const helpers = [
  { name: "xclog", args: ["list", "--help"] },
  { name: "xcsym", args: ["--help"] },
  { name: "xcui", args: ["--help"] },
  { name: "xcprof", args: ["--help"] },
];

describe("generated Codex helpers", () => {
  it("ships executable canonical helpers at stable package paths", () => {
    for (const { name } of helpers) {
      const source = path.resolve(".claude-plugin/plugins/axiom/bin", name);
      const shipped = path.resolve("axiom-codex/bin", name);
      assert.equal(fs.existsSync(shipped), true, `${name} missing from Codex package`);
      assert.deepEqual(fs.readFileSync(shipped), fs.readFileSync(source));
      assert.equal(fs.statSync(shipped).mode & 0o777, fs.statSync(source).mode & 0o777);
      assert.ok(fs.statSync(shipped).mode & 0o111, `${name} is not executable`);
    }
  });
  it("runs bundled help from outside the project", { skip: process.platform !== "darwin" }, () => {
    for (const { name, args } of helpers) {
      const shipped = path.resolve("axiom-codex/bin", name);
      const result = spawnSync(shipped, args, { cwd: "/private/tmp", encoding: "utf8", timeout: 10000 });
      assert.equal(result.status, 0, `${name} help failed: ${result.error?.message ?? result.stderr}`);
      assert.ok((result.stdout + result.stderr).length > 0, `${name} help was empty`);
    }
  });
});
