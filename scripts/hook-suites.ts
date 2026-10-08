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

export function runHookSuites(pluginDir: string): {
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
        timeout: 60000,
        cwd: hooksDir,
      }).toString();
      runs.push({ file: testFile, ran: out.match(/Ran \d+ tests?/)?.[0] ?? "ran" });
    } catch (e: unknown) {
      const err = e as { killed?: boolean; stdout?: Buffer; stderr?: Buffer };
      failures.push({
        file: testFile,
        message: err.killed
          ? `${testFile} timed out`
          : `${testFile} FAILED:\n${err.stdout?.toString() || err.stderr?.toString() || ""}`,
      });
    }
  }

  return { runs, failures };
}
