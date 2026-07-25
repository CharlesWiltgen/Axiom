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
  extractSection,
  parseInlineAuditReferences,
  validateInlineReferences,
  parseAgentDescription,
  hasSubstantiveOverlap,
  validateAgentDescriptionParity,
  parseAdvertisedAuditAreas,
  validateAdvertisedAreas,
  parseAdvertisedCommands,
  validateAdvertisedCommands,
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
  it("returns area + agent + detects for each row", () => {
    assert.deepEqual(parseBodyTable(goodCommandMd), [
      { area: "memory", agent: "memory-auditor", detects: "Retain cycles" },
      { area: "concurrency", agent: "concurrency-auditor", detects: "Data races" },
      { area: "accessibility", agent: "accessibility-auditor", detects: "VoiceOver" },
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

// ── Inline audit-area reference tests (axiom-pop Gap 1) ───────────────────

const inlineFixtureMd = `# /axiom:audit

## Available Audits

| Area | Agent | Detects |
|------|-------|---------|
| memory | memory-auditor | Retain cycles |
| swiftui-nav | swiftui-nav-auditor | NavigationStack |

## Direct Dispatch

If $ARGUMENTS is "all" → Launch the \`health-check\` agent instead.

**Example:**
- User runs \`/axiom:audit memory\` → Launch memory-auditor agent
- User runs \`/axiom:audit swiftui-nav\` → Launch swiftui-nav-auditor agent
- User runs \`/axiom:audit MyService.swift\` → Pick relevant auditor(s) for that file

## Batch Execution Guidance

**Priority Order:**
1. **CRITICAL audits** (data corruption/loss risk):
   - memory → Retain cycles, leaks
   - swiftui-nav → NavigationStack issues

2. **HIGH audits** (production crashes):
   - swiftui-nav → Path management

**Batch Recommendations:**
- For pre-release: Run CRITICAL + HIGH audits
- For UX review: Run swiftui-nav + memory
- For architecture review: Run memory + swiftui-nav

## Project Analysis (No Area Specified)

If no area argument:
1. Analyze project structure:
   - Find Timer/NotificationCenter → suggest memory audit
   - Find NavigationStack/sheet/TabView → suggest swiftui-nav audit
   - Find SwiftUI files → suggest memory, swiftui-nav

2. Present findings.
`;

describe("extractSection", () => {
  it("extracts content of a ## heading until the next ## heading", () => {
    const got = extractSection(inlineFixtureMd, "Direct Dispatch");
    assert.ok(got !== null);
    assert.match(got!, /User runs `\/axiom:audit memory`/);
    assert.doesNotMatch(got!, /Priority Order/);
  });

  it("handles headings with regex meta-chars (parentheses)", () => {
    const got = extractSection(inlineFixtureMd, "Project Analysis (No Area Specified)");
    assert.ok(got !== null);
    assert.match(got!, /suggest memory audit/);
  });

  it("returns null when the heading is not found", () => {
    assert.equal(extractSection(inlineFixtureMd, "Nonexistent Section"), null);
  });
});

describe("parseInlineAuditReferences", () => {
  it("extracts areas from `/axiom:audit AREA` code spans (Direct Dispatch)", () => {
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Direct Dispatch");
    assert.deepEqual(refs.sort(), ["memory", "swiftui-nav"]);
  });

  it("ignores filename-style backtick spans like `MyService.swift`", () => {
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Direct Dispatch");
    assert.ok(!refs.includes("MyService.swift"));
    assert.ok(!refs.some((r) => /\.swift$/.test(r)));
  });

  it("extracts areas from bullet `- AREA →` lines (Priority Order)", () => {
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Batch Execution Guidance");
    assert.ok(refs.includes("memory"));
    assert.ok(refs.includes("swiftui-nav"));
  });

  it("extracts areas from `Run X + Y + Z` lines (Batch Recommendations)", () => {
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Batch Execution Guidance");
    // "Run swiftui-nav + memory" — both should be captured.
    assert.ok(refs.includes("swiftui-nav"));
    assert.ok(refs.includes("memory"));
  });

  it("ignores `Run CRITICAL + HIGH` (uppercase placeholders, not areas)", () => {
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Batch Execution Guidance");
    assert.ok(!refs.some((r) => /critical|high/i.test(r)));
  });

  it("extracts areas from `→ suggest AREA` lines (Project Analysis)", () => {
    const refs = parseInlineAuditReferences(
      inlineFixtureMd,
      "Project Analysis (No Area Specified)",
    );
    assert.ok(refs.includes("memory"));
    assert.ok(refs.includes("swiftui-nav"));
  });

  it("returns [] when the section is missing", () => {
    assert.deepEqual(parseInlineAuditReferences("# heading\n", "Anything"), []);
  });

  it("does NOT capture agent names like `memory-auditor` from prose", () => {
    // The Direct Dispatch section says "Launch memory-auditor agent" — that
    // must not be flagged as an area reference.
    const refs = parseInlineAuditReferences(inlineFixtureMd, "Direct Dispatch");
    assert.ok(!refs.includes("memory-auditor"));
    assert.ok(!refs.includes("swiftui-nav-auditor"));
  });

  it("does NOT capture trailing words after `→ suggest X audit(s)` (Pattern 4 boundary)", () => {
    // Pattern 4's `(?:\s*,\s*...)*` iteration requires a literal comma to
    // continue, so trailing words like `audit` / `audits` (separated by
    // whitespace, not comma) terminate the capture before reaching them.
    // Locked in as a regression test — the reviewer flagged this as a
    // potential fragility; the regex actually handles it cleanly.
    const md = `## Project Analysis (No Area Specified)

   - Find Timer → suggest memory audit
   - Find SwiftUI → suggest swiftui-performance, swiftui-architecture audit
   - Find Realm → suggest memory, performance audits

## next`;
    const refs = parseInlineAuditReferences(md, "Project Analysis (No Area Specified)");
    assert.ok(!refs.some((r) => /^audits?$/.test(r)), `audit/audits leaked into refs: ${JSON.stringify(refs)}`);
    assert.ok(refs.includes("memory"));
    assert.ok(refs.includes("swiftui-performance"));
    assert.ok(refs.includes("swiftui-architecture"));
    assert.ok(refs.includes("performance"));
  });
});

describe("validateInlineReferences", () => {
  it("returns no errors when every reference is in the canonical set", () => {
    const errs = validateInlineReferences(
      ["memory", "swiftui-nav", "concurrency"],
      ["memory", "swiftui-nav", "memory"],
      "Priority Order",
    );
    assert.deepEqual(errs, []);
  });

  it("flags references not in the canonical set with the section label", () => {
    const errs = validateInlineReferences(
      ["memory", "concurrency"],
      ["memory", "core-data-v2"],
      "Priority Order",
    );
    assert.equal(errs.length, 1);
    assert.match(errs[0], /Priority Order/);
    assert.match(errs[0], /core-data-v2/);
  });

  it("dedupes — one error per unknown reference even if it appears 5×", () => {
    const errs = validateInlineReferences(
      ["memory"],
      ["ghost", "ghost", "ghost", "ghost"],
      "Direct Dispatch",
    );
    assert.equal(errs.length, 1);
  });

  it("simulates the rename-drift scenario (axiom-pop Gap 1)", () => {
    // Canonical was renamed core-data → core-data-v2 but Priority Order
    // still says core-data.
    const canonical = ["core-data-v2", "memory"];
    const refs = parseInlineAuditReferences(
      `## Batch Execution Guidance\n\n- core-data → Schema safety\n\n## next`,
      "Batch Execution Guidance",
    );
    const errs = validateInlineReferences(canonical, refs, "Batch Execution Guidance");
    assert.ok(errs.some((e) => /core-data/.test(e) && /Batch Execution Guidance/.test(e)));
  });
});

// ── Agent description parity tests (axiom-pop Gap 2) ──────────────────────

describe("parseAgentDescription", () => {
  it("parses the YAML block-scalar `description: |` format used by every Axiom agent", () => {
    const content = `---
name: memory-auditor
description: |
  Use this agent when the user mentions memory leaks. Scans for retain cycles, timer leaks, and observer leaks.

  <example>
  user: "Check my code"
  </example>
model: sonnet
---

# Body content
`;
    const desc = parseAgentDescription(content);
    assert.ok(desc !== null);
    assert.match(desc!, /Use this agent when the user mentions memory leaks/);
    assert.match(desc!, /retain cycles/);
    assert.match(desc!, /<example>/);
    // Block-scalar end marker should not include 'model:' or any other key
    assert.doesNotMatch(desc!, /model:/);
  });

  it("parses single-line `description: \"...\"` format", () => {
    const content = `---
name: foo
description: "Use this agent for foo audits."
---
`;
    assert.equal(parseAgentDescription(content), "Use this agent for foo audits.");
  });

  it("parses single-line unquoted `description: ...` format", () => {
    const content = `---
name: foo
description: bare description
---
`;
    assert.equal(parseAgentDescription(content), "bare description");
  });

  it("returns null when there is no frontmatter", () => {
    assert.equal(parseAgentDescription("# heading only\n"), null);
  });

  it("returns null when frontmatter has no description field", () => {
    const content = `---
name: foo
model: sonnet
---
`;
    assert.equal(parseAgentDescription(content), null);
  });

  it("strips 2-space indentation from block-scalar lines", () => {
    const content = `---
name: foo
description: |
  Line one.
  Line two.
---
`;
    const desc = parseAgentDescription(content);
    assert.equal(desc, "Line one.\nLine two.");
  });

  it("does not truncate on flush-left example content (column-0 user:/assistant:)", () => {
    // A future author who forgets to indent <example> bodies must not have the
    // description silently truncated — only a real frontmatter key terminates
    // the block, and user:/assistant: are not frontmatter keys (axiom-2jf).
    const content = `---
name: memory-auditor
description: |
  Use this agent when the user mentions memory leaks.

<example>
user: "Check my code"
assistant: [runs the audit]
</example>
---
`;
    // Whole block captured — the flush-left example lines are kept verbatim,
    // not truncated at `user:`/`assistant:`.
    assert.equal(
      parseAgentDescription(content),
      'Use this agent when the user mentions memory leaks.\n\n<example>\nuser: "Check my code"\nassistant: [runs the audit]\n</example>',
    );
  });

  it("terminates at a real frontmatter key, incl. mcp/hooks/exempt-from-routing", () => {
    // Guards the allowlist completeness — these keys (used by real agents) must
    // terminate the block, else their values would be swallowed into the
    // description. The issue's originally-suggested allowlist omitted them.
    const content = `---
name: foo
description: |
  The description.
exempt-from-routing: true
mcp: some-server
hooks: a-hook
---
`;
    assert.equal(parseAgentDescription(content), "The description.");
  });
});

describe("hasSubstantiveOverlap", () => {
  it("returns true when descriptions share a domain word", () => {
    assert.equal(
      hasSubstantiveOverlap(
        "Retain cycles, leaks, Timer/observer patterns",
        "Use this agent when the user mentions memory leaks. Scans for retain cycles and timer leaks.",
      ),
      true,
    );
  });

  it("returns false on egregious drift (no shared domain vocabulary)", () => {
    assert.equal(
      hasSubstantiveOverlap(
        "Retain cycles, leaks, Timer/observer patterns",
        "Use this agent for SwiftData migration safety and VersionedSchema validation.",
      ),
      false,
    );
  });

  it("ignores the agent-template boilerplate when computing overlap", () => {
    // Both descriptions contain "agent" / "scans" / "user" — but no real
    // domain overlap. Should NOT count as overlap.
    assert.equal(
      hasSubstantiveOverlap(
        "VoiceOver labels, Dynamic Type, color contrast",
        "Use this agent when the user mentions battery drain. Scans for timer abuse and polling.",
      ),
      false,
    );
  });

  it("returns false when one side is empty", () => {
    assert.equal(hasSubstantiveOverlap("", "anything"), false);
    assert.equal(hasSubstantiveOverlap("anything", ""), false);
  });

  it("matches plural/inflected forms via 5-char prefix overlap", () => {
    // Real-world: swift-performance body says "allocation patterns,
    // generic specialization" while the agent description says
    // "unspecialized generics" / "excessive allocations". The exact
    // word match misses these but the 5-char prefix fallback catches
    // "alloc" (allocation/allocations) and "gener" (generic/generics).
    assert.equal(
      hasSubstantiveOverlap(
        "ARC issues, allocation patterns, generic specialization",
        "Use this agent for performance review. Detects unspecialized generics and excessive allocations.",
      ),
      true,
    );
  });
});

describe("validateAgentDescriptionParity", () => {
  const memoryAgent = `---
name: memory-auditor
description: |
  Use this agent when the user mentions memory leak prevention. Scans for retain cycles, leaks, timer leaks, observer leaks.
---
body`;

  const concurrencyAgent = `---
name: concurrency-auditor
description: |
  Use this agent for Swift 6 strict concurrency. Detects unsafe Task captures, missing MainActor, Sendable violations, actor isolation problems.
---
body`;

  it("returns no errors when every body row's description overlaps with the agent", () => {
    const errs = validateAgentDescriptionParity({
      rows: [
        { area: "memory", agent: "memory-auditor", detects: "Retain cycles, leaks, Timer/observer patterns" },
        { area: "concurrency", agent: "concurrency-auditor", detects: "Swift 6 data races, unsafe Task captures, actor isolation" },
      ],
      agentFiles: {
        "memory-auditor": memoryAgent,
        "concurrency-auditor": concurrencyAgent,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("flags drift when body description shares no substantive words with agent", () => {
    // Body says one thing, agent has been repurposed to a different domain.
    const driftedAgent = `---
name: memory-auditor
description: |
  Use this agent for SwiftData migrations and VersionedSchema validation only.
---
body`;
    const errs = validateAgentDescriptionParity({
      rows: [
        { area: "memory", agent: "memory-auditor", detects: "Retain cycles, leaks, Timer/observer patterns" },
      ],
      agentFiles: { "memory-auditor": driftedAgent },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /memory.*memory-auditor/);
    assert.match(errs[0], /no substantive vocabulary|rename drift/);
  });

  it("flags missing or empty agent description", () => {
    const noDesc = `---
name: empty-agent
model: sonnet
---
body`;
    const errs = validateAgentDescriptionParity({
      rows: [
        { area: "empty", agent: "empty-agent", detects: "Some thing" },
      ],
      agentFiles: { "empty-agent": noDesc },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /empty-agent.*missing or empty/);
  });

  it("flags empty body-table 'Detects' column", () => {
    const errs = validateAgentDescriptionParity({
      rows: [
        { area: "memory", agent: "memory-auditor", detects: "" },
      ],
      agentFiles: { "memory-auditor": memoryAgent },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /memory.*empty body-table/);
  });

  it("skips rows whose agent file is not in the map (existence is caller's job)", () => {
    const errs = validateAgentDescriptionParity({
      rows: [
        { area: "ghost", agent: "ghost-agent", detects: "stuff" },
      ],
      agentFiles: {},
    });
    assert.deepEqual(errs, []);
  });
});

// ── Agent-advertised command reachability (the inverse check) ─────────────
//
// validateParity anchors on the frontmatter `argument:` list and diffs the
// other three sources against it, so it only sees drift BETWEEN sources. An
// area missing from all four at once looks perfectly consistent. Two agents
// shipped for months advertising `/axiom:audit <area>` for an area that was
// registered nowhere, so the command silently did not dispatch — and the
// generated inline sub-skill dropped the command line for the same reason.
// These tests pin the inverse direction: every command an agent advertises
// must resolve to a registered area.

describe("parseAdvertisedAuditAreas", () => {
  it("extracts the area from an agent's explicit-command line", () => {
    const agent = `---
name: grdb-performance-auditor
description: |
  Use this agent when the user mentions GRDB performance review.

  Explicit command: Users can also invoke this agent directly with \`/axiom:audit grdb-performance\`
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["grdb-performance"]);
  });

  it("extracts every area when an agent advertises several", () => {
    const agent = `---
name: security-privacy-scanner
description: |
  Explicit command: invoke directly with \`/axiom:audit security\` or \`/axiom:audit privacy\`
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["security", "privacy"]);
  });

  it("deduplicates repeated mentions of the same area", () => {
    const agent = `---
name: dup
description: |
  Run \`/axiom:audit memory\`. Really, run \`/axiom:audit memory\`.
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["memory"]);
  });

  it("returns nothing for an agent that advertises no audit command", () => {
    const agent = `---
name: build-fixer
description: |
  Explicit command: Users can also invoke this agent directly with \`/axiom:fix-build\`
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), []);
  });

  it("ignores /axiom:audit mentions in the body, reading frontmatter only", () => {
    // The body routinely discusses other auditors in prose; only the
    // frontmatter description is the agent's own dispatch contract.
    const agent = `---
name: memory-auditor
description: |
  Explicit command: \`/axiom:audit memory\`
---
See also \`/axiom:audit concurrency\` for data races.`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["memory"]);
  });
});

describe("validateAdvertisedAreas", () => {
  const registered = ["memory", "concurrency", "grdb-performance"];

  it("returns no errors when every advertised area is registered", () => {
    const errs = validateAdvertisedAreas({
      registered,
      agentFiles: {
        "memory-auditor": `---
name: memory-auditor
description: |
  Explicit command: \`/axiom:audit memory\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("flags an agent advertising an area registered nowhere", () => {
    // The exact bug: agent claims the command, no source declares the area.
    const errs = validateAdvertisedAreas({
      registered,
      agentFiles: {
        "test-failure-analyzer": `---
name: test-failure-analyzer
description: |
  Explicit command: \`/axiom:audit test-failures\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /test-failure-analyzer/);
    assert.match(errs[0], /test-failures/);
  });

  it("flags each unregistered area separately when an agent advertises several", () => {
    const errs = validateAdvertisedAreas({
      registered,
      agentFiles: {
        "security-privacy-scanner": `---
name: security-privacy-scanner
description: |
  Explicit command: \`/axiom:audit security\` or \`/axiom:audit privacy\`
---
body`,
      },
    });
    assert.equal(errs.length, 2);
    assert.ok(errs.some((e) => /security/.test(e)));
    assert.ok(errs.some((e) => /privacy/.test(e)));
  });

  it("treats the 'all' meta-target as registered — it dispatches to health-check", () => {
    const errs = validateAdvertisedAreas({
      registered,
      agentFiles: {
        "health-check": `---
name: health-check
description: |
  Explicit command: \`/axiom:health-check\` or \`/axiom:audit all\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("honours an exemption keyed by agent:area", () => {
    const errs = validateAdvertisedAreas({
      registered,
      exempt: ["iap-implementation:iap-implementation"],
      agentFiles: {
        "iap-implementation": `---
name: iap-implementation
description: |
  Explicit command: \`/axiom:audit iap-implementation\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("does not let an exemption for one area cover a different unregistered area", () => {
    // Agent-scoped exemptions silently bless unrelated future typos. The
    // exemption is granted for `privacy`; `gdpr` must still be reported.
    const errs = validateAdvertisedAreas({
      registered,
      exempt: ["security-privacy-scanner:privacy"],
      agentFiles: {
        "security-privacy-scanner": `---
name: security-privacy-scanner
description: |
  Run \`/axiom:audit privacy\` or \`/axiom:audit gdpr\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /advertises `\/axiom:audit gdpr`/);
    // Not `/privacy/` — the agent's own NAME contains "privacy", so that
    // would pass on the agent reference rather than on the exempted area.
    assert.doesNotMatch(errs[0], /audit privacy/);
  });

  it("clears an exemption whose agent mixes a registered and an unregistered area", () => {
    // The shipped shape: `memory` registered, `privacy` exempt. The
    // registered area short-circuits before the exempt branch, so this
    // exercises different control flow than a single-area fixture.
    const errs = validateAdvertisedAreas({
      registered,
      exempt: ["scanner:privacy"],
      agentFiles: {
        "scanner": `---
name: scanner
description: |
  Run \`/axiom:audit memory\` or \`/axiom:audit privacy\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("flags a stale exemption when the agent no longer advertises the area", () => {
    // The regression that matters: someone registers the area and forgets
    // to drop the exemption, silently re-opening the hole.
    const errs = validateAdvertisedAreas({
      registered,
      exempt: ["memory-auditor:memory"],
      agentFiles: {
        "memory-auditor": `---
name: memory-auditor
description: |
  Run \`/axiom:audit memory\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /stale exemption/);
    assert.match(errs[0], /memory-auditor:memory/);
  });

  it("distinguishes a stale exemption for an agent that no longer exists", () => {
    // "advertises no unregistered area — remove it" would point at a file
    // that is gone. Right remedy, wrong diagnosis.
    const errs = validateAdvertisedAreas({
      registered,
      exempt: ["ghost-agent:some-area"],
      agentFiles: {},
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /ghost-agent/);
    assert.match(errs[0], /no such agent file/);
  });

  it("reports nothing when the registry failed to parse", () => {
    // An unparseable `argument:` line is one real error; it must not
    // become one bogus error per advertising agent.
    const errs = validateAdvertisedAreas({
      registered: [],
      agentFiles: {
        "memory-auditor": `---
name: memory-auditor
description: |
  Run \`/axiom:audit memory\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });
});

describe("parseAdvertisedAuditAreas — parsing boundaries", () => {
  it("does not run past a line break onto the next word", () => {
    // `\s` matches newlines. With a bare `\s+`, prose that ends a line on
    // "/axiom:audit" swallows the first word of the following line and
    // reports it as an unregistered area.
    const agent = `---
name: x
description: |
  Not reachable via /axiom:audit
  because it writes code.
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), []);
  });

  it("stops at trailing punctuation outside the area name", () => {
    const agent = `---
name: x
description: |
  Run \`/axiom:audit memory\`, then \`/axiom:audit energy\`.
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["memory", "energy"]);
  });

  it("reads a description written with a chomped block scalar", () => {
    // `|-` / `|+` / `>` fall through a `|`-only test to the single-line
    // branch, yielding the literal "|-" and silently dropping every
    // advertised command. Nothing else catches that for an agent absent
    // from the audit table — which is exactly this check's population.
    const agent = `---
name: x
description: |-
  Explicit command: \`/axiom:audit memory\`
---
body`;
    assert.deepEqual(parseAdvertisedAuditAreas(agent), ["memory"]);
  });
});

// ── Advertised slash-command reachability (the general case) ──────────────
//
// validateAdvertisedAreas covers the ARGUMENT of `/axiom:audit <area>`.
// Agents advertise a whole family of other commands in the same
// "Explicit command:" frontmatter convention — /axiom:fix-build,
// /axiom:profile, /axiom:resolve-deps — and nothing validated that the
// COMMAND itself exists. Two ghosts shipped that way.

describe("parseAdvertisedCommands", () => {
  it("extracts the command name, not the argument", () => {
    const agent = `---
name: x
description: |
  Explicit command: \`/axiom:audit memory\`
---
body`;
    assert.deepEqual(parseAdvertisedCommands(agent), ["audit"]);
  });

  it("extracts every distinct command an agent advertises", () => {
    const agent = `---
name: modernization-helper
description: |
  Invoke with \`/axiom:audit modernization\` or \`/axiom:modernize\`
---
body`;
    assert.deepEqual(parseAdvertisedCommands(agent), ["audit", "modernize"]);
  });

  it("deduplicates a command advertised with several arguments", () => {
    const agent = `---
name: x
description: |
  \`/axiom:audit security\` or \`/axiom:audit privacy\`
---
body`;
    assert.deepEqual(parseAdvertisedCommands(agent), ["audit"]);
  });

  it("reads frontmatter only, ignoring command mentions in the body", () => {
    const agent = `---
name: x
description: |
  \`/axiom:fix-build\`
---
See also \`/axiom:profile\` for traces.`;
    assert.deepEqual(parseAdvertisedCommands(agent), ["fix-build"]);
  });

  it("does not run past a line break onto the next word", () => {
    const agent = `---
name: x
description: |
  There is no /axiom:
  modernize command.
---
body`;
    assert.deepEqual(parseAdvertisedCommands(agent), []);
  });
});

describe("validateAdvertisedCommands", () => {
  const registered = ["audit", "fix-build", "profile"];

  it("returns no errors when every advertised command is registered", () => {
    const errs = validateAdvertisedCommands({
      registered,
      agentFiles: {
        "build-fixer": `---
name: build-fixer
description: |
  Explicit command: \`/axiom:fix-build\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("flags a command that exists in no manifest entry", () => {
    // The exact ghost: agent promises it, no command file, no manifest row.
    const errs = validateAdvertisedCommands({
      registered,
      agentFiles: {
        "spm-conflict-resolver": `---
name: spm-conflict-resolver
description: |
  Explicit command: \`/axiom:resolve-deps\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /spm-conflict-resolver/);
    assert.match(errs[0], /resolve-deps/);
  });

  it("flags only the ghost when an agent advertises one real and one ghost command", () => {
    const errs = validateAdvertisedCommands({
      registered,
      agentFiles: {
        "modernization-helper": `---
name: modernization-helper
description: |
  \`/axiom:audit modernization\` or \`/axiom:modernize\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /\/axiom:modernize/);
  });

  it("honours an exemption keyed by agent:command", () => {
    const errs = validateAdvertisedCommands({
      registered,
      exempt: ["spm-conflict-resolver:resolve-deps"],
      agentFiles: {
        "spm-conflict-resolver": `---
name: spm-conflict-resolver
description: |
  \`/axiom:resolve-deps\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });

  it("flags a stale exemption", () => {
    const errs = validateAdvertisedCommands({
      registered,
      exempt: ["build-fixer:fix-build"],
      agentFiles: {
        "build-fixer": `---
name: build-fixer
description: |
  \`/axiom:fix-build\`
---
body`,
      },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /stale exemption/);
  });

  it("reports nothing when the registry failed to parse", () => {
    const errs = validateAdvertisedCommands({
      registered: [],
      agentFiles: {
        "build-fixer": `---
name: build-fixer
description: |
  \`/axiom:resolve-deps\`
---
body`,
      },
    });
    assert.deepEqual(errs, []);
  });
});
