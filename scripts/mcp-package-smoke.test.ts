import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { comparePackagedArtifacts, unexpectedPackedFiles } from "./mcp-package-smoke.ts";

const binaries = ["xclog", "xcproject"];

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-package-smoke-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, "plugin");
  const packageRoot = path.join(root, "package");
  for (const directory of ["plugin/bin", "plugin/licenses", "package/dist/bin", "package/dist/licenses"])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const name of binaries) {
    fs.writeFileSync(path.join(plugin, "bin", name), `binary ${name}`, { mode: 0o755 });
    fs.writeFileSync(path.join(packageRoot, "dist/bin", name), `binary ${name}`, { mode: 0o755 });
  }
  fs.writeFileSync(path.join(plugin, "licenses/xcproject.txt"), "license", { mode: 0o644 });
  fs.writeFileSync(path.join(packageRoot, "dist/licenses/xcproject.txt"), "license", { mode: 0o644 });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ bin: { xcproject: "./dist/bin/xcproject" } }),
  );
  return { plugin, packageRoot };
}

describe("comparePackagedArtifacts", () => {
  it("should report nothing when every packaged artifact matches its canonical copy", (t) => {
    const { plugin, packageRoot } = fixture(t);
    assert.deepEqual(comparePackagedArtifacts(packageRoot, plugin, binaries), []);
  });

  for (const [defect, damage, expected] of [
    [
      "a missing binary",
      (packageRoot: string) => fs.unlinkSync(path.join(packageRoot, "dist/bin/xclog")),
      ["dist/bin/xclog is missing from the package"],
    ],
    [
      "different binary bytes",
      (packageRoot: string) => fs.writeFileSync(path.join(packageRoot, "dist/bin/xcproject"), "stale"),
      ["dist/bin/xcproject differs from canonical bin/xcproject"],
    ],
    [
      "a lost executable mode",
      (packageRoot: string) => fs.chmodSync(path.join(packageRoot, "dist/bin/xclog"), 0o644),
      ["dist/bin/xclog mode 644 differs from canonical bin/xclog mode 755"],
    ],
    [
      "a missing license",
      (packageRoot: string) => fs.unlinkSync(path.join(packageRoot, "dist/licenses/xcproject.txt")),
      ["dist/licenses/xcproject.txt is missing from the package"],
    ],
    [
      "an unmapped xcproject CLI",
      (packageRoot: string) => fs.writeFileSync(path.join(packageRoot, "package.json"), "{}"),
      ["package.json bin.xcproject must be ./dist/bin/xcproject"],
    ],
  ] as const) {
    it(`should report ${defect}`, (t) => {
      const { plugin, packageRoot } = fixture(t);
      damage(packageRoot);
      assert.deepEqual(comparePackagedArtifacts(packageRoot, plugin, binaries), expected);
    });
  }
});

describe("unexpectedPackedFiles", () => {
  const allowed = ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/bin/xcproject"];

  it("should accept the manifest, README, LICENSE and everything under dist/", () => {
    assert.deepEqual(unexpectedPackedFiles(allowed), []);
  });

  it("should name every file outside the published allowlist", () => {
    assert.deepEqual(
      unexpectedPackedFiles([...allowed, ".npmrc", "fnox.toml", "src/index.ts", "distribution/x.js"]),
      [".npmrc", "fnox.toml", "src/index.ts", "distribution/x.js"],
    );
  });
});
