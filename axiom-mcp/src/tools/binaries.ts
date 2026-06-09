/**
 * Single source of truth for the Go tool binaries the MCP server ships in
 * `dist/bin`. The bundler (`scripts/bundle.ts`) copies exactly these and
 * hard-fails if any is missing. Any MCP tool that `execFile`s `bin/<name>`
 * MUST list its binary here — the coverage test (`scripts/bundle.test.ts`)
 * and pre-deploy step 12h enforce that this list matches the `bin/<name>`
 * references across `src/tools/*.ts`, so the bundler can never silently drift
 * from the tools that actually need a binary.
 *
 * Today only `xcprof` is exposed over MCP. `xclog`/`xcsym`/`xcui` are
 * Claude-Code-plugin tools without MCP wrappers, so they are intentionally NOT
 * bundled here — adding one means writing its MCP tool wrapper AND adding it to
 * this list (the coverage test will fail until both are done).
 */
export const MCP_TOOL_BINARIES = ['xcprof'] as const;

export type McpToolBinary = (typeof MCP_TOOL_BINARIES)[number];
