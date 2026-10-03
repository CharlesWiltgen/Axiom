import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const binary =
  process.env.AXIOM_XCPROJECT ??
  path.join(root, ".claude-plugin/plugins/axiom/bin/xcproject");
const fixtures = path.join(root, "scripts/fixtures/xcode-projects");
function run(args: string[], cwd = root) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr };
}
function success(args: string[], cwd = root) {
  const result = run(args, cwd);
  assert.deepEqual(
    { exit: result.exit, stderr: result.stderr },
    { exit: 0, stderr: "" },
  );
  return JSON.parse(result.stdout);
}
function failure(args: string[], pattern: RegExp, cwd = root) {
  const result = run(args, cwd);
  assert.equal(result.exit, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, pattern);
}
function temporary(action: (directory: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "xcproject-"));
  try {
    action(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const format of ["xcproj", "pbxproj"]) {
  describe(`inspect ${format}`, { skip: process.platform !== "darwin" }, () => {
    const project = path.join(fixtures, format, "Example.xcodeproj");
    it("returns explicit selection and preserves source bytes", () => {
      const file = path.join(project, `project.${format}`);
      const before = createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
      const result = success([
        "inspect",
        "--project",
        project,
        "--target",
        "Extension",
        "--configuration",
        "Release",
      ]);
      assert.deepEqual(
        {
          format: result.format,
          targets: result.targets,
          configurations: result.configurations,
          selection: result.selection,
          semantics: result.semantics,
        },
        {
          format,
          targets: ["Primary", "Extension", "Support"],
          configurations: ["Debug", "Release"],
          selection: { target: "Extension", configuration: "Release" },
          semantics: "declarations",
        },
      );
      assert.equal(
        createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
        before,
      );
    });
    it("discovers deeply nested projects with spaces and excludes dependencies", () =>
      temporary((directory) => {
        const nested = path.join(directory, "apps/ios app/Example.xcodeproj");
        fs.cpSync(project, nested, { recursive: true });
        for (const cache of [
          "Pods",
          "Carthage",
          ".build",
          "DerivedData",
          "node_modules",
          "scratch",
        ]) {
          fs.cpSync(project, path.join(directory, cache, "Hidden.xcodeproj"), {
            recursive: true,
          });
        }
        fs.symlinkSync(directory, path.join(directory, "loop"));
        const discovered = success(["discover", "--root", directory]);
        assert.deepEqual(discovered, { projects: [nested] });
        assert.equal(success(["inspect", "--root", directory]).project, nested);
      }));
    it("rejects missing target and configuration", () => {
      failure(
        ["inspect", "--project", project, "--target", "Missing"],
        /target.*Missing/i,
      );
      failure(
        ["inspect", "--project", project, "--configuration", "Missing"],
        /configuration.*Missing/i,
      );
    });
    it("rejects multiple projects until a project is explicitly selected", () =>
      temporary((directory) => {
        fs.cpSync(project, path.join(directory, "First.xcodeproj"), {
          recursive: true,
        });
        fs.cpSync(project, path.join(directory, "Second.xcodeproj"), {
          recursive: true,
        });
        failure(["inspect", "--root", directory], /ambiguous.*project/i);
        assert.equal(
          success([
            "inspect",
            "--project",
            path.join(directory, "First.xcodeproj"),
          ]).format,
          format,
        );
      }));
  });
}

describe("inspect structure", { skip: process.platform !== "darwin" }, () => {
  it("retains arrays, scripts, packages, products and folder exceptions without evaluating them", () => {
    const result = success([
      "inspect",
      "--project",
      path.join(fixtures, "xcproj/Example.xcodeproj"),
    ]);
    const d = result.declarations;
    assert.deepEqual(
      {
        flags:
          d["build-settings"]["GCC_PREPROCESSOR_DEFINITIONS[config=Debug]"],
        scripts: d.targets[0]["build-phases"]
          .filter((p: { kind?: string }) => p.kind === "script")
          .map((p: { script: unknown }) => p.script),
        packages: d.packages,
        products: d.targets[0]["package-product-members"].map(
          (p: { "product-name": string }) => p["product-name"],
        ),
        folder: d.files.find((f: { kind?: string }) => f.kind === "folder"),
        shared: d.files.find(
          (f: { path?: string }) => f.path === "Shared.swift",
        ),
        conditional:
          d.targets[1]["build-settings"][
            "OTHER_SWIFT_FLAGS[config=Debug][arch=arm64]"
          ],
        inherited:
          d.targets[2]["build-settings"].IPHONEOS_DEPLOYMENT_TARGET ?? null,
      },
      {
        flags: ["$(inherited)", "DEBUG=1"],
        scripts: ["echo fixture", ["echo first", "echo second"]],
        packages: [
          {
            kind: "remote",
            repository: "https://example.invalid/Remote",
            version: { "up-to-next-major-version": "1.0.0" },
          },
          { kind: "local", path: "Packages/Local" },
        ],
        products: ["LocalProduct", "RemoteProduct"],
        folder: {
          kind: "folder",
          path: "Sources",
          "target-membership": ["Extension", "Primary", "Support"],
          "membership-exceptions": [
            { target: "Extension", exclusions: ["Excluded.swift"] },
          ],
        },
        shared: {
          path: "Shared.swift",
          "target-membership": ["Primary/compile-sources"],
        },
        conditional: "$(inherited) -DARM64",
        inherited: null,
      },
    );
  });
  it("rejects malformed JSON5, missing default configuration and unsupported capability", () =>
    temporary((directory) => {
      const original = fs.readFileSync(
        path.join(fixtures, "xcproj/Example.xcodeproj/project.xcproj"),
        "utf8",
      );
      const project = path.join(directory, "Bad.xcodeproj");
      fs.mkdirSync(project);
      for (const text of [
        original.slice(0, -2),
        original.replace('  "default-configuration": "Release",\n', ""),
        original.replace(
          "{",
          '{"required-capabilities":["unsupported fixture capability"],',
        ),
      ]) {
        fs.writeFileSync(path.join(project, "project.xcproj"), text);
        failure(["inspect", "--project", project], /reading.*project.xcproj/i);
      }
    }));
  it("rejects absent projects, dual inner files and invalid options explicitly", () =>
    temporary((directory) => {
      failure(["inspect", "--root", directory], /no.*project/i);
      const project = path.join(directory, "Both.xcodeproj");
      fs.mkdirSync(project);
      for (const format of ["xcproj", "pbxproj"])
        fs.copyFileSync(
          path.join(fixtures, format, `Example.xcodeproj/project.${format}`),
          path.join(project, `project.${format}`),
        );
      failure(["inspect", "--project", project], /both.*project/i);
      failure(["inspect", "--unknown", "value"], /unknown.*option/i);
      failure(["inspect", "--target"], /value.*target/i);
      failure(
        ["inspect", "--root", directory, "--root", directory],
        /duplicate.*root/i,
      );
    }));
});

describe("settings", { skip: process.platform !== "darwin" }, () => {
  const project = path.join(fixtures, "xcproj/Example.xcodeproj");
  const valid = [
    {
      target: "Extension",
      buildSettings: {
        PROJECT_FILE_PATH: project,
        TARGET_NAME: "Extension",
        CONFIGURATION: "Debug",
        PLATFORM_NAME: "iphonesimulator",
        SDK_NAME: "iphonesimulator27.2",
        ARCHS: "arm64",
        IPHONEOS_DEPLOYMENT_TARGET: "26.4",
        OTHER_SWIFT_FLAGS: "-DBASE -DDEBUG_CONFIG",
      },
    },
  ];
  function argumentsFor(input: string) {
    return [
      "settings",
      "--project",
      project,
      "--input",
      input,
      "--target",
      "Extension",
      "--configuration",
      "Debug",
      "--sdk",
      "iphonesimulator",
      "--key",
      "IPHONEOS_DEPLOYMENT_TARGET",
    ];
  }
  it("returns the selected effective value with capture identity", () =>
    temporary((directory) => {
      const input = path.join(directory, "settings.json");
      fs.writeFileSync(input, JSON.stringify(valid));
      assert.deepEqual(success(argumentsFor(input)), {
        evaluation: "xcodebuild-general-settings",
        project,
        target: "Extension",
        configuration: "Debug",
        sdk: "iphonesimulator27.2",
        architectures: ["arm64"],
        key: "IPHONEOS_DEPLOYMENT_TARGET",
        value: "26.4",
      });
      assert.deepEqual(
        run([...argumentsFor(input), "--arch", "arm64", "--value-only"]),
        { exit: 0, stdout: "26.4\n", stderr: "" },
      );
    }));
  for (const [key, value] of [
    ["PROJECT_FILE_PATH", "/tmp/Other.xcodeproj"],
    ["TARGET_NAME", "Primary"],
    ["CONFIGURATION", "Release"],
    ["PLATFORM_NAME", "iphoneos"],
    ["SDK_NAME", "iphoneos27.2"],
    ["IPHONEOS_DEPLOYMENT_TARGET", ""],
    ["IPHONEOS_DEPLOYMENT_TARGET", null],
    ["IPHONEOS_DEPLOYMENT_TARGET", []],
  ] as const) {
    it(`rejects mismatching or missing ${key} (${JSON.stringify(value)})`, () =>
      temporary((directory) => {
        const input = path.join(directory, "settings.json");
        const record = structuredClone(valid);
        Object.assign(record[0].buildSettings, { [key]: value });
        fs.writeFileSync(input, JSON.stringify(record));
        failure(argumentsFor(input), /settings|capture|empty|missing/i);
      }));
  }
  it("rejects ambiguous, absent or malformed target records", () =>
    temporary((directory) => {
      const input = path.join(directory, "settings.json");
      for (const content of [
        JSON.stringify([]),
        JSON.stringify([...valid, ...valid]),
        "{",
        JSON.stringify([{ target: "Extension" }]),
      ]) {
        fs.writeFileSync(input, content);
        failure(argumentsFor(input), /settings|target|capture|reading/i);
      }
    }));
  it("rejects unsupported architecture and missing selector options", () =>
    temporary((directory) => {
      const input = path.join(directory, "settings.json");
      fs.writeFileSync(input, JSON.stringify(valid));
      failure([...argumentsFor(input), "--arch", "x86_64"], /architecture/i);
      failure(["settings", "--input", input], /required.*project/i);
      const record = structuredClone(valid);
      record[0].buildSettings.ARCHS = "arm64 x86_64";
      fs.writeFileSync(input, JSON.stringify(record));
      failure([...argumentsFor(input), "--arch", "arm64"], /architecture/i);
    }));
});

const oracles = process.env.AXIOM_XCPROJECT_ORACLES;
describe(
  "recorded Xcode effective-settings integration",
  { skip: !oracles || process.platform !== "darwin" },
  () => {
    it("returns all fourteen independently measured deployment values across both formats", () =>
      temporary((directory) => {
        const captures = JSON.parse(fs.readFileSync(oracles!, "utf8"));
        assert.equal(captures.length, 14);
        for (const capture of captures) {
          assert.equal(capture.exit, 0);
          const input = path.join(directory, "capture.json");
          fs.writeFileSync(input, capture.stdout);
          const project = capture.argv[capture.argv.indexOf("-project") + 1];
          const selection = capture.selection;
          assert.deepEqual(
            run([
              "settings",
              "--project",
              project,
              "--input",
              input,
              "--target",
              selection.target,
              "--configuration",
              selection.configuration,
              "--sdk",
              selection.sdk,
              "--arch",
              selection.arch,
              "--key",
              "IPHONEOS_DEPLOYMENT_TARGET",
              "--value-only",
            ]),
            {
              exit: 0,
              stdout: `${capture.expected_deployment}\n`,
              stderr: "",
            },
          );
        }
      }));
  },
);

describe(
  "OpenStep graph validation",
  { skip: process.platform !== "darwin" },
  () => {
    type PBXObject = {
      isa: string;
      name?: string;
      buildConfigurationList?: string;
      buildConfigurations?: string[];
      targets?: string[];
    };
    type PBXFixture = {
      objects: Record<string, PBXObject>;
      rootObject: string;
    };
    function configurationList(
      objects: Record<string, PBXObject>,
      owner: PBXObject,
    ) {
      assert.ok(owner.buildConfigurationList);
      return objects[owner.buildConfigurationList];
    }
    const changes: Record<
      string,
      (
        objects: Record<string, PBXObject>,
        project: PBXObject,
        target: PBXObject,
      ) => void
    > = {
      "missing target configuration list": (_objects, _project, target) => {
        delete target.buildConfigurationList;
      },
      "missing selected target configuration": (objects, _project, target) => {
        const list = configurationList(objects, target);
        assert.ok(list.buildConfigurations);
        list.buildConfigurations = list.buildConfigurations.filter(
          (id: string) => objects[id].name !== "Debug",
        );
      },
      "wrong target class": (_objects, _project, target) => {
        target.isa = "PBXFileReference";
      },
      "wrong project list class": (objects, project) => {
        configurationList(objects, project).isa = "PBXFileReference";
      },
      "wrong target list class": (objects, _project, target) => {
        configurationList(objects, target).isa = "PBXFileReference";
      },
      "wrong configuration class": (objects, _project, target) => {
        const list = configurationList(objects, target);
        assert.ok(list.buildConfigurations);
        objects[list.buildConfigurations[0]].isa = "PBXFileReference";
      },
    };
    for (const [name, change] of Object.entries(changes)) {
      it(`rejects ${name}`, () =>
        temporary((directory) => {
          const project = path.join(directory, "Broken.xcodeproj");
          fs.mkdirSync(project);
          const file = path.join(project, "project.pbxproj");
          const source = path.join(
            fixtures,
            "pbxproj/Example.xcodeproj/project.pbxproj",
          );
          const converted = spawnSync(
            "plutil",
            ["-convert", "json", "-o", "-", source],
            { encoding: "utf8" },
          );
          assert.equal(converted.status, 0, converted.stderr);
          const data: PBXFixture = JSON.parse(converted.stdout);
          const pbx = data.objects[data.rootObject];
          assert.ok(pbx.targets);
          const target = data.objects[pbx.targets[0]];
          change(data.objects, pbx, target);
          const json = path.join(directory, "modified.json");
          fs.writeFileSync(json, JSON.stringify(data));
          const serialized = spawnSync(
            "plutil",
            ["-convert", "xml1", "-o", file, json],
            { encoding: "utf8" },
          );
          assert.equal(serialized.status, 0, serialized.stderr);
          failure(
            [
              "inspect",
              "--project",
              project,
              "--target",
              "Primary",
              "--configuration",
              "Debug",
            ],
            /configuration|target/i,
          );
        }));
    }
  },
);
