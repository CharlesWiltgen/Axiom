import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `.claude/rules/skill-development.md` is appended to the tool result of any Read
 * under `.claude-plugin/plugins/axiom/skills/` by the harness. Only the GREEN arm of
 * a behavioral test reads a skill file, so anything in that file reaches the treatment
 * arm and never the control.
 *
 * Asymmetric delivery is what turns a leak into a confound — content sensitivity is
 * secondary. `router-validation.md` carries RED/GREEN language too, but it arrives via
 * the claudeMd block to BOTH arms, so it biases nothing and is deliberately not checked
 * here.
 *
 * Measured 2026-09-05 (`Axiom-kud`): with the scenario templates and the tester
 * watch-list in this file, GREEN agents disclosed having seen the exact scenario type
 * they were about to face. After relocating both to
 * `.claude/skills/preflight/skills/behavioral-testing.md`, a verification agent
 * confirmed neither reaches a subject, and rated inferable-test-awareness from the
 * Read result alone at 1/3 (protocol named by location only) rather than 3/3.
 *
 * This test fails if that payload comes back.
 */
const LEAKING_FILE = ".claude/rules/skill-development.md";
const CANONICAL_FILE = ".claude/skills/preflight/skills/behavioral-testing.md";

/** Payload that lets a subject recognise the manipulation being applied to it. */
const FORBIDDEN_IN_LEAKING_FILE: ReadonlyArray<readonly [label: string, pattern: RegExp]> = [
  ["pressure-scenario type names", /\b(sunk cost|scope creep|existential threat)\b/i],
  ["authority/time pressure scenario rows", /\|\s*(authority|time) pressure\s*\|/i],
  ["tester watch-list phrases", /nonisolated\(unsafe\)|Ship quick fix|Use sleep\(\) for now/i],
  ["letter-grade rubric", /\|\s*A\+?\s*\|.*\|/],
  ["scenario template scaffold", /\*\*Pressure\*\*:|\*\*Expected with skill\*\*:|Anti-pattern without skill/i],
];

test("the auto-surfaced rules file carries no behavioral-test methodology", () => {
  const text = fs.readFileSync(path.join(root, LEAKING_FILE), "utf8");
  for (const [label, pattern] of FORBIDDEN_IN_LEAKING_FILE) {
    assert.equal(
      pattern.test(text),
      false,
      `${LEAKING_FILE} contains ${label}. It is appended to every skill-file Read, so ` +
        `this reaches a behavioral test's GREEN arm and never its RED control. ` +
        `Move it to ${CANONICAL_FILE}.`,
    );
  }
});

test("the canonical protocol file still holds that methodology", () => {
  // The other half of the invariant: relocation, not deletion. If someone "fixes"
  // the test above by deleting the content outright, this fails.
  const text = fs.readFileSync(path.join(root, CANONICAL_FILE), "utf8");
  for (const [label, pattern] of [
    ["pressure-scenario type names", /sunk cost/i],
    ["tester watch-list phrases", /nonisolated\(unsafe\)/i],
    ["letter-grade rubric", /\|\s*A\+\s*\|/],
  ] as const) {
    assert.ok(pattern.test(text), `${CANONICAL_FILE} lost its ${label} — relocate, do not delete`);
  }
});

test("pointers in the rules file stay bare", () => {
  // Explaining the fix in the leaking file re-creates the leak: a subject that reads
  // why the protocol moved learns that arms exist and how they differ. Verified —
  // the first attempt at this fix did exactly that and was caught by re-measurement.
  const text = fs.readFileSync(path.join(root, LEAKING_FILE), "utf8");
  for (const forbidden of [/GREEN arm/i, /RED arm/i, /treatment arm/i, /control arm/i, /contaminat/i]) {
    assert.equal(
      forbidden.test(text),
      false,
      `${LEAKING_FILE} explains the test-arm structure. Keep pointers bare; ` +
        `put rationale in ${CANONICAL_FILE}.`,
    );
  }
});
