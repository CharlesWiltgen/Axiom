import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ListingEntry,
  LISTING_BUDGET,
  LISTING_BUDGET_FRACTION,
  LISTING_POLICY_BUDGET,
  MANIFEST_EXCLUDED_SKILLS,
  MAX_ENTRY_CHARS,
  SMALLEST_SUPPORTED_CONTEXT,
  auditListing,
  manifestSkillsFromDisk,
  readShippedListing,
} from "./skill-listing.ts";

const pluginDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.claude-plugin/plugins/axiom",
);

// The constants are the whole point of this module: the previous gates encoded
// 8,000/250 and 15,000/300, none of which are limits Claude Code applies.
// https://code.claude.com/docs/en/skills — the listing budget scales at 1% of
// the model's context window, and each entry's combined description +
// when_to_use text is capped at 1,536 characters regardless of budget.
test("encodes the limits Claude Code actually applies", () => {
  assert.equal(LISTING_BUDGET_FRACTION, 0.01);
  assert.equal(MAX_ENTRY_CHARS, 1536);
});

// Regression guard for a real mistake: the 1% fraction is 1% of the context in
// TOKENS, while the limit is applied in CHARACTERS (~3 chars/token, floor 8,000).
// Measured on CC 2.1.241: Haiku 4.5 (200K) reports "> 8000 budget". Deriving the
// budget as context x 0.01 gives 2,000 and fails builds Claude Code accepts.
test("budget converts tokens to chars; it is not context x 1%", () => {
  assert.equal(SMALLEST_SUPPORTED_CONTEXT, 1_000_000);
  assert.equal(LISTING_BUDGET, 30_000);
  assert.notEqual(
    LISTING_BUDGET,
    SMALLEST_SUPPORTED_CONTEXT * LISTING_BUDGET_FRACTION,
    "the 1% fraction is 1% of TOKENS; the limit is applied in CHARACTERS",
  );
});

// The defect this module exists to fix: every prior gate measured
// claude-code.json, which Claude Code never reads. axiom-tools is absent from
// that manifest and present on disk, so its presence here proves the source.
test("reads the listing Claude Code ships, not the manifest", () => {
  const entries = readShippedListing(pluginDir);
  assert.ok(
    entries.some((e) => e.name === "axiom-tools"),
    "axiom-tools ships a SKILL.md but is absent from claude-code.json",
  );
  for (const entry of entries) {
    assert.ok(entry.description.length > 0, `${entry.name} has no description`);
  }
});

test("every shipped entry carries the frontmatter description verbatim", () => {
  const entries = readShippedListing(pluginDir);
  const shipping = entries.find((e) => e.name === "axiom-shipping");
  assert.ok(shipping, "axiom-shipping should be on disk");
  assert.match(shipping.description, /^Use when preparing ANY app for submission/);
});

test("auditListing totals the shipped text and reports the real budget", () => {
  const audit = auditListing([
    { name: "a", description: "x".repeat(20_000) },
    { name: "b", description: "y".repeat(11_000) },
  ]);
  assert.equal(audit.total, 31_000);
  assert.equal(audit.budget, LISTING_BUDGET);
  assert.equal(audit.overBudget, true);
});

test("auditListing flags entries past the per-entry cap", () => {
  const audit = auditListing([
    { name: "fine", description: "x".repeat(MAX_ENTRY_CHARS) },
    { name: "toolong", description: "y".repeat(MAX_ENTRY_CHARS + 1) },
  ]);
  assert.deepEqual(
    audit.oversize.map((e) => e.name),
    ["toolong"],
  );
});

test("auditListing reports a listing that fits as within budget", () => {
  const audit = auditListing([{ name: "a", description: "x".repeat(500) }]);
  assert.equal(audit.overBudget, false);
  assert.equal(audit.overPolicy, false);
});

// The policy share is what actually protects users: the listing budget is
// shared with every other installed plugin, so Axiom fitting alone is not the
// same as the user's listing fitting.
test("auditListing flags Axiom's self-imposed share before the hard limit", () => {
  const audit = auditListing([
    { name: "a", description: "x".repeat(LISTING_POLICY_BUDGET + 1) },
  ]);
  assert.equal(audit.overPolicy, true);
  assert.equal(audit.overBudget, false);
});

test("the shipped listing fits both the hard budget and Axiom's policy share", () => {
  const audit = auditListing(readShippedListing(pluginDir));
  assert.equal(audit.overBudget, false, `${audit.total} > ${LISTING_BUDGET}`);
  assert.equal(
    audit.overPolicy,
    false,
    `${audit.total} exceeds Axiom's ${LISTING_POLICY_BUDGET}-char share of a budget ` +
      `every installed plugin competes for`,
  );
});

// Regression guard for the seven descriptions that had drifted between
// claude-code.json and the SKILL.md frontmatter. /axiom:ask is generated from
// the manifest array, so drift shipped stale trigger text to users.
test("the committed manifest matches what disk generates", () => {
  const generated = manifestSkillsFromDisk(pluginDir);
  const committed = JSON.parse(
    fs.readFileSync(path.join(pluginDir, "claude-code.json"), "utf8"),
  ).skills as ListingEntry[];
  const byName = new Map(committed.map((e) => [e.name, e.description]));
  for (const entry of generated) {
    assert.equal(
      entry.description,
      byName.get(entry.name),
      `${entry.name}: claude-code.json has drifted from SKILL.md frontmatter — ` +
        `regenerate with scripts/set-version.js`,
    );
  }
  assert.deepEqual(
    committed.map((e) => e.name).sort(),
    generated.map((e) => e.name).sort(),
  );
});

// The manifest order is curated (axiom-build first, not alphabetical) and
// drives the section order of the generated /axiom:ask. Regenerating must not
// reshuffle it, or every version bump carries a spurious reordering diff.
test("manifest generation preserves the curated order and appends newcomers", () => {
  const previous = ["axiom-swiftui", "axiom-build"];
  const generated = manifestSkillsFromDisk(pluginDir, previous);
  assert.deepEqual(generated.slice(0, 2).map((e) => e.name), previous);
  const rest = generated.slice(2).map((e) => e.name);
  assert.deepEqual(rest, [...rest].sort(), "newcomers append in stable order");
  assert.equal(new Set(generated.map((e) => e.name)).size, generated.length);
});

// A skill deleted from disk must leave the manifest, not linger because it is
// named in the previous order.
test("manifest generation drops names that no longer exist on disk", () => {
  const generated = manifestSkillsFromDisk(pluginDir, ["axiom-deleted-suite"]);
  assert.equal(generated.some((e) => e.name === "axiom-deleted-suite"), false);
});

test("manifest generation preserves the deliberate axiom-tools exclusion", () => {
  const generated = manifestSkillsFromDisk(pluginDir);
  assert.ok(MANIFEST_EXCLUDED_SKILLS.has("axiom-tools"));
  assert.equal(
    generated.some((e) => e.name === "axiom-tools"),
    false,
    "axiom-tools is the always-on onboarding suite, not a routed skill",
  );
  assert.ok(
    generated.length > 0 && generated.every((e) => e.name.startsWith("axiom-")),
  );
});
