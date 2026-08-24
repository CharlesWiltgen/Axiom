/**
 * Single source of truth for Axiom's skill-listing budget.
 *
 * Claude Code loads a listing of skill names and descriptions into context. It
 * builds that listing from each skill's SKILL.md frontmatter — it never reads
 * claude-code.json, which is Axiom's own metadata file (the string
 * "claude-code.json" does not appear in the Claude Code binary). Every gate
 * that predated this module measured claude-code.json against invented limits
 * (8,000/250 in .claude/rules/skill-descriptions.md, 15,000/300 in
 * pre-deploy.ts), so none of them could see what actually ships.
 *
 * Limits per https://code.claude.com/docs/en/skills:
 *   - "The budget scales at 1% of the model's context window."
 *   - "each entry's combined text is capped at 1,536 characters regardless of
 *      budget" (description + when_to_use).
 *   - On overflow Claude Code keeps every name but "drops descriptions starting
 *     with the skills you invoke least" — so an over-budget listing silently
 *     strips trigger text from exactly the routers a user has not used yet.
 */

import fs from "node:fs";
import path from "node:path";

export const LISTING_BUDGET_FRACTION = 0.01;

/**
 * Smallest context window Axiom targets. Haiku-class 200K models are explicitly
 * out of scope, so this is the 1M shared by Opus 5 / Sonnet 5 / Sonnet 4.6.
 */
export const SMALLEST_SUPPORTED_CONTEXT = 1_000_000;

/** Characters per token used by Claude Code when it converts the budget. */
const CHARS_PER_TOKEN = 3;

/**
 * The hard limit Claude Code enforces. The 1% fraction is 1% of the context in
 * TOKENS; the limit is applied and reported in CHARACTERS at ~3 chars/token.
 * Do NOT simplify to `context * 0.01` — that reads the fraction as characters
 * and under-estimates by 3x.
 *
 * Measured on Claude Code 2.1.241 (listing of 115 skills / 24,576 chars):
 *   Opus 5 (1M), fraction 0.001 -> "> 3000 budget"
 *   Opus 5 (1M), fraction 0.002 -> "> 6000 budget"
 *   Opus 5 (1M), fraction 0.008 -> "> 24000 budget"
 *   Opus 5 (1M), default        -> no warning (30,000 > 24,576)
 * Linear in the fraction, so the default 0.01 on a 1M model is 30,000 chars.
 * (Haiku 4.5 at 200K reports 8,000 — a floor, not the 6,000 the formula gives.
 * Out of scope, recorded so nobody re-derives it as a contradiction.)
 */
export const LISTING_BUDGET =
  SMALLEST_SUPPORTED_CONTEXT * LISTING_BUDGET_FRACTION * CHARS_PER_TOKEN;

/**
 * Axiom's self-imposed share — POLICY, not a Claude Code limit. The listing
 * budget is shared with every other installed plugin: a real session measured
 * 115 skills / 24,576 chars against the 30,000 budget, with Axiom only 22% of
 * it. Staying near a third of the budget keeps Axiom a good citizen rather than
 * the reason someone else's skills lose their descriptions.
 */
export const LISTING_POLICY_BUDGET = 10_000;

export const MAX_ENTRY_CHARS = 1_536;

/**
 * axiom-tools is the always-on onboarding/tools suite injected by the
 * session-start hook rather than routed to, and it is deliberately excluded
 * from the Codex variant. It ships a SKILL.md (so it counts against the
 * listing budget) but is intentionally absent from claude-code.json. Keeping
 * the exclusion explicit here stops the generator from "fixing" the omission.
 * See scripts/check-cross-refs.js (IMPLICIT_SUITES).
 */
export const MANIFEST_EXCLUDED_SKILLS = new Set(["axiom-tools"]);

export type ListingEntry = { name: string; description: string };

export type ListingAudit = {
  total: number;
  budget: number;
  overBudget: boolean;
  overPolicy: boolean;
  oversize: ListingEntry[];
};

function frontmatterDescription(skillMd: string, name: string): string {
  const fm = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) throw new Error(`${name}/SKILL.md has no frontmatter block`);
  const line = fm[1].match(/^description:[ \t]*(.*)$/m);
  if (!line) throw new Error(`${name}/SKILL.md frontmatter has no description`);
  const value = line[1].trim();
  // A block scalar ("description: |") would leave us measuring the sigil
  // instead of the text — the exact silent-undercount this module exists to
  // prevent. Fail loudly rather than report 1 character.
  if (value === "" || value === "|" || value === ">") {
    throw new Error(
      `${name}/SKILL.md uses a block-scalar description; this reader only ` +
        `handles single-line descriptions and would undercount the budget`,
    );
  }
  return value;
}

/** The entries Claude Code actually lists: one per skills/<name>/SKILL.md. */
export function readShippedListing(pluginDir: string): ListingEntry[] {
  const skillsDir = path.join(pluginDir, "skills");
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(skillsDir, name, "SKILL.md")))
    .sort()
    .map((name) => ({
      name,
      description: frontmatterDescription(
        fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8"),
        name,
      ),
    }));
}

export function auditListing(entries: ListingEntry[]): ListingAudit {
  const total = entries.reduce((sum, e) => sum + e.description.length, 0);
  return {
    total,
    budget: LISTING_BUDGET,
    overBudget: total > LISTING_BUDGET,
    overPolicy: total > LISTING_POLICY_BUDGET,
    oversize: entries.filter((e) => e.description.length > MAX_ENTRY_CHARS),
  };
}

/** `node scripts/skill-listing.ts` — the human-runnable form of the CI gate. */
export function reportListing(pluginDir: string): string {
  const entries = readShippedListing(pluginDir);
  const audit = auditListing(entries);
  const lines = [...entries]
    .sort((a, b) => b.description.length - a.description.length)
    .map((e) => `  ${String(e.description.length).padStart(4)}  ${e.name}`);
  const pct = Math.round((audit.total / audit.budget) * 100);
  const verdict = audit.overBudget
    ? `FAIL — ${pct}% of the ${audit.budget}-char Claude Code budget`
    : audit.overPolicy
      ? `OVER POLICY — ${audit.total} chars exceeds Axiom's ${LISTING_POLICY_BUDGET}-char share`
      : `OK — ${audit.total}/${audit.budget} chars (${pct}%), policy share ${LISTING_POLICY_BUDGET}`;
  return [
    `${entries.length} listed skills, ${audit.total} chars`,
    ...lines,
    ``,
    `per-entry cap ${MAX_ENTRY_CHARS}: ${audit.oversize.length ? audit.oversize.map((e) => e.name).join(", ") : "all within"}`,
    verdict,
  ].join("\n");
}

/**
 * The claude-code.json `skills` array, derived from disk. Generating it keeps
 * /axiom:ask (built from this array by set-version.js) honest: seven manifest
 * descriptions had drifted from their frontmatter, so users read trigger text
 * that differed from what Claude was given.
 */
export function manifestSkillsFromDisk(
  pluginDir: string,
  previousOrder: string[] = [],
): ListingEntry[] {
  const onDisk = readShippedListing(pluginDir).filter(
    (e) => !MANIFEST_EXCLUDED_SKILLS.has(e.name),
  );
  const byName = new Map(onDisk.map((e) => [e.name, e]));
  const kept = previousOrder
    .map((name) => byName.get(name))
    .filter((e): e is ListingEntry => e !== undefined);
  const seen = new Set(kept.map((e) => e.name));
  return [...kept, ...onDisk.filter((e) => !seen.has(e.name))];
}

if (import.meta.filename === process.argv[1]) {
  console.log(
    reportListing(
      path.join(path.dirname(import.meta.filename), "../.claude-plugin/plugins/axiom"),
    ),
  );
}
