/**
 * Derived-artifact staleness — pure decision logic.
 *
 * pre-deploy.ts guards two derived artifacts (the MCP bundle, §12b; the Codex
 * variant, §12f) against being shipped out of sync with the skill/agent/command
 * sources. The cheap signal is mtime: if any source `.md` is newer than the
 * built artifact, the artifact *might* be stale.
 *
 * But mtime is a leaky proxy for "content changed". `git checkout`, stash,
 * rebase, and `restore` all rewrite files byte-for-byte identically with fresh
 * mtimes, so a pure mtime check false-positives on no-op git operations — which
 * is exactly the documented "trap" this module exists to retire.
 *
 * Hybrid resolution: mtime stays the fast pre-filter. When it trips, the caller
 * runs ONE `git status` and passes the results here. If the newer-than-artifact
 * sources are git-clean (content still matches the committed baseline the
 * artifact was built from), it's mtime skew, not staleness. If any are
 * modified/untracked, it's a real change. If git is unavailable, fall back to
 * the conservative mtime verdict so a genuinely stale artifact never ships.
 *
 * This module is I/O free. The caller (pre-deploy.ts) does the fs walk and the
 * git call. Tests in staleness.test.ts exercise these functions.
 */

/**
 * Parse `git status --porcelain` output into the set of dirty/untracked paths
 * (repo-relative, matching git's own output). Each record is `XY <path>`; a
 * rename (`R  old -> new`) contributes its destination; git quotes paths with
 * spaces, so those are unquoted.
 *
 * Assumes the caller ran git with `-c core.quotepath=false`, so non-ASCII
 * paths arrive as literal UTF-8 (not octal-escaped). The ` -> ` split assumes
 * git's rename format — a non-rename file literally containing ` -> ` would
 * mis-parse, but that can't occur for skill/agent/command filenames.
 */
export function parsePorcelain(porcelain: string): Set<string> {
  const dirty = new Set<string>();
  for (const line of porcelain.split("\n")) {
    if (line.trim() === "") continue;
    let p = line.slice(3); // strip the 2 status chars + separating space
    const arrow = p.indexOf(" -> ");
    if (arrow !== -1) p = p.slice(arrow + 4); // rename → destination path
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
    dirty.add(p);
  }
  return dirty;
}

export interface StalenessInput {
  /** Source files newer than the artifact by mtime (repo-relative). */
  newerFiles: string[];
  /** The subset of `newerFiles` that git reports modified/untracked. */
  dirtyFiles: string[];
  /** Whether the `git status` call succeeded. */
  gitAvailable: boolean;
}

export interface StalenessVerdict {
  stale: boolean;
  /** Human-readable explanation for the pass/fail line. */
  reason: string;
}

/**
 * Decide whether a derived artifact is genuinely stale, given the mtime
 * pre-filter results (`newerFiles`) and the git content confirmation
 * (`dirtyFiles`, `gitAvailable`). See module docstring for the rationale.
 */
export function resolveStaleness(input: StalenessInput): StalenessVerdict {
  const { newerFiles, dirtyFiles, gitAvailable } = input;

  if (newerFiles.length === 0) {
    return { stale: false, reason: "no source newer than artifact" };
  }

  if (!gitAvailable) {
    return {
      stale: true,
      reason: `${newerFiles.length} source file(s) newer than artifact; git unavailable to confirm content`,
    };
  }

  if (dirtyFiles.length === 0) {
    return {
      stale: false,
      reason: `${newerFiles.length} source file(s) have newer mtimes but content matches HEAD (git-clean) — mtime skew, not a real change`,
    };
  }

  return {
    stale: true,
    reason: `${dirtyFiles.length} source file(s) changed since the artifact was built`,
  };
}

/** One Go module's shipped binary and the sources it is built from. */
export interface GoToolInput {
  /** Module (and binary) name, e.g. "xcui". */
  tool: string;
  /** mtime of the committed `bin/<tool>`, or null when it is absent. */
  binaryMtimeMs: number | null;
  /** Whether git sees the committed binary's BYTES as changed (rebuilt but not yet committed). */
  binaryDirty: boolean;
  /** Every file in the module that `go build` reads: *.go plus go.mod/go.sum. */
  sources: { path: string; mtimeMs: number }[];
  /**
   * Compiled files git reports as DELETED. They cannot appear in `sources` — the
   * fs walk can only list files that still exist — so a deletion would otherwise
   * be invisible, though it changes the build as surely as an edit.
   */
  deletedSources?: string[];
  /** Compiled files STAGED for the next commit (empty outside a commit). */
  stagedSources?: string[];
  /** Whether the binary is staged alongside them. */
  binaryStaged?: boolean;
}

export interface GoToolVerdict {
  tool: string;
  state: "ok" | "stale" | "missing-binary" | "binary-not-staged";
  reason: string;
}

/**
 * Decides, per Go tool, whether the committed binary still matches its source.
 *
 * The binary is what ships — the plugin, the MCP bundle, and the Codex/Cursor
 * variants all carry `bin/<tool>`, never the source. So a Go edit whose binary
 * was not rebuilt ships the OLD tool while the repo and the skills document the
 * new behavior, and every other gate stays green: the source compiles, its tests
 * pass, and the binary is present and correctly listed.
 *
 * Two complementary clauses, because neither alone is enough:
 *
 *   1. CONTENT — a compiled source is dirty while the binary's bytes still match
 *      HEAD. A rebuild changes those bytes, so a clean binary beside edited source
 *      means the rebuild never happened. This is the clause `touch bin/<tool>`
 *      cannot beat: touching a file changes its mtime, not what git sees.
 *      (With git unavailable this clause is skipped and only clause 2 applies.)
 *   1b. STAGED — the gate reads the working tree, but what ships is HEAD. Source
 *      staged without the rebuilt binary lands a commit whose source and binary
 *      disagree, which both worktree clauses read as green.
 *   2. MTIME — the resolveStaleness hybrid (mtime pre-filters, git dirtiness
 *      confirms), which catches the case clause 1 misses: a binary rebuilt once
 *      (so already dirty) and then left behind by a further source edit.
 *
 * A fresh clone trips neither: everything looks newer, nothing is dirty.
 *
 * `_test.go` is excluded deliberately — `go build` ignores it, so a test-only
 * edit leaves the shipped binary correct, and flagging it would teach the reader
 * to re-commit a multi-megabyte binary for a change it cannot contain.
 */
export function resolveGoBinaryStaleness(
  tools: GoToolInput[],
  dirty: Set<string>,
  gitAvailable: boolean,
): GoToolVerdict[] {
  return tools.map((tool) => {
    if (tool.binaryMtimeMs === null) {
      return {
        tool: tool.tool,
        state: "missing-binary" as const,
        reason: "no committed bin/" + tool.tool + " — the module exists but nothing ships it",
      };
    }
    const compiled = tool.sources.filter((s) => !s.path.endsWith("_test.go"));
    const deleted = (tool.deletedSources ?? []).filter((p) => !p.endsWith("_test.go"));
    const changedCount = compiled.filter((s) => dirty.has(s.path)).length + deleted.length;
    if (gitAvailable && changedCount > 0 && !tool.binaryDirty) {
      return {
        tool: tool.tool,
        state: "stale" as const,
        reason:
          `${changedCount} source file(s) changed but bin/${tool.tool} was not rebuilt ` +
          `(the committed binary still matches HEAD)`,
      };
    }
    const stagedCompiled = (tool.stagedSources ?? []).filter((p) => !p.endsWith("_test.go"));
    if (stagedCompiled.length > 0 && tool.binaryStaged === false) {
      return {
        tool: tool.tool,
        state: "binary-not-staged" as const,
        reason:
          `${stagedCompiled.length} source file(s) staged for commit without bin/${tool.tool} — ` +
          `the commit would ship the previous binary`,
      };
    }
    const newerFiles = compiled
      .filter((s) => s.mtimeMs > (tool.binaryMtimeMs as number))
      .map((s) => s.path);
    const verdict = resolveStaleness({
      newerFiles,
      dirtyFiles: newerFiles.filter((f) => dirty.has(f)),
      gitAvailable,
    });
    return {
      tool: tool.tool,
      state: verdict.stale ? ("stale" as const) : ("ok" as const),
      reason: verdict.reason,
    };
  });
}
