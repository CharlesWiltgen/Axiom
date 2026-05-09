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
    if (!area || area === "Area" || area.startsWith("---")) continue;
    rows.push({ area, agent });
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
