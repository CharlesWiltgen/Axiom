/**
 * Docs dash-convention detection (pre-deploy check 12i).
 *
 * Enforces `.claude/rules/documentation-style.md` §Dashes: a *list-led inline-heading
 * separator* — a `**bold**` / `[link](url)` / `` `code` `` head at the start of a bullet
 * or numbered list item, immediately followed by the separator — must use a spaced
 * EN-dash " – " (U+2013). Running prose keeps the spaced em-dash, so the anchored
 * pattern only ever looks at the separator position and never touches prose.
 *
 * Extracted from pre-deploy.ts so the pattern is unit-testable. It previously lived
 * inline and untested, and flagged ONLY the em-dash — so `- **Label** - desc` (ASCII
 * hyphen) passed silently and six violations shipped on a docs page, past the very gate
 * meant to catch them. See docs-dashes.test.ts.
 *
 * Scope: `docs/` only. For-LLM skill files are exempt by design (not human reading
 * material) — they carry ~1,271 such separators and scanning them is meaningless.
 */

/**
 * Every WRONG separator, enumerated.
 *
 * U+2013 EN DASH is the ONLY legal one here, so enumerate the whole complement rather
 * than adding wrong dashes one at a time — that incremental habit is what let the ASCII
 * hyphen through. Covers: ASCII hyphen, U+2010 HYPHEN, U+2011 NON-BREAKING HYPHEN,
 * U+2012 FIGURE DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR, U+2212 MINUS SIGN.
 *
 * The hyphen is ESCAPED deliberately. A trailing `-` in a character class is literal, so
 * an unescaped `[—-]` happens to work — but appending the Unicode minus (the obvious next
 * edit) gives `[—-−]`, a silent RANGE U+2014–U+2212 matching ~510 code points. Escaping
 * makes the class order- and insertion-proof.
 */
const WRONG_SEP = "[\\-\\u2010\\u2011\\u2012\\u2014\\u2015\\u2212]";

/**
 * The trailing `\s` is LOAD-BEARING: it is what excludes negative numbers and CLI flags
 * (`- **Delta** -5 degrees`, `- **Usage** -v for verbose`). Do not "tidy" it away, or
 * every such line starts blocking commits.
 *
 * Matches inline links in the `[text](url)` form only — not reference links
 * (`[text][ref]`). That is exhaustive for VitePress docs; widen the alternation if
 * reference-link heads ever appear.
 */
export const dashSepPattern = new RegExp(
  "^\\s*(?:[-*]|\\d+\\.)\\s+(?:\\*\\*[^*]+\\*\\*|\\[[^\\]]+\\]\\([^)]+\\)|`[^`]+`)\\s+" +
    WRONG_SEP + "\\s",
);

/** True when a single line is a list-led inline-heading separator using the wrong dash. */
export function isDashViolation(line: string): boolean {
  return dashSepPattern.test(line);
}

/**
 * Scan one file's contents, returning the 1-indexed line numbers that violate the rule.
 * Skips fenced code blocks and YAML frontmatter — a bullet inside a ```markdown example
 * is illustrative, not prose, and must not be flagged.
 */
export function findDashViolations(contents: string): number[] {
  const lines = contents.split("\n");
  const violations: number[] = [];
  let inFence = false;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (isDashViolation(line)) violations.push(i + 1);
  }
  return violations;
}
