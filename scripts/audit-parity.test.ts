/**
 * Tests for scripts/audit-parity.ts.
 *
 * Run via `node --test scripts/audit-parity.test.ts` (Node 24 native, no
 * extra deps). Wired into npm `predeploy` so every release gates on
 * these tests passing.
 *
 * Each test exercises one drift class with a synthetic fixture string
 * — never touches the real source files, so the suite is hermetic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatterAreas,
  parseBodyTable,
  parseDocAreas,
  parseSidebarAreas,
  parseSidebarGroups,
  parseDocGroups,
  validateGroupedParity,
  findDuplicates,
  diffAreas,
  validateParity,
} from "./audit-parity.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────

const goodCommandMd = `---
description: Smart audit selector
argument: "area (optional) - Which audit to run: all, memory, concurrency, accessibility"
disable-model-invocation: true
---

You are an iOS project auditor.

## Available Audits

| Area | Agent | Detects |
|------|-------|---------|
| memory | memory-auditor | Retain cycles |
| concurrency | concurrency-auditor | Data races |
| accessibility | accessibility-auditor | VoiceOver |

## Direct Dispatch
`;

const goodDocMd = `# /axiom:audit

## Available Audit Areas

### Code Quality
| Area | What |
|------|------|
| \`memory\` | Leaks |
| \`concurrency\` | Data races |
| \`accessibility\` | VoiceOver |

## Priority Levels
`;

const goodConfigTs = `      '/commands/': [
        {
          text: 'Debugging',
          items: [
            { text: '/axiom:audit memory', link: '/commands/debugging/audit-memory' }
          ]
        },
        {
          text: 'Concurrency',
          items: [
            { text: '/axiom:audit concurrency', link: '/commands/concurrency/audit-concurrency' }
          ]
        },
        {
          text: 'Accessibility',
          items: [
            { text: '/axiom:audit accessibility', link: '/commands/accessibility/audit-accessibility' }
          ]
        }
      ],
`;

// ── Parser tests ──────────────────────────────────────────────────────────

describe("parseFrontmatterAreas", () => {
  it("extracts the comma-separated list and drops 'all'", () => {
    assert.deepEqual(parseFrontmatterAreas(goodCommandMd), [
      "memory",
      "concurrency",
      "accessibility",
    ]);
  });

  it("returns [] when the argument: line is missing", () => {
    assert.deepEqual(parseFrontmatterAreas("---\nfoo: bar\n---\n"), []);
  });

  it("trims whitespace around each area", () => {
    const fm = `---\nargument: "x - Which audit to run:   memory ,  concurrency  "\n---\n`;
    assert.deepEqual(parseFrontmatterAreas(fm), ["memory", "concurrency"]);
  });
});

describe("parseBodyTable", () => {
  it("returns area + agent for each row", () => {
    assert.deepEqual(parseBodyTable(goodCommandMd), [
      { area: "memory", agent: "memory-auditor" },
      { area: "concurrency", agent: "concurrency-auditor" },
      { area: "accessibility", agent: "accessibility-auditor" },
    ]);
  });

  it("ignores the header and separator rows", () => {
    const rows = parseBodyTable(goodCommandMd);
    for (const r of rows) {
      assert.notEqual(r.area, "Area");
      assert.notEqual(r.area.startsWith("---"), true);
    }
  });

  it("returns [] when the section is missing", () => {
    assert.deepEqual(parseBodyTable("# heading\n## something else\n"), []);
  });
});

describe("parseDocAreas", () => {
  it("extracts code-span tokens preserving order and multiplicity", () => {
    assert.deepEqual(parseDocAreas(goodDocMd), [
      "memory",
      "concurrency",
      "accessibility",
    ]);
  });

  it("captures duplicates so callers can detect them", () => {
    const doc = `## Available Audit Areas\n\n| \`foo\` | x |\n| \`foo\` | y |\n| \`bar\` | z |\n\n## next`;
    assert.deepEqual(parseDocAreas(doc), ["foo", "foo", "bar"]);
  });

  it("returns [] when the section is missing", () => {
    assert.deepEqual(parseDocAreas("# heading\n## other\n"), []);
  });
});

describe("parseSidebarAreas", () => {
  it("extracts area names from /commands/<group>/audit-<area> links", () => {
    assert.deepEqual(parseSidebarAreas(goodConfigTs).sort(), [
      "accessibility",
      "concurrency",
      "memory",
    ]);
  });

  it("ignores non-audit command links (fix-build, ask, etc.)", () => {
    const cfg = `      '/commands/': [
        {
          text: 'Build',
          items: [
            { text: 'fix-build', link: '/commands/build/fix-build' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: '/axiom:audit textkit', link: '/commands/ui-design/audit-textkit' }
          ]
        }
      ],
`;
    assert.deepEqual(parseSidebarAreas(cfg), ["textkit"]);
  });

  it("returns [] when the commands sidebar block is missing", () => {
    assert.deepEqual(parseSidebarAreas("export default { themeConfig: { sidebar: {} } }"), []);
  });
});

// ── Validation tests ──────────────────────────────────────────────────────

describe("findDuplicates", () => {
  it("returns counts only for items appearing 2+ times", () => {
    assert.deepEqual(findDuplicates(["a", "b", "a", "c", "a", "b"]), { a: 3, b: 2 });
  });

  it("returns {} when nothing duplicates", () => {
    assert.deepEqual(findDuplicates(["a", "b", "c"]), {});
  });
});

describe("diffAreas", () => {
  it("reports missing and extra symmetrically", () => {
    assert.deepEqual(diffAreas(["a", "b", "c"], ["b", "c", "d"]), {
      missing: ["a"],
      extra: ["d"],
    });
  });

  it("returns empty arrays for equal sets regardless of order", () => {
    assert.deepEqual(diffAreas(["a", "b", "c"], ["c", "a", "b"]), {
      missing: [],
      extra: [],
    });
  });
});

describe("validateParity end-to-end", () => {
  it("returns no errors when all four sources agree", () => {
    const errs = validateParity({
      frontmatter: ["memory", "concurrency", "accessibility"],
      body: ["memory", "concurrency", "accessibility"],
      docs: ["memory", "concurrency", "accessibility"],
      sidebar: ["memory", "concurrency", "accessibility"],
    });
    assert.deepEqual(errs, []);
  });

  it("flags A↔B drift when body table is missing an area", () => {
    const errs = validateParity({
      frontmatter: ["memory", "concurrency"],
      body: ["memory"],
      docs: ["memory", "concurrency"],
      sidebar: ["memory", "concurrency"],
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /body table.*missing.*concurrency/);
  });

  it("flags A↔C drift when docs page has an extra area", () => {
    const errs = validateParity({
      frontmatter: ["memory"],
      body: ["memory"],
      docs: ["memory", "axiom-data"],
      sidebar: ["memory"],
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /docs page.*extra.*axiom-data/);
  });

  it("flags A↔Sidebar drift when sidebar is missing an area", () => {
    const errs = validateParity({
      frontmatter: ["memory", "concurrency", "ux-flow"],
      body: ["memory", "concurrency", "ux-flow"],
      docs: ["memory", "concurrency", "ux-flow"],
      sidebar: ["memory", "concurrency"],
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /sidebar config.*missing.*ux-flow/);
  });

  it("detects duplicates in the docs page (the axiom-77g regression)", () => {
    const errs = validateParity({
      frontmatter: ["memory"],
      body: ["memory"],
      docs: ["memory", "axiom-data", "axiom-data", "axiom-data"],
      sidebar: ["memory"],
    });
    // 1 extra-axiom-data drift + 1 duplicate report
    const dup = errs.find((e) => /Duplicate.*axiom-data.*3×.*docs/.test(e));
    assert.ok(dup, `expected duplicate error, got: ${JSON.stringify(errs)}`);
  });

  it("detects duplicates in the frontmatter (rare but possible)", () => {
    const errs = validateParity({
      frontmatter: ["memory", "memory"],
      body: ["memory"],
      docs: ["memory"],
      sidebar: ["memory"],
    });
    const dup = errs.find((e) => /Duplicate.*memory.*frontmatter/.test(e));
    assert.ok(dup, `expected duplicate error, got: ${JSON.stringify(errs)}`);
  });

  it("reports parse failures for empty inputs", () => {
    const errs = validateParity({
      frontmatter: [],
      body: ["memory"],
      docs: ["memory"],
      sidebar: ["memory"],
    });
    assert.ok(errs.some((e) => /Could not parse.*frontmatter/.test(e)));
  });

  it("reports multiple drifts independently — A↔B and A↔Sidebar at once", () => {
    const errs = validateParity({
      frontmatter: ["memory", "concurrency", "ux-flow"],
      body: ["memory"],
      docs: ["memory", "concurrency", "ux-flow"],
      sidebar: ["memory"],
    });
    // Two missing reports: one for body, one for sidebar.
    const bodyMiss = errs.find((e) => /body table.*missing.*concurrency.*ux-flow/.test(e));
    const sidebarMiss = errs.find((e) => /sidebar config.*missing.*concurrency.*ux-flow/.test(e));
    assert.ok(bodyMiss, "expected body-table missing error");
    assert.ok(sidebarMiss, "expected sidebar missing error");
  });
});

// ── Grouped parity tests ──────────────────────────────────────────────────

const groupedConfigTs = `      '/commands/': [
        {
          text: 'Build',
          items: [
            { text: '/axiom:audit build', link: '/commands/build/audit-build' },
            { text: '/axiom:fix-build', link: '/commands/build/fix-build' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: '/axiom:audit liquid-glass', link: '/commands/ui-design/audit-liquid-glass' },
            { text: '/axiom:audit textkit', link: '/commands/ui-design/audit-textkit' }
          ]
        },
        {
          text: 'Utility',
          items: [
            { text: '/axiom:ask', link: '/commands/utility/ask' }
          ]
        }
      ],
`;

const groupedDocMd = `## Available Audit Areas

### Build
| Area | What |
|------|------|
| \`build\` | Build optimization |

### UI & Design
| Area | What |
|------|------|
| \`liquid-glass\` | iOS 26 |
| \`textkit\` | Text rendering |

## Priority Levels
`;

describe("parseSidebarGroups", () => {
  it("returns one entry per group with at least one audit link, in order", () => {
    const groups = parseSidebarGroups(groupedConfigTs);
    assert.deepEqual(groups, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["liquid-glass", "textkit"] },
    ]);
  });

  it("ignores groups with zero audit links (e.g., Utility)", () => {
    const groups = parseSidebarGroups(groupedConfigTs);
    assert.equal(groups.find((g) => g.group === "Utility"), undefined);
  });

  it("returns [] when commands sidebar block is absent", () => {
    assert.deepEqual(parseSidebarGroups("export default {}"), []);
  });
});

describe("parseDocGroups", () => {
  it("returns one entry per ### heading + table with code-span items, in order", () => {
    const groups = parseDocGroups(groupedDocMd);
    assert.deepEqual(groups, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["liquid-glass", "textkit"] },
    ]);
  });

  it("returns [] when section is missing", () => {
    assert.deepEqual(parseDocGroups("# heading\n## elsewhere\n"), []);
  });

  it("preserves item order within each group", () => {
    const md = `## Available Audit Areas\n\n### Storage\n| \`zebra\` | x |\n| \`alpha\` | y |\n| \`mid\` | z |\n\n## next`;
    const groups = parseDocGroups(md);
    assert.deepEqual(groups[0].areas, ["zebra", "alpha", "mid"]);
  });
});

describe("validateGroupedParity", () => {
  const sidebarBaseline = [
    { group: "Build", areas: ["build"] },
    { group: "UI & Design", areas: ["liquid-glass", "textkit"] },
  ];

  it("returns no errors when sidebar and docs match exactly", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["liquid-glass", "textkit"] },
    ]);
    assert.deepEqual(errs, []);
  });

  it("flags group-count mismatch", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
    ]);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /sidebar has 2 groups, docs has 1/);
  });

  it("flags group-name mismatch at first divergence", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
      { group: "Code Quality", areas: ["liquid-glass", "textkit"] },
    ]);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /position 1.*sidebar='UI & Design'.*docs='Code Quality'/);
  });

  it("flags group-order swap (Build ↔ UI & Design)", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "UI & Design", areas: ["liquid-glass", "textkit"] },
      { group: "Build", areas: ["build"] },
    ]);
    assert.match(errs[0], /position 0.*sidebar='Build'.*docs='UI & Design'/);
  });

  it("flags within-group count mismatch", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["liquid-glass"] },
    ]);
    const ui = errs.find((e) => /UI & Design.*count mismatch/.test(e));
    assert.ok(ui, `expected UI & Design count error, got ${JSON.stringify(errs)}`);
  });

  it("flags within-group item-order swap", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["textkit", "liquid-glass"] },
    ]);
    const ui = errs.find((e) => /UI & Design.*item order.*position 0.*sidebar='liquid-glass'.*docs='textkit'/.test(e));
    assert.ok(ui, `expected UI & Design order error, got ${JSON.stringify(errs)}`);
  });

  it("flags within-group item-name mismatch (ghost area in docs)", () => {
    const errs = validateGroupedParity(sidebarBaseline, [
      { group: "Build", areas: ["build"] },
      { group: "UI & Design", areas: ["liquid-glass", "ghost-area"] },
    ]);
    const ui = errs.find((e) => /UI & Design.*item order.*sidebar='textkit'.*docs='ghost-area'/.test(e));
    assert.ok(ui, `expected UI & Design item-name error, got ${JSON.stringify(errs)}`);
  });
});
