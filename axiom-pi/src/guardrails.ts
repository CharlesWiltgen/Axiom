/**
 * Tool-hook logic ported from Axiom's Claude Code hooks. Pure functions so
 * they're unit-testable; the Pi wiring in index.ts feeds them tool I/O.
 *
 *  - unscopedStateVars      ← swift-guardrails.py   (@State without access control)
 *  - unguardedRelationships ← swift-guardrails.py   (to-many @Relationship, no default)
 *  - crashFileHint          ← pretool-crash-route.py (route crash Reads to xcsym)
 *  - bashOutputHints        ← posttool-bash-hints.py (suggest a skill from output)
 *
 * Pi appends these as advisory text on the tool result (it can't block), so both
 * Swift checks are warnings here — which matches the warn-first stance for the
 * @Relationship check on the other harnesses.
 */

/**
 * `@State var` declarations missing an explicit access level. Without one,
 * child views can create independent copies of the state — a silent-bug class.
 * Honors a `// axiom-ignore` trailing comment, matching the Claude hook.
 */
export function unscopedStateVars(swift: string): { line: number; text: string }[] {
  // Mirrors swift-guardrails.py check_state: drop access-controlled forms (a modifier
  // on either side of @State), the axiom-ignore escape hatch, and false positives where
  // the match is inside a // comment or a string literal.
  const ACCESS =
    /(private|fileprivate|internal|public|package|open)\s+@State|@State\s+(private|fileprivate|internal|public|package|open)/;
  const hits: { line: number; text: string }[] = [];
  const lines = swift.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!/@State\s+var\b/.test(text)) continue;
    if (ACCESS.test(text)) continue;
    if (/\/\/\s*axiom-ignore/.test(text)) continue;
    if (/\/\/.*@State\s+var/.test(text)) continue; // commented-out / doc comment
    if (/".*@State\s+var/.test(text)) continue; // inside a string literal
    hits.push({ line: i + 1, text: text.trim() });
  }
  return hits;
}

/**
 * SwiftData to-many `@Relationship` array properties with no `= []` default. Without
 * one, SwiftData crashes at runtime when it reads the relationship — and it compiles
 * clean, so the compiler won't catch it. Mirrors swift-guardrails.py check_relationship:
 * the attribute may sit on the `var` line or up to 3 lines above it; skips to-one
 * (non-array / optional), already-defaulted, dictionary, commented, and ignored decls.
 */
export function unguardedRelationships(swift: string): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  const lines = swift.split("\n");
  const n = lines.length;
  for (let i = 0; i < n; i++) {
    const line = lines[i];
    if (!line.includes("@Relationship")) continue;
    const stripped = line.replace(/^\s+/, "");
    if (stripped.startsWith("//") || stripped.startsWith("*")) continue;
    const rel = line.indexOf("@Relationship");
    const cmt = line.indexOf("//");
    if (cmt !== -1 && cmt < rel) continue; // inside a trailing comment
    if (line.slice(0, rel).includes('"')) continue; // inside a string literal
    if (line.includes("axiom-ignore")) continue;
    // The `var` may be on this line or on a following non-blank line (attribute above).
    let decl = line.slice(rel);
    let j = i;
    while (!decl.includes("var ") && j + 1 < n && j - i < 3) {
      j++;
      if (lines[j].trim() === "" || lines[j].includes("axiom-ignore")) {
        decl = "";
        break;
      }
      decl += " " + lines[j].trim();
    }
    if (!/var\s+\w+\s*:\s*\[[^\]:]+\]/.test(decl)) continue; // not a to-many array (to-one/dict)
    if (/\]\s*\?/.test(decl)) continue; // optional to-many — defaults to nil
    const defaultedOnNextLine = j + 1 < n && /^\s*=/.test(lines[j + 1]);
    if (/\]\s*=/.test(decl) || defaultedOnNextLine) continue; // already has a default
    hits.push({ line: i + 1, text: line.trim() });
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

const ISSUE_TERMS = String.raw`(?:migration\s+(?:errors?|failures?|issues?|problems?)|memory leaks?|retain cycles?)\b`;
const NEGATED_ISSUE = new RegExp(String.raw`\b(?:no|without)\s+${ISSUE_TERMS}(?:\s+(?:or|and)\s+${ISSUE_TERMS})*`, "gi");

/** Every skill hint whose pattern matches diagnostic output, in rule order. */
export function bashOutputHints(output: string): string[] {
  if (!output) return [];
  const diagnostics = output.split(/[;\n]|(?<=[.!?])\s+/)
    .map((line) => line.replace(NEGATED_ISSUE, ""))
    .filter((line) => /\b(?:error|warning|failed|failure|detected|unavailable)\b|never called|not available|Unable to simultaneously satisfy constraints|Leaks:|CKError\s*\d/i.test(line));
  return BASH_PATTERN_RULES.filter((r) => diagnostics.some((line) => r.pattern.test(line))).map((r) => r.hint);
}

function isDocumentationCommand(command: string): boolean {
  const tokens = command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[;&|\n<>]+|[^\s;&|<>]+/g) ?? [];
  const groups: { words: string[]; pipeline: boolean }[] = [];
  let words: string[] = [];
  let pipeline = false;
  for (const token of [...tokens, ";"]) {
    if (/^[;&|\n]+$/.test(token)) {
      groups.push({ words, pipeline });
      words = [];
      pipeline = token === "|";
    } else {
      words.push(token.replace(/^(['"])([\s\S]*)\1$/, "$2"));
    }
  }
  const readers = new Set(["cat", "head", "tail", "less", "more", "bat", "nl"]);
  const searches = new Set(["rg", "grep", "sed", "awk"]);
  const inspectors = new Set([...readers, ...searches, "curl", "wget"]);
  const prefixes = new Set(["env", "sudo", "time", "command", "exec"]);
  const optionArguments = new Set(["-u", "--unset", "-C", "--chdir", "-a", "-f", "-g"]);
  let runtime = false;
  let inspection = false;
  for (const group of groups) {
    const commandWords = [...group.words];
    while (commandWords.length) {
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(commandWords[0])) commandWords.shift();
      else if (prefixes.has(commandWords[0].split("/").at(-1) ?? "")) {
        commandWords.shift();
        while (commandWords[0]?.startsWith("-")) {
          const option = commandWords.shift() ?? "";
          if (optionArguments.has(option)) commandWords.shift();
        }
      } else break;
    }
    const program = commandWords[0]?.split("/").at(-1);
    if (!program) continue;
    if (["sh", "bash", "zsh"].includes(program)) {
      runtime = true;
      const index = commandWords.findIndex((word) => /^-[A-Za-z]*c[A-Za-z]*$/.test(word));
      const nested = index >= 0 ? commandWords[index + 1] : undefined;
      if (nested) {
        if (isDocumentationCommand(nested)) return true;
        runtime = true;
      }
      continue;
    }
    if (inspectors.has(program)) {
      let operands: string[] = [];
      let patternProvided = false;
      const patternOptions = new Set(searches.has(program) ? ["-e", "--regexp", "-f", "--file", "--expression"] : []);
      const pairedOptions = new Set([...patternOptions, "-A", "-B", "-C", "--context", "-g", "--glob"]);
      if (["head", "tail"].includes(program)) { for (const option of ["-n", "-c", "--lines", "--bytes"]) pairedOptions.add(option); }
      if (program === "awk") { pairedOptions.add("-F"); pairedOptions.add("-v"); }
      for (let index = 1; index < commandWords.length; index++) {
        const word = commandWords[index];
        if (pairedOptions.has(word)) {
          index++;
          patternProvided ||= patternOptions.has(word);
        } else if (word.startsWith("-")) {
          patternProvided ||= [...patternOptions].some((option) => word.startsWith(`${option}=`));
          patternProvided ||= searches.has(program) && /^-[ef][^-].*/.test(word);
        } else if (!/^[<>]+$/.test(word)) operands.push(word);
      }
      if (searches.has(program) && !patternProvided) operands = operands.slice(1);
      if (operands.length && operands.every((word) => /\.(log|crash|ips)$/.test(word)) && !commandWords.includes("-")) {
        runtime = true;
        continue;
      }
      if (group.pipeline && !operands.length) continue;
      return true;
    }
    if (["echo", "printf"].includes(program) || (program === "git" && commandWords.slice(1).includes("status"))) inspection = true;
    else if (program === "git") return true;
    else if (!["cd", "pwd", "true", "false", ":", "export"].includes(program)) runtime = true;
  }
  return inspection && !runtime;
}

/** A file path off a tool event's input, tolerating either `path` or `filePath`. */
export function inputPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const rec = input as Record<string, unknown>;
  const p = rec.path ?? rec.filePath;
  return typeof p === "string" ? p : undefined;
}

/** Advisory text for the Swift guardrails (@State + @Relationship) in source, or null. */
export function swiftGuardrailWarning(swiftSource: string): string | null {
  const sections: string[] = [];
  const stateHits = unscopedStateVars(swiftSource).slice(0, 3);
  if (stateHits.length) {
    const detail = stateHits.map((h) => `  L${h.line}: ${h.text}`).join("\n");
    sections.push(
      "⚠️ Axiom guardrail: `@State` without an explicit access level " +
        "(use `@State private var` — child views can otherwise create independent " +
        `state copies):\n${detail}`,
    );
  }
  const relHits = unguardedRelationships(swiftSource).slice(0, 3);
  if (relHits.length) {
    const detail = relHits.map((h) => `  L${h.line}: ${h.text}`).join("\n");
    sections.push(
      "⚠️ Axiom guardrail: SwiftData to-many `@Relationship` without a default " +
        `(add \`= []\` — it crashes at runtime when SwiftData reads it):\n${detail}`,
    );
  }
  return sections.length ? sections.join("\n\n") : null;
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
    if (typeof event.input === "object" && event.input !== null) {
      const command = (event.input as Record<string, unknown>).command;
      if (typeof command === "string" && isDocumentationCommand(command)) return null;
    }
    const text = event.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    const hints = bashOutputHints(text);
    return hints.length ? hints.join("\n") : null;
  }
  return null;
}
