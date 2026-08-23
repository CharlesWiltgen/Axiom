import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VirtualFile } from "./types.ts";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.join(moduleDirectory, "runtime");
const repositoryRoot = path.resolve(moduleDirectory, "..", "..");
const canonicalHooksDirectory = path.join(
  repositoryRoot,
  ".claude-plugin",
  "plugins",
  "axiom",
  "hooks",
);

const HOOKS_DOCUMENT = {
  version: 1,
  hooks: {
    sessionStart: [
      { command: "python3 ./scripts/cursor-hook-adapter.py session-start", timeout: 5 },
    ],
    beforeSubmitPrompt: [
      { command: "python3 ./scripts/cursor-hook-adapter.py prompt-submit", timeout: 5 },
    ],
    subagentStart: [
      { command: "python3 ./scripts/cursor-hook-adapter.py subagent-start", timeout: 5 },
    ],
    preToolUse: [
      { command: "python3 ./scripts/cursor-hook-adapter.py pretool-read", matcher: "Read", timeout: 5 },
    ],
    postToolUse: [
      { command: "python3 ./scripts/cursor-hook-adapter.py post-shell", matcher: "Shell", timeout: 5 },
      { command: "python3 ./scripts/cursor-hook-adapter.py post-write", matcher: "Write", timeout: 5 },
    ],
  },
};

function readFile(source: string): string {
  return fs.readFileSync(source, "utf8");
}

export function renderCursorHooks(): VirtualFile[] {
  const runtime = ["pretool-crash-route.py", "project_detect.py", "posttool-bash-hints.py", "subagent-start.py", "swift-guardrails.py", "user-prompt-submit.py"].map((filename) => ({
    path: `scripts/${filename}`,
    content: readFile(path.join(canonicalHooksDirectory, filename)),
    mode: 0o644 as const,
  }));
  return [
    {
      path: "hooks/hooks.json",
      content: `${JSON.stringify(HOOKS_DOCUMENT, null, 2)}\n`,
      mode: 0o644,
    },
    {
      path: "scripts/cursor-hook-adapter.py",
      content: readFile(path.join(runtimeDirectory, "cursor-hook-adapter.py")),
      mode: 0o644,
    },
    ...runtime,
  ];
}
