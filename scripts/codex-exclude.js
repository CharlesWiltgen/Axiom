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
//   - The last 3 suite entries were removed 2026-08-15 (Axiom-ky1) — see below.
//
// WHY THE SUITE LIST IS NOW EMPTY. The original list (9e9c389c, 2026-03-29) was a
// blanket policy: "Router skills — Codex has native progressive disclosure, so
// these are unnecessary." That premise was abandoned, but three names survived the
// conversion to a curated list: axiom-apple-docs and axiom-shipping (both annotated
// "Codex fit not yet assessed" — a placeholder, never a judgment) and axiom-tools.
//
// axiom-tools was the worst case. Its entry began as `axiom-using-axiom`, excluded
// for "Claude Code-specific discipline injection" when the suite held ONLY that
// discipline text. It was then renamed and absorbed six sub-skills (2026-04-11 →
// 2026-07-04), five of them harness-neutral tool references, all of which inherited
// an exclusion written before they existed.
//
// Measured cost at removal: 41 dangling "see X for the full reference" pointers and
// ~94 name citations across ~40 emitted Codex skills, aimed at files the build never
// wrote. The stated blocker — harness-flavored router prose — does not distinguish
// these suites: axiom-build ships to Codex with 17 `/axiom:` references and 6 agent
// launches, mitigated by the AXIOM_AUDITOR_INLINE block that axiom-tools/SKILL.md
// already carries. Re-adding a suite here needs evidence about THAT suite, not a
// policy inherited from a different one.
export const CODEX_EXCLUDED_SUITES = [];

// Per-FILE exclusion, for the rare sub-skill that cannot function on Codex even
// though its suite ships. Keys are `<suite>/<file>.md`. Suite-level exclusion is a
// blunt instrument — it withholds a whole reference set to suppress one file — so
// prefer this. Any router table row linking an excluded sub-skill is dropped from
// the Codex copy automatically (see dropExcludedSubSkillRows), so a removal here
// never leaves a dangling row behind.
export const CODEX_EXCLUDED_SUBSKILLS = new Set([
  // Drives AskUserQuestion (a Claude Code tool with no Codex equivalent) and cites
  // 15 `/axiom:` slash commands that do not exist there. Zero inbound references
  // from any other skill, so withholding it dangles nothing.
  'axiom-tools/getting-started.md',
]);

// True when a suite's sub-skill file is withheld from the Codex build.
export function isExcludedSubSkill(suiteName, fileName, excludeSet = CODEX_EXCLUDED_SUBSKILLS) {
  return excludeSet.has(`${suiteName}/${fileName}`);
}

// Strip router table rows that link a withheld sub-skill. A router's routing table
// is its only structural reference to its own sub-skills, so dropping the row is
// what keeps a per-file exclusion from producing the exact defect this whole change
// removes: a pointer to a file that ships nowhere.
export function dropExcludedSubSkillRows(content, suiteName, excludeSet = CODEX_EXCLUDED_SUBSKILLS) {
  const withheld = [...excludeSet]
    .filter((key) => key.startsWith(`${suiteName}/`))
    .map((key) => key.slice(suiteName.length + 1));
  if (withheld.length === 0) return content;

  return content
    .split('\n')
    .filter((line) => {
      if (!line.trimStart().startsWith('|')) return true;
      return !withheld.some((file) => line.includes(`skills/${file}`));
    })
    .join('\n');
}

// Router suites that actually ship to Codex = source routers minus the excludes
// that match a real source suite. Stale exclude entries (no matching suite) are
// IGNORED, not subtracted — mirroring build-codex's name-filtered traversal, so a
// dead exclude name can't silently lower the expected count.
export function shippedRouterCount(sourceRouterNames, excludeList = CODEX_EXCLUDED_SUITES) {
  const exclude = new Set(excludeList);
  return sourceRouterNames.filter((name) => !exclude.has(name)).length;
}

// Agent name → Codex skill name. Shared with pre-deploy.ts for the same reason the
// exclude list is: the gate has to classify an emitted directory as router-vs-agent-
// skill, and a name-shaped heuristic gets that wrong in both directions — `axiom-health`
// and `axiom-testing` are routers that look verb-first, `axiom-swift-simplifier` is an
// agent-skill that doesn't. Derive the set, never guess it.
const AGENT_NAME_MAP = {
  'build-fixer': 'axiom-fix-build',
  'build-optimizer': 'axiom-optimize-build',
  'crash-analyzer': 'axiom-analyze-crash',
  'health-check': 'axiom-health-check',
  'iap-implementation': 'axiom-implement-iap',
  'modernization-helper': 'axiom-modernize',
  'performance-profiler': 'axiom-profile-performance',
  'screenshot-validator': 'axiom-validate-screenshots',
  'simulator-tester': 'axiom-test-simulator',
  'spm-conflict-resolver': 'axiom-resolve-spm',
  'test-debugger': 'axiom-debug-tests',
  'test-failure-analyzer': 'axiom-analyze-test-failures',
  'test-runner': 'axiom-run-tests',
};

// Default: *-auditor → axiom-audit-*, *-analyzer → axiom-analyze-*, *-scanner → axiom-scan-*
export function agentToSkillName(agentName) {
  if (AGENT_NAME_MAP[agentName]) return AGENT_NAME_MAP[agentName];
  if (agentName.endsWith('-auditor')) return `axiom-audit-${agentName.replace(/-auditor$/, '')}`;
  if (agentName.endsWith('-analyzer')) return `axiom-analyze-${agentName.replace(/-analyzer$/, '')}`;
  if (agentName.endsWith('-scanner')) return `axiom-scan-${agentName.replace(/-scanner$/, '')}`;
  return `axiom-${agentName}`;
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
