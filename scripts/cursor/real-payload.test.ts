import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * Contract tests against payloads captured from a live Cursor 3.17.8 session.
 *
 * Every other adapter test builds its own payload, so they all agree with the
 * adapter's assumptions rather than with Cursor. These use the recorded shape:
 * postToolUse(Write) carries NO `cwd`, and `duration` arrives as a float.
 */

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname!, "fixtures", "cursor-3.17.8-hook-payloads.json"), "utf8"),
) as Record<string, Record<string, unknown>>;

// Exercise the SHIPPED artifact: the guardrails child is only co-located with the
// adapter in the generated distribution, which is what a Cursor install actually runs.
const ADAPTER = path.join(import.meta.dirname!, "..", "..", "axiom-cursor", "scripts", "cursor-hook-adapter.py");

function invoke(mode: string, payload: unknown) {
  const result = spawnSync("python3", [ADAPTER, mode], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return { response: JSON.parse(result.stdout), stderr: result.stderr };
}

function swiftWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-real-payload-"));
  fs.writeFileSync(
    path.join(dir, "Counter.swift"),
    "import SwiftUI\n\nstruct CounterView: View {\n    @State var count = 0\n    var body: some View { Text(\"\\(count)\") }\n}\n",
  );
  return dir;
}

test("live Cursor postToolUse(Write) omits cwd — the guardrails must still run", () => {
  const workspace = swiftWorkspace();
  try {
    const payload = {
      ...FIXTURE["post-write"],
      workspace_roots: [workspace],
      tool_input: { file_path: path.join(workspace, "Counter.swift"), content: "<redacted>" },
    };
    assert.ok(!("cwd" in payload), "the recorded Cursor payload has no cwd — do not add one");
    const { response, stderr } = invoke("post-write", payload);
    assert.doesNotMatch(stderr, /unsafe write cwd/, "must not reject a well-formed Cursor payload");
    assert.match(
      (response as { additional_context?: string }).additional_context ?? "",
      /AXIOM_SWIFT_STATE_ACCESS/,
      "the Swift guardrail must fire on a real Cursor write payload",
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("live Cursor sends duration as a float — duration hints must still fire", () => {
  const payload = {
    ...FIXTURE["post-shell"],
    tool_input: { command: "xcodebuild -scheme Demo build" },
    tool_output: JSON.stringify({ exitCode: 65, output: "** BUILD FAILED **\nerror: linker command failed" }),
    duration: 240_000.5,
  };
  assert.equal(typeof payload.duration, "number");
  assert.ok(!Number.isInteger(payload.duration), "the recorded duration is fractional");
  const { response } = invoke("post-shell", payload);
  assert.match(
    (response as { additional_context?: string }).additional_context ?? "",
    /Long xcodebuild \(240s\) ended in failure/,
    "a fractional duration must still reach the hints child",
  );
});

test("live Cursor Shell tool_output is a JSON string keyed exitCode/output", () => {
  const raw = FIXTURE["post-shell"].tool_output;
  assert.equal(typeof raw, "string", "tool_output is a JSON-encoded string, not an object");
  assert.deepEqual(Object.keys(JSON.parse(raw as string)).sort(), ["exitCode", "output"]);
});
