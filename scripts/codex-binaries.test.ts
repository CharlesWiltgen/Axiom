import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("generated Codex helpers", () => {
  it("ships canonical executable helpers and the xcproject license", () => {
    for (const name of ["xclog", "xcsym", "xcui", "xcprof", "xcproject"]) {
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
});
