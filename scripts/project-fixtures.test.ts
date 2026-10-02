import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { scanText } from "./leak-scan.ts";

const fixtures = path.join(import.meta.dirname, "fixtures/xcode-projects");

describe("project compatibility fixtures", () => {
  it(
    "preserves the independent contract in JSON5 and OpenStep project files",
    { skip: process.platform !== "darwin" },
    () => {
      const xcFile = path.join(
        fixtures,
        "xcproj/Example.xcodeproj/project.xcproj",
      );
      const pbxFile = path.join(
        fixtures,
        "pbxproj/Example.xcodeproj/project.pbxproj",
      );
      assert.ok(fs.existsSync(xcFile), "Missing JSON5 compatibility fixture");
      assert.ok(
        fs.existsSync(pbxFile),
        "Missing OpenStep compatibility fixture",
      );
      const cache = fs.mkdtempSync(path.join(os.tmpdir(), "fixture-swift-"));
      try {
        const xc = JSON.parse(
          execFileSync(
            "xcrun",
            [
              "swift",
              "-module-cache-path",
              cache,
              "-e",
              "import Foundation; let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])); let value = try JSONSerialization.jsonObject(with: data, options: [.json5Allowed]); FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: value))",
              xcFile,
            ],
            { encoding: "utf8", timeout: 60_000 },
          ),
        );
        const pbx = JSON.parse(
          execFileSync("plutil", ["-convert", "json", "-o", "-", pbxFile], {
            encoding: "utf8",
          }),
        );
        assert.deepEqual(
          xc.targets.map((t: { name: string }) => t.name),
          ["Primary", "Extension", "Support"],
        );
        assert.deepEqual(xc.configurations, [
          { name: "Debug", file: "Config/Debug.xcconfig" },
          { name: "Release", file: "Config/Release.xcconfig" },
        ]);
        assert.equal(xc["default-configuration"], "Release");
        assert.equal(
          xc.targets[0]["build-settings"].IPHONEOS_DEPLOYMENT_TARGET,
          "26.5",
        );
        assert.deepEqual(xc.targets[1]["build-settings"], {
          "IPHONEOS_DEPLOYMENT_TARGET[config=Debug]": "26.2",
          "IPHONEOS_DEPLOYMENT_TARGET[config=Release]": "26.3",
          "IPHONEOS_DEPLOYMENT_TARGET[config=Debug][sdk=iphonesimulator*]":
            "26.4",
          "OTHER_SWIFT_FLAGS[config=Debug][arch=arm64]": "$(inherited) -DARM64",
          PRODUCT_BUNDLE_IDENTIFIER: "org.example.Extension",
        });
        assert.equal(
          xc.targets[2]["build-settings"].IPHONEOS_DEPLOYMENT_TARGET,
          undefined,
        );
        assert.deepEqual(xc.packages, [
          {
            kind: "remote",
            repository: "https://example.invalid/Remote",
            version: { "up-to-next-major-version": "1.0.0" },
          },
          { kind: "local", path: "Packages/Local" },
        ]);
        assert.deepEqual(xc.targets[0]["build-phases"], [
          "compile-sources",
          "frameworks",
          "resources",
          {
            kind: "script",
            name: "OneLine",
            "log-environment-variables": true,
            shell: "/bin/sh",
            script: "echo fixture",
          },
          {
            kind: "script",
            name: "MultiLine",
            "log-environment-variables": true,
            shell: "/bin/sh",
            script: ["echo first", "echo second"],
          },
        ]);
        assert.deepEqual(xc.targets[0]["package-product-members"], [
          {
            package: "Local",
            "product-name": "LocalProduct",
            "build-phase": { "build-phase": "frameworks" },
          },
          {
            package: "Remote",
            "product-name": "RemoteProduct",
            "build-phase": { "build-phase": "frameworks" },
          },
        ]);
        assert.deepEqual(
          xc.files.find((f: { kind?: string }) => f.kind === "folder"),
          {
            kind: "folder",
            path: "Sources",
            "target-membership": ["Extension", "Primary", "Support"],
            "membership-exceptions": [
              { target: "Extension", exclusions: ["Excluded.swift"] },
            ],
          },
        );
        assert.deepEqual(xc["build-settings"], {
          "DEBUG_INFORMATION_FORMAT[config=Debug]": "dwarf",
          "GCC_PREPROCESSOR_DEFINITIONS[config=Debug]": [
            "$(inherited)",
            "DEBUG=1",
          ],
          "ONLY_ACTIVE_ARCH[config=Debug]": "YES",
          PRODUCT_NAME: "$(TARGET_NAME)",
          SDKROOT: "iphoneos",
          "SWIFT_COMPILATION_MODE[config=Debug]": "singlefile",
          "SWIFT_COMPILATION_MODE[config=Release]": "wholemodule",
          SWIFT_VERSION: "6.0",
        });
        assert.equal(xc["required-capabilities"], undefined);
        assert.deepEqual(
          xc.targets.map((t: { kind?: string }) => t.kind ?? "native"),
          ["native", "native", "native"],
        );
        const project = pbx.objects[pbx.rootObject];
        assert.deepEqual(
          xc.files.find((f: { path?: string }) => f.path === "Shared.swift"),
          {
            path: "Shared.swift",
            "target-membership": ["Primary/compile-sources"],
          },
        );
        assert.deepEqual(
          project.targets.map((id: string) => {
            const target = pbx.objects[id];
            const sources = target.buildPhases
              .map((phase: string) => pbx.objects[phase])
              .filter(
                (phase: { isa: string }) =>
                  phase.isa === "PBXSourcesBuildPhase",
              );
            return {
              name: target.name,
              sources: sources.flatMap((phase: { files: string[] }) =>
                phase.files.map(
                  (file: string) => pbx.objects[pbx.objects[file].fileRef].path,
                ),
              ),
              folders: target.fileSystemSynchronizedGroups.map(
                (folder: string) => pbx.objects[folder].path,
              ),
            };
          }),
          [
            {
              name: "Primary",
              sources: ["Shared.swift"],
              folders: ["Sources"],
            },
            { name: "Extension", sources: [], folders: ["Sources"] },
            { name: "Support", sources: [], folders: ["Sources"] },
          ],
        );
        const syncedFolder =
          pbx.objects[
            pbx.objects[project.targets[0]].fileSystemSynchronizedGroups[0]
          ];
        assert.deepEqual(
          syncedFolder.exceptions.map((id: string) => ({
            target: pbx.objects[pbx.objects[id].target].name,
            exclusions: pbx.objects[id].membershipExceptions,
          })),
          [{ target: "Extension", exclusions: ["Excluded.swift"] }],
        );
        assert.deepEqual(
          project.packageReferences.map((id: string) => pbx.objects[id]),
          [
            {
              isa: "XCRemoteSwiftPackageReference",
              repositoryURL: "https://example.invalid/Remote",
              requirement: {
                kind: "upToNextMajorVersion",
                minimumVersion: "1.0.0",
              },
            },
            {
              isa: "XCLocalSwiftPackageReference",
              relativePath: "Packages/Local",
            },
          ],
        );
        const primary = pbx.objects[project.targets[0]];
        assert.deepEqual(
          primary.packageProductDependencies.map((id: string) => ({
            product: pbx.objects[id].productName,
            kind: pbx.objects[pbx.objects[id].package].isa,
          })),
          [
            { product: "RemoteProduct", kind: "XCRemoteSwiftPackageReference" },
            { product: "LocalProduct", kind: "XCLocalSwiftPackageReference" },
          ],
        );
        assert.deepEqual(
          primary.buildPhases
            .map((id: string) => pbx.objects[id])
            .filter(
              (phase: { isa: string }) =>
                phase.isa === "PBXFrameworksBuildPhase",
            )
            .flatMap((phase: { files: string[] }) =>
              phase.files.map(
                (id: string) =>
                  pbx.objects[pbx.objects[id].productRef].productName,
              ),
            ),
          ["RemoteProduct", "LocalProduct"],
        );

        const declarations = project.targets.map((id: string) => {
          const target = pbx.objects[id];
          return {
            name: target.name,
            deployments: pbx.objects[
              target.buildConfigurationList
            ].buildConfigurations.map(
              (id: string) =>
                pbx.objects[id].buildSettings.IPHONEOS_DEPLOYMENT_TARGET ??
                null,
            ),
          };
        });
        assert.deepEqual(declarations, [
          { name: "Primary", deployments: ["26.5", "26.5"] },
          { name: "Extension", deployments: ["26.2", "26.3"] },
          { name: "Support", deployments: [null, null] },
        ]);
        assert.deepEqual(
          pbx.objects[project.targets[0]].buildPhases
            .map((id: string) => pbx.objects[id])
            .filter(
              (v: { isa: string }) => v.isa === "PBXShellScriptBuildPhase",
            )
            .map((v: { shellScript: string }) => v.shellScript),
          ["echo fixture", "echo first\necho second"],
        );
        assert.deepEqual(
          Object.values(pbx.objects)
            .filter(
              (v: unknown) =>
                (v as { isa: string }).isa ===
                "XCSwiftPackageProductDependency",
            )
            .map((v: unknown) => (v as { productName: string }).productName)
            .sort(),
          ["LocalProduct", "RemoteProduct"],
        );
        const exception = Object.values(pbx.objects).find(
          (v: unknown) =>
            (v as { isa: string }).isa ===
            "PBXFileSystemSynchronizedBuildFileExceptionSet",
        ) as { target: string; membershipExceptions: string[] };
        assert.deepEqual(
          {
            target: pbx.objects[exception.target].name,
            exclusions: exception.membershipExceptions,
          },
          { target: "Extension", exclusions: ["Excluded.swift"] },
        );
        const extension = pbx.objects[project.targets[1]];
        const debug =
          pbx.objects[
            pbx.objects[extension.buildConfigurationList].buildConfigurations[0]
          ];
        assert.deepEqual(debug.buildSettings["OTHER_SWIFT_FLAGS[arch=arm64]"], [
          "$(inherited)",
          "-DARM64",
        ]);
        assert.equal(
          debug.buildSettings[
            "IPHONEOS_DEPLOYMENT_TARGET[sdk=iphonesimulator*]"
          ],
          "26.4",
        );
        assert.deepEqual(
          pbx.objects[project.buildConfigurationList].buildConfigurations.map(
            (id: string) =>
              pbx.objects[pbx.objects[id].baseConfigurationReference].path,
          ),
          ["Debug.xcconfig", "Release.xcconfig"],
        );
        for (const format of ["pbxproj", "xcproj"]) {
          assert.equal(
            fs.readFileSync(
              path.join(fixtures, format, "Sources/Excluded.swift"),
              "utf8",
            ),
            "",
          );
          assert.equal(
            fs.readFileSync(
              path.join(fixtures, format, "Shared.swift"),
              "utf8",
            ),
            "",
          );
          assert.equal(
            fs.readFileSync(
              path.join(fixtures, format, "Config/Base.xcconfig"),
              "utf8",
            ),
            "IPHONEOS_DEPLOYMENT_TARGET = 26.1\nOTHER_SWIFT_FLAGS = -DBASE\n",
          );
          for (const config of ["Debug", "Release"]) {
            assert.equal(
              fs.readFileSync(
                path.join(fixtures, format, `Config/${config}.xcconfig`),
                "utf8",
              ),
              `#include "Base.xcconfig"\nOTHER_SWIFT_FLAGS = $(inherited) -D${config.toUpperCase()}_CONFIG\n`,
            );
          }
        }
      } finally {
        fs.rmSync(cache, { recursive: true, force: true });
      }
    },
  );

  it("contains no identifying content in distributed fixtures", () => {
    assert.ok(fs.existsSync(fixtures), "Missing sanitized fixture directory");
    const provenance = JSON.parse(
      fs.readFileSync(path.join(fixtures, "provenance.json"), "utf8"),
    );
    assert.deepEqual(
      Object.fromEntries(
        ["pbxproj", "xcproj"].map((format) => [
          format,
          createHash("sha256")
            .update(
              fs.readFileSync(
                path.join(
                  fixtures,
                  format,
                  "Example.xcodeproj",
                  `project.${format}`,
                ),
              ),
            )
            .digest("hex"),
        ]),
      ),
      provenance.sha256,
    );

    const files = fs
      .readdirSync(fixtures, { recursive: true })
      .map(String)
      .filter((rel) => fs.statSync(path.join(fixtures, rel)).isFile());
    assert.ok(
      files.length >= 6,
      "Scan must cover projects, configuration files and provenance",
    );
    assert.deepEqual(
      files.flatMap((rel) =>
        scanText(rel, fs.readFileSync(path.join(fixtures, rel), "utf8")),
      ),
      [],
    );
  });
});

const sourceRoot =
  process.env.AXIOM_PROJECT_SOURCE_ROOT ??
  path.resolve(import.meta.dirname, "..");
const regressions = process.env.AXIOM_PROJECT_REGRESSION === "1";

describe("project workflow regressions", { skip: !regressions }, () => {
  for (const format of ["pbxproj", "xcproj"] as const) {
    for (const shell of ["bash", "zsh"]) {
      for (const scenario of [
        "root",
        "deep",
        "extension",
        "simulator",
        "release",
        "inherited",
      ] as const) {
        it(`${format}/${shell}: returns the selected deployment target for ${scenario}`, (t) => {
          const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "project-regression-"),
          );
          try {
            const layout = scenario === "deep" ? "apps/ios" : ".";
            fs.cpSync(
              path.join(fixtures, format),
              path.join(directory, layout),
              { recursive: true },
            );
            const source = fs.readFileSync(
              path.join(
                sourceRoot,
                ".claude-plugin/plugins/axiom/commands/status.md",
              ),
              "utf8",
            );
            const command = source
              .split("\n")
              .find(
                (line) =>
                  line.startsWith("find . -maxdepth") ||
                  line.startsWith('grep -r "IPHONEOS'),
              );
            assert.ok(command, "No status deployment-target command found");
            const target =
              scenario === "extension" ||
              scenario === "simulator" ||
              scenario === "release"
                ? "Extension"
                : scenario === "inherited"
                  ? "Support"
                  : "Primary";
            const expected = {
              root: "26.5",
              deep: "26.5",
              extension: "26.2",
              simulator: "26.4",
              release: "26.3",
              inherited: "26.1",
            }[scenario];
            const result = spawnSync(shell, ["-c", command], {
              cwd: directory,
              encoding: "utf8",
              timeout: 20_000,
              env: {
                ...process.env,
                AXIOM_TARGET: target,
                AXIOM_CONFIGURATION:
                  scenario === "release" ? "Release" : "Debug",
                AXIOM_SDK:
                  scenario === "simulator" ? "iphonesimulator" : "iphoneos",
              },
            });
            t.diagnostic(
              JSON.stringify({
                argv: [shell, "-c", command],
                scenario,
                target,
                expected,
                exit: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
              }),
            );
            assert.equal(result.error, undefined);
            assert.equal(result.status, 0);
            const value =
              result.stdout.match(/\b\d+(?:\.\d+)+\b/)?.[0] ??
              result.stdout.trim();
            assert.equal(
              value,
              expected,
              `status oracle for ${target}/${scenario === "release" ? "Release" : "Debug"}/${scenario === "simulator" ? "iphonesimulator" : "iphoneos"} in ${layout}`,
            );
          } finally {
            fs.rmSync(directory, { recursive: true, force: true });
          }
        });
      }
      for (const scenario of [
        "missing-target",
        "missing-project",
        "multiple-projects",
      ] as const) {
        it(`${format}/${shell}: reports ${scenario} explicitly`, (t) => {
          const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "project-regression-"),
          );
          try {
            if (scenario !== "missing-project")
              fs.cpSync(path.join(fixtures, format), directory, {
                recursive: true,
              });
            if (scenario === "multiple-projects")
              fs.cpSync(
                path.join(directory, "Example.xcodeproj"),
                path.join(directory, "Other.xcodeproj"),
                { recursive: true },
              );
            const source = fs.readFileSync(
              path.join(
                sourceRoot,
                ".claude-plugin/plugins/axiom/commands/status.md",
              ),
              "utf8",
            );
            const command = source
              .split("\n")
              .find(
                (line) =>
                  line.startsWith("find . -maxdepth") ||
                  line.startsWith('grep -r "IPHONEOS'),
              );
            assert.ok(command);
            const result = spawnSync(shell, ["-c", command], {
              cwd: directory,
              encoding: "utf8",
              timeout: 20_000,
              env: {
                ...process.env,
                AXIOM_TARGET:
                  scenario === "missing-target" ? "AbsentTarget" : "Primary",
              },
            });
            t.diagnostic(
              JSON.stringify({
                argv: [shell, "-c", command],
                scenario,
                expected: "nonzero exit with diagnostic",
                exit: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
              }),
            );
            assert.equal(result.error, undefined);
            assert.notEqual(
              result.status,
              0,
              "Missing or ambiguous selection must fail explicitly",
            );
            assert.ok(
              result.stderr.trim().length > 0,
              "Failure must explain the selection problem",
            );
          } finally {
            fs.rmSync(directory, { recursive: true, force: true });
          }
        });
      }
      const settings = [
        "SWIFT_COMPILATION_MODE",
        "ONLY_ACTIVE_ARCH",
        "DEBUG_INFORMATION_FORMAT",
        "GCC_PREPROCESSOR_DEFINITIONS",
      ];
      for (const setting of settings) {
        it(`${format}/${shell}: locates ${setting} declarations under ios/`, (t) => {
          const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "project-regression-"),
          );
          try {
            fs.cpSync(
              path.join(fixtures, format),
              path.join(directory, "ios"),
              { recursive: true },
            );
            const source = fs.readFileSync(
              path.join(
                sourceRoot,
                ".claude-plugin/plugins/axiom/skills/axiom-build/skills/build-performance.md",
              ),
              "utf8",
            );
            const commands = source
              .split("\n")
              .filter((line) => line.startsWith(`grep "${setting}"`));
            assert.equal(
              commands.length,
              1,
              `Expected the census command for ${setting}`,
            );
            const result = spawnSync(shell, ["-c", commands[0]], {
              cwd: directory,
              encoding: "utf8",
              timeout: 20_000,
            });
            t.diagnostic(
              JSON.stringify({
                argv: [shell, "-c", commands[0]],
                setting,
                expected: "nonempty declaration",
                exit: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
              }),
            );
            assert.equal(result.error, undefined);
            assert.equal(result.status, 0);
            assert.ok(
              result.stdout.trim().length > 0,
              `Empty setting lookup: ${commands[0]}`,
            );
          } finally {
            fs.rmSync(directory, { recursive: true, force: true });
          }
        });
      }
    }
  }
});

const decoder = process.env.AXIOM_XCPROJ_FORMATTER;
describe("Apple typed decoder fixture boundaries", { skip: !decoder }, () => {
  for (const scenario of [
    "valid",
    "missing-configuration",
    "unsupported-capability",
    "malformed",
  ] as const) {
    it(`validates the ${scenario} control with the pinned decoder`, () => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "project-decoder-"),
      );
      try {
        let text = fs.readFileSync(
          path.join(fixtures, "xcproj/Example.xcodeproj/project.xcproj"),
          "utf8",
        );
        if (scenario === "missing-configuration")
          text = text.replace(/  "default-configuration": "Release",\n/, "");
        if (scenario === "unsupported-capability")
          text = text.replace(
            "{",
            '{"required-capabilities": ["fixture unsupported capability"],',
          );
        if (scenario === "malformed") text = text.slice(0, -2);
        const file = path.join(directory, "project.xcproj");
        fs.writeFileSync(file, text);
        const result = spawnSync(decoder!, ["--input", file], {
          encoding: "utf8",
          timeout: 20_000,
        });
        assert.equal(result.error, undefined);
        if (scenario === "valid") {
          assert.deepEqual(
            { exit: result.status, stderr: result.stderr, text: result.stdout },
            { exit: 0, stderr: "", text },
          );
        } else {
          assert.equal(result.status, 255);
          assert.ok(
            result.stderr.length > 0,
            "Invalid input must have an actionable diagnostic",
          );
        }
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
