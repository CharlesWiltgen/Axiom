// Holds every harness's version ground truth to one source.
//
// The canonical text lives in the plugin's hooks/version_context.py, which Claude
// Code, Codex and Cursor render directly. axiom-pi and axiom-mcp are TypeScript, so
// each carries version-context.ts. These tests fail when either copy differs from
// the other, renders different text from the Python module for the same inputs,
// or detects a different Xcode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildAxiomContext } from "../axiom-pi/src/session.ts";
import * as piContext from "../axiom-pi/src/version-context.ts";
import * as mcpContext from "../axiom-mcp/src/version-context.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const HOOKS_DIR = path.join(ROOT, ".claude-plugin/plugins/axiom/hooks");
const PI_FILE = path.join(ROOT, "axiom-pi/src/version-context.ts");
const MCP_FILE = path.join(ROOT, "axiom-mcp/src/version-context.ts");

type Toolchain = piContext.Toolchain;
type Env = Record<string, string | undefined>;

/** Runs `body` with the hooks dir importable; `cases` arrives as `cases`, and
 * whatever the body assigns to `out` comes back as JSON. */
function python(body: string, cases: unknown = null): unknown {
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(HOOKS_DIR)})`,
    "from datetime import datetime",
    "import version_context, xcode_path",
    "from xcode_path import Toolchain",
    "cases = json.load(sys.stdin)",
    body,
    "print(json.dumps(out))",
  ].join("\n");
  return JSON.parse(
    execFileSync("python3", ["-c", script], { input: JSON.stringify(cases), encoding: "utf8" }),
  );
}

const RENDER_CASES: { date: string; toolchain: Toolchain | null }[] = [
  { date: "Thursday, 2026-10-08", toolchain: null },
  {
    date: "Thursday, 2026-10-08",
    toolchain: { path: "/Applications/Xcode-beta.app", xcodeVersion: "27.2", iosSdkVersion: "27.2" },
  },
  { date: "Monday, 2027-06-07", toolchain: { path: "/X.app", xcodeVersion: "28.0", iosSdkVersion: null } },
  { date: "Monday, 2027-06-07", toolchain: { path: "/X.app", xcodeVersion: null, iosSdkVersion: "28.0" } },
];

test("the Pi and MCP copies of version-context.ts are the same file", () => {
  assert.equal(fs.readFileSync(PI_FILE, "utf8"), fs.readFileSync(MCP_FILE, "utf8"));
});

test("TypeScript renders the version ground truth byte-identical to version_context.py", () => {
  const expected = python(
    [
      "out = [version_context.version_ground_truth(c['date'], Toolchain(",
      "    c['toolchain']['path'], c['toolchain']['xcodeVersion'], c['toolchain']['iosSdkVersion'],",
      ") if c['toolchain'] else None) for c in cases]",
    ].join("\n"),
    RENDER_CASES,
  );
  for (const renderer of [piContext, mcpContext]) {
    assert.deepEqual(RENDER_CASES.map((c) => renderer.versionGroundTruth(c.date, c.toolchain)), expected);
  }
});

test("the attribution sentence matches version_context.ATTRIBUTION", () => {
  const expected = python("out = version_context.ATTRIBUTION");
  assert.deepEqual([piContext.ATTRIBUTION, mcpContext.ATTRIBUTION], [expected, expected]);
});

test("Pi's session context carries the shared text, not a copy of its own", () => {
  // axiom-pi's vitest suite runs in pre-deploy only; this keeps the wiring in CI.
  const toolchain: Toolchain = { path: "/X.app", xcodeVersion: "28.0", iosSdkVersion: "28.0" };
  const ctx = buildAxiomContext({ now: new Date(2027, 5, 7), toolchain, availableTools: [] });
  const shared = [piContext.versionGroundTruth("Monday, 2027-06-07", toolchain), piContext.ATTRIBUTION];
  assert.deepEqual(shared.filter((part) => !ctx.includes(part)), []);
});

test("a failing xcode-select never rejects Xcode resolution", async () => {
  // execFile throws synchronously for some spawn errors (EPERM in a sandbox), and
  // a rejected promise here took down MCP startup and Pi's session context.
  const throwing: piContext.XcodeSelect = () => {
    throw new Error("spawn EPERM");
  };
  const rejecting: piContext.XcodeSelect = () => Promise.reject(new Error("spawn EPERM"));
  for (const port of [piContext, mcpContext]) {
    for (const select of [throwing, rejecting]) {
      assert.equal(await port.resolveXcodePath({}, select), port.DEFAULT_XCODE_PATH);
    }
  }
});

test("formatDate stamps the same weekday and date as format_date", () => {
  const dates: [number, number, number][] = [[2026, 10, 8], [2027, 1, 1], [2028, 2, 29]];
  const expected = python(
    "out = [version_context.format_date(datetime(y, m, d, 23, 59)) for y, m, d in cases]",
    dates,
  );
  assert.deepEqual(dates.map(([y, m, d]) => piContext.formatDate(new Date(y, m - 1, d, 23, 59))), expected);
});

test("TypeScript detects the same active Xcode as xcode_path.py", { skip: process.platform !== "darwin" }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-version-context-"));
  try {
    const app = path.join(root, "Xcode Beta.app");
    const sdk = path.join(app, "Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk");
    fs.mkdirSync(sdk, { recursive: true });
    fs.mkdirSync(path.join(root, "CommandLineTools"));
    python(
      [
        "import plistlib",
        "app, sdk = cases",
        "plistlib.dump({'CFBundleShortVersionString': '99.1'}, open(app + '/Contents/Info.plist', 'wb'))",
        "plistlib.dump({'Version': '99.2'}, open(sdk + '/SDKSettings.plist', 'wb'), fmt=plistlib.FMT_BINARY)",
        "out = None",
      ].join("\n"),
      [app, sdk],
    );
    const base: Env = { ...process.env };
    delete base.AXIOM_XCODE_PATH;
    delete base.DEVELOPER_DIR;
    const envs: Env[] = [
      { ...base, DEVELOPER_DIR: app },
      { ...base, DEVELOPER_DIR: `${app}/` },
      { ...base, DEVELOPER_DIR: path.join(app, "Contents", "Developer") },
      { ...base, AXIOM_XCODE_PATH: app },
      { ...base, DEVELOPER_DIR: path.join(root, "CommandLineTools") },
      { ...base, AXIOM_XCODE_PATH: "" },
      { ...base, AXIOM_XCODE_PATH: path.join(root, "Missing.app") },
      // A value no process can be spawned with: both ports must fall back, not throw.
      { ...base, DEVELOPER_DIR: "bad\0dir" },
      { ...base, PATH: "/nonexistent" },
      base,
    ];
    const expected = python(
      "out = [list(xcode_path.detect_toolchain(env)) for env in cases]",
      envs,
    );
    for (const detect of [piContext.detectToolchain, mcpContext.detectToolchain]) {
      const actual = await Promise.all(envs.map((env) => detect(env)));
      assert.deepEqual(actual.map((t) => [t.path, t.xcodeVersion, t.iosSdkVersion]), expected);
    }
    // The app-form DEVELOPER_DIR is the 2026-10-08 regression: it must name the beta.
    assert.deepEqual((expected as unknown[][])[0], [app, "99.1", "99.2"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
