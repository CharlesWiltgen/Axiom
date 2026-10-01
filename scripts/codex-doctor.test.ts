import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { inspectInstallation } from "./codex-doctor.mjs";

const helpers = ["xclog", "xcsym", "xcui", "xcprof"];
const version = "27.1.2";
const healthyHelper = "#!/bin/sh\nprintf 'Usage: helper\\n'\n";

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "axiom-doctor-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const directory of [
    ".codex-plugin",
    "skills/axiom-build",
    "hooks",
    "bin",
    "nested/cwd",
  ]) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }
  await fs.writeFile(
    path.join(root, ".codex-plugin/plugin.json"),
    JSON.stringify({
      name: "axiom",
      version,
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    }),
  );
  await fs.writeFile(
    path.join(root, "skills/axiom-build/SKILL.md"),
    "---\nname: axiom-build\ndescription: Build guidance\n---\n",
  );
  await fs.writeFile(path.join(root, "hooks/session-start.sh"), healthyHelper, {
    mode: 0o755,
  });
  for (const dependency of ["session-start.py", "project_detect.py", "hook_diagnostics.py"]) {
    await fs.writeFile(
      path.join(root, "hooks", dependency),
      "# synthetic hook dependency\n",
    );
  }
  await fs.writeFile(
    path.join(root, "hooks/hooks.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command:
                  'AXIOM_HARNESS=codex "${PLUGIN_ROOT}/hooks/session-start.sh"',
                statusMessage: "Axiom: SessionStart onboarding",
              },
            ],
          },
        ],
      },
    }),
  );
  await fs.writeFile(
    path.join(root, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        axiom: { command: "npx", args: ["-y", `axiom-mcp@${version}`] },
      },
    }),
  );
  for (const helper of helpers)
    await fs.writeFile(path.join(root, "bin", helper), healthyHelper, {
      mode: 0o755,
    });
  return root;
}

describe("inspectInstallation", () => {
  it(
    "should reject a metadata pipe without blocking",
    { skip: process.platform === "win32" },
    async (t) => {
      const root = await fixture(t);
      const metadata = path.join(root, "metadata-pipe");
      assert.equal(spawnSync("mkfifo", [metadata]).status, 0);
      const result = spawnSync(
        process.execPath,
        [
          path.resolve("axiom-codex/scripts/doctor.mjs"),
          "--package-root",
          root,
          "--host-metadata",
          metadata,
        ],
        { encoding: "utf8", timeout: 2500 },
      );
      assert.equal(result.status, 1, result.stderr);
      assert.equal(JSON.parse(result.stdout).host.status, "invalid");
    },
  );
  for (const dependency of ["session-start.py", "project_detect.py", "hook_diagnostics.py"]) {
    it(`should report missing SessionStart dependency ${dependency}`, async (t) => {
      const root = await fixture(t);
      await fs.unlink(path.join(root, "hooks", dependency));
      assert.equal(
        (await inspectInstallation({ packageRoot: root })).hooks.status,
        "missing_handler",
      );
    });
  }

  it("should accept optional nested host metadata fields", async (t) => {
    const root = await fixture(t);
    const report = await inspectInstallation({
      packageRoot: root,
      hostMetadata: { hookTrust: "trusted", mcp: { version }, xcode: {} },
    });
    assert.deepEqual(
      [
        report.host.status,
        report.hooks.trust,
        report.mcp.connection,
        report.mcp.versionMatch,
        report.xcode,
      ],
      [
        "caller_supplied",
        "trusted",
        "unknown",
        "match",
        { status: "unknown", version: null },
      ],
    );
  });

  it("should run the generated doctor through a symlinked package path", async (t) => {
    const root = await fixture(t);
    await fs.symlink(path.resolve("axiom-codex"), path.join(root, "installed"));
    const result = spawnSync(
      process.execPath,
      [path.join(root, "installed/scripts/doctor.mjs")],
      { cwd: path.join(root, "nested/cwd"), encoding: "utf8", timeout: 20000 },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).package.status, "ok");
  });
  it("should distinguish package integrity from unobserved host capabilities", async (t) => {
    const root = await fixture(t);
    const report = await inspectInstallation({ packageRoot: root });
    assert.deepEqual(report, {
      schemaVersion: 1,
      package: { status: "ok", version },
      skills: { status: "ok", count: 1 },
      hooks: {
        status: "ok",
        count: 1,
        events: ["SessionStart"],
        trust: "unknown",
      },
      mcp: {
        status: "pinned",
        configuredVersion: version,
        observedVersion: null,
        connection: "unknown",
        versionMatch: "unknown",
      },
      helpers: Object.fromEntries(
        helpers.map((name) => [name, { status: "available" }]),
      ),
      host: { status: "not_supplied", version: null },
      xcode: { status: "unknown", version: null },
    });
  });

  for (const [name, mode, expected] of [
    ["missing", "missing", "missing"],
    ["non-executable", "permissions", "not_executable"],
    ["wrong architecture", "architecture", "wrong_architecture"],
    ["unsupported platform", "platform", "unsupported_platform"],
    ["failed help", "failed", "help_failed"],
    ["timed-out help", "timeout", "timeout"],
    ["invalid executable", "invalid", "launch_error"],
  ]) {
    it(`should report ${name} without leaking helper output`, async (t) => {
      const root = await fixture(t);
      const helperPath = path.join(root, "bin/xcui");
      if (mode === "missing") await fs.unlink(helperPath);
      if (mode === "permissions") await fs.chmod(helperPath, 0o644);
      if (mode === "architecture" || mode === "platform") {
        const header = Buffer.alloc(32);
        header.writeUInt32LE(0xfeedfacf, 0);
        header.writeUInt32LE(0x01000007, 4);
        await fs.writeFile(helperPath, header);
      }
      if (mode === "failed")
        await fs.writeFile(
          helperPath,
          "#!/bin/sh\necho secret-path >&2\nexit 3\n",
        );
      if (mode === "timeout")
        await fs.writeFile(helperPath, "#!/bin/sh\nwhile :; do :; done\n");
      if (mode === "invalid")
        await fs.writeFile(helperPath, "#!/nonexistent/axiom-interpreter\n");
      const report = await inspectInstallation({
        packageRoot: root,
        platform: mode === "platform" ? "linux" : "darwin",
        arch: "arm64",
        timeoutMs: mode === "timeout" ? 150 : 3000,
      });
      assert.deepEqual(report.helpers.xcui, { status: expected });
      assert.doesNotMatch(
        JSON.stringify(report),
        /secret-path|axiom-doctor-test|nonexistent/,
      );
    });
  }

  it("should read only allowlisted caller-supplied host metadata", async (t) => {
    const root = await fixture(t);
    const report = await inspectInstallation({
      packageRoot: root,
      hostMetadata: {
        runtimeVersion: "0.154.0-alpha.6.2",
        hookTrust: "untrusted",
        mcp: { version: "27.1.1", status: "connected" },
        xcode: { status: "unavailable", version: null },
        secret: "do-not-retain",
        env: { TOKEN: "do-not-retain" },
      },
    });
    assert.deepEqual(
      [report.host, report.hooks.trust, report.mcp, report.xcode],
      [
        { status: "caller_supplied", version: "0.154.0-alpha.6.2" },
        "untrusted",
        {
          status: "pinned",
          configuredVersion: version,
          observedVersion: "27.1.1",
          connection: "connected",
          versionMatch: "mismatch",
        },
        { status: "unavailable", version: null },
      ],
    );
    assert.doesNotMatch(JSON.stringify(report), /do-not-retain|TOKEN|secret/);
  });

  it("should reject malformed capability values without echoing them", async (t) => {
    const root = await fixture(t);
    const report = await inspectInstallation({
      packageRoot: root,
      hostMetadata: {
        runtimeVersion: "private-path",
        hookTrust: "private-path",
        mcp: { version: "private-path", status: "private-path" },
        xcode: { status: "private-path", version: "private-path" },
      },
    });
    assert.deepEqual(
      [
        report.host,
        report.hooks.trust,
        report.mcp.connection,
        report.mcp.observedVersion,
        report.xcode,
      ],
      [
        { status: "invalid", version: null },
        "unknown",
        "unknown",
        null,
        { status: "unknown", version: null },
      ],
    );
    assert.doesNotMatch(JSON.stringify(report), /private-path/);
  });

  for (const [target, content, field] of [
    [".codex-plugin/plugin.json", "{", "package"],
    ["hooks/hooks.json", '{"hooks":[]}', "hooks"],
    [".mcp.json", '{"mcpServers":null}', "mcp"],
  ]) {
    it(`should report invalid ${field} metadata`, async (t) => {
      const root = await fixture(t);
      await fs.writeFile(path.join(root, target), content);
      const report = await inspectInstallation({ packageRoot: root });
      assert.equal(report[field].status, "invalid");
    });
  }

  it("should report a missing hook handler as broken package integrity", async (t) => {
    const root = await fixture(t);
    await fs.unlink(path.join(root, "hooks/session-start.sh"));
    assert.equal(
      (await inspectInstallation({ packageRoot: root })).hooks.status,
      "missing_handler",
    );
  });

  it("should distinguish an unpinned server from unknown live availability", async (t) => {
    const root = await fixture(t);
    await fs.writeFile(
      path.join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: { axiom: { command: "npx", args: ["-y", "axiom-mcp"] } },
      }),
    );
    assert.deepEqual((await inspectInstallation({ packageRoot: root })).mcp, {
      status: "unpinned",
      configuredVersion: null,
      observedVersion: null,
      connection: "unknown",
      versionMatch: "unknown",
    });
  });

  it("should run the generated doctor from a clean unrelated cwd", () => {
    const script = path.resolve("axiom-codex/scripts/doctor.mjs");
    const result = spawnSync(process.execPath, [script], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.package.status, "ok");
    assert.equal(report.hooks.count, 5);
    assert.equal(report.host.status, "not_supplied");
    if (process.platform === "darwin")
      assert.deepEqual(
        report.helpers,
        Object.fromEntries(
          helpers.map((name) => [name, { status: "available" }]),
        ),
      );
  });

  it("should configure generated MCP startup with the MCP package version pin", async () => {
    const pkg = JSON.parse(await fs.readFile("axiom-mcp/package.json", "utf8"));
    const manifest = JSON.parse(
      await fs.readFile("axiom-codex/.mcp.json", "utf8"),
    );
    assert.deepEqual(manifest.mcpServers.axiom, {
      command: "npx",
      args: ["-y", `axiom-mcp@${pkg.version}`],
    });
  });
});
