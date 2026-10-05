import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreCompilerEvidence } from "./axbuild.acceptance.ts";

describe("scoreCompilerEvidence", () => {
  it("rejects incorrect locations and invented errors while retaining emitted repeats", () => {
    const expected = {
      compilerErrors: [{
        file: "A.swift",
        line: 2,
        column: 3,
        message: "cannot find missingName in scope",
      }],
      compilerWarnings: [],
    };
    const log =
      "/fixture/A.swift:2:3: error: cannot find missingName in scope\n/fixture/A.swift:2:3: error: cannot find missingName in scope\n";
    const items = Array.from(
      { length: 2 },
      () => ({
        kind: "compiler",
        severity: "error",
        line: 2,
        column: 3,
        message: "cannot find missingName in scope",
      }),
    );
    const report = {
      diagnostics: [{ file: "/fixture/A.swift", items }],
    } as Parameters<typeof scoreCompilerEvidence>[0];
    assert.doesNotThrow(() =>
      scoreCompilerEvidence(report, log, "/fixture", expected)
    );
    for (
      const variant of [
        { file: "/wrong/location.swift", items },
        {
          file: "/fixture/A.swift",
          items: items.map((item) => ({ ...item, line: 999 })),
        },
        {
          file: "/fixture/A.swift",
          items: items.map((item) => ({ ...item, message: "invented error" })),
        },
      ]
    ) {
      assert.throws(() =>
        scoreCompilerEvidence(
          { ...report, diagnostics: [variant] },
          log,
          "/fixture",
          expected,
        )
      );
    }
  });

  it("requires each expected key at its own location", () => {
    const expected = {
      compilerErrors: [2, 5].map((line) => ({
        file: "A.swift",
        line,
        column: 3,
        message: "cannot find missingName in scope",
      })),
      compilerWarnings: [],
    };
    const log = "/fixture/A.swift:2:3: error: cannot find missingName in scope\n";
    const report = {
      diagnostics: [{
        file: "/fixture/A.swift",
        items: [{
          kind: "compiler",
          severity: "error",
          line: 2,
          column: 3,
          message: "cannot find missingName in scope",
        }],
      }],
    } as Parameters<typeof scoreCompilerEvidence>[0];
    assert.throws(() => scoreCompilerEvidence(report, log, "/fixture", expected));
  });

  it("rejects a native log that is missing an expected error", () => {
    const expected = {
      compilerErrors: ["A", "B"].map((name) => ({
        file: `${name}.swift`,
        line: 2,
        column: 3,
        message: `cannot find missing${name} in scope`,
      })),
      compilerWarnings: [],
    };
    const log = "/fixture/A.swift:2:3: error: cannot find missingA in scope\n";
    const report = {
      diagnostics: [{
        file: "/fixture/A.swift",
        items: [{
          kind: "compiler",
          severity: "error",
          line: 2,
          column: 3,
          message: "cannot find missingA in scope",
        }],
      }],
    } as Parameters<typeof scoreCompilerEvidence>[0];
    assert.throws(
      () => scoreCompilerEvidence(report, log, "/fixture", expected),
      /cannot find missingB in scope/,
    );
  });
});
