import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  checkCodexToolArtifacts,
  checkSwiftToolBuild,
  recordSwiftToolBuild,
  swiftToolInputs,
} from "./swift-tool.ts";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "swift-tool-"));
  const files = [
    "tools/xcproject/Package.swift",
    "tools/xcproject/Package.resolved",
    "tools/xcproject/Makefile",
    "tools/xcproject/Sources/xcproject/main.swift",
    "tools/xcproject/THIRD_PARTY_LICENSE.txt",
    "scripts/swift-tool.ts",
    ".claude-plugin/plugins/axiom/bin/xcproject",
    ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
  ];
  for (const file of files) {
    const dest = path.join(root, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(
      dest,
      file.endsWith("Package.swift")
        ? '.executableTarget(name: "xcproject")'
        : "fixture",
    );
  }
  fs.chmodSync(
    path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
    0o755,
  );
  return root;
}

describe("Swift tool build provenance", () => {
  it("records only the files that build xcproject, not the checker that reads the record", () => {
    // Listing the checker made any edit to it demand a rebuild of an unchanged binary.
    assert.deepEqual(
      Object.keys(swiftToolInputs(process.cwd())).filter((file) => !file.startsWith("tools/xcproject/")),
      [],
    );
  });

  for (
    const mutation of [
      "clean",
      "manifest-deleted",
      "library-manifest",
      "source-deleted",
      "source-changed",
      "binary-changed",
      "license-changed",
      "record-missing",
      "record-invalid",
      "mtime-only",
      "identical-rebuild",
    ] as const
  ) {
    it(`validates ${mutation} against the recorded build inputs`, () => {
      const root = fixture();
      try {
        recordSwiftToolBuild(root, swiftToolInputs(root));
        const source = path.join(
          root,
          "tools/xcproject/Sources/xcproject/main.swift",
        );
        const manifest = path.join(root, "tools/xcproject/Package.swift");
        const record = path.join(
          root,
          ".claude-plugin/plugins/axiom/build-info/xcproject.json",
        );
        if (mutation === "manifest-deleted") fs.unlinkSync(manifest);
        if (mutation === "library-manifest") {
          fs.writeFileSync(manifest, '.target(name: "xcproject")');
        }
        if (mutation === "source-deleted") fs.unlinkSync(source);
        if (mutation === "source-changed") {
          fs.writeFileSync(source, "changed source");
        }
        if (mutation === "binary-changed") {
          fs.writeFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
            "changed binary",
          );
        }
        if (mutation === "license-changed") {
          fs.writeFileSync(
            path.join(
              root,
              ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
            ),
            "changed license",
          );
        }
        if (mutation === "record-missing") fs.unlinkSync(record);
        if (mutation === "record-invalid") fs.writeFileSync(record, "{}");
        if (mutation === "mtime-only") fs.utimesSync(source, 1, 1);
        if (mutation === "identical-rebuild") {
          fs.appendFileSync(
            path.join(root, "tools/xcproject/Makefile"),
            "\n# comment",
          );
          recordSwiftToolBuild(root, swiftToolInputs(root));
        }
        const problems = checkSwiftToolBuild(root);
        if (["clean", "mtime-only", "identical-rebuild"].includes(mutation)) {
          assert.deepEqual(problems, []);
        } else {assert.ok(
            problems.length > 0,
            `${mutation} must fail build validation`,
          );}
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
  it("rejects sources changed while a build was running", () => {
    const root = fixture();
    try {
      const snapshot = swiftToolInputs(root);
      fs.appendFileSync(
        path.join(root, "tools/xcproject/Sources/xcproject/main.swift"),
        "changed",
      );
      assert.throws(
        () => recordSwiftToolBuild(root, snapshot),
        /inputs.*changed/i,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkCodexToolArtifacts", () => {
  for (
    const mutation of [
      "clean",
      "finder-dotfile",
      "missing",
      "changed",
      "unstaged",
      "staged-mode",
      "staged-license",
      "staged-binary",
      "both-staged-nonexec",
    ] as const
  ) {
    it(`checks ${mutation} Codex artifact parity`, () => {
      const root = fixture();
      const binary = "axiom-codex/bin/xcproject";
      const license = "axiom-codex/licenses/xcproject.txt";
      try {
        fs.mkdirSync(path.join(root, "axiom-codex/bin"), { recursive: true });
        fs.mkdirSync(path.join(root, "axiom-codex/licenses"));
        fs.copyFileSync(
          path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
          path.join(root, binary),
        );
        fs.copyFileSync(
          path.join(
            root,
            ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
          ),
          path.join(root, license),
        );
        execFileSync("git", ["init", "-q", root]);
        execFileSync("git", ["-C", root, "add", "."]);
        if (mutation === "missing") fs.unlinkSync(path.join(root, binary));
        if (mutation === "changed") {
          fs.appendFileSync(path.join(root, binary), "changed");
        }
        if (mutation === "unstaged") {
          execFileSync("git", ["-C", root, "rm", "--cached", binary]);
        }
        if (mutation === "staged-mode") {
          execFileSync("git", [
            "-C",
            root,
            "update-index",
            "--chmod=-x",
            binary,
          ]);
        }
        if (mutation === "both-staged-nonexec") {
          execFileSync("git", [
            "-C",
            root,
            "update-index",
            "--chmod=-x",
            binary,
            ".claude-plugin/plugins/axiom/bin/xcproject",
          ]);
        }
        if (mutation === "staged-license") {
          fs.appendFileSync(path.join(root, license), "changed");
          execFileSync("git", ["-C", root, "add", license]);
          fs.copyFileSync(
            path.join(
              root,
              ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
            ),
            path.join(root, license),
          );
        }
        if (mutation === "finder-dotfile") {
          // Gitignored, so Finder can create it unseen; it is not a helper.
          fs.writeFileSync(path.join(root, ".claude-plugin/plugins/axiom/bin/.DS_Store"), "finder");
        }
        if (mutation === "staged-binary") {
          fs.appendFileSync(path.join(root, binary), "changed");
          execFileSync("git", ["-C", root, "add", binary]);
          fs.copyFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
            path.join(root, binary),
          );
        }
        const problems = checkCodexToolArtifacts(root, true);
        if (mutation === "clean" || mutation === "finder-dotfile") assert.deepEqual(problems, []);
        else {assert.ok(
            problems.length > 0,
            `${mutation} must fail distribution validation`,
          );}
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe("checkSwiftToolBuild index", () => {
  for (
    const mutation of [
      "clean",
      "large-clean",
      "source",
      "added-source",
      "binary",
      "license",
      "record",
    ] as const
  ) {
    it(`validates ${mutation} against the staged build record`, () => {
      const root = fixture();
      try {
        if (mutation === "large-clean") {
          fs.writeFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
            Buffer.alloc(2 * 1024 * 1024, 17),
          );
        }
        recordSwiftToolBuild(root, swiftToolInputs(root));
        execFileSync("git", ["init", "-q", root]);
        execFileSync("git", ["-C", root, "add", "."]);
        const file = {
          source: "tools/xcproject/Sources/xcproject/main.swift",
          "added-source": "tools/xcproject/Sources/xcproject/extra.swift",
          binary: ".claude-plugin/plugins/axiom/bin/xcproject",
          license: ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
          record: ".claude-plugin/plugins/axiom/build-info/xcproject.json",
          clean: "",
          "large-clean": "",
        }[mutation];
        if (file) {
          const target = path.join(root, file);
          const previous = fs.existsSync(target)
            ? fs.readFileSync(target)
            : null;
          fs.writeFileSync(target, "staged change");
          execFileSync("git", ["-C", root, "add", file]);
          if (previous) fs.writeFileSync(target, previous);
          else fs.unlinkSync(target);
        }
        assert.deepEqual(checkSwiftToolBuild(root), []);
        const problems = checkSwiftToolBuild(root, true);
        if (!file) assert.deepEqual(problems, []);
        else {assert.ok(
            problems.length > 0,
            `${mutation} index must fail independently of working tree`,
          );}
        if (mutation === "large-clean") {
          fs.mkdirSync(path.join(root, "axiom-codex/bin"), { recursive: true });
          fs.mkdirSync(path.join(root, "axiom-codex/licenses"));
          fs.copyFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject"),
            path.join(root, "axiom-codex/bin/xcproject"),
          );
          fs.copyFileSync(
            path.join(
              root,
              ".claude-plugin/plugins/axiom/licenses/xcproject.txt",
            ),
            path.join(root, "axiom-codex/licenses/xcproject.txt"),
          );
          execFileSync("git", ["-C", root, "add", "axiom-codex"]);
          assert.deepEqual(checkCodexToolArtifacts(root, true), []);
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
  it("reports a missing canonical bin directory as a validation problem", () => {
    const root = fixture();
    try {
      fs.rmSync(path.join(root, ".claude-plugin/plugins/axiom/bin"), {
        recursive: true,
      });
      assert.ok(checkCodexToolArtifacts(root, false).length > 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
