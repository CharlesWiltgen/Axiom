import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { npmInstallEnvironment, runNpmDryRun } from "./npm-resolution.ts";

describe("npmInstallEnvironment", () => {
  it("allows a real fresh npm ci under an inherited npm run environment", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm fresh install "));
    const manifest = {
      name: "axiom-npm-environment-fixture",
      version: "1.0.0",
      private: true,
    };
    try {
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify(manifest),
      );
      await writeFile(
        join(directory, "package-lock.json"),
        JSON.stringify({
          name: manifest.name,
          version: manifest.version,
          lockfileVersion: 3,
          packages: { "": manifest },
        }),
      );
      const result = spawnSync("npm", [
        "ci",
        "--ignore-scripts",
        "--dry-run",
        "--no-audit",
        "--no-fund",
      ], {
        cwd: directory,
        timeout: 10_000,
        encoding: "utf8",
        env: npmInstallEnvironment({
          ...process.env,
          npm_config_allow_scripts: "*",
          NPM_CONFIG_ALLOW_SCRIPTS: "*",
          npm_config_strict_allow_scripts: "true",
          npm_config_cache: join(directory, "cache"),
        }),
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("runNpmDryRun", () => {
  it("stops a TERM-resistant npm process and its descendant at the deadline", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm deadline "));
    const timeoutMs = 500;
    const maximumElapsedMs = 2000;
    let pids: number[] = [];
    try {
      const executable = join(directory, "npm");
      await writeFile(
        executable,
        `#!${process.execPath}\nconst {spawn}=require('node:child_process');\nprocess.on('SIGTERM',()=>{});\nconst child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(),4000);setInterval(()=>{},100)"],{stdio:'inherit'});\nconsole.log(JSON.stringify([process.pid,child.pid]));\nsetTimeout(()=>process.exit(),4000);setInterval(()=>{},100);\n`,
      );
      await chmod(executable, 0o755);
      const start = performance.now();
      const result = await runNpmDryRun(directory, {
        timeoutMs,
        env: { ...process.env, PATH: directory },
      });
      assert.deepEqual(
        {
          timedOut: result.timedOut,
          errorCode: result.errorCode,
          status: result.status,
        },
        { timedOut: true, errorCode: "ETIMEDOUT", status: null },
      );
      pids = JSON.parse(result.stdout.trim());
      assert.ok(performance.now() - start < maximumElapsedMs);
      for (const pid of pids) {
        let alive = true;
        for (let attempt = 0; attempt < 20 && alive; attempt++) {
          try {
            process.kill(pid, 0);
            await delay(25);
          } catch (error) {
            assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
            alive = false;
          }
        }
        assert.equal(
          alive,
          false,
          `owned process ${pid} survived the deadline`,
        );
      }
    } finally {
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch (error) {
          assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
        }
      }
      await rm(directory, { recursive: true });
    }
  });

  for (const detached of [false, true]) {
    it(`preserves leader success and bounds pipe draining with a ${detached ? "detached" : "same-group"} descendant`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "axiom npm leader "));
      let pids: number[] = [];
      try {
        const executable = join(directory, "npm");
        await writeFile(
          executable,
          `#!${process.execPath}\nconst {spawn}=require('node:child_process');\nconst child=spawn(process.execPath,['-e',"setTimeout(()=>process.exit(),1500);setInterval(()=>{},100)"],{stdio:'inherit',detached:${detached}});\nconsole.log(JSON.stringify([process.pid,child.pid]));process.exit(0);\n`,
        );
        await chmod(executable, 0o755);
        const start = performance.now();
        const result = await runNpmDryRun(directory, {
          timeoutMs: 300,
          env: { ...process.env, PATH: directory },
        });
        pids = JSON.parse(result.stdout.trim());
        assert.deepEqual(
          {
            status: result.status,
            timedOut: result.timedOut,
            errorCode: result.errorCode,
          },
          { status: 0, timedOut: false, errorCode: undefined },
        );
        assert.ok(performance.now() - start < 1000);
        if (!detached) {
          await delay(100);
          assert.throws(() => process.kill(pids[1], 0), { code: "ESRCH" });
        }
      } finally {
        for (const pid of pids) {
          try {
            process.kill(pid, "SIGKILL");
          } catch (error) {
            assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
          }
        }
        await rm(directory, { recursive: true });
      }
    });
  }

  // Darwin's kill(-pgid) answers EPERM while every remaining member is an unreaped
  // zombie. The fake npm leaves exactly that: a helper forks a child that exits at
  // once, moves itself to a new group and holds the zombie unreaped for holdSeconds.
  const zombieHoldingNpm = async (directory: string, holdSeconds: number) => {
    const python = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], {
      encoding: "utf8",
    }).stdout.trim();
    const ready = join(directory, "holder-pid");
    const holder = [
      "import os, sys, time",
      "if os.fork() == 0:",
      "    os._exit(0)",
      "os.setpgid(0, 0)",
      "open(sys.argv[1] + '.tmp', 'w').write(str(os.getpid()))",
      "os.rename(sys.argv[1] + '.tmp', sys.argv[1])",
      "time.sleep(float(sys.argv[2]))",
    ].join("\n");
    const executable = join(directory, "npm");
    await writeFile(
      executable,
      `#!${process.execPath}\nconst {spawn}=require('node:child_process');const fs=require('node:fs');\nspawn(${JSON.stringify(python)},['-c',${JSON.stringify(holder)},${JSON.stringify(ready)},'${holdSeconds}'],{stdio:'ignore'});\nconst until=Date.now()+5000;while(!fs.existsSync(${JSON.stringify(ready)})&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);\nprocess.exit(0);\n`,
    );
    await chmod(executable, 0o755);
    return ready;
  };
  const killHolder = async (ready: string) => {
    try {
      process.kill(Number(await readFile(ready, "utf8")), "SIGKILL");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ESRCH" && code !== "ENOENT") throw error;
    }
  };

  it("finishes once a zombie-only process group is reaped", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm zombie group "));
    const ready = await zombieHoldingNpm(directory, 0.4);
    try {
      const result = await runNpmDryRun(directory, {
        timeoutMs: 3000,
        env: { ...process.env, PATH: directory },
      });
      assert.deepEqual(
        {
          status: result.status,
          timedOut: result.timedOut,
          errorCode: result.errorCode,
        },
        { status: 0, timedOut: false, errorCode: undefined },
      );
    } finally {
      await killHolder(ready);
      await rm(directory, { recursive: true });
    }
  });

  it(
    "rejects only after retrying a group that stays unsignalable",
    { skip: process.platform !== "darwin" },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "axiom npm held zombie "));
      const ready = await zombieHoldingNpm(directory, 5);
      try {
        await assert.rejects(
          runNpmDryRun(directory, {
            timeoutMs: 3000,
            env: { ...process.env, PATH: directory },
          }),
          { __brand: "NpmDryRunCleanupError", message: /EPERM/ },
        );
        // Measured from the zombie's creation, so slow process startup cannot
        // stand in for the retry window.
        assert.ok(
          Date.now() - (await stat(ready)).mtimeMs >= 900,
          "EPERM was not retried",
        );
      } finally {
        await killHolder(ready);
        await rm(directory, { recursive: true });
      }
    },
  );

  it("executes the documented dry-run arguments directly from the requested directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm args "));
    try {
      const executable = join(directory, "npm");
      await writeFile(
        executable,
        `#!${process.execPath}\nconsole.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2),oneOffAllowed:'npm_config_allow_scripts' in process.env || 'NPM_CONFIG_ALLOW_SCRIPTS' in process.env,strictPolicy:process.env.npm_config_strict_allow_scripts}));\n`,
      );
      await chmod(executable, 0o755);
      const result = await runNpmDryRun(directory, {
        env: {
          ...process.env,
          PATH: directory,
          npm_config_allow_scripts: "workerd",
          NPM_CONFIG_ALLOW_SCRIPTS: "workerd",
          npm_config_strict_allow_scripts: "true",
        },
      });
      assert.deepEqual(
        {
          payload: JSON.parse(result.stdout),
          status: result.status,
          timedOut: result.timedOut,
          errorCode: result.errorCode,
        },
        {
          payload: {
            cwd: directory.replace(/^\/var\//, "/private/var/"),
            args: ["install", "--omit=dev", "--dry-run"],
            oneOffAllowed: false,
            strictPolicy: "true",
          },
          status: 0,
          timedOut: false,
          errorCode: undefined,
        },
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("retains npm failure output and exit status for classification", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm failure "));
    try {
      const executable = join(directory, "npm");
      await writeFile(
        executable,
        `#!${process.execPath}\nconsole.error('npm error code ERESOLVE');process.exit(23);\n`,
      );
      await chmod(executable, 0o755);
      const result = await runNpmDryRun(directory, {
        env: { ...process.env, PATH: directory },
      });
      assert.deepEqual(result, {
        stdout: "",
        stderr: "npm error code ERESOLVE\n",
        status: 23,
        timedOut: false,
        errorCode: undefined,
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("bounds captured output and stops the owned process on overflow", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm output "));
    const outputLimit = 1024 * 1024;
    try {
      const executable = join(directory, "npm");
      await writeFile(
        executable,
        `#!${process.execPath}\nprocess.stdout.write('x'.repeat(${
          outputLimit * 2
        }));setInterval(()=>{},100);\n`,
      );
      await chmod(executable, 0o755);
      const result = await runNpmDryRun(directory, {
        env: { ...process.env, PATH: directory },
        timeoutMs: 2000,
      });
      assert.equal(result.errorCode, "ENOBUFS");
      assert.ok(Buffer.byteLength(result.stdout) <= outputLimit);
      assert.equal(result.timedOut, false);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("reports a missing npm executable without guessing a dependency failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "axiom npm absent "));
    try {
      const result = await runNpmDryRun(directory, {
        env: { ...process.env, PATH: directory },
      });
      assert.deepEqual(result, {
        stdout: "",
        stderr: "",
        status: null,
        timedOut: false,
        errorCode: "ENOENT",
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
