import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FOOTPRINT_CEILINGS,
  measureFootprints,
  reportFootprints,
} from "./always-on-footprint.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// "Always-on" = what Axiom puts in the model's context before the user has said
// anything. The skill listing is only ~10% of it on Claude Code; agent
// descriptions dominate. Measuring only the listing hid that for a long time.
test("measures every harness Axiom ships to", () => {
  const names = measureFootprints(root).map((f) => f.harness).sort();
  assert.deepEqual(names, ["claude-code", "codex", "cursor", "mcp"]);
});

test("every harness reports parts that sum to its total", () => {
  for (const f of measureFootprints(root)) {
    assert.equal(
      f.total,
      f.parts.reduce((n, p) => n + p.chars, 0),
      `${f.harness} parts do not sum to total`,
    );
    assert.ok(f.total > 0, `${f.harness} measured zero`);
  }
});

// Agent descriptions are `description: |` block scalars. A reader that only
// handles single-line values would score them at 1 char and report the
// dominant cost as negligible.
test("reads block-scalar agent descriptions, not just the sigil", () => {
  const cc = measureFootprints(root).find((f) => f.harness === "claude-code");
  const agents = cc!.parts.find((p) => p.label === "agent listing");
  assert.ok(agents, "claude-code should measure an agent listing");
  assert.ok(
    agents.chars > 20_000,
    `agent listing measured ${agents.chars} — block scalars are being missed`,
  );
});

// The Cursor build truncates agent descriptions to their first sentence. That
// is the same content at a fraction of the cost, so the gap is a standing
// signal about what Claude Code could reclaim.
test("cursor carries the same agents far more cheaply than claude-code", () => {
  const by = Object.fromEntries(
    measureFootprints(root).map((f) => [f.harness, f]),
  );
  const ccAgents = by["claude-code"].parts.find((p) => p.label === "agent listing")!;
  const cursorAgents = by["cursor"].parts.find((p) => p.label === "agent listing")!;
  assert.ok(
    cursorAgents.chars * 2 < ccAgents.chars,
    `expected Cursor agents (${cursorAgents.chars}) to be far under Claude Code (${ccAgents.chars})`,
  );
});

// The ratchet. These only ever move DOWN. Raising one to make a build pass
// silently re-opens the growth this file exists to catch.
test("no harness exceeds its tracked ceiling", () => {
  for (const f of measureFootprints(root)) {
    const ceiling = FOOTPRINT_CEILINGS[f.harness];
    assert.ok(ceiling, `${f.harness} has no ceiling`);
    assert.ok(
      f.total <= ceiling,
      `${f.harness} always-on footprint ${f.total} exceeds ceiling ${ceiling} — ` +
        `reduce the footprint; do not raise the ceiling`,
    );
  }
});

test("report names each harness and its token estimate", () => {
  const out = reportFootprints(root);
  for (const h of ["claude-code", "cursor", "codex", "mcp"]) {
    assert.match(out, new RegExp(h));
  }
  assert.match(out, /tokens/);
});
