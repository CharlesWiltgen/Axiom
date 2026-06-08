/**
 * `/skill <name>` invocation resolution — pure parsing & validation.
 *
 * Skill/agent/command bodies invoke other skills with `/skill <name>`. A
 * reference to a skill that doesn't exist is a user-facing dead end: the
 * ios-ml router (axiom-rgmn) once shipped pointing `/skill coreml`,
 * `/skill coreml-ref`, … at skills that were never created.
 *
 * This module finds every Axiom `/skill` invocation in a body and reports
 * whether each resolves to a known skill. The caller (pre-deploy.ts) builds
 * the valid-target set from the filesystem and handles error reporting.
 *
 * Recognized forms (the `axiom:` plugin prefix is informational — resolution
 * is by basename existence, NOT suite-correct routing; check-cross-refs.js
 * owns structural sibling/child correctness):
 *   /skill axiom-build          bare name — top-level routers/standalone skills
 *   /skill axiom:build-perf     plugin-namespaced — `<name>` is the lookup key
 *
 * `validTargets` must contain top-level skill names (e.g. "axiom-build") AND
 * child sub-skill basenames (e.g. "build-performance") — both are valid
 * targets per axiom-39fb ("router or child").
 *
 * Invocations namespaced to a non-axiom plugin (e.g. "superpowers:foo") are
 * skipped — they live in other plugins and can't be validated from this repo.
 *
 * Limitations:
 *  - `/skill` invocations inside fenced code blocks are scanned too (they're
 *    real copy-paste invocations here, not illustrations) — a deliberately
 *    broken `/skill` used as a teaching example would be flagged.
 *  - A bare, non-namespaced reference to an EXTERNAL skill (e.g. a hypothetical
 *    `/skill brainstorming`) would be flagged as a dead end; namespace such
 *    references (`superpowers:brainstorming`) so they're recognized as external.
 *
 * This module is I/O free. Tests in skill-invocations.test.ts exercise it.
 */

export interface SkillInvocation {
  /** Text after `/skill `, verbatim — e.g. "axiom:build-performance". */
  raw: string;
  /** Lookup key (raw with any `axiom:` plugin prefix stripped). */
  name: string;
  /** 1-based line number of the invocation. */
  line: number;
  /** Whether `name` is in the valid-target set. */
  resolved: boolean;
}

// `/skill` + whitespace + a target token. The token starts with a letter and
// runs through word chars, `:` (plugin namespace), and `-` (hyphenated names),
// stopping at markdown punctuation (backticks, periods, commas). Requiring
// whitespace after `/skill` means a `skills/foo.md` path never matches; the
// `(?<!\w)` lookbehind means a word-char-prefixed `foo/skill` never matches
// either (so only a standalone `/skill` command is picked up).
const INVOCATION = /(?<!\w)\/skill\s+([A-Za-z][\w:-]*)/g;

/**
 * Find every Axiom `/skill` invocation in `body` and resolve each against
 * `validTargets`. Non-axiom-namespaced invocations are omitted from the result.
 */
export function checkSkillInvocations(
  body: string,
  validTargets: Set<string>,
): SkillInvocation[] {
  const found: SkillInvocation[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(INVOCATION)) {
      const raw = match[1];
      const colon = raw.indexOf(":");
      // Plugin-namespaced reference to a non-axiom plugin — unverifiable here.
      if (colon !== -1 && raw.slice(0, colon) !== "axiom") continue;
      const name = colon === -1 ? raw : raw.slice(colon + 1);
      found.push({ raw, name, line: i + 1, resolved: validTargets.has(name) });
    }
  }
  return found;
}

export interface SkillNameCollision {
  /** `duplicate-child`: one basename in 2+ suites. `child-shadows-top-level`:
   *  a child basename equal to a top-level skill name. */
  kind: "duplicate-child" | "child-shadows-top-level";
  name: string;
  /** Relative path(s) of the colliding child file(s). */
  locations: string[];
}

/**
 * Detect ambiguity in the `/skill` target namespace. `checkSkillInvocations`
 * resolves against a FLAT set (top-level names ∪ child basenames), so a child
 * basename that appears in two suites — or equals a top-level skill name —
 * makes a `/skill <name>` reference ambiguous about which file it reaches.
 * Today there are zero such collisions; this guards the resolver against a
 * future one being introduced silently (axiom-n7c4).
 *
 * Pure: the caller (pre-deploy.ts §5) supplies the walked data. Returns [] when
 * the namespace is unambiguous; results are sorted by name then kind.
 */
export function findSkillNameCollisions(input: {
  topLevelNames: Set<string>;
  /** Child basename → relative path(s) where a `skills/<name>.md` exists. */
  childOccurrences: Map<string, string[]>;
}): SkillNameCollision[] {
  const collisions: SkillNameCollision[] = [];
  for (const [name, locations] of input.childOccurrences) {
    if (input.topLevelNames.has(name)) {
      collisions.push({ kind: "child-shadows-top-level", name, locations: [...locations] });
    }
    if (locations.length > 1) {
      collisions.push({ kind: "duplicate-child", name, locations: [...locations] });
    }
  }
  return collisions.sort(
    (a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind),
  );
}
