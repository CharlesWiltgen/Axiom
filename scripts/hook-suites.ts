// Runs the Python hook test suites (hooks/*_test.py).
//
// Shared by pre-deploy (phase 1) and `npm run test:hooks` (check:ci) so a
// maintainer's machine and CI execute exactly the same suites. Offline-only;
// each module runs under a 60s cap and reports its unittest count.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface HookSuiteRun {
  file: string;
  ran: string;
}

export interface HookSuiteFailure {
  file: string;
  message: string;
}

/** True when `execSync` gave up on its `timeout`. It never sets `killed` (only
 * the async `exec`/`execFile` do); a timeout surfaces as code ETIMEDOUT. */
export function isExecSyncTimeout(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "ETIMEDOUT";
}

/** What a failed `execSync` left behind: its output, headed by a timeout notice
 * when its `timeout` is why it stopped. */
export function execSyncFailureOutput(error: unknown, timeoutMs: number): string {
  const err = error as { stdout?: Buffer; stderr?: Buffer } | null;
  const output = err?.stdout?.toString() || err?.stderr?.toString() || "";
  return isExecSyncTimeout(error) ? `timed out after ${timeoutMs / 1000}s\n${output}` : output;
}

export function runHookSuites(pluginDir: string, timeoutMs = 60_000): {
  runs: HookSuiteRun[];
  failures: HookSuiteFailure[];
} {
  const hooksDir = path.join(pluginDir, "hooks");
  const testFiles = fs
    .readdirSync(hooksDir)
    .filter((f: string) => f.endsWith("_test.py"))
    .sort();
  const runs: HookSuiteRun[] = [];
  const failures: HookSuiteFailure[] = [];

  for (const testFile of testFiles) {
    const moduleName = testFile.replace(/\.py$/, "");
    try {
      // unittest writes its dots + summary to stderr; merge it so we can
      // report the test count on success.
      const out = execSync(`python3 -m unittest "${moduleName}" 2>&1`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeoutMs,
        cwd: hooksDir,
      }).toString();
      runs.push({ file: testFile, ran: out.match(/Ran \d+ tests?/)?.[0] ?? "ran" });
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      failures.push({
        file: testFile,
        message: isExecSyncTimeout(e)
          ? `${testFile} timed out after ${timeoutMs / 1000}s`
          : `${testFile} FAILED:\n${err.stdout?.toString() || err.stderr?.toString() || ""}`,
      });
    }
  }

  return { runs, failures };
}
