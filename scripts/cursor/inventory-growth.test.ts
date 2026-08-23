import assert from "node:assert/strict";
import test from "node:test";
import {
  CURSOR_FORCED_FOREGROUND,
  assertCursorCapabilityInventory,
  classifyAgentTools,
} from "./contract.ts";

/**
 * Adding a router, agent, or command to the canonical tree is routine Axiom work.
 * It must not require editing a reviewed-contract fixture. These tests fail against
 * the frozen-name-list contract and pass once inventories are derived.
 */

const CANONICAL = {
  routers: ["axiom-build", "axiom-data", "axiom-tools"],
  agents: ["build-fixer", "memory-auditor"],
  commands: ["fix-build", "status"],
};

test("a newly added router does not trip the capability contract", () => {
  assert.doesNotThrow(() =>
    assertCursorCapabilityInventory({
      ...CANONICAL,
      routers: [...CANONICAL.routers, "axiom-brand-new"],
    }),
  );
});

test("a newly added agent does not trip the capability contract", () => {
  assert.doesNotThrow(() =>
    assertCursorCapabilityInventory({
      ...CANONICAL,
      agents: [...CANONICAL.agents, "brand-new-auditor"],
    }),
  );
});

test("a newly added command does not trip the capability contract", () => {
  assert.doesNotThrow(() =>
    assertCursorCapabilityInventory({
      ...CANONICAL,
      commands: [...CANONICAL.commands, "brand-new-command"],
    }),
  );
});

test("the capability contract still fails closed on malformed inventories", () => {
  assert.throws(
    () => assertCursorCapabilityInventory({ ...CANONICAL, agents: [] }),
    /empty/,
    "an empty inventory must not pass",
  );
  assert.throws(
    () =>
      assertCursorCapabilityInventory({
        ...CANONICAL,
        agents: [...CANONICAL.agents, "build-fixer"],
      }),
    /duplicate/,
    "a duplicate name must not pass",
  );
  assert.throws(
    () =>
      assertCursorCapabilityInventory({
        ...CANONICAL,
        routers: [...CANONICAL.routers, "NotARouter"],
      }),
    /router/,
    "a router outside the axiom-* namespace must not pass",
  );
  assert.throws(
    () =>
      assertCursorCapabilityInventory({
        ...CANONICAL,
        commands: [...CANONICAL.commands, "../escape"],
      }),
    /command/,
    "a command name that is not a bare slug must not pass",
  );
});

test("policy surface stays hand-reviewed, not derived", () => {
  assert.deepEqual([...CURSOR_FORCED_FOREGROUND], ["screenshot-validator"]);
  assert.equal(classifyAgentTools(["Glob", "Grep", "Read"]), "readonly");
  assert.equal(classifyAgentTools(["Bash"]), "writable");
});
