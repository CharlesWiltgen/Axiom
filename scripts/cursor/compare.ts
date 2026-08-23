import fs from "node:fs";
import path from "node:path";

export interface DirectoryComparison {
  added: string[];
  removed: string[];
  changed: string[];
}

/** Stable, locale-independent ordering for generated Cursor paths. */
export function compareCursorPaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

interface ComparedFile {
  content: Buffer;
  mode: number;
}

function filesIn(directory: string): Map<string, ComparedFile> {
  const files = new Map<string, ComparedFile>();
  const visit = (current: string, prefix: string): void => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`symlinked comparison input: ${current}`);
    if (!stat.isDirectory()) throw new Error(`comparison input is not a directory: ${current}`);
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => compareCursorPaths(a.name, b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.posix.join(prefix, entry.name);
      const entryStat = fs.lstatSync(absolute);
      if (entryStat.isSymbolicLink()) throw new Error(`symlinked comparison input: ${relative}`);
      if (entryStat.isDirectory()) visit(absolute, relative);
      else if (entryStat.isFile()) {
        files.set(relative, {
          content: fs.readFileSync(absolute),
          mode: entryStat.mode & 0o777,
        });
      }
      else throw new Error(`unsupported comparison input: ${relative}`);
    }
  };
  visit(directory, "");
  return files;
}

/** Compare directory bytes and modes, reporting actual-only, expected-only, and changed paths. */
export function compareDirectories(expected: string, actual: string): DirectoryComparison {
  const wanted = filesIn(expected);
  const observed = filesIn(actual);
  const added = [...observed.keys()].filter((file) => !wanted.has(file)).sort(compareCursorPaths);
  const removed = [...wanted.keys()].filter((file) => !observed.has(file)).sort(compareCursorPaths);
  const changed = [...wanted.keys()]
    .filter((file) => {
      const expectedFile = wanted.get(file)!;
      const actualFile = observed.get(file);
      return actualFile !== undefined
        && (expectedFile.mode !== actualFile.mode || !expectedFile.content.equals(actualFile.content));
    })
    .sort(compareCursorPaths);
  return { added, removed, changed };
}
