/**
 * Session-context injection, ported from Axiom's SessionStart hook
 * (session-start.py / project_detect.py).
 *
 * Pi already loads the `axiom-*` skills (their descriptions sit in context),
 * so this does NOT re-inject skill content. It injects only what skills can't
 * supply: the iOS-version behavioral ground truth, and which bundled Axiom
 * command-line tools are on PATH. The Apple-project gate keeps it quiet in
 * non-Apple repos (fail-open — doubt injects).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Sunday, 2026-06-14" in local time, matching the Claude hook's stamp. */
export function formatDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${WEEKDAYS[now.getDay()]}, ${y}-${m}-${d}`;
}

/** iOS/Xcode version ground truth + behavioral rules (additive, never asserts a cutoff). */
export function iosGroundTruth(now: Date): string {
  return `## iOS / Xcode VERSION GROUND TRUTH (Current date: ${formatDate(now)})

iOS 26 is the current major line — Apple went straight from iOS 18 to iOS 26 at
WWDC 2025; the in-between majors (19-25) were never released. Xcode 26 ships with
it. A newer major may have shipped since your training cutoff — don't assume 26 is
still the latest.

BEHAVIORAL RULES:
1. NEVER claim an iOS/Xcode version "doesn't exist" or is "wrong" because it
   postdates your training — that includes iOS 26 and anything above it.
2. NEVER state which iOS/Xcode version is "current" or "latest" from training
   alone — defer to Axiom skills, or check https://support.apple.com/en-us/123075.
3. For iOS-version or new-API questions, load the relevant Axiom skill first
   (axiom-apple-docs, axiom-swiftui) — they carry WWDC 2025+ documentation.
4. Before giving OS-version-specific advice, establish the user's DEPLOYMENT TARGET.
   Advice for a newer OS than the target can name APIs the user cannot ship. For any
   API marked new in a newer cycle, give the \`@available\`/\`#available\` gate and the
   pre-cycle fallback — not just the new path.

This is a behavioral instruction grounded in Apple's release history, not a claim
about your training data.`;
}

export type AxiomTool = { name: string; blurb: string };

/** The four command-line tools Axiom ships. Detected on PATH at runtime. */
export const AXIOM_TOOLS: readonly AxiomTool[] = [
  { name: "xclog", blurb: "simulator console capture — `xclog list`, `xclog launch <bundle-id> --timeout 30s`" },
  { name: "xcsym", blurb: "crash symbolication — `xcsym crash <file>`, `xcsym verify <file>`" },
  { name: "xcui", blurb: "scriptable sim UI & accessibility — `xcui doctor`, `xcui assert`, `xcui voiceover`" },
  { name: "xcprof", blurb: "structured xctrace capture/analysis — `xcprof record`, `xcprof analyze`, `xcprof compare`" },
];

/** True if `p` is an executable regular file (not a directory or non-exec file). */
function isExecutableFile(p: string): boolean {
  try {
    if (!fs.statSync(p).isFile()) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** First directory on PATH holding an executable `name`, or null. Predicate injectable for tests. */
export function findOnPath(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  isExecutable: (p: string) => boolean = isExecutableFile,
): string | null {
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (dir && isExecutable(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}

export type ResolvedTool = { name: string; blurb: string; resolvedPath: string };

/** Markdown block listing the Axiom tools found on PATH, or "" when none. */
export function toolContextBlock(available: readonly ResolvedTool[]): string {
  if (available.length === 0) return "";
  const lines = available.map((t) => `- **${t.name}** (\`${t.resolvedPath}\`): ${t.blurb}`).join("\n");
  return `\n\n---\n\n**Axiom command-line tools on your PATH** — call them via \`bash\`:\n${lines}`;
}

/** The full `<EXTREMELY_IMPORTANT>` context block injected before each turn. */
export function buildAxiomContext(opts: { now: Date; availableTools: readonly ResolvedTool[] }): string {
  return `<EXTREMELY_IMPORTANT>
You have Axiom iOS/Apple-platform development skills installed (the \`axiom-*\`
skills). For ANY iOS, Swift, or Xcode question, load the relevant skill before
answering.

${iosGroundTruth(opts.now)}${toolContextBlock(opts.availableTools)}
</EXTREMELY_IMPORTANT>`;
}

// --- Apple-project gate (port of project_detect.py) ------------------------
// Cardinal sin is a false negative (a real Apple project read as non-Apple →
// Axiom silently off), so every path fails OPEN (inject) on doubt or error.

const APPLE_MARKER_SUFFIXES = [".xcodeproj", ".xcworkspace", ".swiftpm", ".playground", ".swift"];
const APPLE_MARKER_NAMES = new Set(["Podfile"]);
const PRUNE_DIRS = new Set([
  "node_modules", ".git", "build", ".build", "Pods", "DerivedData", "dist",
  "target", ".venv", "venv", "vendor", "Carthage", ".gradle", "__pycache__", "out",
  "Intermediate", "Binaries", "Saved", "DerivedDataCache", // Unreal
  "Library", "Temp", "Obj", // Unity
]);
const UPWARD_MAX_LEVELS = 6;
const DOWNWARD_MAX_DEPTH = 4;
const MAX_ENTRIES = 10_000;

function isMarker(name: string): boolean {
  return APPLE_MARKER_NAMES.has(name) || APPLE_MARKER_SUFFIXES.some((s) => name.endsWith(s));
}

function dirHasMarker(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(isMarker);
  } catch {
    return false;
  }
}

/** Bounded, pruned DFS for an Apple marker. Entry-cap hit → fail-open (true). */
function downwardHasMarker(root: string): boolean {
  let seen = 0;
  const stack: Array<[string, number]> = [[root, 0]];
  while (stack.length) {
    const [dir, depth] = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++seen > MAX_ENTRIES) return true;
      if (isMarker(e.name)) return true;
      if (depth < DOWNWARD_MAX_DEPTH && !PRUNE_DIRS.has(e.name)) {
        let isDir = false;
        try {
          isDir = e.isDirectory();
        } catch {
          isDir = false;
        }
        if (isDir) stack.push([path.join(dir, e.name), depth + 1]);
      }
    }
  }
  return false;
}

/** True if `start` is inside, or contains, an Apple project. Errors → fail-open. */
export function isAppleProject(start: string): boolean {
  try {
    let cur = path.resolve(start);
    if (!fs.existsSync(cur) || !fs.statSync(cur).isDirectory()) return true;
    const home = process.env.HOME ? path.resolve(process.env.HOME) : null;
    let scanRoot = cur;
    let levels = 0;
    for (;;) {
      if (levels <= UPWARD_MAX_LEVELS && dirHasMarker(cur)) return true;
      if (fs.existsSync(path.join(cur, ".git"))) {
        scanRoot = cur;
        break;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      if (home !== null && cur === home) break;
      levels++;
      cur = parent;
    }
    return downwardHasMarker(scanRoot);
  } catch {
    return true;
  }
}

/**
 * Whether to inject Axiom context. `AXIOM_SESSION_CONTEXT`: "never" → skip,
 * "always" → inject without scanning, anything else → auto-detect.
 */
export function resolveContextDecision(cwd: string, override: string | undefined): boolean {
  const o = (override || "").trim().toLowerCase();
  if (o === "never") return false;
  if (o === "always") return true;
  return isAppleProject(cwd);
}
