/**
 * Single source of truth for the Go tool binaries the MCP server ships in
 * `dist/bin`. The bundler (`scripts/bundle.ts`) copies exactly these and
 * hard-fails if any is missing. Any MCP tool that `execFile`s `bin/<name>`
 * MUST list its binary here — the coverage test (`scripts/bundle.test.ts`)
 * and pre-deploy step 12h enforce that this list matches the `bin/<name>`
 * references across `src/tools/*.ts`, so the bundler can never silently drift
 * from the tools that actually need a binary.
 *
 * `xcprof`, `xclog`, and `xcsym` are exposed over MCP. `xcui` is a Claude-Code-plugin
 * tool that doesn't have an MCP wrapper yet (tracked in axiom-x72g), so it is
 * intentionally NOT bundled here — adding one means writing its MCP tool wrapper
 * AND adding it to this list (the coverage test will fail until both are done).
 */
export const MCP_TOOL_BINARIES = ['xcprof', 'xclog', 'xcsym'] as const;

export type McpToolBinary = (typeof MCP_TOOL_BINARIES)[number];
