// Shared version-format pattern for Axiom's release tooling.
//
// Accepts `X.Y.Z` with an optional `-beta.N` / `-rc.N` prerelease suffix
// (beta and rc only — no alpha, no arbitrary identifiers). Kept in one place so
// the three JS/TS sites that must agree cannot drift:
//   - set-version.js  — input validation (anchored) AND the config.ts footer WRITE
//   - pre-deploy.ts   — the config.ts footer PARSE for the version-parity gate
//
// scripts/qa-check.sh has its own bash copy of this pattern (it can't import JS);
// keep it in sync by hand if this changes.
export const VERSION_CORE = String.raw`\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?`;
export const VERSION_RE = new RegExp(`^${VERSION_CORE}$`);
