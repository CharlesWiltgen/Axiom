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
      Object.keys(swiftToolInputs(process.cwd())).filter((file) =>
        !file.startsWith("tools/xcproject/")
      ),
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
          fs.writeFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/.DS_Store"),
            "finder",
          );
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
        if (mutation === "clean" || mutation === "finder-dotfile") {
          assert.deepEqual(problems, []);
        } else {assert.ok(
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

function axbuildFixture() {
  const root = fixture();
  for (
    const file of [
      "Package.swift",
      "Makefile",
      "Sources/AxBuildCore/Domain.swift",
      "Sources/AxBuildCore/Domain.test.swift",
      "Sources/AxBuildCore/Fixtures/example.swift",
      "Sources/axbuild/main.swift",
    ]
  ) {
    const destination = path.join(root, "tools/axbuild", file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      file === "Package.swift"
        ? '.executableTarget(name: "axbuild")'
        : "axbuild fixture",
    );
  }
  const binary = path.join(root, ".claude-plugin/plugins/axiom/bin/axbuild");
  fs.writeFileSync(binary, "axbuild binary");
  fs.chmodSync(binary, 0o755);
  return root;
}

describe("axbuild build provenance", () => {
  it("tracks each tool independently and excludes pure tests and fixtures", () => {
    const root = axbuildFixture();
    try {
      const original = swiftToolInputs(root);
      assert.deepEqual(Object.keys(swiftToolInputs(root, "axbuild")), [
        "tools/axbuild/Makefile",
        "tools/axbuild/Package.swift",
        "tools/axbuild/Sources/AxBuildCore/Domain.swift",
        "tools/axbuild/Sources/axbuild/main.swift",
      ]);
      fs.appendFileSync(
        path.join(root, "tools/axbuild/Sources/AxBuildCore/Domain.swift"),
        "changed",
      );
      assert.deepEqual(swiftToolInputs(root), original);
      recordSwiftToolBuild(root, swiftToolInputs(root, "axbuild"), "axbuild");
      assert.deepEqual(checkSwiftToolBuild(root, false, "axbuild"), []);
      const record = JSON.parse(
        fs.readFileSync(
          path.join(
            root,
            ".claude-plugin/plugins/axiom/build-info/axbuild.json",
          ),
          "utf8",
        ),
      );
      assert.equal(record.license, undefined);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  for (
    const mutation of [
      "clean",
      "source-changed",
      "source-deleted",
      "source-added",
      "test-changed",
      "fixture-changed",
      "binary-changed",
      "nonexecutable",
    ] as const
  ) {
    it(`checks axbuild ${mutation} without license placeholders`, () => {
      const root = axbuildFixture();
      try {
        recordSwiftToolBuild(root, swiftToolInputs(root, "axbuild"), "axbuild");
        const source = path.join(
          root,
          "tools/axbuild/Sources/AxBuildCore/Domain.swift",
        );
        if (mutation === "source-changed") fs.appendFileSync(source, "changed");
        if (mutation === "source-deleted") fs.unlinkSync(source);
        if (mutation === "source-added") {
          fs.writeFileSync(source.replace("Domain", "Extra"), "new source");
        }
        if (mutation === "test-changed") {
          fs.appendFileSync(
            source.replace(".swift", ".test.swift"),
            "test changed",
          );
        }
        if (mutation === "fixture-changed") {
          fs.appendFileSync(
            path.join(
              root,
              "tools/axbuild/Sources/AxBuildCore/Fixtures/example.swift",
            ),
            "fixture changed",
          );
        }
        if (mutation === "binary-changed") {
          fs.appendFileSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/axbuild"),
            "binary changed",
          );
        }
        if (mutation === "nonexecutable") {
          fs.chmodSync(
            path.join(root, ".claude-plugin/plugins/axiom/bin/axbuild"),
            0o644,
          );
        }
        const problems = checkSwiftToolBuild(root, false, "axbuild");
        if (["clean", "test-changed", "fixture-changed"].includes(mutation)) {
          assert.deepEqual(problems, []);
        } else assert.ok(problems.length > 0, mutation);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
  it("refuses changed inputs mid-build and retains xcproject license validation", () => {
    const root = axbuildFixture();
    try {
      const snapshot = swiftToolInputs(root, "axbuild");
      fs.appendFileSync(
        path.join(root, "tools/axbuild/Sources/axbuild/main.swift"),
        "changed",
      );
      assert.throws(
        () => recordSwiftToolBuild(root, snapshot, "axbuild"),
        /axbuild.*inputs.*changed/,
      );
      fs.writeFileSync(
        path.join(root, ".claude-plugin/plugins/axiom/licenses/xcproject.txt"),
        "wrong",
      );
      assert.throws(
        () => recordSwiftToolBuild(root, swiftToolInputs(root)),
        /license/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  for (
    const mutation of [
      "staged-source",
      "working-source-deleted",
      "staged-mode",
    ] as const
  ) {
    it(`checks ${mutation} from the correct source view`, () => {
      const root = axbuildFixture();
      try {
        recordSwiftToolBuild(root, swiftToolInputs(root, "axbuild"), "axbuild");
        execFileSync("git", ["init", "-q", root]);
        execFileSync("git", ["-C", root, "add", "."]);
        const source = path.join(
          root,
          "tools/axbuild/Sources/AxBuildCore/Domain.swift",
        );
        if (mutation === "staged-source") {
          fs.appendFileSync(source, "changed");
          execFileSync("git", ["-C", root, "add", source]);
          fs.writeFileSync(source, "axbuild fixture");
        }
        if (mutation === "working-source-deleted") fs.unlinkSync(source);
        if (mutation === "staged-mode") {
          execFileSync("git", [
            "-C",
            root,
            "update-index",
            "--chmod=-x",
            ".claude-plugin/plugins/axiom/bin/axbuild",
          ]);
        }
        const staged = checkSwiftToolBuild(root, true, "axbuild");
        const working = checkSwiftToolBuild(root, false, "axbuild");
        if (mutation === "working-source-deleted") {
          assert.deepEqual(staged, []);
          assert.ok(working.length > 0);
        } else {
          assert.ok(staged.length > 0, mutation);
          assert.deepEqual(working, []);
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

it("checks axbuild Codex bytes and executable mode alongside licensed xcproject", () => {
  const root = axbuildFixture();
  try {
    for (
      const file of ["bin/xcproject", "bin/axbuild", "licenses/xcproject.txt"]
    ) {
      const output = path.join(root, "axiom-codex", file);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(
        path.join(root, ".claude-plugin/plugins/axiom", file),
        output,
      );
    }
    assert.deepEqual(checkCodexToolArtifacts(root, false), []);
    fs.appendFileSync(path.join(root, "axiom-codex/bin/axbuild"), "changed");
    assert.deepEqual(checkCodexToolArtifacts(root, false), [
      "axiom-codex/bin/axbuild differs from its canonical bytes or executable mode",
    ]);
    fs.copyFileSync(
      path.join(root, ".claude-plugin/plugins/axiom/bin/axbuild"),
      path.join(root, "axiom-codex/bin/axbuild"),
    );
    fs.chmodSync(path.join(root, "axiom-codex/bin/axbuild"), 0o644);
    assert.deepEqual(checkCodexToolArtifacts(root, false), [
      "axiom-codex/bin/axbuild differs from its canonical bytes or executable mode",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
