// Single source of truth for the Codex variant's excluded suites AND the
// fidelity-count math. Imported by BOTH scripts/build-codex.ts (the builder) and
// scripts/pre-deploy.ts (the fidelity gate) so the two cannot drift — that drift
// is what made the pre-deploy count check dead for so long (axiom-altb). Mirrors
// the scripts/version-regex.js precedent: a .js module imported with an explicit
// `.js` extension, because root scripts run under bare-node type-stripping.
//
// CURATED exclusion list, NOT "all routers" — most router suites DO ship to Codex.
// Annotate each entry with WHY it's withheld. History worth keeping:
//   - axiom-xcode-mcp was removed 2026-06-13 (axiom-pkek): Codex is a first-class
//     consumer (it documents `codex mcp add xcode -- xcrun mcpbridge`), so it ships.
//   - 6 stale pre-v3.0 axiom-ios-* names were pruned the same day (axiom-u5c0):
//     they matched no current suite and only inflated the excluded count.

export const CODEX_EXCLUDED_SUITES = [
  'axiom-apple-docs', // Xcode-bundled for-LLM doc routing — Codex fit not yet assessed
  'axiom-shipping',   // App Store Connect submission workflow — Codex fit not yet assessed
  'axiom-tools',      // Claude Code-specific discipline injection + onboarding
];

// Router suites that actually ship to Codex = source routers minus the excludes
// that match a real source suite. Stale exclude entries (no matching suite) are
// IGNORED, not subtracted — mirroring build-codex's name-filtered traversal, so a
// dead exclude name can't silently lower the expected count.
export function shippedRouterCount(sourceRouterNames, excludeList = CODEX_EXCLUDED_SUITES) {
  const exclude = new Set(excludeList);
  return sourceRouterNames.filter((name) => !exclude.has(name)).length;
}

// True when an agent's parsed frontmatter has what build-codex requires to emit a
// Codex skill: BOTH `name` and `description`. build-codex skips agents that fail
// this, so the pre-deploy gate must count agents the same way — otherwise a
// description-less agent is counted-but-not-emitted and the fidelity check fails a
// correct build (a false positive). Shared so the emit condition can't drift
// between the builder and the gate, the same way the exclude list is shared.
export function isEmittableAgent(frontmatter) {
  return Boolean(frontmatter && frontmatter.name && frontmatter.description);
}

// Total skill dirs the Codex build emits under axiom-codex/skills/ = shipped
// router suites + one generated skill per source agent. The pre-deploy gate must
// span this SAME universe; comparing all codex dirs (routers + agents) against a
// router-only expected count is the bug that made the check unable to ever match.
export function expectedCodexSkillCount(sourceRouterNames, sourceAgentCount, excludeList = CODEX_EXCLUDED_SUITES) {
  return shippedRouterCount(sourceRouterNames, excludeList) + sourceAgentCount;
}
