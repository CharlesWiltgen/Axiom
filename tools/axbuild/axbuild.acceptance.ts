import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type NativeReport = {
  schemaVersion: number;
  command: {
    exitCode: number | null;
    status: string;
    interruptionSignal: number | null;
  };
  collection: { status: string; issues: unknown[] };
  counts: { failedTests: number | null };
  omissions: { diagnostics: number; details: number };
  artifacts: {
    run: string;
    report: string;
    log: string;
    resultBundle?: string;
    eventStream?: string;
  };
  diagnostics: {
    file: string | null;
    items: {
      kind: string;
      severity: string;
      message: string;
      line?: number;
      column?: number;
      test?: {
        framework: string;
        isFailure: boolean | null;
        evaluatedValues?: unknown;
        messages?: string[];
      };
    }[];
  }[];
};
type MeasurementManifest = {
  schemaVersion: number;
  projectPath: string;
  scheme: string;
  destination: string;
  developerDirectories: string[];
  trialResults: unknown[];
};
type CaseResult = {
  name: string;
  passed: boolean;
  durationMs: number;
  evidence?: string;
  error?: string;
};

export function scoreNativeOutcome(
  report: NativeReport,
  expectedExit: number,
): void {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.command.exitCode, expectedExit);
  assert.equal(
    report.command.status,
    expectedExit === 0 ? "succeeded" : "failed",
  );
}

export function scoreCompilerEvidence(
  full: NativeReport,
  log: string,
  projectRoot: string,
  expected: {
    compilerErrors: {
      file: string;
      line: number;
      column: number;
      message: string;
      target?: string;
      project?: string;
    }[];
    compilerWarnings: {
      file: string;
      line: number;
      column: number;
      message: string;
      target?: string;
      project?: string;
    }[];
  },
): void {
  const keys = [
    ...expected.compilerErrors.map((key) => ({ ...key, severity: "error" })),
    ...expected.compilerWarnings.map((key) => ({
      ...key,
      severity: "warning",
    })),
  ].map((key) => ({ ...key, file: path.resolve(projectRoot, key.file) }));
  const emitted = log.split("\n").flatMap((line) => {
    const match = /^(.+):(\d+):(\d+): (error|warning): (.*)$/.exec(line);
    if (!match) return [];
    const observed = {
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      severity: match[4],
      message: match[5],
    };
    const key = keys.find((key) =>
      key.file === observed.file && key.line === observed.line &&
      key.column === observed.column && key.severity === observed.severity &&
      (key.message === observed.message ||
        (key.target && key.project &&
          `${key.message} (in target '${key.target}' from project '${key.project}')` ===
            observed.message))
    );
    assert.ok(
      key,
      `Native diagnostic differs from independent fixture key: ${line}`,
    );
    return [JSON.stringify(observed)];
  });
  const retained = full.diagnostics.flatMap((group) =>
    group.items.filter((item) => item.kind === "compiler").map((item) =>
      JSON.stringify({
        file: group.file,
        line: item.line,
        column: item.column,
        message: item.message,
        severity: item.severity,
      })
    )
  );
  const normalize = (record: string) => {
    const value = JSON.parse(record);
    return JSON.stringify([
      value.file,
      value.line,
      value.column,
      value.severity,
      value.message,
    ]);
  };
  assert.deepEqual(
    retained.map(normalize).sort(),
    emitted.map(normalize).sort(),
    "Retained compiler evidence differs from independently checked native diagnostics",
  );
  assert.ok(emitted.length > 0);
  for (const key of keys) {
    assert.ok(
      emitted.some((record) => {
        const observed = JSON.parse(record);
        return observed.file === key.file && observed.line === key.line &&
          observed.column === key.column && observed.severity === key.severity &&
          (observed.message === key.message ||
            observed.message ===
              `${key.message} (in target '${key.target}' from project '${key.project}')`);
      }),
      `${key.file}:${key.line}:${key.column}: ${key.message}`,
    );
  }
}

function xcodePreflight(): void {
  const count = spawnSync("sh", ["-c", "pgrep -x xcodebuild | wc -l"], {
    encoding: "utf8",
  });
  const inventory = spawnSync("pgrep", ["-x", "xcodebuild"], {
    encoding: "utf8",
  });
  assert.equal(count.status, 0, count.stderr);
  assert.ok(
    inventory.status === 0 || inventory.status === 1,
    `process inventory failed: ${inventory.stderr}`,
  );
  assert.equal(
    Number(count.stdout.trim()),
    inventory.stdout.trim() ? inventory.stdout.trim().split("\n").length : 0,
  );
  assert.equal(
    inventory.status,
    1,
    `Investigate existing Xcode builds before native acceptance: ${inventory.stdout}`,
  );
}

async function acceptance(manifestPath: string): Promise<void> {
  const manifest: MeasurementManifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(path.isAbsolute(manifest.projectPath));
  assert.ok(fs.existsSync(manifest.projectPath));
  assert.ok(
    manifest.scheme && manifest.destination &&
      manifest.developerDirectories.length,
  );
  assert.ok(
    manifest.trialResults.length >= 20,
    "Approved paired measurement evidence is required before acceptance",
  );
  const projectRoot = path.dirname(manifest.projectPath);
  const expected = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "expected.json"), "utf8"),
  );
  const binary = path.resolve(
    import.meta.dirname,
    "../../.claude-plugin/plugins/axiom/bin/axbuild",
  );
  fs.accessSync(binary, fs.constants.X_OK);
  const help = spawnSync(binary, ["--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  const root = path.resolve("scratch/axbuild", `acceptance-${Date.now()}`);
  fs.mkdirSync(root, { recursive: true });
  const results: CaseResult[] = [];
  const detachedJobs: {
    signal: string;
    pid: number;
    observedSurvivor: boolean;
    fixtureCleanup: boolean;
  }[] = [];
  const env = {
    ...process.env,
    DEVELOPER_DIR: manifest.developerDirectories[0],
  };
  const xcode = [
    "xcodebuild",
    "-project",
    manifest.projectPath,
    "-scheme",
    manifest.scheme,
    "-destination",
    manifest.destination,
    "-configuration",
    "Debug",
    "CODE_SIGNING_ALLOWED=NO",
    "ONLY_ACTIVE_ARCH=YES",
  ];
  function captured(
    name: string,
    args: string[],
    expectedExit: number,
    extraEnvironment: NodeJS.ProcessEnv = {},
  ): { full: NativeReport; compact: NativeReport; log: string } {
    if (args[0] === "xcodebuild") xcodePreflight();
    const output = spawnSync(binary, args, {
      cwd: projectRoot,
      env: { ...env, ...extraEnvironment },
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(output.error, undefined);
    fs.writeFileSync(path.join(root, name + ".stdout"), output.stdout);
    fs.writeFileSync(path.join(root, name + ".stderr"), output.stderr);
    fs.writeFileSync(
      path.join(root, name + ".argv.json"),
      JSON.stringify(args),
    );
    assert.equal(output.status, expectedExit, output.stderr.toString());
    assert.ok(
      output.stdout.length <= 8000,
      `stdout exceeded ceiling: ${output.stdout.length}`,
    );
    const compact: NativeReport = JSON.parse(output.stdout.toString());
    scoreNativeOutcome(compact, expectedExit);
    const startup = output.stderr.toString().split("\n").map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).find((record) => record?.event === "run");
    assert.equal(startup?.path, compact.artifacts.run);
    const fullPath = path.resolve(
      compact.artifacts.run,
      compact.artifacts.report,
    );
    const logPath = path.resolve(compact.artifacts.run, compact.artifacts.log);
    const full: NativeReport = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    fs.copyFileSync(fullPath, path.join(root, name + ".report.json"));
    fs.copyFileSync(logPath, path.join(root, name + ".log"));
    scoreNativeOutcome(full, expectedExit);
    return { full, compact, log: fs.readFileSync(logPath, "utf8") };
  }
  async function check(
    name: string,
    action: () => void | Promise<void>,
  ): Promise<void> {
    const start = Date.now();
    try {
      await action();
      results.push({
        name,
        passed: true,
        durationMs: Date.now() - start,
        evidence: root,
      });
    } catch (error) {
      results.push({
        name,
        passed: false,
        durationMs: Date.now() - start,
        error: String(error),
        evidence: root,
      });
    }
    fs.writeFileSync(
      path.join(root, "acceptance.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          manifestPath,
          results,
          detachedJobs,
          gaps: [
            "Xcode 26 is unavailable",
            "Detached descendants are found by parentage captured at interruption; jobs Xcode starts outside that lineage are not stopped",
            "Agent adoption is measured only with direct-file guidance in Claude Code safe mode and Codex; plugin auto-discovery, Pi and Cursor remain unmeasured (Axiom-9ur1.10)",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${results.at(-1)!.passed ? "PASS" : "FAIL"} ${name}`);
  }
  for (const cache of ["fresh", "incremental"]) {
    const dd = path.join(root, "build-dd");
    await check(`xcode-${cache}-build`, () => {
      const r = captured(`xcode-${cache}-build`, [
        ...xcode,
        "-derivedDataPath",
        dd,
        "build",
      ], 0);
      if (cache === "fresh") assert.ok(r.log.includes("CompileC "));
      else {
        assert.ok(!r.log.includes("CompileC "));
        assert.ok(!r.log.includes("SwiftCompile "));
      }
    });
    await check(`xcode-${cache}-faults`, () => {
      const r = captured(`xcode-${cache}-faults`, [
        ...xcode,
        "-derivedDataPath",
        path.join(root, "faults-dd"),
        "AXBUILD_SWIFT_CONDITIONS=AXBUILD_FAULTS",
        "build",
      ], 65);
      scoreCompilerEvidence(r.full, r.log, projectRoot, expected);
      assert.ok(
        r.compact.omissions.diagnostics > 0 || r.compact.omissions.details > 0,
      );
    });
  }
  for (const framework of ["xcode", "swiftpm"]) {
    for (const iteration of ["fresh", "incremental"]) {
      await check(`${framework}-${iteration}-tests`, () => {
        const args = framework === "xcode"
          ? [
            ...xcode.map((arg, i) =>
              i > 0 && xcode[i - 1] === "-scheme" ? "Tests" : arg
            ),
            "-derivedDataPath",
            path.join(root, "tests-dd"),
            "test",
          ]
          : [
            "swift",
            "test",
            "--package-path",
            path.join(projectRoot, "Package"),
            "--scratch-path",
            path.join(root, "swiftpm-tests-dd"),
          ];
        const r = captured(
          `${framework}-${iteration}-tests`,
          args,
          framework === "xcode" ? 65 : 1,
        );
        const records = r.full.diagnostics.flatMap((group) => group.items);
        for (const marker of expected.testFailures) {
          assert.ok(
            records.some((item) =>
              (item.message + JSON.stringify(item.test)).includes(marker)
            ),
            marker,
          );
        }
        assert.deepEqual(
          [
            ...new Set(
              records.filter((item) => item.test?.isFailure === true).map(
                (item) => item.test!.framework,
              ),
            ),
          ].sort(),
          [...expected.testFrameworks].sort(),
        );
        assert.equal(r.full.counts.failedTests, expected.failedTests);
        assert.ok(
          records.some((item) =>
            item.test?.framework === "swift-testing" &&
            ((Array.isArray(item.test.evaluatedValues) &&
              item.test.evaluatedValues.includes("3")) ||
              item.test.messages?.includes("actual → 3"))
          ),
        );
        assert.ok(r.full.artifacts.resultBundle || framework === "swiftpm");
      });
    }
  }
  for (const iteration of ["fresh", "incremental"]) {
    await check(`swiftpm-${iteration}-build`, () => {
      captured(`swiftpm-${iteration}-build`, [
        "swift",
        "build",
        "--package-path",
        path.join(projectRoot, "Package"),
        "--scratch-path",
        path.join(root, "swiftpm-dd"),
      ], 0);
    });
  }
  for (const framework of ["xcode", "swiftpm"]) {
    await check(`${framework}-large-test-evidence`, () => {
      const args = framework === "xcode"
        ? [
          ...xcode.map((arg, i) =>
            i > 0 && xcode[i - 1] === "-scheme" ? "Stress" : arg
          ),
          "-derivedDataPath",
          path.join(root, "stress-dd"),
          "-only-testing:Tests/stress()",
          "test",
        ]
        : [
          "swift",
          "test",
          "--package-path",
          path.join(projectRoot, "Package"),
          "--scratch-path",
          path.join(root, "swiftpm-tests-dd"),
          "--filter",
          "stress",
        ];
      const run = captured(
        `${framework}-large-test-evidence`,
        args,
        framework === "xcode" ? 65 : 1,
        { AXBUILD_STRESS: "YES" },
      );
      const records = run.full.diagnostics.flatMap((group) => group.items)
        .filter((item) =>
          item.kind === "test" &&
          (item.message + JSON.stringify(item.test)).includes("STRESS_MARKER")
        );
      assert.equal(records.length, expected.stressFailures);
      assert.ok(run.compact.omissions.diagnostics > 0);
      assert.ok(
        fs.statSync(
          path.join(root, `${framework}-large-test-evidence.report.json`),
        ).size > 8000,
      );
    });
  }
  await check("xcode-test-compile-failure", () => {
    const r = captured("xcode-test-compile-failure", [
      ...xcode.map((arg, i) => i > 0 && xcode[i - 1] === "-scheme" ? "Tests" : arg),
      "-derivedDataPath",
      path.join(root, "test-compile-dd"),
      "SWIFT_ACTIVE_COMPILATION_CONDITIONS=AXBUILD_TEST_FAULTS",
      "test",
    ], 65);
    assert.equal(r.full.counts.failedTests, 0);
    assert.ok(
      r.full.diagnostics.some((group) =>
        group.file?.endsWith("/Tests/XCTestCases.swift") &&
        group.items.some((item) => item.kind === "compiler" && item.severity === "error")
      ),
    );
    assert.ok(
      !r.full.collection.issues.some((issue) =>
        (issue as { operation?: string }).operation === "count failed tests"
      ),
    );
  });
  await check("script-failure", () => {
    const r = captured("script-failure", [
      ...xcode,
      "-derivedDataPath",
      path.join(root, "script-dd"),
      "AXBUILD_SCRIPT_FAIL=YES",
      "build",
    ], 65);
    assert.ok(
      r.full.diagnostics.flatMap((group) => group.items).some((item) =>
        item.message.includes(expected.scriptFailure)
      ),
    );
  });
  await check("link-failure", () => {
    const r = captured("link-failure", [
      ...xcode,
      "-derivedDataPath",
      path.join(root, "link-dd"),
      "OTHER_LDFLAGS=-lAXBUILD_MISSING_LIBRARY",
      "build",
    ], 65);
    assert.ok(
      r.full.diagnostics.flatMap((group) => group.items).some((item) =>
        item.kind === "linker" && item.message.includes(expected.linkFailure)
      ),
    );
  });
  await check("caller-result-path", () => {
    const result = path.join(root, "caller.xcresult");
    const r = captured("caller-result-path", [
      ...xcode,
      "-derivedDataPath",
      path.join(root, "caller-dd"),
      "-resultBundlePath",
      result,
      "build",
    ], 0);
    assert.equal(r.full.artifacts.resultBundle, result);
    assert.ok(fs.existsSync(result));
  });
  await check("informational-passthrough", () => {
    const direct = spawnSync("swift", ["build", "--help"], { env });
    const wrapped = spawnSync(binary, ["swift", "build", "--help"], { env });
    assert.equal(wrapped.status, direct.status);
    assert.deepEqual(wrapped.stdout, direct.stdout);
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    await check(`native-${signal}`, async () => {
      xcodePreflight();
      const sentinel = spawn("sleep", ["120"], { stdio: "ignore" });
      const readyFile = path.join(root, signal + ".ready");
      let scriptPID: number | undefined;
      function fixtureJobAlive(): boolean {
        if (!scriptPID) return false;
        const row = spawnSync("ps", [
          "-p",
          String(scriptPID),
          "-o",
          "pgid=,command=",
        ], { encoding: "utf8" });
        return row.status === 0 &&
          Number(row.stdout.trim().split(/\s+/)[0]) === scriptPID &&
          row.stdout.includes(path.join(root, signal + "-dd")) &&
          row.stdout.includes("Script-");
      }
      function cleanupFixtureJob(): void {
        if (scriptPID && fixtureJobAlive()) process.kill(-scriptPID, "SIGTERM");
      }
      const command = spawn(binary, [
        ...xcode,
        "-derivedDataPath",
        path.join(root, signal + "-dd"),
        "AXBUILD_HANG=YES",
        "AXBUILD_READY_FILE=" + readyFile,
        "build",
      ], { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      command.stdout.on("data", (data) => {
        stdout += data;
      });
      command.stderr.on("data", (data) => {
        stderr += data;
      });
      const completion = new Promise<number | null>((resolve) =>
        command.on("close", (code) => resolve(code))
      );
      try {
        let ready = false;
        for (let i = 0; i < 600; i++) {
          if (fs.existsSync(readyFile)) {
            scriptPID = Number(fs.readFileSync(readyFile, "utf8").trim());
            ready = Number.isInteger(scriptPID) && scriptPID! > 1 &&
              fixtureJobAlive();
          }
          if (ready || command.exitCode !== null) break;
          await delay(100);
        }
        assert.ok(ready, "native script did not reach readiness");
        const inventory = spawnSync("pgrep", ["-P", String(command.pid)], {
          encoding: "utf8",
        });
        assert.equal(inventory.status, 0, inventory.stderr);
        const children = inventory.stdout.trim().split("\n").filter(Boolean);
        assert.ok(
          children.length > 0,
          "No native owned child observed before interruption",
        );
        fs.writeFileSync(
          path.join(root, signal + ".owned-pids.json"),
          JSON.stringify(children),
        );
        command.kill(signal);
        const exit = await Promise.race([
          completion,
          delay(15000).then(() => {
            throw new Error("native interruption did not finish");
          }),
        ]);
        assert.equal(
          exit,
          128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }[signal]),
        );
        assert.equal(sentinel.exitCode, null);
        const report: NativeReport = JSON.parse(stdout);
        assert.equal(report.command.status, "interrupted");
        assert.ok(
          !report.collection.issues.some((issue) =>
            typeof issue === "object" && issue !== null && "kind" in issue &&
            issue.kind === "cleanup-incomplete"
          ),
          JSON.stringify(report.collection.issues),
        );
        for (const pid of children) {
          const remaining = spawnSync("pgrep", ["-g", pid], {
            encoding: "utf8",
          });
          assert.equal(
            remaining.status,
            1,
            `owned group ${pid} survived: ${remaining.stdout}`,
          );
        }
        const observedSurvivor = fixtureJobAlive();
        cleanupFixtureJob();
        await delay(200);
        detachedJobs.push({
          signal,
          pid: scriptPID!,
          observedSurvivor,
          fixtureCleanup: !fixtureJobAlive(),
        });
        assert.ok(
          !fixtureJobAlive(),
          "Confirmed fixture detached job did not stop after harness cleanup",
        );
        assert.equal(
          observedSurvivor,
          false,
          "axbuild left the detached Xcode build script running",
        );
        fs.writeFileSync(path.join(root, signal + ".stdout"), stdout);
        fs.writeFileSync(path.join(root, signal + ".stderr"), stderr);
      } finally {
        if (command.exitCode === null) {
          command.kill("SIGTERM");
          await Promise.race([completion, delay(7000)]);
        }
        cleanupFixtureJob();
        sentinel.kill("SIGTERM");
      }
    });
  }
  const failed = results.filter((result) => !result.passed);
  console.log(
    JSON.stringify({
      evidence: root,
      passed: results.length - failed.length,
      failed: failed.length,
    }),
  );
  if (failed.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args[0] === "--score" && args.length === 3) {
    scoreNativeOutcome(
      JSON.parse(fs.readFileSync(args[1], "utf8")),
      Number(args[2]),
    );
  } else if (args[0] === "--manifest" && args.length === 2) {
    await acceptance(path.resolve(args[1]));
  } else {
    throw new Error(
      "Usage: node tools/axbuild/axbuild.acceptance.ts --manifest <approved-measurement-manifest>",
    );
  }
}
