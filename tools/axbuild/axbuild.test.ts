import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const binary = process.env.AXIOM_AXBUILD ??
  path.resolve(
    import.meta.dirname,
    "../../.claude-plugin/plugins/axiom/bin/axbuild",
  );
const fixture = path.join(import.meta.dirname, "fixtures/process-child.py");
function temporary<T>(action: (root: string, env: NodeJS.ProcessEnv) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "axbuild-test-"));
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  for (const name of ["swift", "xcodebuild", "xcresulttool", "xcrun"]) {
    fs.copyFileSync(fixture, path.join(bin, name));
    fs.chmodSync(path.join(bin, name), 0o755);
  }
  const env = { ...process.env, PATH: bin + ":/usr/bin:/bin", TMPDIR: root };
  const result = action(root, env);
  if (result instanceof Promise) {
    return result.finally(() =>
      fs.rmSync(root, { recursive: true, force: true })
    ) as T;
  }
  fs.rmSync(root, { recursive: true, force: true });
  return result;
}
function run(args: string[], root: string, env: NodeJS.ProcessEnv) {
  const r = spawnSync(binary, args, { cwd: root, env, timeout: 12_000 });
  assert.equal(r.error, undefined);
  return {
    exit: r.status,
    stderr: r.stderr.toString(),
    bytes: r.stdout,
    report: JSON.parse(r.stdout.toString()),
  };
}
function saved(report: any) {
  assert.equal(typeof report.artifacts.run, "string");
  return JSON.parse(
    fs.readFileSync(
      path.join(report.artifacts.run, report.artifacts.report),
      "utf8",
    ),
  );
}
async function readiness(file: string, child: ReturnType<typeof spawn>) {
  const deadline = Date.now() + 8000;
  while (!fs.existsSync(file)) {
    assert.equal(child.exitCode, null, "process exited before readiness");
    assert.ok(Date.now() < deadline, "readiness deadline");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function completed(child: ReturnType<typeof spawn>, timeout = 12_000) {
  let stdout = "", stderr = "";
  child.stdout!.on("data", (d) => stdout += d);
  child.stderr!.on("data", (d) => stderr += d);
  return new Promise<
    {
      exit: number | null;
      signal: string | null;
      stdout: string;
      stderr: string;
    }
  >((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("wrapper deadline"));
    }, timeout);
    child.on("error", reject);
    child.on("close", (exit, signal) => {
      clearTimeout(timer);
      resolve({ exit, signal, stdout, stderr });
    });
  });
}
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function reap(ready: string) {
  if (!fs.existsSync(ready)) return;
  const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
  for (const group of [owned.pid, owned.detached].filter(Boolean)) {
    try {
      process.kill(-group, "SIGKILL");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ESRCH" && code !== "EPERM") throw error;
    }
  }
}

describe("axbuild process integration", () => {
  it("retains an unidentified compiler basename and reports partial collection", () =>
    temporary((root, env) => {
      const result = run(["swift", "build"], root, env);
      assert.equal(result.exit, 65);
      assert.equal(result.report.collection.status, "partial");
      assert.ok(result.report.collection.issues.some((issue: any) =>
        issue.kind === "parse-failed" && issue.operation === "identify compiler source"
      ));
      assert.deepEqual(result.report.diagnostics.map((group: any) => group.file), ["A.swift"]);
    }));
  it("refuses unsupported invocations without launching", () =>
    temporary((root, env) => {
      const r = run(["python3", "-c", "print(1)"], root, env);
      assert.equal(r.exit, 64);
      assert.equal(r.report.command.status, "not-started");
      assert.equal(r.report.collection.issues[0].kind, "invalid-invocation");
      assert.deepEqual(r.report.artifacts, {
        run: null,
        log: null,
        report: null,
      });
    }));
  it("preserves argv environment cwd native exit and exact raw bytes", () =>
    temporary((root, env) => {
      const record = path.join(root, "record.json");
      const args = [
        "swift",
        "build",
        "--package-path",
        ".",
        "-Xswiftc",
        "literal $HOME; echo x",
      ];
      const r = run(args, root, {
        ...env,
        FIXTURE_RECORD: record,
        FIXTURE_VALUE: "kept",
      });
      assert.equal(r.exit, 65);
      assert.ok(r.bytes.length <= 8000);
      const actual = JSON.parse(fs.readFileSync(record, "utf8"));
      assert.deepEqual(actual.args, [
        ...args.slice(1),
        "--no-color-diagnostics",
      ]);
      assert.equal(actual.cwd, fs.realpathSync(root));
      assert.equal(actual.value, "kept");
      const full = saved(r.report);
      assert.deepEqual(full.invocation.originalArgs, args);
      assert.deepEqual(full.invocation.executedArgs, actual.args);
      assert.deepEqual(
        fs.readFileSync(
          path.join(r.report.artifacts.run, r.report.artifacts.log),
        ),
        Buffer.concat([
          Buffer.from("A.swift:3:7: error: fixture error\r\nraw stderr "),
          Buffer.from([255, 10]),
        ]),
      );
      assert.equal(r.report.command.exitCode, 65);
      assert.equal(r.report.counts.errors, 1);
      assert.ok(
        r.report.collection.issues.some((i: any) => i.kind === "parse-failed"),
      );
    }));
  it("passes native help through unchanged", () =>
    temporary((root, env) => {
      const r = spawnSync(binary, ["swift", "build", "--help"], {
        cwd: root,
        env,
        encoding: "utf8",
      });
      assert.deepEqual({ exit: r.status, stdout: r.stdout, stderr: r.stderr }, {
        exit: 12,
        stdout: "native informational stdout\n",
        stderr: "native informational stderr\n",
      });
    }));
  it("emits startup paths and isolates concurrent runs", async () =>
    temporary(async (root, env) => {
      const results = await Promise.all(
        [1, 2].map(() =>
          completed(spawn(binary, ["swift", "build"], { cwd: root, env }))
        ),
      );
      const paths = results.map((r) => {
        assert.ok(r.stderr.trim(), r.stdout);
        return JSON.parse(r.stderr.trim()).path;
      });
      assert.notEqual(paths[0], paths[1]);
      results.forEach((r, i) => {
        assert.equal(JSON.parse(r.stdout).artifacts.run, paths[i]);
        assert.ok(fs.existsSync(path.join(paths[i], "report.json")));
      });
    }));
  it("adds absent Xcode defaults and preserves explicit settings", () =>
    temporary((root, env) => {
      const first = run(["xcodebuild", "-scheme", "App"], root, {
        ...env,
        FIXTURE_RESULT: "create",
      });
      const full = saved(first.report);
      assert.deepEqual(full.invocation.defaults, [
        "-resultBundlePath",
        full.artifacts.resultBundle,
        "-IDEBuildingContinueBuildingAfterErrors=YES",
      ]);
      const explicit = path.join(root, "caller.xcresult");
      const args = [
        "xcodebuild",
        "build",
        "-resultBundlePath",
        explicit,
        "-IDEBuildingContinueBuildingAfterErrors=NO",
      ];
      const second = saved(run(args, root, env).report);
      assert.deepEqual(second.invocation.executedArgs, args.slice(1));
      assert.deepEqual(second.invocation.defaults, []);
    }));
  it("does not ingest stale caller result artifacts", () =>
    temporary((root, env) => {
      const result = path.join(root, "caller.xcresult");
      fs.mkdirSync(result);
      fs.writeFileSync(path.join(result, "sentinel"), "unchanged");
      const r = run(
        ["xcodebuild", "test", "-resultBundlePath", result],
        root,
        env,
      );
      assert.equal(r.exit, 65);
      assert.ok(
        r.report.collection.issues.some((i: any) =>
          i.kind === "missing-artifact" && /unchanged|stale/.test(i.message)
        ),
      );
      assert.ok(!r.report.collection.sources.includes("test-results"));
      assert.equal(
        fs.readFileSync(path.join(result, "sentinel"), "utf8"),
        "unchanged",
      );
    }));
  for (
    const [name, number] of [["SIGINT", 2], ["SIGTERM", 15], [
      "SIGHUP",
      1,
    ]] as const
  ) {
    it(`forwards ${name} and cleans owned descendants without killing a sentinel`, async () =>
      temporary(async (root, env) => {
        const sentinel = spawn("/usr/bin/python3", [
          "-c",
          "import time; time.sleep(60)",
        ]);
        const ready = path.join(root, "ready.json");
        const child = spawn(binary, ["swift", "build"], {
          cwd: root,
          env: {
            ...env,
            FIXTURE_MODE: "hang",
            FIXTURE_READY: ready,
            FIXTURE_SIGNAL_EXIT: "1",
          },
        });
        const finish = completed(child);
        try {
          await readiness(ready, child);
          const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
          child.kill(name);
          const r = await finish;
          assert.equal(r.exit, 128 + number);
          assert.equal(r.signal, null);
          const report = JSON.parse(r.stdout);
          assert.equal(report.command.interruptionSignal, number);
          assert.equal(report.command.exitCode, 7);
          assert.equal(report.command.status, "interrupted");
          assert.equal(report.counts.errors, 1);
          assert.equal(alive(owned.pid), false);
          assert.equal(alive(owned.grandchild), false);
          assert.equal(alive(sentinel.pid!), true);
          assert.ok(
            fs.readFileSync(
              path.join(report.artifacts.run, report.artifacts.log),
              "utf8",
            ).includes("partial output"),
          );
        } finally {
          sentinel.kill("SIGKILL");
          child.kill("SIGKILL");
          reap(ready);
        }
      }));
  }
  it("distinguishes unavailable executables from unavailable capture", () =>
    temporary((root, env) => {
      const missing = run(["/missing/swift", "build"], root, env);
      assert.equal(missing.exit, 69);
      assert.equal(
        missing.report.collection.issues[0].kind,
        "tool-unavailable",
      );
      const capture = run(["swift", "build"], root, {
        ...env,
        TMPDIR: "/does-not-exist/axbuild-fixture",
      });
      assert.equal(capture.exit, 74);
      assert.equal(
        capture.report.collection.issues[0].kind,
        "capture-unavailable",
      );
    }));
});

describe("axbuild evidence and teardown regressions", () => {
  it("bounds a TERM-ignoring auxiliary with the production reader limit", {
    timeout: 45_000,
  }, async () =>
    temporary(async (root, env) => {
      const ready = path.join(root, "aux-ready");
      const child = spawn(binary, ["xcodebuild", "test"], {
        cwd: root,
        env: {
          ...env,
          FIXTURE_RESULT: "create",
          FIXTURE_EXIT: "0",
          FIXTURE_AUX_HANG: "1",
          FIXTURE_AUX_READY: ready,
        },
      });
      const finish = completed(child, 43_000);
      await readiness(ready, child);
      const start = Date.now();
      const pid = Number(fs.readFileSync(ready, "utf8"));
      const result = await finish;
      const elapsed = Date.now() - start;
      assert.ok(
        elapsed >= 29_000 && elapsed < 38_000,
        `reader timeout ${elapsed}ms`,
      );
      assert.equal(result.exit, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.command.exitCode, 0);
      assert.equal(report.collection.status, "partial");
      assert.ok(
        report.collection.issues.some((i: any) => i.kind === "timed-out"),
      );
      assert.ok(!report.collection.sources.includes("test-results"));
      assert.equal(alive(pid), false);
    }));
  it("retains completed report when stdout receiver closes", async () =>
    temporary(async (root, env) => {
      const child = spawn(binary, ["swift", "build"], {
        cwd: root,
        env: { ...env, FIXTURE_EXIT: "0" },
      });
      const finish = completed(child);
      child.stdout!.destroy();
      const result = await finish;
      assert.equal(result.exit, 0);
      const startup = JSON.parse(result.stderr.trim());
      const full = JSON.parse(
        fs.readFileSync(path.join(startup.path, "report.json"), "utf8"),
      );
      assert.equal(full.command.exitCode, 0);
      assert.ok(
        full.collection.issues.some((i: any) =>
          i.kind === "write-failed" && i.operation === "deliver stdout report"
        ),
      );
    }));
  it("collects changed caller artifacts using the explicitly selected Xcode reader", () =>
    temporary((root, env) => {
      const aux = path.join(root, "aux-record");
      const result = path.join(root, "caller.xcresult");
      const results = fs.readFileSync(
        path.join(
          import.meta.dirname,
          "Sources/AxBuildCore/Fixtures/tests/test-results.json",
        ),
        "utf8",
      );
      const executable = path.join(root, "bin/xcodebuild");
      const r = run([executable, "test", "-resultBundlePath", result], root, {
        ...env,
        FIXTURE_RESULT: "create",
        FIXTURE_AUX_RECORD: aux,
        FIXTURE_RESULTS: results,
        FIXTURE_VALUE: "selected-toolchain",
      });
      assert.equal(r.report.counts.failedTests, 2);
      assert.ok(r.report.collection.sources.includes("test-results"));
      assert.deepEqual(JSON.parse(fs.readFileSync(aux, "utf8")), {
        args: ["get", "test-results", "tests", "--path", result, "--compact"],
        value: "selected-toolchain",
      });
    }));
  it("retains selectors without replaying a mutating cache switch during probes", () =>
    temporary((root, env) => {
      const record = path.join(root, "xcrun-record");
      const r = run(
        [
          "xcrun",
          "--sdk",
          "fixture-sdk",
          "--toolchain",
          "fixture-toolchain",
          "--kill-cache",
          "swift",
          "build",
        ],
        root,
        { ...env, FIXTURE_XCRUN_RECORD: record },
      );
      assert.equal(r.exit, 65);
      const calls = fs.readFileSync(record, "utf8").trim().split("\n").map(
        (line) => JSON.parse(line),
      );
      assert.deepEqual(calls[0], [
        "--sdk",
        "fixture-sdk",
        "--toolchain",
        "fixture-toolchain",
        "swift",
        "build",
        "--help-hidden",
      ]);
      assert.deepEqual(calls[1], [
        "--sdk",
        "fixture-sdk",
        "--toolchain",
        "fixture-toolchain",
        "--kill-cache",
        "swift",
        "build",
        "--no-color-diagnostics",
      ]);
    }));
  it("retains supported event semantics and reports malformed streams", () =>
    temporary((root, env) => {
      const events = fs.readFileSync(
        path.join(
          import.meta.dirname,
          "Sources/AxBuildCore/Fixtures/tests/semantics-6.3.jsonl",
        ),
        "utf8",
      );
      const r = run(["swift", "test"], root, {
        ...env,
        FIXTURE_EVENTS: events,
      });
      assert.ok(r.report.collection.sources.includes("events"));
      const full = saved(r.report);
      const tests = full.diagnostics.flatMap((group: any) => group.items)
        .filter((item: any) => item.kind === "test");
      assert.equal(
        tests.filter((t: any) => t.test.isFailure === true).length,
        4,
      );
      assert.equal(
        tests.filter((t: any) =>
          t.test.isKnown === true && t.test.isFailure === false
        ).length,
        1,
      );
      assert.equal(
        tests.filter((t: any) =>
          t.test.issueSeverity === "warning" && t.test.isFailure === false
        ).length,
        1,
      );
      const malformed = run(["swift", "test"], root, {
        ...env,
        FIXTURE_EVENTS: events + "{",
      });
      assert.ok(
        malformed.report.collection.issues.some((i: any) =>
          i.kind === "parse-failed"
        ),
      );
      assert.ok(!malformed.report.collection.sources.includes("events"));
    }));
  it("marks unknown mappings partial and respects explicit Swift Testing disablement", () =>
    temporary((root, env) => {
      const unknown = run(["swift", "test"], root, {
        ...env,
        FIXTURE_VERSION: "Swift unknown",
      });
      assert.ok(
        unknown.report.collection.issues.some((i: any) =>
          i.kind === "unsupported-source"
        ),
      );
      assert.ok(
        !saved(unknown.report).invocation.defaults.includes(
          "--event-stream-version",
        ),
      );
      const disabled = run(
        ["swift", "test", "--disable-swift-testing"],
        root,
        env,
      );
      assert.ok(
        !disabled.report.collection.issues.some((i: any) =>
          i.kind === "unsupported-source" || i.kind === "missing-artifact"
        ),
      );
      assert.ok(
        !saved(disabled.report).invocation.defaults.includes(
          "--event-stream-output-path",
        ),
      );
    }));
  it("reports native signal termination independently of wrapper interruption", () =>
    temporary((root, env) => {
      const r = run(["swift", "build"], root, {
        ...env,
        FIXTURE_SELF_SIGNAL: "15",
      });
      assert.equal(r.exit, 143);
      assert.equal(r.report.command.signal, 15);
      assert.equal(r.report.command.interruptionSignal, null);
      assert.equal(r.report.command.exitCode, null);
    }));
  it("escalates a TERM-ignoring build and preserves the first interruption", async () =>
    temporary(async (root, env) => {
      const ready = path.join(root, "ready");
      const child = spawn(binary, ["swift", "build"], {
        cwd: root,
        env: {
          ...env,
          FIXTURE_MODE: "hang",
          FIXTURE_READY: ready,
          FIXTURE_IGNORE_TERM: "1",
        },
      });
      const finish = completed(child);
      try {
        await readiness(ready, child);
        child.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 40));
        child.kill("SIGHUP");
        const r = await finish;
        const report = JSON.parse(r.stdout);
        assert.equal(r.exit, 143);
        assert.equal(report.command.interruptionSignal, 15);
        assert.equal(report.command.signal, 9);
        const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
        assert.equal(alive(owned.pid), false);
        assert.equal(alive(owned.grandchild), false);
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
        reap(ready);
      }
    }));
  it("does not advertise missing artifacts as retained evidence", () =>
    temporary((root, env) => {
      const full = saved(run(["xcodebuild", "test"], root, env).report);
      assert.equal(full.artifacts.resultBundle, undefined);
    }));
});

it("refuses a symlinked shared capture directory", () =>
  temporary((root, env) => {
    const target = path.join(root, "redirect");
    fs.mkdirSync(target);
    fs.symlinkSync(target, path.join(root, "axbuild"));
    const r = run(["swift", "build"], root, env);
    assert.equal(r.exit, 74);
    assert.deepEqual(fs.readdirSync(target), []);
  }));

it("uses the explicitly selected Xcode inside an xcrun invocation for its reader", () =>
  temporary((root, env) => {
    const selected = path.join(root, "selected-Xcode/usr/bin");
    fs.mkdirSync(selected, { recursive: true });
    for (const name of ["xcodebuild", "xcresulttool"]) {
      fs.copyFileSync(fixture, path.join(selected, name));
      fs.chmodSync(path.join(selected, name), 0o755);
    }
    fs.writeFileSync(
      path.join(root, "bin/xcresulttool"),
      "#!/bin/sh\necho incorrect-reader\n",
    );
    const results = fs.readFileSync(
      path.join(
        import.meta.dirname,
        "Sources/AxBuildCore/Fixtures/tests/test-results.json",
      ),
      "utf8",
    );
    const r = run(["xcrun", path.join(selected, "xcodebuild"), "test"], root, {
      ...env,
      FIXTURE_RESULT: "create",
      FIXTURE_RESULTS: results,
    });
    assert.ok(r.report.collection.sources.includes("test-results"));
    assert.equal(r.report.counts.failedTests, 2);
  }));

it("keeps completed child success when collection is interrupted", async () =>
  temporary(async (root, env) => {
    const ready = path.join(root, "aux-ready");
    const child = spawn(binary, ["xcodebuild", "test"], {
      cwd: root,
      env: {
        ...env,
        FIXTURE_RESULT: "create",
        FIXTURE_EXIT: "0",
        FIXTURE_AUX_HANG: "1",
        FIXTURE_AUX_READY: ready,
      },
    });
    const finish = completed(child);
    await readiness(ready, child);
    const pid = Number(fs.readFileSync(ready, "utf8"));
    child.kill("SIGTERM");
    const r = await finish;
    const report = JSON.parse(r.stdout);
    assert.equal(r.exit, 143);
    assert.equal(report.command.status, "succeeded");
    assert.equal(report.command.exitCode, 0);
    assert.equal(report.command.interruptionSignal, 15);
    assert.equal(report.collection.status, "partial");
    assert.equal(alive(pid), false);
    assert.ok(
      report.collection.issues.some((i: any) =>
        /read test-results/.test(i.operation)
      ),
    );
  }));

it("does not advertise a missing build-only result bundle", () =>
  temporary((root, env) => {
    const r = run(["xcodebuild", "build"], root, env);
    const full = saved(r.report);
    assert.equal(full.artifacts.resultBundle, undefined);
    assert.ok(
      full.collection.issues.some((i: any) => i.kind === "missing-artifact"),
    );
  }));

it("does not advertise an inapplicable disabled event stream", () =>
  temporary((root, env) => {
    const stream = path.join(root, "caller.events");
    const r = run(
      [
        "swift",
        "test",
        "--disable-swift-testing",
        "--event-stream-output-path",
        stream,
      ],
      root,
      env,
    );
    const full = saved(r.report);
    assert.equal(full.artifacts.eventStream, undefined);
    assert.ok(
      !full.collection.issues.some((i: any) =>
        i.kind === "missing-artifact" || i.kind === "unsupported-source"
      ),
    );
  }));

it("names unrecognized xcodebuild arguments that skip structured collection", () =>
  temporary((root, env) => {
    const r = run(["xcodebuild", "test", "-futureOption", "-scheme", "App"], root, env);
    const issue = r.report.collection.issues.find((i: { operation: string }) =>
      i.operation === "classify xcodebuild arguments"
    );
    assert.ok(issue, JSON.stringify(r.report.collection.issues));
    assert.ok(issue.message.includes("-futureOption"));
    assert.equal(r.report.collection.status, "partial");
  }));

it("launches the native command with default SIGPIPE handling", () =>
  temporary((root, env) => {
    const status = path.join(root, "pipe-status");
    fs.writeFileSync(
      path.join(root, "bin", "swift"),
      `#!/bin/bash\nyes | head -n 1 > /dev/null\necho "\${PIPESTATUS[0]}" > "${status}"\nexit 65\n`,
      { mode: 0o755 },
    );
    run(["swift", "build"], root, env);
    assert.equal(fs.readFileSync(status, "utf8").trim(), "141");
  }));

it("survives a closed stderr reader before launch", () =>
  temporary((root, env) => {
    const script = [
      "import os, subprocess, sys",
      "r, w = os.pipe()",
      "os.close(r)",
      "p = subprocess.run([sys.argv[1], 'swift', 'build'], stdout=subprocess.DEVNULL, stderr=w)",
      "print(p.returncode)",
    ].join("\n");
    const r = spawnSync("/usr/bin/python3", ["-c", script, binary], {
      cwd: root,
      env,
      timeout: 12_000,
    });
    assert.equal(r.stdout.toString().trim(), "65", r.stderr.toString());
  }));

it("keeps the tool-unavailable exit when arguments are also unrecognized", () =>
  temporary((root, env) => {
    const r = spawnSync(binary, ["/nonexistent/xcodebuild", "test", "-futureOption"], {
      cwd: root,
      env,
      timeout: 12_000,
    });
    assert.equal(r.status, 69, r.stdout.toString());
  }));

it("reports interruption when the signal and the child's death coincide", async () =>
  temporary(async (root, env) => {
    const ready = path.join(root, "coincide-ready.json");
    const child = spawn(binary, ["xcodebuild", "build"], {
      cwd: root,
      env: { ...env, FIXTURE_MODE: "hang", FIXTURE_READY: ready },
    });
    const finish = completed(child);
    try {
      await readiness(ready, child);
      const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
      child.kill("SIGTERM");
      process.kill(owned.pid, "SIGKILL");
      const output = await finish;
      const report = JSON.parse(output.stdout);
      assert.equal(report.command.status, "interrupted");
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      reap(ready);
    }
  }));

it("reports interruption when the child dies from the signal the wrapper then receives", async () =>
  temporary(async (root, env) => {
    const ready = path.join(root, "same-signal-ready.json");
    const child = spawn(binary, ["xcodebuild", "build"], {
      cwd: root,
      env: {
        ...env,
        FIXTURE_MODE: "hang",
        FIXTURE_READY: ready,
        FIXTURE_GRANDCHILD_IGNORE_TERM: "1",
      },
    });
    const finish = completed(child);
    try {
      await readiness(ready, child);
      const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
      process.kill(owned.pid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 300));
      child.kill("SIGTERM");
      const output = await finish;
      const report = JSON.parse(output.stdout);
      assert.equal(report.command.signal, 15);
      assert.equal(report.command.status, "interrupted");
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      reap(ready);
    }
  }));

it("does not report zero failed tests for a crashed test run with unrecognized arguments", () =>
  temporary((root, env) => {
    const r = run(["xcodebuild", "test", "-futureOption"], root, {
      ...env,
      FIXTURE_MODE: "trap",
    });
    assert.equal(r.report.counts.failedTests, null);
  }));

it("leaves detached processes alone when the build completes normally", async () =>
  temporary(async (root, env) => {
    const ready = path.join(root, "normal-detach-ready.json");
    try {
      const r = run(["xcodebuild", "build"], root, {
        ...env,
        FIXTURE_MODE: "linger",
        FIXTURE_READY: ready,
        FIXTURE_DETACH: "1",
      });
      assert.equal(r.exit, 65);
      const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
      assert.equal(alive(owned.detached), true);
    } finally {
      reap(ready);
    }
  }));

it("keeps the finished native status when interrupted during group cleanup", async () =>
  temporary(async (root, env) => {
    const ready = path.join(root, "linger-ready.json");
    const child = spawn(binary, ["xcodebuild", "build"], {
      cwd: root,
      env: { ...env, FIXTURE_MODE: "linger", FIXTURE_READY: ready },
    });
    const finish = completed(child);
    try {
      await readiness(ready, child);
      await new Promise((resolve) => setTimeout(resolve, 300));
      child.kill("SIGINT");
      const output = await finish;
      assert.equal(output.exit, 130);
      const report = JSON.parse(output.stdout);
      assert.equal(report.command.status, "failed");
      assert.equal(report.command.exitCode, 65);
      assert.equal(report.command.interruptionSignal, 2);
      assert.ok(
        !report.collection.issues.some((issue: { kind: string }) =>
          issue.kind === "cleanup-incomplete"
        ),
      );
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      reap(ready);
    }
  }));

for (const ignoreTerm of [false, true]) {
  it(`stops detached descendants of an interrupted build (ignores TERM: ${ignoreTerm})`, async () =>
    temporary(async (root, env) => {
      const sentinel = spawn("/usr/bin/python3", ["-c", "import time; time.sleep(60)"], {
        detached: true,
      });
      const ready = path.join(root, "detach-ready.json");
      const child = spawn(binary, ["xcodebuild", "build"], {
        cwd: root,
        env: {
          ...env,
          FIXTURE_MODE: "hang",
          FIXTURE_READY: ready,
          FIXTURE_DETACH: "1",
          ...(ignoreTerm ? { FIXTURE_DETACH_IGNORE_TERM: "1" } : {}),
        },
      });
      const finish = completed(child);
      try {
        await readiness(ready, child);
        const owned = JSON.parse(fs.readFileSync(ready, "utf8"));
        assert.ok(alive(owned.detached));
        const lateSentinel = spawn("/usr/bin/python3", ["-c", "import time; time.sleep(60)"], {
          detached: true,
        });
        child.kill("SIGTERM");
        const output = await finish;
        assert.equal(output.exit, 143);
        const report = JSON.parse(output.stdout);
        assert.equal(report.command.status, "interrupted");
        assert.equal(alive(owned.detached), false);
        assert.equal(alive(sentinel.pid!), true);
        assert.equal(alive(lateSentinel.pid!), true);
        lateSentinel.kill("SIGKILL");
        assert.ok(
          !report.collection.issues.some((issue: { kind: string }) =>
            issue.kind === "cleanup-incomplete"
          ),
          JSON.stringify(report.collection.issues),
        );
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
        sentinel.kill("SIGKILL");
        reap(ready);
      }
    }));
}
