import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { execSyncFailureOutput, runHookSuites } from "./hook-suites.ts";

function pluginWithSuite(name: string, body: string): string {
  const plugin = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-hook-suites-"));
  fs.mkdirSync(path.join(plugin, "hooks"));
  fs.writeFileSync(path.join(plugin, "hooks", name), body);
  return plugin;
}

test("runHookSuites reports a suite that exceeds its time limit as timed out", () => {
  // execSync never sets `killed`; a timeout surfaces as code ETIMEDOUT, and was
  // reported as an ordinary FAILED with partial output.
  const plugin = pluginWithSuite(
    "slow_test.py",
    "import time, unittest\n\nclass T(unittest.TestCase):\n    def test_slow(self):\n        time.sleep(3)\n",
  );
  try {
    const { failures } = runHookSuites(plugin, 300);
    assert.deepEqual(failures.map((f) => f.message), ["slow_test.py timed out after 0.3s"]);
  } finally {
    fs.rmSync(plugin, { recursive: true, force: true });
  }
});

test("runHookSuites reports a failing suite with its output", () => {
  const plugin = pluginWithSuite(
    "broken_test.py",
    "import unittest\n\nclass T(unittest.TestCase):\n    def test_broken(self):\n        self.assertEqual(1, 2)\n",
  );
  try {
    const { runs, failures } = runHookSuites(plugin, 30_000);
    assert.deepEqual(
      { runs, failures: failures.map((f) => f.message.split("\n")[0]) },
      { runs: [], failures: ["broken_test.py FAILED:"] },
    );
  } finally {
    fs.rmSync(plugin, { recursive: true, force: true });
  }
});

test("execSyncFailureOutput names a timeout and keeps a real failure's output", () => {
  const failure = (cmd: string, timeout: number): unknown => {
    try {
      execSync(cmd, { stdio: "pipe", timeout });
    } catch (e) {
      return e;
    }
    throw new Error(`${cmd} did not fail`);
  };
  assert.deepEqual(
    [
      execSyncFailureOutput(failure("sleep 3", 200), 200).split("\n")[0],
      execSyncFailureOutput(failure("echo broken; exit 1", 5000), 5000).trim(),
    ],
    ["timed out after 0.2s", "broken"],
  );
});
