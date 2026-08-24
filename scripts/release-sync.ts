/**
 * Detects release-surface divergence: a version that shipped to plugin users but
 * never reached npm.
 *
 * WHY THIS CAN HAPPEN. Axiom's two distribution surfaces publish by different
 * mechanics:
 *   - Plugin: no publish step at all. `/plugin marketplace add CharlesWiltgen/Axiom`
 *     reads .claude-plugin/marketplace.json off `main`, so pushing the version
 *     bump ships it. Irreversible the moment `git push` lands.
 *   - MCP: a manual `fnox exec -- npm publish --tag latest` (xpublish Step 4).
 *     No CI performs it; there are no GitHub releases.
 *
 * So stopping after xpublish Step 3, or a Step 4 that errors, leaves plugin users
 * upgraded and MCP users behind — with nothing detecting it. Observed on
 * 27.0.0-beta.48: tagged and pushed 2026-08-20, never published to npm, found
 * three days later only because someone went looking.
 *
 * xpublish Step 5 asks the operator to report the npm URL, but asking for a URL
 * is not the same as verifying one resolves. This module verifies.
 */

import { VERSION_RE } from "./version-regex.js";

export const NPM_PACKAGE = "axiom-mcp";

type Parsed = { core: number[]; pre: string[] | null };

function parse(version: string): Parsed | null {
  const v = version.replace(/^v/, "");
  if (!VERSION_RE.test(v)) return null;
  const [core, pre] = v.split("-");
  return { core: core.split(".").map(Number), pre: pre ? pre.split(".") : null };
}

function comparePre(a: string[] | null, b: string[] | null): number {
  // A release outranks any prerelease of the same core version.
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const an = /^\d+$/.test(a[i]);
    const bn = /^\d+$/.test(b[i]);
    if (an && bn) {
      const d = Number(a[i]) - Number(b[i]);
      if (d) return d < 0 ? -1 : 1;
    } else if (an !== bn) {
      return an ? -1 : 1;
    } else if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

/** SemVer precedence, prerelease-aware. Returns <0, 0, or >0. */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) throw new Error(`unparseable version: ${!pa ? a : b}`);
  for (let i = 0; i < 3; i++) {
    const d = pa.core[i] - pb.core[i];
    if (d) return d < 0 ? -1 : 1;
  }
  return comparePre(pa.pre, pb.pre);
}

export type SyncInput = {
  /** Version in claude-code.json — what the repo currently claims to be. */
  canonical: string;
  /** Tags present on the REMOTE. Only these have shipped to plugin users. */
  pushedTags: string[];
  /** Tags that exist only locally. Included for clarity; never counted. */
  localOnlyTags?: string[];
  publishedToNpm: string[];
};

/**
 * Versions that shipped to plugin users but are missing from npm, oldest first.
 *
 * Scoped to tags at or below `canonical`: a tag above it would mean the repo is
 * behind its own releases, which is a different problem, and mid-release the
 * canonical version is legitimately bumped before any tag exists.
 */
export function unpublishedShippedVersions(input: SyncInput): string[] {
  const published = new Set(input.publishedToNpm);
  return input.pushedTags
    .map((t) => t.replace(/^v/, ""))
    .filter((v) => parse(v) !== null)
    .filter((v) => compareVersions(v, input.canonical) <= 0)
    .filter((v) => !published.has(v))
    .sort(compareVersions);
}

export type SyncVerdict = {
  /**
   * Shipped to plugin users, missing from npm, and nothing in flight will fix
   * it — the newest thing plugin users have is not on npm. Fail on these.
   */
  unresolved: string[];
  /**
   * Missing from npm but already below the version being prepared, so the next
   * publish closes the gap (npm users skip straight to it). Worth reporting,
   * not worth blocking — erroring here would break every validation run during
   * the very cycle that fixes it.
   */
  superseded: string[];
};

/**
 * Split the gaps by whether the release in progress resolves them.
 *
 * The test is simply whether CANONICAL itself has shipped:
 *   - canonical is tagged-and-pushed but missing from npm -> UNRESOLVED. Plugin
 *     users have the newest version and npm users cannot get it, and no pending
 *     release will change that.
 *   - canonical is not yet tagged -> every gap below it is SUPERSEDED. Publishing
 *     canonical closes them; npm users leapfrog straight to it.
 */
export function classifyReleaseSync(input: SyncInput): SyncVerdict {
  const missing = unpublishedShippedVersions(input);
  const unresolved = missing.filter(
    (v) => compareVersions(v, input.canonical) === 0,
  );
  return {
    unresolved,
    superseded: missing.filter((v) => !unresolved.includes(v)),
  };
}

/** Live npm versions. Hits the registry directly — `npm view` can serve stale cache. */
export async function fetchPublishedVersions(
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const res = await fetchImpl(`https://registry.npmjs.org/${NPM_PACKAGE}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`registry returned ${res.status}`);
  const body = (await res.json()) as { versions?: Record<string, unknown> };
  return Object.keys(body.versions ?? {});
}
