import { describe, it, expect } from "vitest";
import {
  unscopedStateVars,
  classifyCrashPath,
  crashFileHint,
  bashOutputHints,
  inputPath,
  swiftGuardrailWarning,
  toolResultHint,
} from "./guardrails.ts";

describe("unscopedStateVars", () => {
  it("flags @State var without an access level, with 1-based line numbers", () => {
    const swift = [
      "struct V: View {",
      "    @State var count = 0",
      '    @State private var name = ""',
      "    @State var flagged = true // axiom-ignore",
      "}",
    ].join("\n");
    expect(unscopedStateVars(swift)).toEqual([{ line: 2, text: "@State var count = 0" }]);
  });

  it("returns nothing when every @State is scoped", () => {
    expect(unscopedStateVars("@State private var a = 1\n@State public var b = 2")).toEqual([]);
  });
});

describe("classifyCrashPath", () => {
  it("classifies each crash-path shape", () => {
    expect([
      classifyCrashPath("/x/a.ips"),
      classifyCrashPath("/x/a.crash"),
      classifyCrashPath("/x/Foo.xccrashpoint"),
      classifyCrashPath("/x/Foo.xccrashpoint/Logs/a.crash"),
      classifyCrashPath("/x/Foo.xccrashpoint/Info.plist"),
      classifyCrashPath("/x/main.swift"),
    ]).toEqual([
      "ips", "crash_text", "xccrashpoint_bundle_root",
      "xccrashpoint_inner_crash", "xccrashpoint_inner_other", "",
    ]);
  });
});

describe("crashFileHint", () => {
  it("names xcsym and echoes the path for a crash file", () => {
    const hint = crashFileHint("/tmp/foo.ips");
    expect(hint).toContain("xcsym crash");
    expect(hint).toContain("/tmp/foo.ips");
  });

  it("is null for a non-crash path", () => {
    expect(crashFileHint("/tmp/main.swift")).toBeNull();
  });
});

describe("bashOutputHints", () => {
  it("returns the matching skill hints, in rule order", () => {
    expect(bashOutputHints("error: Sendable closure; linker command failed")).toEqual([
      "💡 Concurrency issue — load the axiom-concurrency skill.",
      "💡 Build configuration issue — try /axiom-fix-build.",
    ]);
  });

  it("is empty for empty output", () => {
    expect(bashOutputHints("")).toEqual([]);
  });
});

describe("inputPath", () => {
  it("reads either path or filePath, else undefined", () => {
    expect(inputPath({ path: "/a" })).toBe("/a");
    expect(inputPath({ filePath: "/b" })).toBe("/b");
    expect(inputPath({})).toBeUndefined();
    expect(inputPath(null)).toBeUndefined();
  });
});

describe("swiftGuardrailWarning", () => {
  it("warns about unscoped @State with line numbers", () => {
    const w = swiftGuardrailWarning("struct V {\n    @State var x = 0\n}");
    expect(w).toContain("@State private var");
    expect(w).toContain("L2");
  });

  it("is null when every @State is scoped", () => {
    expect(swiftGuardrailWarning("@State private var x = 0")).toBeNull();
  });
});

describe("toolResultHint", () => {
  const readSwift = () => "struct V {\n  @State var x = 0\n}";

  it("returns the Swift guardrail warning for a .swift write", () => {
    const hint = toolResultHint({ toolName: "write", input: { path: "/a/V.swift" }, content: [] }, readSwift);
    expect(hint).toContain("@State private var");
  });

  it("ignores non-Swift writes", () => {
    expect(toolResultHint({ toolName: "edit", input: { path: "/a/x.txt" }, content: [] }, readSwift)).toBeNull();
  });

  it("returns bash skill hints from output text", () => {
    const hint = toolResultHint(
      { toolName: "bash", input: {}, content: [{ type: "text", text: "data race here" }] },
      readSwift,
    );
    expect(hint).toBe("💡 Concurrency issue — load the axiom-concurrency skill.");
  });

  it("returns null when nothing matches", () => {
    expect(
      toolResultHint({ toolName: "bash", input: {}, content: [{ type: "text", text: "all good" }] }, readSwift),
    ).toBeNull();
  });
});
