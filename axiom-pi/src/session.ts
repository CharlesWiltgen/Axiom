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

/**
 * True if `name` identifies an Apple project.
 *
 * HIDDEN entries never count. A dot-prefixed marker is tool state, not a
 * project: SwiftPM creates ~/.swiftpm (cache/, configuration/, security/) on any
 * machine where it has run, and ".swiftpm" ends with a marker suffix. That made
 * $HOME — and every non-git directory under it, since the upward walk checks
 * markers at each ancestor — read as an Apple project on every Apple developer's
 * machine (GH #52). Nothing real is lost: a package's own <pkg>/.swiftpm always
 * sits beside a visible Package.swift.
 */
function isMarker(name: string): boolean {
  if (name.startsWith(".")) return false;
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
      // Hidden dirs are skipped, not merely unnamed as markers: the ~/.swiftpm
      // cache holds CLONED PACKAGES, each with a visible Package.swift, so
      // descending would re-break the fix one level down — and burn entries
      // toward the fail-open cap.
      if (depth < DOWNWARD_MAX_DEPTH && !e.name.startsWith(".") && !PRUNE_DIRS.has(e.name)) {
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

/**
 * True when "does this contain an Apple project?" is a meaningless question.
 *
 * A home directory and the top of the filesystem contain EVERYTHING, so a
 * containment scan rooted there finds SOME project — or trips MAX_ENTRIES and
 * fails open — regardless of what the session is about. $HOME is what GH #52
 * reported; `/`, `/Users`, `/tmp`, and `/Volumes` are the same defect one level
 * up. Depth, not a denylist, so no list of special paths needs maintaining.
 * Direct markers are checked before this and still win.
 */
export function isVacuousScanRoot(dir: string, home: string | null, isRepoRoot: boolean): boolean {
  if (home !== null && dir === home) return true;
  // A .git directory IS a project boundary, so containment is meaningful even at
  // a shallow path — a repo at a container workdir (/app, /workspace, /src) with
  // markers in a subdir must not be silenced.
  const depth = dir.split(path.sep).filter(Boolean).length;
  // The filesystem root is never a project root, `git init /` notwithstanding —
  // without this floor the repo exemption re-opens the scan of / that the depth
  // rule exists to prevent.
  if (depth === 0) return true;
  if (isRepoRoot) return false;
  return depth <= 1;
}

/** True if `start` is inside, or contains, an Apple project. Errors → fail-open. */
export function isAppleProject(start: string): boolean {
  try {
    let cur = path.resolve(start);
    if (!fs.existsSync(cur) || !fs.statSync(cur).isDirectory()) return true;
    const home = process.env.HOME ? path.resolve(process.env.HOME) : null;
    let scanRoot = cur;
    let foundRepoRoot = false;
    let prev: string | null = null;
    let levels = 0;
    for (;;) {
      if (levels <= UPWARD_MAX_LEVELS && dirHasMarker(cur)) return true;
      if (fs.existsSync(path.join(cur, ".git"))) {
        // A .git at $HOME (dotfiles repo) must NOT widen the scan root: that hands
        // the whole home directory to the vacuous-root check, which refuses —
        // silently disabling Axiom for every real project under ~ whose markers
        // sit in a subdirectory. Stop ascending, keep the original scan root.
        if (home === null || cur !== home) {
          scanRoot = cur;
          foundRepoRoot = true;
        } else if (prev !== null) {
          // $HOME is the repo root (dotfiles). Scanning all of ~ is the GH #52
          // bug; scanning from a deep cwd misses a marker sitting up-and-over.
          // The branch of ~ we came through is both.
          scanRoot = prev;
        }
        break;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      if (home !== null && cur === home) break;
      prev = cur;
      levels++;
      cur = parent;
    }
    if (isVacuousScanRoot(scanRoot, home, foundRepoRoot)) return false;
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
