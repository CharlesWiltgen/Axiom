/**
 * Guards that stop a check from printing ✓ over an empty or partial walk
 * (Axiom-nta1). The floor comes from an independent source where one exists:
 * git's tracked files, which a walk of the same tree must at least cover.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Returns a guard that records an error through `report` when a check examined
 * fewer items than `min` (at least 1), and says whether the check may report
 * success.
 */
export function examinedGuard(report: (check: string, msg: string) => void) {
  return (check: string, what: string, count: number, min = 1): boolean => {
    const floor = Math.max(min, 1);
    if (count >= floor) return true;
    report(check, `examined ${count} ${what}, expected at least ${floor}, so this check can't vouch for anything`);
    return false;
  };
}

/** Tracked files under `root` that exist on disk, or null when `root` isn't a git checkout or git can't run. */
export function trackedFilesIn(root: string): string[] | null {
  try {
    // A conflicted path is listed once per stage; count it once.
    const listed = new Set(
      execFileSync("git", ["ls-files", "-z"], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      }).split("\0"),
    );
    return [...listed].filter((f) => f && fs.existsSync(path.join(root, f)));
  } catch {
    // Not a checkout (a tarball, an export) or no git: the caller reports it once
    // and falls back to floors of 1, rather than crashing mid-run.
    return null;
  }
}
