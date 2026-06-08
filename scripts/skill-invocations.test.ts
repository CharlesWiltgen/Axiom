/**
 * Tests for scripts/skill-invocations.ts.
 *
 * Run via `node --test scripts/skill-invocations.test.ts` (Node 24 native, no
 * extra deps). Wired into npm `test:unit` so every release gates on these
 * tests passing.
 *
 * Each test exercises one resolution case with a synthetic body string —
 * never touches the real skill tree, so the suite is hermetic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkSkillInvocations,
  findSkillNameCollisions,
} from "./skill-invocations.ts";

// Stand-in target universe: two top-level skills + two child sub-skills.
// Top-level names carry the axiom- prefix; children are bare basenames —
// mirrors the real filesystem (allSkillNames ∪ childSkillNames).
const targets = new Set([
  "axiom-build",
  "axiom-concurrency",
  "build-performance",
  "accessibility-diag",
]);

describe("checkSkillInvocations", () => {
  it("resolves a bare top-level (router) invocation", () => {
    const result = checkSkillInvocations("/skill axiom-concurrency", targets);
    assert.deepEqual(result, [
      { raw: "axiom-concurrency", name: "axiom-concurrency", line: 1, resolved: true },
    ]);
  });

  it("resolves a namespaced child invocation (axiom:<child>)", () => {
    const result = checkSkillInvocations("/skill axiom:build-performance", targets);
    assert.deepEqual(result, [
      { raw: "axiom:build-performance", name: "build-performance", line: 1, resolved: true },
    ]);
  });

  it("flags a bare dead-end (the ios-ml /skill coreml bug)", () => {
    const result = checkSkillInvocations("/skill coreml", targets);
    assert.deepEqual(result, [
      { raw: "coreml", name: "coreml", line: 1, resolved: false },
    ]);
  });

  it("flags a namespaced dead-end (axiom:<missing>)", () => {
    const result = checkSkillInvocations("/skill axiom:coreml-ref", targets);
    assert.deepEqual(result, [
      { raw: "axiom:coreml-ref", name: "coreml-ref", line: 1, resolved: false },
    ]);
  });

  it("skips invocations namespaced to a non-axiom plugin", () => {
    const result = checkSkillInvocations(
      "/skill superpowers:brainstorming",
      targets,
    );
    assert.deepEqual(result, []);
  });

  it("reports the 1-based line of each invocation", () => {
    const body = "intro line\n\n/skill axiom-build\ntrailing";
    const result = checkSkillInvocations(body, targets);
    assert.deepEqual(result, [
      { raw: "axiom-build", name: "axiom-build", line: 3, resolved: true },
    ]);
  });

  it("stops the target at markdown punctuation (backticks, period)", () => {
    const result = checkSkillInvocations("see `/skill axiom-build`.", targets);
    assert.deepEqual(result, [
      { raw: "axiom-build", name: "axiom-build", line: 1, resolved: true },
    ]);
  });

  it("finds multiple invocations on one line", () => {
    const result = checkSkillInvocations(
      "/skill axiom-build then /skill axiom-concurrency",
      targets,
    );
    assert.deepEqual(result, [
      { raw: "axiom-build", name: "axiom-build", line: 1, resolved: true },
      { raw: "axiom-concurrency", name: "axiom-concurrency", line: 1, resolved: true },
    ]);
  });

  it("does not match a word-char-prefixed /skill (e.g. a path segment)", () => {
    const result = checkSkillInvocations("foo/skill axiom-build", targets);
    assert.deepEqual(result, []);
  });

  it("does not match a skills/ file path (requires whitespace after /skill)", () => {
    const result = checkSkillInvocations(
      "see skills/build-performance.md for details",
      targets,
    );
    assert.deepEqual(result, []);
  });

  it("does not match a bare /skill with no target", () => {
    const result = checkSkillInvocations("run /skill\nnext", targets);
    assert.deepEqual(result, []);
  });

  it("returns [] for a body with no invocations", () => {
    const result = checkSkillInvocations("nothing to see here", targets);
    assert.deepEqual(result, []);
  });
});

describe("findSkillNameCollisions", () => {
  it("returns [] when the namespace is unambiguous", () => {
    const result = findSkillNameCollisions({
      topLevelNames: new Set(["axiom-build", "axiom-accessibility"]),
      childOccurrences: new Map([
        ["build-performance", ["axiom-build/skills/build-performance.md"]],
        ["accessibility-diag", ["axiom-accessibility/skills/accessibility-diag.md"]],
      ]),
    });
    assert.deepEqual(result, []);
  });

  it("flags a child basename present in two suites as duplicate-child", () => {
    const result = findSkillNameCollisions({
      topLevelNames: new Set(["axiom-build", "axiom-data"]),
      childOccurrences: new Map([
        ["debugging", ["axiom-build/skills/debugging.md", "axiom-data/skills/debugging.md"]],
      ]),
    });
    assert.deepEqual(result, [
      {
        kind: "duplicate-child",
        name: "debugging",
        locations: ["axiom-build/skills/debugging.md", "axiom-data/skills/debugging.md"],
      },
    ]);
  });

  it("flags a child basename equal to a top-level skill name", () => {
    const result = findSkillNameCollisions({
      topLevelNames: new Set(["axiom-build"]),
      childOccurrences: new Map([
        ["axiom-build", ["axiom-data/skills/axiom-build.md"]],
      ]),
    });
    assert.deepEqual(result, [
      {
        kind: "child-shadows-top-level",
        name: "axiom-build",
        locations: ["axiom-data/skills/axiom-build.md"],
      },
    ]);
  });

  it("flags both kinds for a name that is duplicated AND shadows a top-level skill", () => {
    const result = findSkillNameCollisions({
      topLevelNames: new Set(["foo"]),
      childOccurrences: new Map([
        ["foo", ["a/skills/foo.md", "b/skills/foo.md"]],
      ]),
    });
    // Sorted by name then kind → shadows ('c') before duplicate ('d').
    assert.deepEqual(result, [
      { kind: "child-shadows-top-level", name: "foo", locations: ["a/skills/foo.md", "b/skills/foo.md"] },
      { kind: "duplicate-child", name: "foo", locations: ["a/skills/foo.md", "b/skills/foo.md"] },
    ]);
  });
});
