import { describe, it, expect } from "vitest";
import {
  unscopedStateVars,
  unguardedRelationships,
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

  it("does not flag comments, string literals, or a leading access modifier", () => {
    const swift = [
      "// @State var commented = 0",
      '    let hint = "@State var inAString = 0"',
      "    private @State var leading = 0",
      "    @State var real = 0",
    ].join("\n");
    expect(unscopedStateVars(swift)).toEqual([{ line: 4, text: "@State var real = 0" }]);
  });
});

describe("unguardedRelationships", () => {
  const model = (decl: string) =>
    `import SwiftData\n@Model final class L {\n    ${decl}\n    init() {}\n}`;

  it("flags a to-many @Relationship array with no default", () => {
    expect(unguardedRelationships(model("@Relationship var books: [Book]"))).toEqual([
      { line: 3, text: "@Relationship var books: [Book]" },
    ]);
  });

  it("flags the attribute-above-var form", () => {
    const swift = "@Model final class L {\n    @Relationship(deleteRule: .cascade)\n    var books: [Book]\n}";
    expect(unguardedRelationships(swift)).toEqual([
      { line: 2, text: "@Relationship(deleteRule: .cascade)" },
    ]);
  });

  it("ignores defaulted, to-one, optional, dictionary, commented, string, and ignored decls", () => {
    expect(unguardedRelationships(model("@Relationship var books: [Book] = []"))).toEqual([]);
    expect(unguardedRelationships(model("@Relationship var owner: Person"))).toEqual([]);
    expect(unguardedRelationships(model("@Relationship var parent: Shelf?"))).toEqual([]);
    expect(unguardedRelationships(model("@Relationship var index: [String: Book]"))).toEqual([]);
    expect(unguardedRelationships(model("// @Relationship var books: [Book]"))).toEqual([]);
    expect(unguardedRelationships(model('let s = "@Relationship var books: [Book]"'))).toEqual([]);
    expect(unguardedRelationships(model("@Relationship var books: [Book] // axiom-ignore"))).toEqual([]);
  });

  it("ignores an optional to-many array (defaults to nil)", () => {
    expect(unguardedRelationships(model("@Relationship var books: [Book]?"))).toEqual([]);
  });

  it("ignores a default on the next line", () => {
    const swift = "@Model class L {\n    @Relationship var books: [Book]\n        = []\n}";
    expect(unguardedRelationships(swift)).toEqual([]);
  });

  it("does not span a blank line between attribute and var", () => {
    const swift = "@Model class L {\n    @Relationship(deleteRule: .cascade)\n\n    var books: [Book]\n}";
    expect(unguardedRelationships(swift)).toEqual([]);
  });

  it("matches a multi-line attribute within the lookahead window", () => {
    const swift = "@Model class L {\n    @Relationship(\n        deleteRule: .cascade\n    )\n    var books: [Book]\n}";
    expect(unguardedRelationships(swift)).toEqual([{ line: 2, text: "@Relationship(" }]);
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

  it("warns about a to-many @Relationship without a default", () => {
    const w = swiftGuardrailWarning("@Model class L {\n    @Relationship var books: [Book]\n}");
    expect(w).toContain("@Relationship");
    expect(w).toContain("= []");
    expect(w).toContain("L2");
  });

  it("reports @State and @Relationship together", () => {
    const swift = [
      "@Model class M {",
      "    @Relationship var items: [Item]",
      "}",
      "struct V {",
      "    @State var count = 0",
      "}",
    ].join("\n");
    const w = swiftGuardrailWarning(swift) ?? "";
    expect(w).toContain("@State private var");
    expect(w).toContain("`@Relationship`");
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
