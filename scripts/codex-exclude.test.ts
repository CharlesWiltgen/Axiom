/**
 * Tests for scripts/codex-exclude.js — the single source of truth for the Codex
 * variant's excluded suites and the fidelity-count math shared by build-codex.ts
 * (the builder) and pre-deploy.ts (the gate). Hermetic: synthetic name lists,
 * never touches real dirs. Run via `node --test scripts/codex-exclude.test.ts`
 * (wired into npm `test:unit`). Regression coverage for axiom-altb.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CODEX_EXCLUDED_SUITES,
  shippedRouterCount,
  expectedCodexSkillCount,
  isEmittableAgent,
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
    // 3 of the 5 are in the default exclude list → 2 ship.
    assert.equal(shippedRouterCount(routers), 2);
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
    const routers = ["axiom-swiftui", "axiom-apple-docs", "axiom-data"]; // 1 excluded → 2 ship
    const agentCount = 41;
    assert.equal(expectedCodexSkillCount(routers, agentCount), 2 + agentCount);
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

  it("matches the real tree shape: 27 routers − 3 excluded + 41 agents = 65", () => {
    const SOURCE_ROUTERS = 27;
    const AGENTS = 41;
    const routers = Array.from({ length: SOURCE_ROUTERS }, (_, i) => `axiom-suite-${i}`);
    // Plant the three real excludes as actual suite names so they subtract.
    [routers[0], routers[1], routers[2]] = CODEX_EXCLUDED_SUITES;
    const expected = SOURCE_ROUTERS - CODEX_EXCLUDED_SUITES.length + AGENTS;
    assert.equal(expectedCodexSkillCount(routers, AGENTS), expected);
    assert.equal(expected, 65);
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
