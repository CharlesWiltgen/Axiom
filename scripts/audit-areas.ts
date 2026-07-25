/**
 * Audit-area registry rendering — pure, I/O free.
 *
 * `scripts/audit-areas.json` is the single source for the /axiom:audit
 * area list. Four surfaces are rendered from it:
 *
 *   1. the `argument:` list in commands/audit.md      (Axiom's own registry)
 *   2. the `## Available Audits` body table there     (for-LLM routing text)
 *   3. the grouped tables in docs/commands/utility/audit.md  (human prose)
 *   4. the audit links in the docs sidebar            (navigation)
 *
 * Surfaces 1-2 and 3-4 deliberately carry DIFFERENT description text:
 * `detects` is what the model reads to pick an agent, `docsDetects` is
 * what a person reads on the docs site. That split is the project's
 * docs-are-human / source-is-for-LLM convention, not drift — so the
 * registry holds both fields rather than reconciling them.
 *
 * Callers (scripts/build-audit-areas.ts) do the file I/O and the
 * marker-region splicing. Tests in audit-areas.test.ts.
 */

export interface AuditArea {
  area: string;
  agent: string;
  group: string;
  /** Model-facing routing text — the body table's "Detects" column. */
  detects: string;
  /** Human-facing prose — the docs page's "What It Checks" column. */
  docsDetects: string;
  /** Sidebar link target, e.g. `/commands/storage/audit-swiftdata`. */
  docPath: string;
}

export interface AuditRegistry {
  groupOrder: string[];
  areas: AuditArea[];
}

/** Begin/end markers delimiting each generated region. */
export const MARKERS = {
  argument: "AXIOM_AUDIT_ARGUMENT",
  bodyTable: "AXIOM_AUDIT_TABLE",
  docsTable: "AXIOM_AUDIT_DOCS",
  sidebar: "AXIOM_AUDIT_SIDEBAR",
} as const;

/**
 * Order areas canonically: by group order, then alphabetically within
 * each group. This is the order docs and sidebar already used; applying
 * it to audit.md too collapses the three arbitrary orderings that had
 * accumulated across the four surfaces into one.
 */
export function orderAreas(registry: AuditRegistry): AuditArea[] {
  const rank = new Map(registry.groupOrder.map((g, i) => [g, i]));
  return [...registry.areas].sort(
    (a, b) =>
      (rank.get(a.group) ?? Infinity) - (rank.get(b.group) ?? Infinity) ||
      a.area.localeCompare(b.area),
  );
}

/**
 * Validate the registry before anything is rendered from it. A bad
 * registry would otherwise propagate silently into all four surfaces.
 */
export function validateRegistry(registry: AuditRegistry): string[] {
  const errors: string[] = [];
  const groups = new Set(registry.groupOrder);
  const seenAreas = new Set<string>();
  const seenPaths = new Set<string>();

  if (registry.groupOrder.length === 0) errors.push("groupOrder is empty");
  if (registry.areas.length === 0) errors.push("areas is empty");

  for (const a of registry.areas) {
    for (const field of [
      "area",
      "agent",
      "group",
      "detects",
      "docsDetects",
      "docPath",
    ] as const) {
      if (!a[field] || a[field].trim() === "") {
        errors.push(`area '${a.area || "(unnamed)"}' has empty '${field}'`);
      }
    }
    if (!groups.has(a.group)) {
      errors.push(`area '${a.area}' has group '${a.group}' which is not in groupOrder`);
    }
    if (seenAreas.has(a.area)) errors.push(`duplicate area '${a.area}'`);
    seenAreas.add(a.area);
    if (seenPaths.has(a.docPath)) errors.push(`duplicate docPath '${a.docPath}'`);
    seenPaths.add(a.docPath);
    // A `|` would break out of the markdown table cell it is rendered into.
    if (a.detects.includes("|") || a.docsDetects.includes("|")) {
      errors.push(`area '${a.area}' has a '|' in description text — breaks table rendering`);
    }
    if (!a.docPath.endsWith(`/audit-${a.area}`)) {
      errors.push(
        `area '${a.area}' has docPath '${a.docPath}' — must end with '/audit-${a.area}' so parseSidebarAreas can derive the area back`,
      );
    }
  }

  // 'all' is the meta-target dispatching to health-check; it is never an area.
  if (seenAreas.has("all")) errors.push("'all' is the meta-target and must not be an area");

  const unused = registry.groupOrder.filter(
    (g) => !registry.areas.some((a) => a.group === g),
  );
  for (const g of unused) errors.push(`group '${g}' in groupOrder has no areas`);

  return errors;
}

/** Surface 1 — the comma-separated list in the `argument:` frontmatter line. */
export function renderArgumentList(registry: AuditRegistry): string {
  const areas = orderAreas(registry).map((a) => a.area);
  return `argument: "area (optional) - Which audit to run: all, ${areas.join(", ")}"`;
}

/** Surface 2 — the `## Available Audits` body table (model-facing text). */
export function renderBodyTable(registry: AuditRegistry): string {
  const lines = ["| Area | Agent | Detects |", "|------|-------|---------|"];
  for (const a of orderAreas(registry)) {
    lines.push(`| ${a.area} | ${a.agent} | ${a.detects} |`);
  }
  return lines.join("\n");
}

/** Surface 3 — the grouped docs tables (human-facing prose). */
export function renderDocsTables(registry: AuditRegistry): string {
  const ordered = orderAreas(registry);
  const out: string[] = [];
  for (const group of registry.groupOrder) {
    const inGroup = ordered.filter((a) => a.group === group);
    if (inGroup.length === 0) continue;
    out.push(`### ${group}`);
    out.push("| Area | What It Checks |");
    out.push("|------|----------------|");
    for (const a of inGroup) out.push(`| \`${a.area}\` | ${a.docsDetects} |`);
    out.push("");
  }
  // Trailing blank line is supplied by the marker splice.
  return out.join("\n").replace(/\n$/, "");
}

/**
 * Surface 4 — the docs sidebar. NOT generated, and deliberately so: each
 * sidebar group interleaves audit entries with unrelated commands
 * (`Build` holds audit-build alongside fix-build, optimize-build, and
 * resolve-deps), so the audit rows are not a whole region that can be
 * spliced. Generating the groups would delete the non-audit entries.
 *
 * Instead the sidebar stays hand-maintained and is CHECKED against the
 * registry. That still collapses the old four hand-maintained copies to
 * one source plus one checked projection.
 *
 * Returns the audit groups the sidebar should contain, in order, for
 * comparison against `parseSidebarGroups` from audit-parity.ts.
 */
export function expectedSidebarGroups(
  registry: AuditRegistry,
): Array<{ group: string; areas: string[] }> {
  const ordered = orderAreas(registry);
  return registry.groupOrder
    .map((group) => ({
      group,
      areas: ordered.filter((a) => a.group === group).map((a) => a.area),
    }))
    .filter((g) => g.areas.length > 0);
}

/**
 * Compare the sidebar as parsed from config.ts against what the registry
 * says it should hold. Reports group-level and item-level divergence.
 */
export function validateSidebarAgainstRegistry(
  registry: AuditRegistry,
  actual: Array<{ group: string; areas: string[] }>,
): string[] {
  const expected = expectedSidebarGroups(registry);
  const errors: string[] = [];

  const eNames = expected.map((g) => g.group);
  const aNames = actual.map((g) => g.group);
  if (JSON.stringify(eNames) !== JSON.stringify(aNames)) {
    errors.push(
      `sidebar audit groups differ from the registry: expected [${eNames.join(", ")}], found [${aNames.join(", ")}]`,
    );
    return errors; // Item comparison is noise once groups are misaligned.
  }

  for (let i = 0; i < expected.length; i++) {
    if (JSON.stringify(expected[i].areas) !== JSON.stringify(actual[i].areas)) {
      errors.push(
        `sidebar group '${expected[i].group}': expected [${expected[i].areas.join(", ")}], found [${actual[i].areas.join(", ")}]`,
      );
    }
  }
  return errors;
}

/**
 * Replace the content between `<!-- BEGIN name -->` / `<!-- END name -->`
 * style markers. Returns null when the markers are absent or malformed,
 * so the caller can report a precise error instead of writing garbage.
 */
export function spliceRegion(
  content: string,
  marker: string,
  replacement: string,
  commentStyle: "html" | "line" | "hash" = "html",
): string | null {
  // `hash` is for YAML frontmatter, where an HTML comment is not a comment.
  const prefix = { html: "<!-- ", line: "// ", hash: "# " }[commentStyle];
  const [open, close] = [`${prefix}${marker}_BEGIN`, `${prefix}${marker}_END`];

  const beginIdx = content.indexOf(open);
  const endIdx = content.indexOf(close);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return null;

  const afterBegin = content.indexOf("\n", beginIdx);
  if (afterBegin === -1 || afterBegin > endIdx) return null;

  return content.slice(0, afterBegin + 1) + replacement + "\n" + content.slice(endIdx);
}
