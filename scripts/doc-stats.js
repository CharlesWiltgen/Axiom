// Shared config + pure helpers for auto-maintaining the skill/agent/command
// counts embedded in human-facing VitePress docs.
//
// Why this exists: counts in prose drifted silently for months because
// set-version.js rewrote stats.json/metadata.txt/README but never touched the
// docs/ pages (install.md said 184 while the real total was 254; xcode-setup.md
// said 133). README was fixed under axiom-wz9k by wrapping its counts in a
// marked block the script rewrites; this module generalizes that fix to every
// doc page, with a parity check in pre-deploy.ts so drift fails preflight.
//
// Mechanism: each maintained number is wrapped in an inline HTML-comment marker
//   <!--ax:KEY-->NN<!--/ax-->
// which renders invisibly in VitePress. set-version.js rewrites the inner
// number from the live filesystem walk; pre-deploy.ts asserts it matches
// stats.json. Rewording the surrounding prose is safe — only the marker moves.
//
// Consumed by both set-version.js (ESM .js) and pre-deploy.ts (TS, via
// `from './doc-stats.js'`), mirroring scripts/version-regex.js. I/O free:
// callers read/write files; these functions take and return strings.

/**
 * Resolve a stats.json object to the integer each marker key should hold.
 * `skills` is the sum of the three skill categories — the headline total used
 * across the docs and README. Declared first so DOC_STAT_KEYS can derive its
 * valid-key list from it (one source of truth — no hand-maintained duplicate).
 */
export function docStatValues(stats) {
  const discipline = stats.disciplineSkills ?? 0;
  const reference = stats.referenceSkills ?? 0;
  const diagnostic = stats.diagnosticSkills ?? 0;
  return {
    skills: discipline + reference + diagnostic,
    discipline,
    reference,
    diagnostic,
    agents: stats.agents ?? 0,
    commands: stats.commands ?? 0,
  };
}

/** Valid marker keys — derived from docStatValues so the two cannot drift. */
export const DOC_STAT_KEYS = Object.keys(docStatValues({}));

/**
 * Doc pages whose counts are auto-maintained + parity-checked, each with the
 * EXACT marker multiset it must carry ({ key: occurrences }). Both the writer
 * and the checker assert a file's actual markers match its spec, so deleting a
 * single marker during a reword fails the release — not just deleting them all.
 * Update a page's entry here when you add/remove a maintained count from it.
 */
export const DOC_STAT_FILES = [
  { file: "docs/start/install.md", markers: { skills: 1 } },
  { file: "docs/start/codex-install.md", markers: { skills: 1, agents: 1, commands: 1 } },
  { file: "docs/start/skill-map.md", markers: { skills: 1, agents: 1, commands: 1 } },
  // index.md states commands + agents twice (category bullets + a Total line).
  { file: "docs/start/index.md", markers: { discipline: 1, reference: 1, diagnostic: 1, agents: 2, commands: 2, skills: 1 } },
  { file: "docs/agents/index.md", markers: { agents: 1 } },
  { file: "docs/start/xcode-setup.md", markers: { skills: 1, agents: 1, commands: 1 } },
  { file: "docs/commands/utility/ask.md", markers: { agents: 1 } },
];

// Pattern is kept as a source string so each call builds a fresh /g RegExp —
// avoids cross-call lastIndex state bugs from a shared global regex.
const MARKER_SRC = String.raw`<!--ax:([a-z]+)-->(\d+)<!--/ax-->`;

/** Fresh global RegExp matching one marker (group 1 = key, group 2 = number). */
export function markerRe() {
  return new RegExp(MARKER_SRC, "g");
}

/**
 * Rewrite every marker in `content` to its expected value from `values`.
 * Returns { content, count }. Throws on an unknown marker key so a typo'd
 * marker fails loudly at release time rather than silently going unmaintained.
 */
export function applyDocStats(content, values) {
  let count = 0;
  const next = content.replace(markerRe(), (_full, key) => {
    count += 1;
    const value = values[key];
    if (value === undefined) {
      throw new Error(
        `Unknown doc-stat marker key '${key}' — expected one of ${DOC_STAT_KEYS.join(", ")}`,
      );
    }
    return `<!--ax:${key}-->${value}<!--/ax-->`;
  });
  return { content: next, count };
}

/** Extract [{ key, value }] for every marker in `content` (value as a Number). */
export function extractDocStats(content) {
  const re = markerRe();
  const found = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    found.push({ key: m[1], value: Number(m[2]) });
  }
  return found;
}

/** Tally markers in `content` by key → { key: occurrences }. */
export function tallyDocStats(content) {
  const tally = {};
  for (const { key } of extractDocStats(content)) {
    tally[key] = (tally[key] ?? 0) + 1;
  }
  return tally;
}

/**
 * Compare a file's actual markers against its expected spec ({ key: count }).
 * Returns a list of human-readable problems ([] when the file matches). Catches
 * a missing marker, a partially-deleted duplicate (count too low), an extra
 * marker, and an unexpected key. Shared by the writer and the checker so they
 * cannot diverge on what "valid" means.
 */
export function checkMarkerSpec(content, spec) {
  const actual = tallyDocStats(content);
  const problems = [];
  for (const key of Object.keys(spec)) {
    const want = spec[key];
    const got = actual[key] ?? 0;
    if (got !== want) {
      problems.push(`expected ${want} '${key}' marker(s), found ${got}`);
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in spec)) {
      problems.push(`unexpected '${key}' marker(s) (found ${actual[key]}) not in spec`);
    }
  }
  return problems;
}
