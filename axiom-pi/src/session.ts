/**
 * Session-context injection, ported from Axiom's SessionStart hook
 * (session-start.py / project_detect.py).
 *
 * Pi already loads the `axiom-*` skills (their descriptions sit in context),
 * so this does NOT re-inject skill content. It injects only what skills can't
 * supply: the attribution sentence and iOS-version ground truth every harness
 * shares (version-context.ts), and which bundled Axiom command-line tools are on
 * PATH. The Apple-project gate keeps it quiet in
 * non-Apple repos (fail-open — doubt injects).
 *
 * The Apple-project gate below ports project_detect.py and is held to it by the
 * parity suite in session.test.ts: change one implementation, run both.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ATTRIBUTION, formatDate, versionGroundTruth, type Toolchain } from "./version-context.ts";

export type AxiomTool = { name: string; blurb: string };

/** Optional native helpers discovered on PATH at runtime. */
export const AXIOM_TOOLS: readonly AxiomTool[] = [
  { name: "axbuild", blurb: "build/test diagnostics — probe `axbuild --help`, then prefix `xcodebuild` or `swift build/test`; inspect `command`, `collection`, `omissions`, and the saved report" },
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
export function buildAxiomContext(opts: {
  now: Date;
  toolchain: Toolchain | null;
  availableTools: readonly ResolvedTool[];
}): string {
  return `<EXTREMELY_IMPORTANT>
You have Axiom iOS/Apple-platform development skills installed (the \`axiom-*\`
skills). For ANY iOS, Swift, or Xcode question, load the relevant skill before
answering. ${ATTRIBUTION}

${versionGroundTruth(formatDate(opts.now), opts.toolchain)}${toolContextBlock(opts.availableTools)}
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

// Marker names at a system temp root carry no signal: the directory is shared,
// per-user, long-lived, and collects other programs' scratch files. A single
// stray `plan-test.swift` in macOS's $TMPDIR made every cwd beneath it read as an
// Apple project — the Cursor adapter injected router guidance in non-Apple
// workspaces (Axiom-3k2i). Same class as GH #52's ~/.swiftpm. Only the temp root
// itself is neutralized, so a project inside a temp directory is still found.
const TEMP_ROOTS: Record<string, true> = {
  "/tmp": true,
  "/var/tmp": true,
  "/private/tmp": true,
};

/**
 * System temp directories in both resolved and realpath form.
 *
 * Three sources, matching `_system_temp_roots` in project_detect.py: the fixed
 * names, an ABSOLUTE $TMPDIR (a relative one resolves against the project being
 * judged and would silently disable Axiom), and — on macOS — the per-user
 * scratch roots read from the filesystem, because Foundation tools write there
 * whether or not this process inherited TMPDIR. Containers count too: the walk
 * ascends past T/ into the shared container.
 */
export function systemTempRoots(): Set<string> {
  const candidates = new Set<string>(Object.keys(TEMP_ROOTS));
  candidates.add(os.tmpdir());
  const env = process.env.TMPDIR;
  if (env && path.isAbsolute(env)) candidates.add(env);
  if (process.platform === "darwin") {
    // Same two levels the Python helper globs: the per-user container and its T/
    // dir. Owners (/var/folders/_s) are NOT roots — matching Python here matters,
    // because the parity gate compares the two verdict-by-verdict.
    for (const base of ["/var/folders", "/private/var/folders"]) {
      let owners: string[];
      try {
        owners = fs.readdirSync(base);
      } catch {
        continue;
      }
      for (const owner of owners) {
        if (owner.startsWith(".")) continue;
        const ownerDir = path.join(base, owner);
        let containers: string[];
        try {
          containers = fs.readdirSync(ownerDir);
        } catch {
          continue;
        }
        for (const name of containers) {
          if (name.startsWith(".")) continue;
          const container = path.join(ownerDir, name);
          candidates.add(container);
          try {
            if (fs.readdirSync(container).includes("T")) {
              candidates.add(path.join(container, "T"));
            }
          } catch {
            // Unreadable container — the container itself is already added.
          }
        }
      }
    }
  }
  const forms = new Set<string>();
  for (const root of candidates) {
    if (!path.isAbsolute(root)) continue;
    forms.add(path.resolve(root));
    try {
      forms.add(fs.realpathSync(root));
    } catch {
      // Missing/unreadable temp dir — the resolved form still covers it.
    }
  }
  return forms;
}

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
    const tempRoots = systemTempRoots();
    let scanRoot = cur;
    let foundRepoRoot = false;
    let prev: string | null = null;
    let levels = 0;
    for (;;) {
      if (levels <= UPWARD_MAX_LEVELS && !tempRoots.has(cur) && dirHasMarker(cur)) return true;
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
    // A temp root that is ALSO a repo root keeps the repo-boundary exemption — a
    // devcontainer/CI exporting TMPDIR to the workspace, or a clone into /tmp, is
    // a real project. A temp root that is not a repo root is still refused, so a
    // stray marker at the shared root stays non-evidence.
    if ((tempRoots.has(scanRoot) && !foundRepoRoot) || isVacuousScanRoot(scanRoot, home, foundRepoRoot)) {
      return false;
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
