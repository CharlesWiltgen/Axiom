/**
 * Tests for scripts/doc-stats.js — the doc count-marker engine.
 *
 * Run via `node --test scripts/doc-stats.test.ts` (wired into npm `test:unit`,
 * which globs scripts/*.test.ts). Each test uses a synthetic fixture string and
 * never touches the real doc files, so the suite is hermetic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDocStats,
  extractDocStats,
  tallyDocStats,
  checkMarkerSpec,
  docStatValues,
  DOC_STAT_FILES,
  DOC_STAT_KEYS,
} from "./doc-stats.js";

// Canonical stats shape (mirrors docs/.vitepress/theme/stats.json) used to keep
// the expected totals in one place rather than as scattered literals.
const STATS = {
  disciplineSkills: 151,
  referenceSkills: 78,
  diagnosticSkills: 25,
  agents: 40,
  commands: 15,
  routers: 26,
};
const VALUES = docStatValues(STATS);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("docStatValues", () => {
  it("derives the headline skills total as the sum of the three categories", () => {
    assert.deepEqual(docStatValues(STATS), {
      skills: 254,
      discipline: 151,
      reference: 78,
      diagnostic: 25,
      agents: 40,
      commands: 15,
      routers: 26,
    });
  });

  it("keeps routers independent of the headline skills total", () => {
    // 26 routers alongside 254 skills: the router count is the number of
    // layer-1 suites, not one of the three skill categories summed into
    // `skills`. Folding it in would inflate every "N skills" figure in docs.
    assert.equal(docStatValues(STATS).routers, 26);
    assert.equal(docStatValues(STATS).skills, 151 + 78 + 25);
  });

  it("treats missing stat fields as zero", () => {
    assert.deepEqual(docStatValues({}), {
      skills: 0,
      discipline: 0,
      reference: 0,
      diagnostic: 0,
      agents: 0,
      commands: 0,
      routers: 0,
    });
  });
});

describe("applyDocStats", () => {
  it("rewrites a stale marked number to the expected value", () => {
    const { content, count } = applyDocStats(
      "install all <!--ax:skills-->184<!--/ax--> skills",
      VALUES,
    );
    assert.equal(content, "install all <!--ax:skills-->254<!--/ax--> skills");
    assert.equal(count, 1);
  });

  it("rewrites every marker on a line independently (mixed keys)", () => {
    const { content, count } = applyDocStats(
      "with <!--ax:agents-->38<!--/ax--> agents and <!--ax:commands-->12<!--/ax--> commands",
      VALUES,
    );
    assert.equal(
      content,
      "with <!--ax:agents-->40<!--/ax--> agents and <!--ax:commands-->15<!--/ax--> commands",
    );
    assert.equal(count, 2);
  });

  it("leaves unmarked numbers untouched (intentional counts like '18 TDD-tested')", () => {
    const input =
      "**<!--ax:discipline-->98<!--/ax--> discipline skills** (18 TDD-tested)";
    const { content } = applyDocStats(input, VALUES);
    assert.equal(
      content,
      "**<!--ax:discipline-->151<!--/ax--> discipline skills** (18 TDD-tested)",
    );
  });

  it("is idempotent — re-running on already-correct content is a no-op", () => {
    const correct = "all <!--ax:skills-->254<!--/ax--> skills";
    assert.equal(applyDocStats(correct, VALUES).content, correct);
  });

  it("throws on an unknown marker key so a typo fails loudly", () => {
    assert.throws(
      () => applyDocStats("<!--ax:skillz-->1<!--/ax-->", VALUES),
      /Unknown doc-stat marker key 'skillz'/,
    );
  });
});

describe("extractDocStats", () => {
  it("returns every marker as { key, value } with numeric values", () => {
    const found = extractDocStats(
      "x <!--ax:skills-->254<!--/ax--> y <!--ax:agents-->40<!--/ax-->",
    );
    assert.deepEqual(found, [
      { key: "skills", value: 254 },
      { key: "agents", value: 40 },
    ]);
  });

  it("returns an empty array when a file has no markers", () => {
    assert.deepEqual(extractDocStats("no markers here"), []);
  });
});

describe("tallyDocStats", () => {
  it("counts markers by key, including repeats", () => {
    assert.deepEqual(
      tallyDocStats(
        "<!--ax:agents-->40<!--/ax--> … <!--ax:agents-->40<!--/ax--> <!--ax:skills-->254<!--/ax-->",
      ),
      { agents: 2, skills: 1 },
    );
  });
});

describe("checkMarkerSpec", () => {
  const spec = { skills: 1, agents: 2, commands: 2 };

  it("returns no problems when the file matches its spec exactly", () => {
    const content =
      "<!--ax:skills-->254<!--/ax--> <!--ax:agents-->40<!--/ax--> <!--ax:agents-->40<!--/ax--> " +
      "<!--ax:commands-->15<!--/ax--> <!--ax:commands-->15<!--/ax-->";
    assert.deepEqual(checkMarkerSpec(content, spec), []);
  });

  it("flags a partially-deleted duplicate (one of two markers removed)", () => {
    // The exact silent-drift case the all-or-nothing guard missed: one of the
    // two agents markers reverted to plain prose, the other still present.
    const content =
      "<!--ax:skills-->254<!--/ax--> <!--ax:agents-->40<!--/ax--> 40 agents " +
      "<!--ax:commands-->15<!--/ax--> <!--ax:commands-->15<!--/ax-->";
    assert.deepEqual(checkMarkerSpec(content, spec), [
      "expected 2 'agents' marker(s), found 1",
    ]);
  });

  it("flags a fully-missing key and an unexpected key", () => {
    const content = "<!--ax:skills-->254<!--/ax--> <!--ax:routers-->23<!--/ax-->";
    assert.deepEqual(checkMarkerSpec(content, { skills: 1, agents: 1 }), [
      "expected 1 'agents' marker(s), found 0",
      "unexpected 'routers' marker(s) (found 1) not in spec",
    ]);
  });
});

describe("module config", () => {
  it("every marker key is a known stat key", () => {
    for (const key of DOC_STAT_KEYS) {
      assert.ok(key in VALUES, `${key} should resolve to a value`);
    }
  });

  it("every maintained page exists on disk with valid spec keys", () => {
    // Asserting the files EXIST beats asserting a path prefix: the registry now
    // includes README.md (outside docs/), and a registered-but-deleted page
    // would otherwise fail only at release time inside pre-deploy.
    assert.equal(DOC_STAT_FILES.length, 9);
    for (const { file, markers } of DOC_STAT_FILES) {
      assert.ok(file.endsWith(".md"), `${file} should be markdown`);
      assert.ok(
        fs.existsSync(path.join(repoRoot, file)),
        `${file} is registered for count maintenance but does not exist`,
      );
      for (const key of Object.keys(markers)) {
        assert.ok(DOC_STAT_KEYS.includes(key), `${file}: '${key}' is a valid key`);
      }
    }
  });

  it("declares the marker count each page actually contains", () => {
    // The spec's per-key number is how pre-deploy knows a marker was deleted in
    // a reword. A spec that disagrees with the file silently stops guarding it.
    for (const { file, markers } of DOC_STAT_FILES) {
      const content = fs.readFileSync(path.join(repoRoot, file), "utf8");
      for (const [key, expected] of Object.entries(markers)) {
        const found = content.split(`<!--ax:${key}-->`).length - 1;
        assert.equal(found, expected, `${file}: spec says ${expected} '${key}' marker(s), file has ${found}`);
      }
    }
  });
});
