/**
 * Tests for scripts/codex-exclude.js — the single source of truth for the Codex
 * variant's excluded suites and the fidelity-count math shared by build-codex.ts
 * (the builder) and pre-deploy.ts (the gate). Hermetic: synthetic name lists,
 * never touches real dirs. Run via `node --test scripts/codex-exclude.test.ts`
 * (wired into npm `test:unit`). Regression coverage for axiom-altb.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const AGENTS_DIR = path.join(import.meta.dirname, "..", ".claude-plugin", "plugins", "axiom", "agents");
import {
  CODEX_EXCLUDED_SUITES,
  shippedRouterCount,
  expectedCodexSkillCount,
  isEmittableAgent,
  isExcludedSubSkill,
  agentToSkillName,
  dropExcludedSubSkillRows,
} from "./codex-exclude.js";

describe("shippedRouterCount", () => {
  it("subtracts only the excludes that match a real source suite", () => {
    const routers = [
      "axiom-swiftui",
      "axiom-apple-docs",
      "axiom-shipping",
      "axiom-tools",
      "axiom-data",
    ];
    // Explicit list, not the default — the default is empty as of Axiom-ky1, and a
    // test that reads it would assert nothing about the subtraction logic.
    assert.equal(shippedRouterCount(routers, ["axiom-apple-docs", "axiom-shipping", "axiom-tools"]), 2);
  });

  it("ships every router under the real default list (no suite is withheld)", () => {
    const routers = ["axiom-swiftui", "axiom-apple-docs", "axiom-shipping", "axiom-tools"];
    assert.equal(shippedRouterCount(routers), routers.length);
  });

  it("ignores stale exclude entries (no matching suite), never subtracting them", () => {
    const routers = ["axiom-swiftui", "axiom-data"];
    assert.equal(shippedRouterCount(routers, ["axiom-nonexistent"]), 2);
  });

  it("ships every router when nothing is excluded", () => {
    const routers = ["axiom-swiftui", "axiom-data", "axiom-concurrency"];
    assert.equal(shippedRouterCount(routers, []), routers.length);
  });
});

describe("expectedCodexSkillCount", () => {
  it("equals shipped routers plus every agent-skill (the universe Codex emits)", () => {
    const routers = ["axiom-swiftui", "axiom-apple-docs", "axiom-data"];
    const agentCount = 41;
    assert.equal(expectedCodexSkillCount(routers, agentCount, ["axiom-apple-docs"]), 2 + agentCount);
  });

  it("drops the expected count by exactly one when a shipped router is removed (catches an under-build)", () => {
    const routers = ["axiom-swiftui", "axiom-data", "axiom-concurrency"];
    const full = expectedCodexSkillCount(routers, 41, []);
    const missingOne = expectedCodexSkillCount(routers.slice(1), 41, []);
    assert.equal(full - missingOne, 1);
  });

  it("drops the expected count by one when one more agent is emittable (catches a dropped agent)", () => {
    const routers = ["axiom-swiftui", "axiom-data"];
    assert.equal(expectedCodexSkillCount(routers, 41, []) - expectedCodexSkillCount(routers, 40, []), 1);
  });

  it("matches the real tree shape: every source router ships, plus one skill per agent", () => {
    const SOURCE_ROUTERS = 27;
    // Derived, not hardcoded: the previous 41 had drifted from a real 42 and the
    // test still passed because it was self-consistent — exactly how a count
    // regression sails through.
    const AGENTS = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md")).length;
    const routers = Array.from({ length: SOURCE_ROUTERS }, (_, i) => `axiom-suite-${i}`);
    // Plant any real excludes as actual suite names so they subtract. Empty today
    // (Axiom-ky1), so this loop is a no-op — but it keeps the assertion honest if a
    // suite is ever re-added with evidence.
    CODEX_EXCLUDED_SUITES.forEach((name, i) => { routers[i] = name; });
    const expected = SOURCE_ROUTERS - CODEX_EXCLUDED_SUITES.length + AGENTS;
    assert.equal(expectedCodexSkillCount(routers, AGENTS), expected);
    assert.equal(expected, SOURCE_ROUTERS + AGENTS);
  });
});

describe("isExcludedSubSkill", () => {
  it("withholds getting-started from axiom-tools — the one sub-skill Codex cannot run", () => {
    assert.equal(isExcludedSubSkill("axiom-tools", "getting-started.md"), true);
  });

  it("ships every other axiom-tools reference (the 5 that inbound pointers target)", () => {
    for (const ref of ["device-control-ref.md", "xcsym-ref.md", "xclog-ref.md", "xcui-ref.md", "xcprof-ref.md"]) {
      assert.equal(isExcludedSubSkill("axiom-tools", ref), false, `${ref} must ship`);
    }
  });

  it("scopes the key by suite — a same-named file in another suite still ships", () => {
    assert.equal(isExcludedSubSkill("axiom-build", "getting-started.md"), false);
  });
});

describe("dropExcludedSubSkillRows", () => {
  const router = [
    "| Question | Read |",
    "|----------|------|",
    '| "How do I use Axiom?" | [skills/getting-started.md](skills/getting-started.md) |',
    '| "What is Device Hub?" | [skills/device-control-ref.md](skills/device-control-ref.md) |',
  ].join("\n");

  it("drops the routing row for a withheld sub-skill", () => {
    const out = dropExcludedSubSkillRows(router, "axiom-tools");
    assert.equal(out.includes("getting-started.md"), false);
  });

  it("keeps every row whose target still ships", () => {
    const out = dropExcludedSubSkillRows(router, "axiom-tools");
    assert.equal(out.includes("device-control-ref.md"), true);
    assert.equal(out.includes("| Question | Read |"), true);
  });

  it("leaves a suite with no withheld sub-skills byte-identical", () => {
    assert.equal(dropExcludedSubSkillRows(router, "axiom-build"), router);
  });

  it("never drops non-table prose that happens to name the file", () => {
    const prose = "See skills/getting-started.md for onboarding.";
    assert.equal(dropExcludedSubSkillRows(prose, "axiom-tools"), prose);
  });
});

describe("agentToSkillName", () => {
  it("applies the suffix rules", () => {
    assert.equal(agentToSkillName("memory-auditor"), "axiom-audit-memory");
    assert.equal(agentToSkillName("swiftui-performance-analyzer"), "axiom-analyze-swiftui-performance");
    assert.equal(agentToSkillName("security-privacy-scanner"), "axiom-scan-security-privacy");
  });

  it("prefers the explicit map over the suffix rules", () => {
    // -analyzer would give axiom-analyze-test-failure; the map wins.
    assert.equal(agentToSkillName("test-failure-analyzer"), "axiom-analyze-test-failures");
    assert.equal(agentToSkillName("modernization-helper"), "axiom-modernize");
  });

  it("falls back to a bare axiom- prefix for names with no known suffix", () => {
    // The case a name-shaped gate heuristic misses: an agent-skill that does not
    // read verb-first, so it looks like a router.
    assert.equal(agentToSkillName("swift-simplifier"), "axiom-swift-simplifier");
  });

  it("never collides with the router names that read verb-first", () => {
    // axiom-health and axiom-testing are ROUTER suites. No agent may map onto them,
    // or the gate would demand a router be explicit-invoke-only.
    const agents = ["health-check", "test-runner", "test-debugger", "simulator-tester"];
    const produced = agents.map(agentToSkillName);
    for (const router of ["axiom-health", "axiom-testing"]) {
      assert.equal(produced.includes(router), false, `${router} is a router, not an agent-skill`);
    }
  });
});

describe("isEmittableAgent", () => {
  it("accepts frontmatter with both name and description (build-codex emits it)", () => {
    assert.equal(isEmittableAgent({ name: "build-fixer", description: "Use when a build fails" }), true);
  });

  it("rejects a description-less agent (build-codex skips it, so the gate must not count it)", () => {
    assert.equal(isEmittableAgent({ name: "build-fixer" }), false);
  });

  it("rejects a name-less agent", () => {
    assert.equal(isEmittableAgent({ description: "Use when a build fails" }), false);
  });

  it("rejects null and empty frontmatter", () => {
    assert.equal(isEmittableAgent(null), false);
    assert.equal(isEmittableAgent({}), false);
  });
});
