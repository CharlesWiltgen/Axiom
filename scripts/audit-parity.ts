/**
 * /axiom:audit Source-of-Truth Parity — pure parsing & validation.
 *
 * The list of audit areas exists in four places that must agree:
 *
 *   A — frontmatter `argument:` line in commands/audit.md (CLI dispatch)
 *   B — body `## Available Audits` table column 1 (agent dispatch)
 *   C — docs/commands/utility/audit.md "Available Audit Areas" code spans
 *   D — docs/.vitepress/config.ts commands sidebar `link` paths shaped
 *       like `/commands/<group>/audit-<area>` — derives an area name from
 *       each link.
 *
 * Plus E — every agent name in B's column 2 must resolve to a real file
 * under .claude-plugin/plugins/axiom/agents/<agent>.md.
 *
 * This module is I/O free. Callers read files and pass strings in; the
 * caller (pre-deploy.ts) handles agent-file-existence checks and error
 * reporting. Tests in audit-parity.test.ts exercise these functions.
 */

export interface BodyRow {
  area: string;
  agent: string;
  /** Column 3 of the body table — short dispatch description shown to the
   * model. Compared against the agent file's frontmatter description by
   * `validateAgentDescriptionParity` to catch rename drift. */
  detects: string;
}

/** A group of audit areas — preserves insertion order from the source. */
export interface AreaGroup {
  group: string;
  areas: string[];
}

export interface ParityError {
  /** Short check identifier — passed to pre-deploy.ts's error() helper. */
  check: "audit-parity";
  message: string;
}

/**
 * Parse the comma-separated audit-area list from the `argument:` frontmatter
 * line. The "all" meta-target is excluded — it dispatches to health-check,
 * not a regular audit.
 */
export function parseFrontmatterAreas(content: string): string[] {
  const m = content.match(/^argument:\s*"[^"]*Which audit to run:\s*([^"]+)"/m);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "all");
}

/**
 * Parse the body table under `## Available Audits` — returns area + agent
 * name for each row. Used to derive both the source-side area set and
 * the agent-existence check.
 */
export function parseBodyTable(content: string): BodyRow[] {
  const section = content.match(/## Available Audits\s*\n([\s\S]*?)\n## /);
  if (!section) return [];
  const rows: BodyRow[] = [];
  for (const line of section[1].split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    const area = cells[1];
    const agent = cells[2];
    const detects = cells[3] ?? "";
    if (!area || area === "Area" || area.startsWith("---")) continue;
    rows.push({ area, agent, detects });
  }
  return rows;
}

/**
 * Parse the docs page Available Audit Areas section — returns every
 * `code-span` token, preserving multiplicity so duplicates can be detected.
 */
export function parseDocAreas(content: string): string[] {
  const section = content.match(/## Available Audit Areas\s*\n([\s\S]*?)\n## /);
  if (!section) return [];
  const out: string[] = [];
  for (const m of section[1].matchAll(/`([a-z][a-z0-9-]+)`/g)) out.push(m[1]);
  return out;
}

/**
 * Parse the commands sidebar in config.ts. Returns area names derived
 * from `/commands/<group>/audit-<area>` links across every `text: '...'`
 * group within the `'/commands/':` block. Captures duplicates.
 */
export function parseSidebarAreas(configTs: string): string[] {
  // Isolate the '/commands/': [ ... ] block — single quotes are typical.
  const m = configTs.match(/'\/commands\/'\s*:\s*\[([\s\S]*?)\n\s*\],/);
  if (!m) return [];
  const block = m[1];
  const out: string[] = [];
  for (const link of block.matchAll(/link:\s*'\/commands\/[^/']+\/audit-([a-z0-9-]+)'/g)) {
    out.push(link[1]);
  }
  return out;
}

/**
 * Parse the commands sidebar in config.ts grouped — returns one entry
 * per group that contains at least one audit link. Group order and
 * within-group item order are preserved. Used to enforce per-group
 * count + order parity with the docs page (axiom-imz finding: set
 * parity passes while groupings can still drift independently).
 */
export function parseSidebarGroups(configTs: string): AreaGroup[] {
  const m = configTs.match(/'\/commands\/'\s*:\s*\[([\s\S]*?)\n\s*\],/);
  if (!m) return [];
  const block = m[1];
  const groups: AreaGroup[] = [];
  // Each group: { text: 'Name', items: [ ... ] }
  for (const gm of block.matchAll(
    /text:\s*'([^']+)',\s*items:\s*\[([\s\S]*?)\]\s*\}/g,
  )) {
    const name = gm[1];
    const items = gm[2];
    const areas: string[] = [];
    for (const link of items.matchAll(
      /link:\s*'\/commands\/[^/']+\/audit-([a-z0-9-]+)'/g,
    )) {
      areas.push(link[1]);
    }
    if (areas.length > 0) groups.push({ group: name, areas });
  }
  return groups;
}

/**
 * Parse the docs page Available Audit Areas section grouped — one
 * entry per `### GroupName` heading + immediately-following table.
 * Group order and within-group item order are preserved.
 */
export function parseDocGroups(content: string): AreaGroup[] {
  const section = content.match(/## Available Audit Areas\s*\n([\s\S]*?)\n## /);
  if (!section) return [];
  const groups: AreaGroup[] = [];
  // Split on ### headings, anchoring at start-of-string OR after \n so a
  // section that starts directly with `### Foo` (no preamble) splits the
  // same way as one with preamble.
  const chunks = section[1].split(/(?:^|\n)###\s+/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    // First line is the group name (until the newline).
    const nameEnd = chunk.indexOf("\n");
    if (nameEnd === -1) continue;
    const name = chunk.slice(0, nameEnd).trim();
    const body = chunk.slice(nameEnd);
    const areas: string[] = [];
    for (const m of body.matchAll(/`([a-z][a-z0-9-]+)`/g)) areas.push(m[1]);
    if (areas.length > 0) groups.push({ group: name, areas });
  }
  return groups;
}

/**
 * Validate that two grouped views agree on group names, group order,
 * within-group items, and within-group order. Returns error messages
 * naming the first divergence in each category — concise reports beat
 * walls of diffs.
 */
export function validateGroupedParity(
  sidebar: AreaGroup[],
  docs: AreaGroup[],
): string[] {
  const errors: string[] = [];

  // Group-name + group-order check.
  const sNames = sidebar.map((g) => g.group);
  const dNames = docs.map((g) => g.group);
  if (sNames.length !== dNames.length) {
    errors.push(
      `sidebar has ${sNames.length} groups, docs has ${dNames.length}: ` +
        `sidebar=[${sNames.join(", ")}] docs=[${dNames.join(", ")}]`,
    );
  } else {
    for (let i = 0; i < sNames.length; i++) {
      if (sNames[i] !== dNames[i]) {
        errors.push(
          `group order/name mismatch at position ${i}: sidebar='${sNames[i]}' docs='${dNames[i]}'`,
        );
        break; // Subsequent positions are noise once we're misaligned.
      }
    }
  }

  // For matching group-name pairs, check items + order.
  const dByName = new Map(docs.map((g) => [g.group, g.areas]));
  for (const sg of sidebar) {
    const da = dByName.get(sg.group);
    if (!da) continue; // Already reported by name check above.
    if (sg.areas.length !== da.length) {
      errors.push(
        `group '${sg.group}' count mismatch: sidebar=${sg.areas.length} docs=${da.length} ` +
          `(sidebar=[${sg.areas.join(", ")}] docs=[${da.join(", ")}])`,
      );
      continue;
    }
    for (let i = 0; i < sg.areas.length; i++) {
      if (sg.areas[i] !== da[i]) {
        errors.push(
          `group '${sg.group}' item order/name mismatch at position ${i}: ` +
            `sidebar='${sg.areas[i]}' docs='${da[i]}'`,
        );
        break;
      }
    }
  }

  return errors;
}

/**
 * Find duplicates in a list. Returns map of {area: count} for any area
 * appearing more than once.
 */
export function findDuplicates(items: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const x of items) counts[x] = (counts[x] || 0) + 1;
  const dupes: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) if (n > 1) dupes[k] = n;
  return dupes;
}

/**
 * Compare two area lists. Returns the symmetric difference broken out by
 * direction (missing vs extra) so the caller can phrase the error.
 */
export function diffAreas(
  a: string[],
  b: string[],
): { missing: string[]; extra: string[] } {
  const aSet = new Set(a);
  const bSet = new Set(b);
  return {
    missing: [...aSet].filter((x) => !bSet.has(x)).sort(),
    extra: [...bSet].filter((x) => !aSet.has(x)).sort(),
  };
}

/**
 * Extract the body of a `## Heading` section — content between the heading
 * line and the next `## ` heading (or end of file). Returns null if the
 * heading isn't found. Headings with regex meta-chars (parens, etc.) are
 * escaped, so callers can pass `Project Analysis (No Area Specified)`.
 */
export function extractSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  return m ? m[1] : null;
}

/**
 * Extract audit-area tokens referenced inline within a `## Heading` section
 * of commands/audit.md. Handles four context-anchored patterns that today's
 * audit.md uses to mention areas — anchors prevent false positives like
 * matching "memory-auditor" (an agent name) when the section just discusses
 * area dispatch. Returns tokens in document order, preserving multiplicity
 * so duplicates can be reported.
 *
 * Patterns (any combination of these may appear in a section):
 *   1. `\`/axiom:audit AREA\``           — Direct Dispatch examples
 *   2. `- AREA → ...`                    — Priority Order bullets
 *   3. `Run AREA + AREA + AREA`          — Batch Recommendations
 *   4. `→ suggest AREA, AREA`            — Project Analysis triggers
 *
 * If a section uses none of these patterns, returns []. Caller validates
 * each token is in the canonical area set.
 */
export function parseInlineAuditReferences(
  content: string,
  sectionHeading: string,
): string[] {
  const section = extractSection(content, sectionHeading);
  if (!section) return [];
  const out: string[] = [];

  // Pattern 1: backtick code spans `/axiom:audit AREA`
  for (const m of section.matchAll(/`\/axiom:audit\s+([a-z][a-z0-9-]*)`/g)) {
    out.push(m[1]);
  }

  // Pattern 2: bullet `- AREA →` (only the first token before the arrow).
  // Anchored to start-of-line + bullet to avoid matching `agent-name → ...`
  // mid-sentence.
  for (const m of section.matchAll(/^\s*-\s+([a-z][a-z0-9-]*)\s*→/gm)) {
    out.push(m[1]);
  }

  // Pattern 3: `Run X + Y + Z` — captures every lowercase token in the
  // chain. Uppercase placeholders like `CRITICAL + HIGH` are excluded
  // because the regex requires `[a-z]` start.
  for (const m of section.matchAll(
    /\bRun\s+([a-z][a-z0-9-]*(?:\s*\+\s*[a-z][a-z0-9-]*)+)/g,
  )) {
    for (const tok of m[1].split(/\s*\+\s*/)) out.push(tok);
  }

  // Pattern 4: `→ suggest X, Y` — captures every lowercase token in the
  // comma-separated list. Trailing words like ` audit` after the last
  // token are excluded because the regex stops at non-token chars.
  for (const m of section.matchAll(
    /→\s+suggest\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*)/g,
  )) {
    for (const tok of m[1].split(/\s*,\s*/)) out.push(tok);
  }

  return out;
}

/**
 * Validate that every inline reference is in the canonical area set.
 * Returns one error message per unknown reference (deduped). Caller
 * supplies the section name so messages stay specific:
 *
 *   "section 'Priority Order' references unknown area 'core-data-v2'"
 */
export function validateInlineReferences(
  canonical: string[],
  references: string[],
  sectionLabel: string,
): string[] {
  const set = new Set(canonical);
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const ref of references) {
    if (set.has(ref) || seen.has(ref)) continue;
    seen.add(ref);
    errors.push(
      `section '${sectionLabel}' references unknown area '${ref}' — not in canonical frontmatter list`,
    );
  }
  return errors;
}

/**
 * Extract the `description:` field from agent file frontmatter. Handles
 * both single-line scalars and YAML block scalars (`description: |`),
 * which is the format every Axiom agent uses today. The line-based
 * frontmatter parser in pre-deploy.ts can't distinguish `description: |`
 * (block-scalar marker) from a real value, so this function is required
 * for the agent-description parity check.
 *
 * Returns the trimmed description text, or null if no frontmatter or no
 * description field is present.
 *
 * Convention dependency: the block-scalar terminator is "next line that
 * starts a top-level YAML key" (`/^[a-zA-Z][\w-]*:/`). Every Axiom agent
 * indents `<example>` body content (including `user:` / `assistant:`
 * lines) with at least 2 spaces, so those don't match the terminator.
 * If a future agent ships flush-left example content, the parser will
 * truncate the description silently — `hasSubstantiveOverlap` may still
 * pass on the truncated prefix, hiding rename drift. Keep example
 * content indented when authoring agent frontmatter.
 */
export function parseAgentDescription(content: string): string | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fmLines = fmMatch[1].split("\n");

  // Block scalar: `description: |` followed by indented lines until the
  // next top-level YAML key (line starting with `key:`, no leading
  // whitespace) or end of frontmatter. Line-based scan rather than
  // a single regex — easier to reason about and avoids `m`-flag traps
  // where `$` matches end of every line.
  for (let i = 0; i < fmLines.length; i++) {
    if (/^description:\s*\|\s*$/.test(fmLines[i])) {
      const body: string[] = [];
      for (let j = i + 1; j < fmLines.length; j++) {
        // Stop at next top-level YAML key. An indented `user:` inside
        // an example block won't match because of the leading space.
        if (/^[a-zA-Z][\w-]*:/.test(fmLines[j])) break;
        body.push(fmLines[j]);
      }
      // Strip up to 2-space leading indent from each line — YAML
      // block-scalar convention. Don't trim arbitrary indentation;
      // preserve structure for examples/snippets in the description.
      const stripped = body.map((l) => l.replace(/^ {2}/, "")).join("\n").trim();
      return stripped.length > 0 ? stripped : null;
    }
  }

  // Single-line scalar: `description: ...` or `description: "..."`.
  const inline = fmMatch[1].match(/^description:\s*(.+)$/m);
  if (inline) {
    let val = inline[1].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val.length > 0 ? val : null;
  }

  return null;
}

/**
 * Common English + Axiom-template stop words excluded from substantive-
 * word overlap. The agent-description boilerplate ("Use this agent when
 * the user mentions...") would create false-positive overlap with any
 * body description; filtering these forces overlap on actual domain
 * vocabulary.
 */
const SUBSTANTIVE_STOP_WORDS = new Set([
  // Common English ≥4 chars
  "this", "that", "with", "from", "have", "been", "were", "what",
  "which", "where", "when", "they", "them", "their", "there", "your",
  "would", "could", "should", "will", "must", "than", "then", "such",
  "into", "onto", "about", "after", "before", "during", "without",
  "within", "between", "while", "also", "some", "many", "most",
  "more", "less", "each", "other", "same", "only", "very", "just",
  // Axiom agent-template boilerplate
  "agent", "user", "users", "scans", "uses", "uses", "code", "review",
  "audit", "audits", "auditor", "automatically", "mentions", "wants",
  "check", "checks", "checking", "checked", "check",
  "scan", "scanning", "scanned", "report", "reports",
  "common", "issues", "issue", "patterns", "pattern",
  // Verbs/nouns that appear in nearly every description
  "find", "finds", "finding", "found", "detect", "detects", "detecting",
  "covers", "including", "include", "includes",
]);

/**
 * Tokenize a description into substantive lowercase words ≥ 4 chars,
 * excluding stop words. Used by hasSubstantiveOverlap.
 */
function tokenizeSubstantive(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !SUBSTANTIVE_STOP_WORDS.has(w)),
  );
}

/**
 * Check whether two descriptions share at least one substantive word.
 * Used to detect agent-description drift: if an agent gets renamed or
 * repurposed but the body-table dispatch description doesn't get updated,
 * the two will share no domain vocabulary.
 *
 * Match modes:
 *   1. Exact word match (e.g., "leaks" ∩ "leaks")
 *   2. Shared 5-char prefix (e.g., "allocation" ∩ "allocations" share
 *      "alloc"; "generic" ∩ "generics" share "gener") — handles plural
 *      and inflected forms without a real stemmer.
 *
 * Example: body "Retain cycles, leaks, Timer/observer patterns" vs
 * agent "audit SwiftData migrations" — zero domain overlap, drift.
 *
 * Returns true if they share ≥ 1 substantive word OR 5-char prefix,
 * false otherwise.
 */
export function hasSubstantiveOverlap(a: string, b: string): boolean {
  const aw = tokenizeSubstantive(a);
  const bw = tokenizeSubstantive(b);
  if (aw.size === 0 || bw.size === 0) return false;
  // Fast path: exact word match.
  for (const w of aw) if (bw.has(w)) return true;
  // Fallback: shared 5-char prefix handles plural/inflected forms.
  const prefixesOf = (set: Set<string>): Set<string> =>
    new Set([...set].filter((w) => w.length >= 5).map((w) => w.slice(0, 5)));
  const ap = prefixesOf(aw);
  const bp = prefixesOf(bw);
  for (const p of ap) if (bp.has(p)) return true;
  return false;
}

export interface AgentParityArgs {
  rows: BodyRow[];
  /** Map of agent name → file content. Caller reads files; this module
   * stays I/O-free. */
  agentFiles: Record<string, string>;
}

/**
 * Validate that every body-table row has a corresponding agent file with
 * a non-empty frontmatter description, and that the body description
 * shares at least one substantive word with the agent description.
 * Returns one error message per drift case.
 *
 * Three failure modes:
 *   1. agent file content not in map (caller didn't include it — likely
 *      missing file, but agent existence is checked elsewhere)
 *   2. agent description missing or empty
 *   3. body and agent descriptions share zero substantive words —
 *      strong signal that one was renamed/repurposed without the other
 */
export function validateAgentDescriptionParity(
  args: AgentParityArgs,
): string[] {
  const errors: string[] = [];
  for (const row of args.rows) {
    if (!row.agent) continue;
    const content = args.agentFiles[row.agent];
    if (!content) continue; // Existence check is the caller's job.

    const agentDesc = parseAgentDescription(content);
    if (!agentDesc || agentDesc.length === 0) {
      errors.push(
        `agent '${row.agent}' (area '${row.area}') has missing or empty frontmatter description`,
      );
      continue;
    }

    if (!row.detects || row.detects.length === 0) {
      errors.push(
        `area '${row.area}' has empty body-table 'Detects' column — cannot cross-check with agent description`,
      );
      continue;
    }

    if (!hasSubstantiveOverlap(row.detects, agentDesc)) {
      errors.push(
        `area '${row.area}' / agent '${row.agent}': body-table description and agent frontmatter share no substantive vocabulary — likely rename drift. ` +
          `body='${row.detects}' agent='${agentDesc.slice(0, 80)}${agentDesc.length > 80 ? "..." : ""}'`,
      );
    }
  }
  return errors;
}

/**
 * Validate parity across all four sources. Returns a list of human-
 * readable error messages. Agent-file existence (E) is left to the
 * caller because it requires filesystem access.
 */
export function validateParity(args: {
  frontmatter: string[];
  body: string[];
  docs: string[];
  sidebar: string[];
}): string[] {
  const errors: string[] = [];
  const { frontmatter, body, docs, sidebar } = args;

  // Parse failures.
  if (frontmatter.length === 0)
    errors.push("Could not parse audit areas from commands/audit.md frontmatter `argument:` line");
  if (body.length === 0)
    errors.push("Could not parse audit areas from commands/audit.md `## Available Audits` body table");
  if (docs.length === 0)
    errors.push("Could not parse audit areas from docs/commands/utility/audit.md `## Available Audit Areas` section");
  if (sidebar.length === 0)
    errors.push("Could not parse audit areas from docs/.vitepress/config.ts commands sidebar");

  // Pairwise drift. Anchor on frontmatter (the canonical CLI dispatch list).
  const pairs: Array<[string, string[], string]> = [
    ["body table", body, "frontmatter argument:"],
    ["docs page", docs, "frontmatter argument:"],
    ["sidebar config", sidebar, "frontmatter argument:"],
  ];
  for (const [bName, b, aName] of pairs) {
    if (frontmatter.length === 0 || b.length === 0) continue;
    const { missing, extra } = diffAreas(frontmatter, b);
    if (missing.length > 0)
      errors.push(`${aName} → ${bName}: missing in ${bName}: ${missing.join(", ")}`);
    if (extra.length > 0)
      errors.push(`${aName} → ${bName}: extra in ${bName} (not in ${aName}): ${extra.join(", ")}`);
  }

  // Duplicate detection within each source.
  const sources: Array<[string, string[]]> = [
    ["frontmatter argument:", frontmatter],
    ["body table", body],
    ["docs page", docs],
    ["sidebar config", sidebar],
  ];
  for (const [name, items] of sources) {
    const dupes = findDuplicates(items);
    for (const [area, count] of Object.entries(dupes)) {
      errors.push(`Duplicate audit area '${area}' appears ${count}× in ${name}`);
    }
  }

  return errors;
}
