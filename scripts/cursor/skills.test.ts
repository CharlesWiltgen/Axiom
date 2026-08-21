import assert from "node:assert/strict";
import { test } from "node:test";
import matter from "gray-matter";
import { validateCursorReferences } from "./references.ts";
import { transformSkill } from "./skills.ts";
import { loadCursorSource } from "./source.ts";
import type { SourceSkill } from "./types.ts";

function skill(overrides: Partial<SourceSkill> = {}): SourceSkill {
  return {
    name: "axiom-example",
    relativeDir: "skills/axiom-example",
    frontmatter: {
      name: "axiom-example",
      description: "An example router.",
      license: "MIT",
    },
    body: "Invoke `/axiom:status`. Launch `example-agent` agent. Use the Task tool and TaskOutput.",
    resources: [],
    ...overrides,
  };
}

test("rejects unknown skill frontmatter fields", () => {
  assert.throws(
    () => transformSkill(skill({ frontmatter: { name: "axiom-example", description: "x", unknown: true } })),
    /unknown skill frontmatter field: unknown/,
  );
});

test("renders frontmatter values as valid YAML scalars", () => {
  const [file] = transformSkill(skill({
    frontmatter: { name: "axiom-example", description: "Use when: needed", license: "MIT" },
  }));
  assert.match(file.content, /description: "Use when: needed"/);
});

test("emits only Cursor-supported skill frontmatter while accepting canonical license metadata", () => {
  const [file] = transformSkill(skill());
  assert.deepEqual(matter(file.content).data, {
    name: "axiom-example",
    description: "An example router.",
  });
});

test("excludes generated mirrors while preserving normal router resources", () => {
  const files = transformSkill(skill({
    resources: [
      {
        path: "skills/axiom-example/skills/manual.md",
        content: "# Manual\n",
        mode: 0o644,
      },
      {
        path: "skills/axiom-example/skills/generated.md",
        content: "<!-- GENERATED from agents/example.md by scripts/build-inlined-auditors.ts — do not edit. -->\n",
        mode: 0o644,
      },
    ],
  }));

  assert.deepEqual(files.map((file) => file.path), [
    "skills/axiom-example/SKILL.md",
    "skills/axiom-example/skills/manual.md",
  ]);
  assert.equal(files[1]?.content, "# Manual\n");
});

test("orders skill resources bytewise across punctuation and case", () => {
  const files = transformSkill(skill({
    resources: ["z.md", "a.md", "_private.md", "A.md"].map((name) => ({
      path: `skills/axiom-example/skills/${name}`,
      content: `# ${name}\n`,
      mode: 0o644 as const,
    })),
  }));

  assert.deepEqual(files.slice(1).map((file) => file.path), [
    "skills/axiom-example/skills/A.md",
    "skills/axiom-example/skills/_private.md",
    "skills/axiom-example/skills/a.md",
    "skills/axiom-example/skills/z.md",
  ]);
});

test("replaces generated-mirror routing blocks with a Cursor subagent instruction", () => {
  const [file] = transformSkill(skill({
    body: "<!-- AXIOM_AUDITOR_INLINE_BEGIN -->\nAvailable: `skills/generated.md`.\n<!-- AXIOM_AUDITOR_INLINE_END -->",
  }));
  assert.match(file.content, /Delegate to the appropriate Cursor subagent/);
  assert.doesNotMatch(file.content, /AXIOM_AUDITOR_INLINE|skills\/generated\.md/);
});

test("rewrites supported Claude invocation syntax", () => {
  const [file] = transformSkill(skill());

  assert.match(file.content, /`\/axiom-status`/);
  assert.match(file.content, /Delegate to the `example-agent` subagent/);
  assert.match(file.content, /Cursor subagent delegation/);
  assert.match(file.content, /the returned subagent result/);
});

test("rewrites command invocations that carry explicit arguments", () => {
  const [file] = transformSkill(skill({ body: "Run `/axiom:audit accessibility` before release." }));
  assert.match(file.content, /`\/axiom-audit` accessibility/);
  assert.doesNotMatch(file.content, /\/axiom:/);
});

test("rewrites command invocations used as standalone command examples", () => {
  const [file] = transformSkill(skill({ body: "```text\n/axiom:status\n```" }));
  assert.match(file.content, /\/axiom-status/);
  assert.doesNotMatch(file.content, /\/axiom:/);
});

test("keeps detailed binary examples as non-executable Cursor MCP reference syntax", () => {
  const [file] = transformSkill(skill({
    body: [
      "```bash",
      "xclog launch com.example.MyApp --device ABC-123 --timeout 30s --max-lines 200 --filter 'error|warning'",
      "xcsym crash --format=summary --dsym-paths '<archives>:<downloads>' --no-spotlight <crash-file>",
      "xcprof record --instrument 'SwiftUI' --instrument 'CPU Profiler' --attach '<app>' --time-limit 10s",
      "xcprof compare baseline.trace current.trace --fail-on-regression --threshold-pct 5 --dsym App.dSYM",
      "```",
    ].join("\n"),
  }));

  assert.match(file.content, /examples below are reference syntax, not executable commands for Cursor/);
  assert.match(file.content, /xclog launch com\.example\.MyApp --device ABC-123 --timeout 30s --max-lines 200/);
  assert.match(file.content, /xcsym crash --format=summary --dsym-paths '<archives>:<downloads>' --no-spotlight <crash-file>/);
  assert.match(file.content, /xcprof record --instrument 'SwiftUI' --instrument 'CPU Profiler' --attach '<app>' --time-limit 10s/);
  assert.match(file.content, /xcprof compare baseline\.trace current\.trace --fail-on-regression --threshold-pct 5 --dsym App\.dSYM/);
  assert.match(file.content, /If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing/);
});

test("translates every emitted skill resource away from Cursor-unavailable helper binaries", () => {
  const files = loadCursorSource(process.cwd()).skills.flatMap(transformSkill);
  const staleBundlingClaim = /(?:xclog|xcsym|xcprof|xcui)[^\n]{0,100}(?:is|are|already|automatically) (?:on PATH|bundled)(?:[^\n]{0,100}Claude Code)?/i;

  for (const file of files) {
    assert.doesNotMatch(file.content, staleBundlingClaim, file.path);
    if (/\b(?:xclog|xcsym|xcprof)\b/.test(file.content)) {
      assert.match(file.content, /## Cursor MCP Tool Boundary/, file.path);
      assert.match(file.content, /examples below are reference syntax, not executable commands for Cursor/, file.path);
      assert.match(file.content, /do not fall back to a same-named executable/, file.path);
    }
  }

  const toolResources = new Map(files.map((file) => [file.path, file.content]));
  const xclog = toolResources.get("skills/axiom-tools/skills/xclog-ref.md");
  const xcsym = toolResources.get("skills/axiom-tools/skills/xcsym-ref.md");
  const xcprof = toolResources.get("skills/axiom-tools/skills/xcprof-ref.md");
  const xcui = toolResources.get("skills/axiom-tools/skills/xcui-ref.md");
  assert.ok(xclog);
  assert.ok(xcsym);
  assert.ok(xcprof);
  assert.ok(xcui);
  assert.match(xclog, /axiom_xclog_launch/);
  assert.match(xclog, /xclog launch com\.example\.MyApp/);
  assert.match(xcsym, /axiom_xcsym_crash/);
  assert.match(xcsym, /xcsym crash --format=summary/);
  assert.match(xcprof, /axiom_xcprof_record/);
  assert.match(xcprof, /xcprof record --preset cpu/);
  assert.match(xcui, /`xcui` is an external tool and is not bundled with the Cursor plugin/);
  assert.match(xcui, /AXe fallback is limited to compatible input verbs/);
  assert.match(xcui, /AXe cannot replace `wait`, `assert`, `a11y`, `dialog`, `voiceover`, `resize`, or `doctor`/);
  assert.doesNotMatch(xcui, /On \*\*Claude Code\*\*/);
});

test("rewrites inline slash commands without conflating ordinary Swift words", () => {
  const [file] = transformSkill(skill({ body: "Integrate with /axiom:screenshot before release." }));
  assert.match(file.content, /\/axiom-screenshot/);
  assert.doesNotMatch(file.content, /\/axiom:/);
});

test("fails closed when an unmatched Claude token remains", () => {
  assert.throws(
    () => transformSkill(skill({ body: "Use $ARGUMENTS after invoking `/axiom:status`." })),
    /unsupported Claude token: \$ARGUMENTS/,
  );
});

test("loads canonical source in lexical order and excludes generated mirrors", () => {
  const source = loadCursorSource(process.cwd());
  assert.deepEqual(source.skills.map((entry) => entry.name), [...source.skills.map((entry) => entry.name)].sort());
  assert.equal(source.manifestSkillNames.length, 26);
  assert.equal(source.skills.length, 27);
  assert.equal(source.agents.length, 42);
  assert.equal(source.commands.length, 17);
  assert.equal(
    source.skills.flatMap((entry) => entry.resources).filter((resource) => resource.content.startsWith("<!-- GENERATED from agents/")).length,
    0,
  );
});

test("validates local resource pointers against the emitted virtual tree", () => {
  const router = {
    path: "skills/axiom-example/SKILL.md",
    content: "Read `skills/example.md`.",
    mode: 0o644 as const,
  };
  const resource = {
    path: "skills/axiom-example/skills/example.md",
    content: "# Example\n",
    mode: 0o644 as const,
  };
  validateCursorReferences(new Map([[router.path, router], [resource.path, resource]]));
  const nested = { ...resource, path: "skills/axiom-example/skills/nested.md", content: "Read `skills/example.md`." };
  validateCursorReferences(new Map([[nested.path, nested], [resource.path, resource]]));
  const crossSuite = { ...resource, path: "skills/axiom-other/skills/example.md" };
  const crossSuiteRouter = { ...router, path: "skills/axiom-router/SKILL.md" };
  validateCursorReferences(new Map([[crossSuiteRouter.path, crossSuiteRouter], [crossSuite.path, crossSuite]]));
  assert.throws(
    () => validateCursorReferences(new Map([[router.path, { ...router, content: "Read `skills/missing.md`." }]])),
    /unresolved local reference/,
  );
});

test("validates reference-style Markdown link destinations", () => {
  const router = {
    path: "skills/axiom-example/SKILL.md",
    content: "[guide]: skills/example.md\n\nRead [guide].\n",
    mode: 0o644 as const,
  };
  const resource = {
    path: "skills/axiom-example/skills/example.md",
    content: "# Example\n",
    mode: 0o644 as const,
  };
  validateCursorReferences(new Map([[router.path, router], [resource.path, resource]]));
  assert.throws(
    () => validateCursorReferences(new Map([[router.path, { ...router, content: "[guide]: skills/missing.md\n" }]])),
    /unresolved local reference/,
  );
});

test("resolves canonical router resource pointers against transformed files", () => {
  const source = loadCursorSource(process.cwd());
  const files = source.skills.flatMap(transformSkill);
  validateCursorReferences(new Map(files.map((file) => [file.path, file])));
});

test("emits Cursor-supported frontmatter for every canonical skill router", () => {
  const routers = loadCursorSource(process.cwd()).skills.flatMap(transformSkill)
    .filter((file) => file.path.endsWith("/SKILL.md"));
  for (const router of routers) {
    assert.deepEqual(Object.keys(matter(router.content).data).sort(), ["description", "name"], router.path);
  }
});
