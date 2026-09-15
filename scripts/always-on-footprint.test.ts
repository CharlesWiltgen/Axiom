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
// handles single-line values would score them at ~1 char each and report the
// listing as negligible. The floor is well under the real value (Axiom-2fa cut
// it to ~6k) and far over what a single-line reader can produce.
test("reads block-scalar agent descriptions, not just the sigil", () => {
  const cc = measureFootprints(root).find((f) => f.harness === "claude-code");
  const agents = cc!.parts.find((p) => p.label === "agent listing");
  assert.ok(agents, "claude-code should measure an agent listing");
  assert.ok(
    agents.chars > 4_000,
    `agent listing measured ${agents.chars} — block scalars are being missed`,
  );
});

// Claude Code and Cursor carry the same 42 agents, and since Axiom-2fa both ship
// the first sentence only. Near-parity is the invariant that keeps it that way:
// it was 6.4x before the frontmatter examples moved into the agent bodies, so
// restoring examples to the frontmatter (or any other listing growth) breaks
// this ratio rather than silently costing every session ~33k chars.
test("claude-code and cursor carry the same agents for about the same cost", () => {
  const by = Object.fromEntries(
    measureFootprints(root).map((f) => [f.harness, f]),
  );
  const ccAgents = by["claude-code"].parts.find((p) => p.label === "agent listing")!;
  const cursorAgents = by["cursor"].parts.find((p) => p.label === "agent listing")!;
  const drift = Math.abs(ccAgents.chars - cursorAgents.chars) / ccAgents.chars;
  assert.ok(
    drift < 0.1,
    `claude-code agents (${ccAgents.chars}) and cursor agents (${cursorAgents.chars}) ` +
      `differ by ${(drift * 100).toFixed(0)}% — the same agents should cost about the same`,
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
