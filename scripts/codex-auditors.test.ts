import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { adaptHealthCheckForCodex } from "./codex-auditors.js";

const source = fs.readFileSync(".claude-plugin/plugins/axiom/agents/health-check.md", "utf8").replace(/^---[\s\S]*?---\n?/, "").trim();
const agents = fs.readdirSync(".claude-plugin/plugins/axiom/agents").filter(name => name.endsWith(".md")).map(name => name.slice(0, -3));

describe("adaptHealthCheckForCodex", () => {
  it("requires verified diff scope before starting a requested Codex diff audit", () => {
    const adapted = adaptHealthCheckForCodex(source, agents);
    assert.ok(adapted.includes("Codex does not provide the command launcher"));
    assert.ok(adapted.includes("obtain a verified `DIFF SCOPE` block before auditing"));
  });
  it("preserves canonical scope and reporting while adapting orchestration", () => {
    const adapted = adaptHealthCheckForCodex(source, agents);
    assert.equal(/Agent calls?|Agent tool|run_in_background|TaskOutput/.test(adapted), false);
    for (const section of ["## Files to Exclude", "## Phase 0:", "## Phase 1:", "## Phase 4:", "## Output Limits", "## Guidelines"]) {
      const start = source.indexOf(section);
      const end = source.indexOf("\n## ", start + section.length);
      assert.ok(adapted.includes(source.slice(start, end < 0 ? undefined : end)), `${section} changed`);
    }
    for (const required of ["spawn_agent", "wait_agent", "sequential", "concurrency limit", "requested model", "axiom-audit-memory", "axiom-scan-security-privacy", "axiom_get_agent", "canonical auditor name"]) {
      assert.ok(adapted.includes(required), `${required} missing`);
    }
    assert.ok(adapted.includes("Only audit the files listed below."));
    assert.ok(adapted.includes("note it in the report and continue with others"));
  });
  it("ships an executable procedure for every mapped auditor", () => {
    const generated = fs.readFileSync("axiom-codex/skills/axiom-health-check/SKILL.md", "utf8");
    assert.equal(/Agent calls?|Agent tool|run_in_background|TaskOutput/.test(generated), false);
    const links = [...generated.matchAll(/`\.\.\/(axiom-[a-z0-9-]+)\/SKILL\.md`/g)];
    assert.ok(links.length >= 6, "always-run auditor links missing");
    for (const [, name] of links) {
      assert.ok(fs.existsSync(`axiom-codex/skills/${name}/SKILL.md`), `${name} procedure missing`);
    }
  });
  it("maps exactly the auditors Phase 1 can select, never agents the canonical text merely mentions", () => {
    const adapted = adaptHealthCheckForCodex(source, agents);
    const mapped = [...adapted.matchAll(/^- `([a-z0-9-]+)` → `/gm)].map((match) => match[1]).sort();
    const phase1 = source.slice(source.indexOf("## Phase 1:"), source.indexOf("\n## Phase 2:"));
    const tokens = new Set(phase1.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g));
    const expected = agents.filter((name) => name !== "health-check" && tokens.has(name)).sort();
    assert.ok(expected.length > 0, "Phase 1 names no auditors");
    assert.deepEqual(
      { mapped, footnoteAgents: ["build-fixer", "test-failure-analyzer"].filter((name) => mapped.includes(name)) },
      { mapped: expected, footnoteAgents: [] },
    );
  });
  it("fails generation when Phase 1 names no auditor", () => {
    const phase1 = source.slice(source.indexOf("## Phase 1:"), source.indexOf("\n## Phase 2:"));
    assert.throws(
      () => adaptHealthCheckForCodex(source.replace(phase1, "## Phase 1: Detect Which Auditors to Run\n\nNone listed.\n"), agents),
      /Phase 1 names no auditor/,
    );
  });
  it("fails generation when canonical orchestration drifts", () => {
    assert.throws(() => adaptHealthCheckForCodex(source.replace("Use TaskOutput", "Collect output"), agents), /health-check.*drift/i);
  });
});
