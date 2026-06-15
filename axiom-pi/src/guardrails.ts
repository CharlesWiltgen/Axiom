/**
 * Tool-hook logic ported from Axiom's Claude Code hooks. Pure functions so
 * they're unit-testable; the Pi wiring in index.ts feeds them tool I/O.
 *
 *  - unscopedStateVars  ← swift-guardrails.sh   (@State without access control)
 *  - crashFileHint      ← pretool-crash-route.py (route crash Reads to xcsym)
 *  - bashOutputHints    ← posttool-bash-hints.py (suggest a skill from output)
 */

/**
 * `@State var` declarations missing an explicit access level. Without one,
 * child views can create independent copies of the state — a silent-bug class.
 * Honors a `// axiom-ignore` trailing comment, matching the Claude hook.
 */
export function unscopedStateVars(swift: string): { line: number; text: string }[] {
  const SCOPED = /@State\s+(private|internal|fileprivate|public|package)\s+var\b/;
  const hits: { line: number; text: string }[] = [];
  const lines = swift.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!/@State\s+var\b/.test(text)) continue;
    if (SCOPED.test(text)) continue;
    if (/\/\/\s*axiom-ignore/.test(text)) continue;
    hits.push({ line: i + 1, text: text.trim() });
  }
  return hits;
}

type CrashKind =
  | "ips"
  | "crash_text"
  | "xccrashpoint_bundle_root"
  | "xccrashpoint_inner_crash"
  | "xccrashpoint_inner_other"
  | "";

/** Categorize a path so the caller can pick the right crash hint. */
export function classifyCrashPath(p: string): CrashKind {
  if (!p) return "";
  if (p.endsWith(".xccrashpoint") || p.endsWith(".xccrashpoint/")) return "xccrashpoint_bundle_root";
  if (p.includes(".xccrashpoint/")) {
    return p.endsWith(".crash") ? "xccrashpoint_inner_crash" : "xccrashpoint_inner_other";
  }
  if (p.endsWith(".ips")) return "ips";
  if (p.endsWith(".crash")) return "crash_text";
  return "";
}

const CRASH_HINTS: Record<Exclude<CrashKind, "">, (p: string) => string> = {
  ips: (p) =>
    `This is an .ips crash report. Before reading it as text, run ` +
    `\`xcsym crash --format=summary "${p}"\` — it symbolicates against local ` +
    `dSYMs and tags the crash pattern. Analyze the JSON output, not the raw .ips. ` +
    `See the axiom-tools skill (xcsym-ref).`,
  crash_text: (p) =>
    `This is an Apple legacy .crash text file. Run ` +
    `\`xcsym crash --format=summary "${p}"\` first — xcsym parses the legacy ` +
    `format, symbolicates via dSYM discovery, and surfaces pattern_tag + crashed frames.`,
  xccrashpoint_inner_crash: (p) =>
    `This is a .crash inside an .xccrashpoint bundle. Pass it directly to ` +
    `\`xcsym crash --format=summary "${p}"\`. Prefer a \`LocallySymbolicated/\` ` +
    `sibling with the same timestamp if present.`,
  xccrashpoint_bundle_root: (p) =>
    `This is an .xccrashpoint bundle (a directory). xcsym needs a .crash file ` +
    `inside it — they live at \`${p}/Filters/*/Logs/*.crash\`. List the directory, ` +
    `then pass the right one to \`xcsym crash\`.`,
  xccrashpoint_inner_other: () =>
    `This file is inside an .xccrashpoint bundle but isn't the crash payload. ` +
    `For crash analysis, route \`Filters/*/Logs/*.crash\` under the bundle root to ` +
    `\`xcsym crash --format=summary\`.`,
};

/** Advisory hint when a crash file is read, or null when the path isn't a crash. */
export function crashFileHint(p: string): string | null {
  const kind = classifyCrashPath(p);
  return kind ? CRASH_HINTS[kind](p) : null;
}

// Output-signature rules from posttool-bash-hints.py. The Python hook's
// duration-aware rules (slow-build / slow-test) are intentionally omitted: Pi's
// tool_result event carries no command duration to gate them on.
const BASH_PATTERN_RULES: { pattern: RegExp; hint: string }[] = [
  { pattern: /Unable to simultaneously satisfy constraints/, hint: "💡 Auto Layout conflict — load the axiom-uikit skill." },
  { pattern: /Actor-isolated|Sendable|data race|@MainActor/, hint: "💡 Concurrency issue — load the axiom-concurrency skill." },
  { pattern: /no such column|FOREIGN KEY constraint|migration/, hint: "💡 Database migration issue — load the axiom-data skill." },
  { pattern: /retain cycle|memory leak|deinit.*never called/, hint: "💡 Memory issue — load the axiom-performance skill." },
  { pattern: /CKError|CKRecord.*error/, hint: "💡 CloudKit issue — load the axiom-data skill." },
  { pattern: /ubiquitous.*error|iCloud Drive|NSFileCoordinator/, hint: "💡 iCloud Drive issue — load the axiom-data skill." },
  { pattern: /file.*disappeared|file not found|storage.*full/, hint: "💡 File storage issue — load the axiom-data skill." },
  { pattern: /FileProtection|data protection|file.*locked/, hint: "💡 File protection issue — load the axiom-data skill." },
  { pattern: /error:.*module.*not found|linker command failed/, hint: "💡 Build configuration issue — try /axiom-fix-build." },
];

/** Every skill hint whose pattern matches the Bash output, in rule order. */
export function bashOutputHints(output: string): string[] {
  if (!output) return [];
  return BASH_PATTERN_RULES.filter((r) => r.pattern.test(output)).map((r) => r.hint);
}

/** A file path off a tool event's input, tolerating either `path` or `filePath`. */
export function inputPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const rec = input as Record<string, unknown>;
  const p = rec.path ?? rec.filePath;
  return typeof p === "string" ? p : undefined;
}

/** Formatted `@State` access-control warning for Swift source, or null. */
export function swiftGuardrailWarning(swiftSource: string): string | null {
  const hits = unscopedStateVars(swiftSource).slice(0, 3);
  if (hits.length === 0) return null;
  const detail = hits.map((h) => `  L${h.line}: ${h.text}`).join("\n");
  return (
    "⚠️ Axiom guardrail: `@State` without an explicit access level " +
    "(use `@State private var` — child views can otherwise create independent " +
    `state copies):\n${detail}`
  );
}

/** Minimal structural shape of a Pi `tool_result` event (keeps this module Pi-free). */
export type ToolResultLike = {
  toolName: string;
  input: unknown;
  content: ReadonlyArray<{ type: string; text?: string }>;
};

/**
 * Advisory text to append to a `write`/`edit`/`bash` tool result, or null.
 * `readFile` is injected so this is unit-testable without touching disk.
 * Crash-file routing is handled pre-read on `tool_call`, not here.
 */
export function toolResultHint(event: ToolResultLike, readFile: (p: string) => string): string | null {
  if (event.toolName === "write" || event.toolName === "edit") {
    const p = inputPath(event.input);
    if (!p || !p.endsWith(".swift")) return null;
    try {
      return swiftGuardrailWarning(readFile(p));
    } catch {
      return null; // file unreadable (e.g. deleted) — nothing to check
    }
  }
  if (event.toolName === "bash") {
    const text = event.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    const hints = bashOutputHints(text);
    return hints.length ? hints.join("\n") : null;
  }
  return null;
}
