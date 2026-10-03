import { describe, expect, it, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionHandler,
  ToolCallEvent,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import axiomPi from "./index.ts";

describe("axiomPi project gate", () => {
  it("keeps every tool hook quiet outside Apple projects and honors the context override", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-pi-hooks-"));
    try {
      const workspace = path.join(root, "workspace");
      fs.mkdirSync(workspace);
      fs.mkdirSync(path.join(workspace, ".git"));
      const external = path.join(root, "external");
      fs.mkdirSync(external);
      const swiftFile = path.join(external, "View.swift");
      fs.writeFileSync(swiftFile, "struct V { @State var count = 0 }\n");
      const listeners = new Map<string, unknown>();
      const messages: unknown[] = [];
      const api = {
        on: (event: string, handler: unknown) => {
          listeners.set(event, handler);
        },
        registerCommand: () => {},
        sendMessage: (message: unknown) => {
          messages.push(message);
        },
      } as unknown as ExtensionAPI;
      axiomPi(api);
      const call = listeners.get(
        "tool_call",
      ) as ExtensionHandler<ToolCallEvent>;
      const result = listeners.get("tool_result") as ExtensionHandler<
        ToolResultEvent,
        unknown
      >;
      const context = { cwd: workspace } as ExtensionContext;
      for (const testCase of [
        { apple: false, override: "", enabled: false },
        { apple: false, override: "always", enabled: true },
        { apple: true, override: "", enabled: true },
        { apple: true, override: "never", enabled: false },
      ]) {
        vi.stubEnv("AXIOM_SESSION_CONTEXT", testCase.override);
        if (testCase.apple)
          fs.writeFileSync(
            path.join(workspace, "Package.swift"),
            "// swift-tools-version: 6.0\n",
          );
        messages.length = 0;
        await call(
          {
            type: "tool_call",
            toolCallId: "crash",
            toolName: "read",
            input: { path: path.join(external, "report.ips") },
          },
          context,
        );
        expect(messages.length).toBe(testCase.enabled ? 1 : 0);
        for (const event of [
          {
            type: "tool_result",
            toolCallId: "bash",
            toolName: "bash",
            input: { command: "swift build" },
            content: [{ type: "text", text: "error: data race detected" }],
            details: undefined,
            isError: false,
          },
          {
            type: "tool_result",
            toolCallId: "write",
            toolName: "write",
            input: {
              path: swiftFile,
              content: "struct V { @State var count = 0 }",
            },
            content: [],
            details: undefined,
            isError: false,
          },
        ] satisfies ToolResultEvent[]) {
          const output = await result(event, context);
          if (testCase.enabled) expect(output).toHaveProperty("content");
          else expect(output).toBeUndefined();
        }
      }
    } finally {
      vi.unstubAllEnvs();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
