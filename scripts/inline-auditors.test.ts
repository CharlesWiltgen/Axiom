/**
 * Tests for scripts/inline-auditors.ts.
 *
 * Run via `node --test scripts/inline-auditors.test.ts` (Node 24 native, no
 * extra deps). Wired into npm `predeploy` via `test:unit` so every release
 * gates on these passing.
 *
 * Each test exercises one drift class with a synthetic fixture string — never
 * touches the real agent files, so the suite is hermetic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUDITOR_HOMES,
  SCAN_TOOLS,
  auditAreaByAgent,
  deriveSuiteReferences,
  findInlineDrift,
  findRouterNoteDrift,
  firstTopLevelH2Index,
  generatedMarkerFor,
  generatedSourceAgent,
  inlinedPathFor,
  inlinedTitle,
  isGeneratedSubSkill,
  isScanAgent,
  parseAgentTools,
  renderInlinedAuditor,
  renderRouterNote,
  routerNoteTargets,
  stripFrontmatter,
  upsertRouterNote,
  validateHomeCoverage,
  NOTE_BEGIN,
  NOTE_END,
} from "./inline-auditors.ts";

/** Minimal agent file shaped like the real ones. */
function agentFixture({
  name = "memory-auditor",
  tools = ["Glob", "Grep", "Read"],
  title = "Memory Auditor Agent",
  body = "You are an expert.\n\n## Phase 1\n\nScan.",
  toolBlockRaw,
}: {
  name?: string;
  tools?: string[];
  title?: string;
  body?: string;
  toolBlockRaw?: string;
} = {}): string {
  const toolBlock =
    toolBlockRaw ??
    (tools.length > 0 ? `tools:\n${tools.map((t) => `  - ${t}`).join("\n")}\n` : "");
  return `---\nname: ${name}\ndescription: |\n  Use this agent when scanning.\nmodel: sonnet\n${toolBlock}skills:\n  - axiom-performance\n---\n\n# ${title}\n\n${body}\n`;
}

function okTools(content: string): string[] {
  const parsed = parseAgentTools(content);
  assert.equal(parsed.kind, "ok", `expected ok, got ${parsed.kind}`);
  return parsed.kind === "ok" ? parsed.tools : [];
}

describe("parseAgentTools", () => {
  it("extracts a block sequence of tools", () => {
    assert.deepEqual(okTools(agentFixture()), ["Glob", "Grep", "Read"]);
  });

  it("reports absence distinctly from an unreadable declaration", () => {
    const noTools = "---\nname: x\nmodel: sonnet\n---\n\n# X\n";
    assert.equal(parseAgentTools(noTools).kind, "none");
  });

  it("stops at the next top-level key rather than swallowing it", () => {
    assert.ok(!okTools(agentFixture()).includes("axiom-performance"));
  });

  it("reads a Bash-declaring agent's full list", () => {
    assert.deepEqual(okTools(agentFixture({ tools: ["Bash", "Read", "Grep", "Glob"] })), [
      "Bash",
      "Read",
      "Grep",
      "Glob",
    ]);
  });

  // The regression that motivated the ToolsParse rewrite: an item with a
  // trailing comment used to fail the whole-line match and vanish, so a
  // Bash-dependent agent classified as pure-scan and would have been published
  // to 44 harnesses promising it needed only read+search.
  it("keeps a tool that carries a trailing YAML comment", () => {
    const withComment = agentFixture({
      toolBlockRaw: "tools:\n  - Glob\n  - Grep\n  - Read\n  - Bash  # needed for xcodebuild\n",
    });
    assert.deepEqual(okTools(withComment), ["Glob", "Grep", "Read", "Bash"]);
    assert.equal(isScanAgent(withComment), false);
  });

  it("parses an inline flow sequence instead of silently reporting none", () => {
    const flow = "---\nname: y\ntools: [Glob, Grep, Read]\n---\n\n# Y\n";
    assert.deepEqual(okTools(flow), ["Glob", "Grep", "Read"]);
    assert.equal(isScanAgent(flow), true);
  });

  it("strips quotes from quoted scalars", () => {
    const quoted = agentFixture({
      toolBlockRaw: 'tools:\n  - "Glob"\n  - \'Grep\'\n  - Read\n',
    });
    assert.deepEqual(okTools(quoted), ["Glob", "Grep", "Read"]);
  });

  it("does not treat a # inside quotes as a comment", () => {
    const hashy = agentFixture({ toolBlockRaw: 'tools:\n  - "Od#d"\n' });
    assert.deepEqual(okTools(hashy), ["Od#d"]);
  });

  it("reports an unreadable entry rather than dropping it", () => {
    const broken = agentFixture({ toolBlockRaw: "tools:\n  - Glob\n  Grep\n" });
    const parsed = parseAgentTools(broken);
    assert.equal(parsed.kind, "unparseable");
  });

  it("reports a scalar tools: value as unparseable", () => {
    const scalar = "---\nname: y\ntools: Glob, Grep, Read\n---\n\n# Y\n";
    assert.equal(parseAgentTools(scalar).kind, "unparseable");
  });

  it("tolerates a comment-only line inside the block", () => {
    const commented = agentFixture({
      toolBlockRaw: "tools:\n  # read-only\n  - Glob\n  - Grep\n  - Read\n",
    });
    assert.deepEqual(okTools(commented), ["Glob", "Grep", "Read"]);
  });
});

describe("isScanAgent", () => {
  it("accepts an agent declaring only Glob/Grep/Read", () => {
    assert.equal(isScanAgent(agentFixture()), true);
  });

  for (const extra of ["Bash", "Write", "Edit", "Agent"]) {
    it(`rejects an agent declaring ${extra}`, () => {
      assert.equal(
        isScanAgent(agentFixture({ tools: ["Glob", "Grep", "Read", extra] })),
        false,
      );
    });
  }

  it("fails closed on an agent with no declared tools", () => {
    assert.equal(isScanAgent("---\nname: x\nmodel: sonnet\n---\n\n# X\n"), false);
  });

  it("fails closed on an unreadable declaration", () => {
    assert.equal(
      isScanAgent(agentFixture({ toolBlockRaw: "tools:\n  Glob\n" })),
      false,
    );
  });
});

describe("stripFrontmatter", () => {
  it("removes the leading YAML block", () => {
    const body = stripFrontmatter(agentFixture());
    assert.ok(body.startsWith("\n# Memory Auditor Agent"));
    assert.ok(!body.includes("model: sonnet"));
  });

  it("leaves content without frontmatter untouched", () => {
    const plain = "# Already A Skill\n\nBody.\n";
    assert.equal(stripFrontmatter(plain), plain);
  });

  it("does not eat a later --- horizontal rule", () => {
    const withRule = agentFixture({ body: "Intro.\n\n---\n\nAfter rule." });
    assert.ok(stripFrontmatter(withRule).includes("After rule."));
  });

  it("handles CRLF so a core.autocrlf checkout cannot publish raw frontmatter", () => {
    const crlf = agentFixture().replace(/\n/g, "\r\n");
    const body = stripFrontmatter(crlf);
    assert.ok(!body.includes("model: sonnet"));
  });
});

describe("inlinedTitle", () => {
  it("drops the trailing 'Agent' from the H1", () => {
    assert.equal(inlinedTitle("# Memory Auditor Agent\n\nBody"), "Memory Auditor");
  });

  it("leaves a title that does not end in 'Agent' alone", () => {
    assert.equal(inlinedTitle("# Swift Simplifier\n\nBody"), "Swift Simplifier");
  });

  it("returns null when there is no H1", () => {
    assert.equal(inlinedTitle("No heading here."), null);
  });

  it("does not strip 'Agent' from the middle of a title", () => {
    assert.equal(inlinedTitle("# Agent Routing Rules\n"), "Agent Routing Rules");
  });
});

describe("auditAreaByAgent", () => {
  it("maps agent to the area declared in commands/audit.md", () => {
    const map = auditAreaByAgent([
      { area: "security", agent: "security-privacy-scanner" },
      { area: "swift-simplify", agent: "swift-simplifier" },
    ]);
    assert.equal(map["security-privacy-scanner"], "security");
    assert.equal(map["swift-simplifier"], "swift-simplify");
  });

  it("keeps the first area when an agent appears twice", () => {
    const map = auditAreaByAgent([
      { area: "memory", agent: "memory-auditor" },
      { area: "mem-alias", agent: "memory-auditor" },
    ]);
    assert.equal(map["memory-auditor"], "memory");
  });

  it("ignores rows with a blank agent or area", () => {
    const map = auditAreaByAgent([
      { area: "", agent: "x-auditor" },
      { area: "y", agent: "" },
    ]);
    assert.deepEqual(map, {});
  });
});

describe("renderInlinedAuditor", () => {
  const areas = { "memory-auditor": "memory" };
  const rendered = renderInlinedAuditor("memory-auditor", agentFixture(), areas);

  it("opens with the generated marker so the file is never hand-edited", () => {
    assert.ok(rendered.startsWith(generatedMarkerFor("memory-auditor")));
  });

  it("emits no YAML frontmatter — Axiom sub-skills carry none", () => {
    assert.ok(!rendered.includes("model: sonnet"));
  });

  it("retitles without the Claude-Code-only 'Agent' vocabulary", () => {
    assert.ok(rendered.includes("# Memory Auditor\n"));
    assert.ok(!rendered.includes("# Memory Auditor Agent"));
  });

  it("names both the Claude Code path and the inline path", () => {
    assert.ok(rendered.includes("`memory-auditor` agent"));
    assert.ok(rendered.includes("/axiom:audit memory"));
    assert.ok(rendered.includes("Every other harness"));
  });

  // Five generated files used to advertise an area derived by stripping the
  // agent's filename suffix; none of those five commands existed.
  it("omits the slash command entirely when the agent has no registered area", () => {
    const noArea = renderInlinedAuditor("iap-auditor", agentFixture({ name: "iap-auditor" }), {});
    assert.ok(!noArea.includes("/axiom:audit"));
    assert.ok(noArea.includes("launch the `iap-auditor` agent."));
  });

  it("preserves the procedure body verbatim", () => {
    assert.ok(rendered.includes("## Phase 1"));
    assert.ok(rendered.includes("You are an expert."));
  });
});

describe("generatedSourceAgent / isGeneratedSubSkill", () => {
  const rendered = renderInlinedAuditor("memory-auditor", agentFixture(), {});

  it("recovers the source agent from a generated file", () => {
    assert.equal(generatedSourceAgent(rendered), "memory-auditor");
  });

  it("returns null for a hand-written sub-skill", () => {
    assert.equal(generatedSourceAgent("# UX Flow Audit\n\nBody.\n"), null);
  });

  it("recognises a file this generator produced", () => {
    assert.equal(isGeneratedSubSkill(rendered), true);
  });

  it("does not claim a hand-written sub-skill", () => {
    assert.equal(isGeneratedSubSkill("# UX Flow Audit\n\nBody.\n"), false);
  });

  it("only matches at the start, so a mention in prose does not count", () => {
    assert.equal(
      isGeneratedSubSkill("# Notes\n\nSee <!-- GENERATED from agents/x.md -->\n"),
      false,
    );
  });
});

describe("inlinedPathFor", () => {
  it("routes each auditor to its canonical suite", () => {
    assert.equal(inlinedPathFor("memory-auditor"), "axiom-performance/skills/memory-auditor.md");
    assert.equal(inlinedPathFor("codable-auditor"), "axiom-data/skills/codable-auditor.md");
  });

  it("homes ux-flow-auditor in axiom-swiftui, clear of accessibility's ux-flow-audit.md", () => {
    assert.equal(inlinedPathFor("ux-flow-auditor"), "axiom-swiftui/skills/ux-flow-auditor.md");
  });

  it("returns null for an unmapped agent", () => {
    assert.equal(inlinedPathFor("build-fixer"), null);
  });
});

describe("deriveSuiteReferences", () => {
  it("finds an auditor mentioned in a router", () => {
    const refs = deriveSuiteReferences({
      "axiom-shipping": ["Launch `iap-auditor` agent before submitting."],
    });
    assert.deepEqual(refs["axiom-shipping"], ["iap-auditor"]);
  });

  // The gap that motivated deriving instead of hand-listing: axiom-watchos
  // mentions modernization-helper only inside a sub-skill, so a hand-maintained
  // list left its readers with no pointer.
  it("finds an auditor mentioned only in a sub-skill", () => {
    const refs = deriveSuiteReferences({
      "axiom-watchos": ["# Router\n\nNothing here.", "See `modernization-helper` for legacy APIs."],
    });
    assert.deepEqual(refs["axiom-watchos"], ["modernization-helper"]);
  });

  it("ignores generated files so a suite cannot reference itself", () => {
    const generated = renderInlinedAuditor("memory-auditor", agentFixture(), {});
    const refs = deriveSuiteReferences({ "axiom-performance": [generated] });
    assert.equal(refs["axiom-performance"], undefined);
  });

  it("omits suites that mention no auditor", () => {
    assert.deepEqual(deriveSuiteReferences({ "axiom-location": ["Maps and geofencing."] }), {});
  });

  it("word-bounds the match so a longer name cannot match a shorter one", () => {
    const refs = deriveSuiteReferences({ "axiom-x": ["see memory-auditor-v2 notes"] });
    assert.equal(refs["axiom-x"], undefined);
  });
});

describe("routerNoteTargets", () => {
  const targets = routerNoteTargets({
    "axiom-shipping": ["iap-auditor"],
    "axiom-accessibility": ["ux-flow-auditor"],
  });

  it("lists an auditor under the suite that hosts it", () => {
    assert.ok(targets["axiom-performance"].local.includes("memory-auditor"));
    assert.ok(targets["axiom-data"].local.includes("codable-auditor"));
  });

  it("gives a referencing suite a remote entry pointing at the canonical suite", () => {
    assert.ok(
      targets["axiom-shipping"].remote.some(
        (r) => r.agent === "iap-auditor" && r.suite === "axiom-integration",
      ),
    );
    assert.ok(!targets["axiom-shipping"].local.includes("iap-auditor"));
  });

  it("routes accessibility to swiftui for ux-flow-auditor rather than hosting it", () => {
    assert.ok(!targets["axiom-accessibility"].local.includes("ux-flow-auditor"));
    assert.ok(
      targets["axiom-accessibility"].remote.some(
        (r) => r.agent === "ux-flow-auditor" && r.suite === "axiom-swiftui",
      ),
    );
    assert.ok(targets["axiom-swiftui"].local.includes("ux-flow-auditor"));
  });

  it("does not add a remote entry for an auditor the suite already hosts", () => {
    const t = routerNoteTargets({ "axiom-performance": ["memory-auditor"] });
    assert.deepEqual(t["axiom-performance"].remote, []);
  });

  it("covers every auditor exactly once across canonical suites", () => {
    const total = Object.values(targets).reduce((n, t) => n + t.local.length, 0);
    assert.equal(total, Object.keys(AUDITOR_HOMES).length);
  });
});

describe("renderRouterNote / upsertRouterNote", () => {
  const target = {
    local: ["memory-auditor"],
    remote: [{ agent: "iap-auditor", suite: "axiom-integration" }],
  };
  const note = renderRouterNote(target);

  it("names both the local file and the cross-suite path", () => {
    assert.ok(note.includes("`skills/memory-auditor.md`"));
    assert.ok(note.includes("`axiom-integration/skills/iap-auditor.md`"));
  });

  it("is honest that Bash-dependent agents have no inline equivalent", () => {
    assert.match(note, /stay Claude Code-only/);
  });

  it("is wrapped in the auto-maintained markers", () => {
    assert.ok(note.startsWith(NOTE_BEGIN));
    assert.ok(note.endsWith(NOTE_END));
  });

  it("omits the remote line entirely when there are no cross-suite auditors", () => {
    const localOnly = renderRouterNote({ local: ["codable-auditor"], remote: [] });
    assert.ok(!localOnly.includes("Homed in another suite"));
  });

  it("inserts before the first H2 of a router", () => {
    const router = "---\nname: x\n---\n\n# Performance\n\n**Intro.**\n\n## When to Use\n\nBody.\n";
    const out = upsertRouterNote(router, note);
    assert.ok(out.indexOf(NOTE_BEGIN) < out.indexOf("## When to Use"));
    assert.ok(out.indexOf("**Intro.**") < out.indexOf(NOTE_BEGIN));
    assert.ok(out.includes("Body."));
  });

  it("replaces an existing block instead of stacking duplicates", () => {
    const router = "# R\n\nIntro.\n\n## Head\n\nBody.\n";
    const once = upsertRouterNote(router, note);
    const twice = upsertRouterNote(once, note);
    assert.equal(twice, once);
    assert.equal(twice.split(NOTE_BEGIN).length - 1, 1);
  });

  it("updates a stale block in place", () => {
    const router = "# R\n\nIntro.\n\n## Head\n\nBody.\n";
    const stale = upsertRouterNote(router, renderRouterNote({ local: ["old-auditor"], remote: [] }));
    const fresh = upsertRouterNote(stale, note);
    assert.ok(!fresh.includes("old-auditor"));
    assert.ok(fresh.includes("memory-auditor"));
  });

  it("appends when a router somehow has no H2", () => {
    assert.ok(upsertRouterNote("# Only A Title\n", note).includes(NOTE_BEGIN));
  });
});

describe("firstTopLevelH2Index", () => {
  it("finds a plain H2", () => {
    const c = "# T\n\n## Head\n";
    assert.equal(firstTopLevelH2Index(c), c.indexOf("## Head"));
  });

  // Routers carry fenced dot diagrams and code blocks whose lines can look
  // like headings; inserting inside one would corrupt the block.
  it("skips a heading-shaped line inside a fenced block", () => {
    const c = "# T\n\n```\n## not a heading\n```\n\n## Real Head\n";
    assert.equal(firstTopLevelH2Index(c), c.indexOf("## Real Head"));
  });

  it("handles tilde fences too", () => {
    const c = "# T\n\n~~~\n## fake\n~~~\n\n## Real\n";
    assert.equal(firstTopLevelH2Index(c), c.indexOf("## Real"));
  });

  it("returns -1 when there is no top-level H2", () => {
    assert.equal(firstTopLevelH2Index("# T\n\nBody only.\n"), -1);
  });

  it("does not match H3", () => {
    assert.equal(firstTopLevelH2Index("# T\n\n### Sub\n"), -1);
  });
});

describe("findInlineDrift", () => {
  const expected = { "memory-auditor": "generated content" };

  it("passes when disk matches regeneration", () => {
    assert.deepEqual(
      findInlineDrift({ expected, actual: { "memory-auditor": "generated content" } }),
      [],
    );
  });

  it("flags a missing generated file", () => {
    const errs = findInlineDrift({ expected, actual: {} });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /is missing/);
    assert.match(errs[0], /axiom-performance\/skills\/memory-auditor\.md/);
  });

  it("flags a hand-edited generated file as stale", () => {
    const errs = findInlineDrift({
      expected,
      actual: { "memory-auditor": "someone edited this" },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /stale relative to agents\/memory-auditor\.md/);
  });

  it("flags an orphan left behind after an agent stops being pure-scan", () => {
    const errs = findInlineDrift({
      expected: {},
      actual: { "ghost-auditor": "stale leftover" },
    });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /orphaned/);
  });
});

describe("findRouterNoteDrift", () => {
  it("passes when every router note matches", () => {
    assert.deepEqual(findRouterNoteDrift({ "axiom-data": "x" }, { "axiom-data": "x" }), []);
  });

  it("flags a router whose note was hand-edited", () => {
    const errs = findRouterNoteDrift({ "axiom-data": "x" }, { "axiom-data": "edited" });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /missing or stale/);
  });

  it("flags a router file that disappeared", () => {
    assert.match(findRouterNoteDrift({ "axiom-data": "x" }, {})[0], /not found/);
  });

  it("flags a note left behind in a suite that no longer references an auditor", () => {
    const errs = findRouterNoteDrift({}, { "axiom-location": `intro\n${NOTE_BEGIN}\nx\n${NOTE_END}\n` });
    assert.equal(errs.length, 1);
    assert.match(errs[0], /no longer references any inlined auditor/);
  });

  it("ignores a suite with no note and no target", () => {
    assert.deepEqual(findRouterNoteDrift({}, { "axiom-location": "plain router" }), []);
  });
});

describe("validateHomeCoverage", () => {
  function allMapped(): Record<string, string> {
    const contents: Record<string, string> = {};
    for (const name of Object.keys(AUDITOR_HOMES)) contents[name] = agentFixture({ name });
    return contents;
  }

  it("passes when every scan agent is mapped and every mapping resolves", () => {
    assert.deepEqual(validateHomeCoverage(allMapped()), []);
  });

  it("flags a new pure-scan agent that nobody gave a home", () => {
    const contents = allMapped();
    contents["brand-new-auditor"] = agentFixture({ name: "brand-new-auditor" });
    const errs = validateHomeCoverage(contents);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /brand-new-auditor.*no entry in AUDITOR_HOMES/s);
  });

  it("flags a mapping whose agent file was deleted", () => {
    const contents = allMapped();
    delete contents["memory-auditor"];
    assert.ok(validateHomeCoverage(contents).some((e) => /maps 'memory-auditor' but/.test(e)));
  });

  it("flags a mapped agent that gained Bash and is no longer inlinable", () => {
    const contents = allMapped();
    contents["memory-auditor"] = agentFixture({
      name: "memory-auditor",
      tools: ["Glob", "Grep", "Read", "Bash"],
    });
    assert.ok(
      validateHomeCoverage(contents).some((e) => /execution-bound and cannot be followed inline/.test(e)),
    );
  });

  // An unreadable declaration is neither generated nor listed by the coverage
  // loops, so without an explicit report it would fail silently — the same
  // invisible-gap failure this module exists to prevent.
  it("reports an agent whose tools block cannot be read", () => {
    const contents = allMapped();
    contents["mystery-auditor"] = agentFixture({
      name: "mystery-auditor",
      toolBlockRaw: "tools:\n  Glob\n",
    });
    assert.ok(validateHomeCoverage(contents).some((e) => /unreadable tools: declaration/.test(e)));
  });

  it("reports an agent that declares no tools at all", () => {
    const contents = allMapped();
    contents["toolless"] = "---\nname: toolless\nmodel: sonnet\n---\n\n# T\n";
    assert.ok(validateHomeCoverage(contents).some((e) => /declares no tools: block/.test(e)));
  });

  it("keeps SCAN_TOOLS to read+search only", () => {
    assert.deepEqual([...SCAN_TOOLS].sort(), ["Glob", "Grep", "Read"]);
  });
});
