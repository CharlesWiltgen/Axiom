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
