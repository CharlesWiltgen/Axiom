import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { renderCursorHooks } from "./hooks.ts";

const root = process.cwd();
const canonicalHooks = path.join(root, ".claude-plugin", "plugins", "axiom", "hooks");
const canonicalToolsSkill = path.join(
  root,
  ".claude-plugin",
  "plugins",
  "axiom",
  "skills",
  "axiom-tools",
  "SKILL.md",
);

function withStagedAdapter(run: (adapter: string, outputRoot: string) => void): void {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-hooks-"));
  try {
    for (const file of renderCursorHooks()) {
      const destination = path.join(outputRoot, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.content, "utf8");
      fs.chmodSync(destination, file.mode);
    }
    const stagedSkill = path.join(outputRoot, "skills", "axiom-tools", "SKILL.md");
    fs.mkdirSync(path.dirname(stagedSkill), { recursive: true });
    fs.copyFileSync(canonicalToolsSkill, stagedSkill);
    run(path.join(outputRoot, "scripts", "cursor-hook-adapter.py"), outputRoot);
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
}

function invoke(adapter: string, mode: string, input: string, timeout = 10_000) {
  const result = spawnSync("python3", [adapter, mode], {
    input,
    encoding: "utf8",
    timeout,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\{[^\n]*\}\n$/);
  return { response: JSON.parse(result.stdout), stderr: result.stderr };
}

function assertFailOpen(
  result: ReturnType<typeof invoke>,
  diagnostic: string,
): void {
  assert.deepEqual(result.response, {});
  assert.equal(result.stderr, `[axiom-cursor-hook] ${diagnostic}\n`);
}

const pollWaiter = new Int32Array(new SharedArrayBuffer(4));

type FixtureProcessState = "running" | "gone" | "zombie";

function fixtureProcessState(pid: number, token: string): FixtureProcessState {
  const result = spawnSync("ps", ["-ww", "-p", String(pid), "-o", "stat=", "-o", "command="], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  const line = result.stdout.trim();
  if (!line) return "gone";
  const match = /^(\S+)\s+(.*)$/.exec(line);
  if (!match || !match[2]!.includes(token)) return "gone";
  return match[1]!.includes("Z") ? "zombie" : "running";
}

function waitForFixtureExit(pid: number, token: string, timeoutMs: number): boolean {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (fixtureProcessState(pid, token) !== "running") return true;
    Atomics.wait(pollWaiter, 0, 0, 25);
  }
  return fixtureProcessState(pid, token) !== "running";
}

test("renders the native Cursor hook manifest and non-executable runtime copies", () => {
  const files = renderCursorHooks();
  const byPath = new Map(files.map((file) => [file.path, file]));

  assert.deepEqual(JSON.parse(byPath.get("hooks/hooks.json")!.content), {
    version: 1,
    hooks: {
      sessionStart: [
        { command: "python3 ./scripts/cursor-hook-adapter.py session-start", timeout: 5 },
      ],
      beforeSubmitPrompt: [
        { command: "python3 ./scripts/cursor-hook-adapter.py prompt-submit", timeout: 5 },
      ],
      preToolUse: [
        { command: "python3 ./scripts/cursor-hook-adapter.py pretool-read", matcher: "Read", timeout: 5 },
      ],
      postToolUse: [
        { command: "python3 ./scripts/cursor-hook-adapter.py post-shell", matcher: "Shell", timeout: 5 },
        { command: "python3 ./scripts/cursor-hook-adapter.py post-write", matcher: "Write", timeout: 5 },
      ],
    },
  });
  assert.deepEqual([...byPath.keys()].sort(), [
    "hooks/hooks.json",
    "scripts/cursor-hook-adapter.py",
    "scripts/posttool-bash-hints.py",
    "scripts/pretool-crash-route.py",
    "scripts/project_detect.py",
    "scripts/swift-guardrails.py",
    "scripts/user-prompt-submit.py",
  ]);
  for (const file of files) assert.equal(file.mode, 0o644);
  for (const filename of ["posttool-bash-hints.py", "project_detect.py", "swift-guardrails.py"]) {
    assert.equal(
      byPath.get(`scripts/${filename}`)!.content,
      fs.readFileSync(path.join(canonicalHooks, filename), "utf8"),
    );
  }
});

test("renderer resolves canonical runtime copies independently of cwd", async () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-cursor-render-cwd-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(outside);
    const moduleUrl = new URL("./hooks.ts?outside-cwd", import.meta.url);
    const outsideModule = await import(moduleUrl.href);
    const files = outsideModule.renderCursorHooks();
    const projectDetect = files.find((file) => file.path === "scripts/project_detect.py");
    assert.equal(
      projectDetect?.content,
      fs.readFileSync(path.join(canonicalHooks, "project_detect.py"), "utf8"),
    );
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("adapter fails open for malformed and oversized input", () => {
  withStagedAdapter((adapter) => {
    assertFailOpen(invoke(adapter, "post-shell", "not json"), "malformed input");
    assertFailOpen(
      invoke(adapter, "post-shell", "x".repeat(1024 * 1024 + 1)),
      "input too large",
    );
  });
});

test("adapter fails open when project detection or a child runtime file is missing", () => {
  withStagedAdapter((adapter, outputRoot) => {
    fs.rmSync(path.join(outputRoot, "scripts", "project_detect.py"));
    assertFailOpen(
      invoke(adapter, "session-start", JSON.stringify({ cwd: outputRoot })),
      "missing project detector",
    );
  });

  withStagedAdapter((adapter, outputRoot) => {
    fs.rmSync(path.join(outputRoot, "scripts", "swift-guardrails.py"));
    assertFailOpen(
      invoke(adapter, "post-write", JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: path.join(outputRoot, "Example.swift") },
        cwd: outputRoot,
      })),
      "missing child",
    );
  });
});

test("adapter fails open for an unknown mode", () => {
  withStagedAdapter((adapter) => {
    assertFailOpen(invoke(adapter, "unknown", "{}"), "unknown mode");
  });
});

test("adapter relays Axiom Shell hints as advisory context", () => {
  withStagedAdapter((adapter) => {
    const { response } = invoke(adapter, "post-shell", JSON.stringify({
      tool_name: "Shell",
      tool_input: { command: "xcodebuild test" },
      tool_output: JSON.stringify({
        stdout: "Unable to simultaneously satisfy constraints",
        stderr: "",
        output: "",
      }),
      duration: 12_345,
    }));

    assert.deepEqual(Object.keys(response), ["additional_context"]);
    assert.match(response.additional_context, /axiom-uikit/);
  });
});

test("adapter relays Swift Write findings only as post-edit advisory context", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const swiftFile = path.join(outputRoot, "Example.swift");
    fs.writeFileSync(
      swiftFile,
      "struct Example {\n  @State var value = 0\n  @Relationship var children: [Child]\n}\n",
      "utf8",
    );

    const { response } = invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: swiftFile },
      cwd: outputRoot,
    }));

    assert.deepEqual(Object.keys(response), ["additional_context"]);
    assert.equal(
      response.additional_context,
      [
        "AXIOM_SWIFT_STATE_ACCESS L2: Add an explicit access level to this @State property (usually @State private var).",
        "AXIOM_SWIFTDATA_RELATIONSHIP_DEFAULT L3: Add a default (= []) to this to-many @Relationship.",
      ].join("\n"),
    );
    assert.doesNotMatch(response.additional_context, new RegExp(swiftFile));
    assert.doesNotMatch(response.additional_context, /value = 0/);
    assert.equal(response.decision, undefined);
    assert.equal(response.reason, undefined);
    assert.equal(response.permission, undefined);
    assert.equal(response.failClosed, undefined);
  });
});

test("adapter sends only a private validated snapshot path and cwd to the post-write child", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const workspace = path.join(outputRoot, "workspace");
    const swiftFile = path.join(workspace, "Sources", "Example.swift");
    const capturedPayload = path.join(outputRoot, "captured-payload.json");
    fs.mkdirSync(path.dirname(swiftFile), { recursive: true });
    fs.writeFileSync(swiftFile, "struct Example {}\n", "utf8");
    const child = path.join(outputRoot, "scripts", "swift-guardrails.py");
    fs.writeFileSync(child, [
      "import json",
      "import pathlib",
      "import sys",
      `capture = ${JSON.stringify(capturedPayload)}`,
      "payload = json.load(sys.stdin)",
      "snapshot = pathlib.Path(payload['tool_input']['file_path'])",
      "with open(capture, 'x', encoding='utf-8') as output:",
      "    json.dump({'payload': payload, 'source': snapshot.read_text(encoding='utf-8')}, output, sort_keys=True)",
      "",
    ].join("\n"), "utf8");

    const { response } = invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: {
        file_path: path.join("Sources", "Example.swift"),
        command: "*** Update File: ../../outside.swift\nSECRET_TOOL_INPUT",
        content: "SECRET_SOURCE_BODY",
      },
      tool_output: "SECRET_TOOL_OUTPUT",
      workspace_roots: [workspace],
      cwd: workspace,
      transcript_path: "/secret/transcript.jsonl",
    }));
    assert.deepEqual(response, {});
    const captured = JSON.parse(fs.readFileSync(capturedPayload, "utf8"));
    assert.equal(captured.source, "struct Example {}\n");
    assert.notEqual(captured.payload.tool_input.file_path, fs.realpathSync(swiftFile));
    assert.equal(path.basename(captured.payload.tool_input.file_path), "validated.swift");
    assert.equal(fs.existsSync(captured.payload.tool_input.file_path), false);
    assert.deepEqual(captured.payload, {
      cwd: fs.realpathSync(workspace),
      tool_input: { file_path: captured.payload.tool_input.file_path },
      tool_name: "Write",
    });
  });
});

test("adapter scans the validated snapshot when the original Swift file is replaced", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const workspace = path.join(outputRoot, "workspace");
    const swiftFile = path.join(workspace, "Example.swift");
    const capturedScan = path.join(outputRoot, "captured-scan.json");
    const validatedSource = "struct Example {\n  @State var value = 0\n}\n";
    const replacementSource = "struct Replacement {}\n";
    fs.mkdirSync(workspace);
    fs.writeFileSync(swiftFile, validatedSource, "utf8");
    const child = path.join(outputRoot, "scripts", "swift-guardrails.py");
    fs.writeFileSync(child, [
      "import json",
      "import pathlib",
      "import sys",
      `original = pathlib.Path(${JSON.stringify(swiftFile)})`,
      `capture = pathlib.Path(${JSON.stringify(capturedScan)})`,
      `original.write_text(${JSON.stringify(replacementSource)}, encoding='utf-8')`,
      "payload = json.load(sys.stdin)",
      "scan_path = pathlib.Path(payload['tool_input']['file_path'])",
      "source = scan_path.read_text(encoding='utf-8')",
      "capture.write_text(json.dumps({",
      "    'payload': payload,",
      "    'source': source,",
      "    'scan_path': str(scan_path),",
      "}), encoding='utf-8')",
      "context = ''",
      "if '@State var value' in source:",
      "    context = (",
      "        f'\\n⚠️ {scan_path}: @State without access control (use @State private var):\\n'",
      "        '2:  @State var value = 0\\n'",
      "    )",
      "print(json.dumps({'hookSpecificOutput': {'additionalContext': context}}))",
      "",
    ].join("\n"), "utf8");

    const { response } = invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: swiftFile },
      workspace_roots: [workspace],
      cwd: workspace,
    }));

    assert.deepEqual(response, {
      additional_context:
        "AXIOM_SWIFT_STATE_ACCESS L2: Add an explicit access level to this @State property (usually @State private var).",
    });
    assert.equal(fs.readFileSync(swiftFile, "utf8"), replacementSource);
    const captured = JSON.parse(fs.readFileSync(capturedScan, "utf8"));
    assert.equal(captured.source, validatedSource);
    assert.notEqual(captured.scan_path, fs.realpathSync(swiftFile));
    assert.deepEqual(captured.payload, {
      cwd: fs.realpathSync(workspace),
      tool_input: { file_path: captured.scan_path },
      tool_name: "Write",
    });
    assert.equal(fs.existsSync(captured.scan_path), false);
  });
});

test("adapter rejects traversal, files outside the workspace, symlinks, and oversized files", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const workspace = path.join(outputRoot, "workspace");
    const outside = path.join(outputRoot, "Outside.swift");
    const symlink = path.join(workspace, "Linked.swift");
    const oversized = path.join(workspace, "Oversized.swift");
    fs.mkdirSync(workspace);
    fs.writeFileSync(outside, "struct Outside {}\n", "utf8");
    fs.symlinkSync(outside, symlink);
    fs.writeFileSync(oversized, "x".repeat(1024 * 1024 + 1), "utf8");

    const event = (filePath: string) => JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: filePath },
      workspace_roots: [workspace],
      cwd: workspace,
    });

    assertFailOpen(invoke(adapter, "post-write", event("../Outside.swift")), "unsafe write path");
    assertFailOpen(invoke(adapter, "post-write", event("..\\Outside.swift")), "unsafe write path");
    assertFailOpen(invoke(adapter, "post-write", event(outside)), "unsafe write path");
    assertFailOpen(invoke(adapter, "post-write", event(symlink)), "unsafe write file");
    assertFailOpen(invoke(adapter, "post-write", event(oversized)), "write file too large");
  });
});

test("adapter rejects malformed workspace boundaries and a cwd outside declared roots", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const workspace = path.join(outputRoot, "workspace");
    const otherWorkspace = path.join(outputRoot, "other-workspace");
    const swiftFile = path.join(workspace, "Example.swift");
    fs.mkdirSync(workspace);
    fs.mkdirSync(otherWorkspace);
    fs.writeFileSync(swiftFile, "struct Example {}\n", "utf8");

    assertFailOpen(invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: swiftFile },
      workspace_roots: ["relative-root"],
      cwd: workspace,
    })), "unsafe workspace roots");
    assertFailOpen(invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: swiftFile },
      workspace_roots: [otherWorkspace],
      cwd: workspace,
    })), "unsafe write cwd");
  });
});

test("adapter emits only fixed diagnostics and validated line numbers from child output", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const swiftFile = path.join(outputRoot, "Example.swift");
    fs.writeFileSync(swiftFile, "struct Example {\n  @State var value = 0\n}\n", "utf8");
    const child = path.join(outputRoot, "scripts", "swift-guardrails.py");
    fs.writeFileSync(child, [
      "import json",
      "print(json.dumps({",
      "    'decision': 'block',",
      "    'reason': 'SECRET REASON',",
      "    'hookSpecificOutput': {'additionalContext': (",
      "        '\\n⚠️ /SECRET/PATH.swift: @State without access control (use @State private var):\\n'",
      "        '2:SECRET SOURCE LINE\\n' + ('9' * 5000) + ':HUGE LINE NUMBER\\n999:OUT OF RANGE\\n'",
      "        '\\n⚠️ /SECRET/PATH.swift: attacker controlled header:\\n1:SECRET EXTRA\\n'",
      "    )},",
      "}))",
      "",
    ].join("\n"), "utf8");

    const { response } = invoke(adapter, "post-write", JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: swiftFile },
      cwd: outputRoot,
    }));
    assert.deepEqual(response, {
      additional_context:
        "AXIOM_SWIFT_STATE_ACCESS L2: Add an explicit access level to this @State property (usually @State private var).",
    });
    assert.doesNotMatch(response.additional_context, /SECRET|PATH|SOURCE|REASON|attacker/);
  });
});

test("adapter fails open instead of relaying unsupported child context", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const swiftFile = path.join(outputRoot, "Example.swift");
    fs.writeFileSync(swiftFile, "struct Example {}\n", "utf8");
    fs.writeFileSync(
      path.join(outputRoot, "scripts", "swift-guardrails.py"),
      "import json\nprint(json.dumps({'hookSpecificOutput': {'additionalContext': 'SECRET CHILD TEXT'}}))\n",
      "utf8",
    );

    assertFailOpen(
      invoke(adapter, "post-write", JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: swiftFile },
        cwd: outputRoot,
      })),
      "unsupported child output",
    );
  });
});

test("adapter fails open for invalid child JSON", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const swiftFile = path.join(outputRoot, "Example.swift");
    fs.writeFileSync(swiftFile, "struct Example {}\n", "utf8");
    fs.writeFileSync(
      path.join(outputRoot, "scripts", "swift-guardrails.py"),
      "print('not json')\n",
      "utf8",
    );
    assertFailOpen(
      invoke(adapter, "post-write", JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: swiftFile },
        cwd: outputRoot,
      })),
      "invalid child JSON",
    );
  });
});

test("adapter fails open when a child exits nonzero or times out", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const child = path.join(outputRoot, "scripts", "posttool-bash-hints.py");
    fs.writeFileSync(child, "import sys\nsys.exit(1)\n", "utf8");
    assertFailOpen(
      invoke(adapter, "post-shell", JSON.stringify({
        tool_name: "Shell",
        tool_input: { command: "echo test" },
        tool_output: JSON.stringify({ stdout: "", stderr: "", output: "" }),
      })),
      "child failure",
    );

    fs.writeFileSync(
      child,
      "import os\nimport time\nos.close(1)\nos.close(2)\ntime.sleep(6)\n",
      "utf8",
    );
    assertFailOpen(
      invoke(adapter, "post-shell", JSON.stringify({
        tool_name: "Shell",
        tool_input: { command: "echo test" },
        tool_output: JSON.stringify({ stdout: "", stderr: "", output: "" }),
      })),
      "child timeout",
    );
  });
});

test("adapter terminates descendants within Cursor's five-second outer deadline", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const child = path.join(outputRoot, "scripts", "posttool-bash-hints.py");
    const identityFile = path.join(outputRoot, "descendant.json");
    const descendantToken = `axiom-descendant-${path.basename(outputRoot)}`;
    const sleeperCode = `import time; marker=${JSON.stringify(descendantToken)}; time.sleep(9)`;
    fs.writeFileSync(child, [
      "import json",
      "import subprocess",
      "import sys",
      `identity_file = ${JSON.stringify(identityFile)}`,
      `token = ${JSON.stringify(descendantToken)}`,
      `sleeper_code = ${JSON.stringify(sleeperCode)}`,
      "descendant = subprocess.Popen(",
      "    [sys.executable, '-c', sleeper_code],",
      "    stdout=sys.stdout,",
      "    stderr=sys.stderr,",
      ")",
      "with open(identity_file, 'x', encoding='utf-8') as output:",
      "    json.dump({'pid': descendant.pid, 'token': token}, output)",
      "",
    ].join("\n"), "utf8");

    let identity: { pid: number; token: string } | undefined;
    try {
      const started = performance.now();
      const result = invoke(adapter, "post-shell", JSON.stringify({
        tool_name: "Shell",
        tool_input: { command: "echo test" },
        tool_output: JSON.stringify({ stdout: "", stderr: "", output: "" }),
      }), 5_000);
      const elapsed = performance.now() - started;
      assertFailOpen(result, "child timeout");
      assert.ok(elapsed < 5_000, `adapter exceeded Cursor's outer deadline at ${Math.round(elapsed)}ms`);
      identity = JSON.parse(fs.readFileSync(identityFile, "utf8"));
      assert.ok(Number.isSafeInteger(identity?.pid) && identity!.pid > 1);
      assert.equal(identity?.token, descendantToken);
      assert.equal(
        waitForFixtureExit(identity!.pid, identity!.token, 2_000),
        true,
        `descendant ${identity!.pid} survived adapter cleanup`,
      );
    } finally {
      if (identity === undefined && fs.existsSync(identityFile)) {
        const recorded = JSON.parse(fs.readFileSync(identityFile, "utf8"));
        if (
          Number.isSafeInteger(recorded?.pid)
          && recorded.pid > 1
          && recorded?.token === descendantToken
        ) {
          identity = recorded;
        }
      }
      if (identity !== undefined) {
        assert.equal(
          waitForFixtureExit(identity.pid, identity.token, 10_000),
          true,
          `fixture descendant ${identity.pid} did not self-expire`,
        );
      }
    }
  });
});

test("adapter terminates a noisy child as soon as either output pipe exceeds 64 KiB", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const child = path.join(outputRoot, "scripts", "posttool-bash-hints.py");
    fs.writeFileSync(child, [
      "import os",
      "import threading",
      "import time",
      "threads = [",
      "    threading.Thread(target=os.write, args=(1, b'x' * 70000)),",
      "    threading.Thread(target=os.write, args=(2, b'y' * 70000)),",
      "]",
      "[thread.start() for thread in threads]",
      "[thread.join() for thread in threads]",
      "time.sleep(6)",
      "",
    ].join("\n"), "utf8");
    const started = performance.now();
    const result = invoke(adapter, "post-shell", JSON.stringify({
      tool_name: "Shell",
      tool_input: { command: "echo test" },
      tool_output: JSON.stringify({ stdout: "", stderr: "", output: "" }),
    }));
    const elapsed = performance.now() - started;

    assertFailOpen(result, "child output too large");
    assert.ok(elapsed < 3_000, `noisy child ran for ${Math.round(elapsed)}ms`);
  });
});

test("adapter injects compact context only when Apple project detection allows it", () => {
  withStagedAdapter((adapter, outputRoot) => {
    const nonApple = path.join(outputRoot, "non-apple");
    fs.mkdirSync(nonApple);
    assert.deepEqual(invoke(adapter, "session-start", JSON.stringify({ cwd: nonApple })).response, {});

    const apple = path.join(outputRoot, "apple");
    fs.mkdirSync(path.join(apple, "App.xcodeproj"), { recursive: true });
    const { response } = invoke(adapter, "session-start", JSON.stringify({ cwd: apple }));
    assert.deepEqual(Object.keys(response), ["additional_context"]);
    assert.match(response.additional_context, /Axiom Cursor session context/);
    assert.match(response.additional_context, /Axiom Tools & Onboarding/);
  });
});
