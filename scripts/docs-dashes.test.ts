/**
 * Tests for scripts/docs-dashes.ts (pre-deploy check 12i).
 *
 * Run via `node --test scripts/docs-dashes.test.ts` (Node 24 native, no extra deps).
 * Wired into npm `test:unit` → `predeploy`, so every release gates on these passing.
 *
 * Each test exercises one drift class with a synthetic fixture string — never touches
 * the real docs tree, so the suite is hermetic.
 *
 * WHY THIS EXISTS: the pattern shipped for months flagging only the em-dash. An ASCII
 * hyphen in the separator position (`- **Label** - desc`) passed silently, and six
 * violations reached a published docs page THROUGH the check that exists to stop them.
 * The gate had no test. That is the bug these fixtures pin down.
 *
 * The ✅/❌ fixtures below are lifted from `.claude/rules/documentation-style.md`
 * §Dashes — keep them in sync with the rule's canonical examples.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findDashViolations, isDashViolation } from "./docs-dashes.ts";

describe("isDashViolation — wrong separators (must flag)", () => {
  // Enumerate the whole wrong class, not just the two we happened to hit. Adding
  // dashes one at a time is what let the ASCII hyphen through in the first place.
  const wrong: Array<[string, string]> = [
    ["- **Silent failures** - `try?` fallbacks lose data", "ASCII hyphen — the one that shipped"],
    ["- **Silent failures** — `try?` fallbacks lose data", "em-dash — the original rule violation"],
    ["- **Silent failures** − `try?` fallbacks lose data", "U+2212 MINUS — the range landmine"],
    ["- **Silent failures** ‐ `try?` fallbacks lose data", "U+2010 HYPHEN"],
    ["- **Silent failures** ‑ `try?` fallbacks lose data", "U+2011 NON-BREAKING HYPHEN"],
    ["- **Silent failures** ‒ `try?` fallbacks lose data", "U+2012 FIGURE DASH"],
    ["- **Silent failures** ― `try?` fallbacks lose data", "U+2015 HORIZONTAL BAR"],
    ["- [build-fixer](/agents/build-fixer) - Autonomous agent", "link head"],
    ["- `code` - description", "code-span head"],
    ["* **Star bullet** - description", "asterisk bullet"],
    ["1. **Numbered** - description", "numbered list item"],
    ["  - **Nested** - description", "indented / nested item"],
  ];

  for (const [line, label] of wrong) {
    it(`flags ${label}`, () => {
      assert.equal(isDashViolation(line), true, `should have flagged: ${JSON.stringify(line)}`);
    });
  }
});

describe("isDashViolation — legal content (must NOT flag)", () => {
  const legal: Array<[string, string]> = [
    ["- **Silent failures** – `try?` fallbacks lose data", "correct en-dash (the rule)"],
    ["- [build-fixer](/agents/build-fixer) – Autonomous agent", "correct en-dash, link head"],
    // The trailing \s in the pattern is what saves these two. If someone "tidies" it
    // away, every negative number and CLI flag in the docs starts blocking commits.
    ["- **Delta** -5 degrees below baseline", "negative number, not a separator"],
    ["- **Usage** -v for verbose output", "CLI flag, not a separator"],
    ["- **Scale** 1-5 rating", "numeric range, not a separator"],
    ["- **Key insight** This pattern prevents data loss.", "no separator at all"],
    ["the build — not the code — is stale", "em-dash in running prose (not list-led)"],
    ["- plain bullet - with a hyphen", "no inline-heading head, so not a separator"],
    ["a 1–5 scale", "unspaced en-dash numeric range"],
  ];

  for (const [line, label] of legal) {
    it(`does not flag ${label}`, () => {
      assert.equal(isDashViolation(line), false, `false positive on: ${JSON.stringify(line)}`);
    });
  }
});

describe("findDashViolations — file-level scanning", () => {
  it("reports 1-indexed line numbers", () => {
    const src = ["# Title", "", "- **Bad** - one", "- **Good** – two", "- **Bad** — three"].join("\n");
    assert.deepEqual(findDashViolations(src), [3, 5]);
  });

  it("skips fenced code blocks — a bullet inside a markdown example is illustrative", () => {
    const src = ["# Title", "", "```markdown", "- **Example** - this is a sample", "```", ""].join("\n");
    assert.deepEqual(findDashViolations(src), []);
  });

  it("skips YAML frontmatter", () => {
    const src = ["---", "name: thing - with a dash", "---", "", "- **Real** – ok"].join("\n");
    assert.deepEqual(findDashViolations(src), []);
  });

  it("still catches violations after a fenced block closes", () => {
    const src = ["```", "- **Inside** - ignored", "```", "- **Outside** - caught"].join("\n");
    assert.deepEqual(findDashViolations(src), [4]);
  });

  it("returns empty for a clean file", () => {
    const src = ["# Title", "", "- **Good** – yes", "- **Also good** – yes"].join("\n");
    assert.deepEqual(findDashViolations(src), []);
  });
});
