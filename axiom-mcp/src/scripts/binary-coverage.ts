/**
 * Shared scanner: which Go tool binaries do the MCP tools resolve under `bin/`?
 *
 * Build/validation tooling (lives beside bundle.ts, not in src/tools/ where the
 * runtime tool wrappers live). Imported by the bundler coverage test
 * (`bundle.test.ts`, same dir → `./binary-coverage.js`) and by root pre-deploy
 * step 12h (`scripts/pre-deploy.ts`, cross-package → `.ts` extension, since that
 * script runs under bare-node type-stripping, not tsc/vitest). One scanner so the
 * two guards can't drift. Result is compared against `MCP_TOOL_BINARIES`
 * (tools/binaries.ts) to catch a tool that needs a binary the bundler won't ship,
 * or a listed binary no tool uses.
 *
 * Detection matches a binary NAME written as a string literal at the resolve site:
 *   resolveToolPath('<name>', …)  — shared-helper form (xcprof/xclog/xcsym use
 *                                   this; the join('bin',name) lives in
 *                                   binary-exec.ts with name as a VARIABLE, so
 *                                   the literal must appear at each call site)
 *   join(..., 'bin', '<name>')   — segment-pair form (raw resolve, pre-helper)
 *   '<...>/bin/<name>'           — single-literal path form (a leading '/' or
 *                                  start-of-literal is required, so '.bin/x'
 *                                  paths like node_modules/.bin do NOT match)
 * A name held in a variable (`resolveToolPath(BIN, …)` / `join(dir, 'bin', BIN)`)
 * is intentionally NOT detected: the convention is to pass the binary name as a
 * literal at the resolve site so coverage stays statically verifiable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// First char allows A-Z too: a capitalized binary name would otherwise be
// silently dropped (the dangerous direction — a tool resolves a binary the
// bundler never ships). Names are lowercase by convention; this is a guard.
const RESOLVE_CALL = /resolveToolPath\(\s*['"`]([A-Za-z][\w-]*)['"`]/g;
const SEGMENT_PAIR = /['"`]bin['"`]\s*,\s*['"`]([A-Za-z][\w-]*)['"`]/g;
const PATH_LITERAL = /['"`](?:[^'"`]*\/)?bin\/([A-Za-z][\w-]*)['"`]/g;

/** Names like `xcprof` that a tool module resolves under `bin/`. */
export function scanReferencedToolBinaries(toolsDir: string): Set<string> {
  const referenced = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'binaries.ts') {
      continue;
    }
    const src = readFileSync(join(toolsDir, file), 'utf-8');
    for (const m of src.matchAll(RESOLVE_CALL)) referenced.add(m[1]);
    for (const m of src.matchAll(SEGMENT_PAIR)) referenced.add(m[1]);
    for (const m of src.matchAll(PATH_LITERAL)) referenced.add(m[1]);
  }
  return referenced;
}
