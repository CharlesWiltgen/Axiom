/**
 * Single source of truth for the Go tool binaries the MCP server ships in
 * `dist/bin`. The bundler (`scripts/bundle.ts`) copies these plus the
 * `MCP_WORKFLOW_BINARIES` (together `MCP_PACKAGED_BINARIES`) and hard-fails if
 * any is missing. Any MCP tool that resolves a binary under `dist/bin/` MUST
 * list it here — the coverage test (`scripts/bundle.test.ts`) and pre-deploy
 * step 12h enforce that this list matches the names `src/tools/*.ts` resolve
 * (`resolveToolPath('<name>', …)`), so the bundler can never silently drift
 * from the tools that actually need a binary.
 *
 * `xcprof`, `xclog`, and `xcsym` are exposed over MCP. `xcui` is a Claude-Code-plugin
 * tool that doesn't have an MCP wrapper yet (tracked in axiom-x72g), so it is
 * intentionally NOT bundled here — adding one means writing its MCP tool wrapper
 * AND adding it to this list (the coverage test will fail until both are done).
 */
export const MCP_TOOL_BINARIES = ['xcprof', 'xclog', 'xcsym'];
/**
 * The MCP tools each wrapped binary registers, in `listTools()` order. The providers read their
 * names from here, and root scripts (the Cursor build) derive their CLI-to-tool maps from it, so
 * adding a tool or a family is one edit; `providers.test.ts` holds it to the live registrations.
 */
export const MCP_TOOL_NAMES = {
    xclog: ['axiom_xclog_launch', 'axiom_xclog_attach', 'axiom_xclog_show', 'axiom_xclog_list'],
    xcsym: [
        'axiom_xcsym_crash',
        'axiom_xcsym_triage',
        'axiom_xcsym_resolve',
        'axiom_xcsym_find_dsym',
        'axiom_xcsym_list_dsyms',
        'axiom_xcsym_verify',
        'axiom_xcsym_anonymize',
    ],
    xcprof: ['axiom_xcprof_doctor', 'axiom_xcprof_analyze', 'axiom_xcprof_compare', 'axiom_xcprof_record'],
};
/** Read-only CLI used by distributed project-inspection workflows; no MCP wrapper. */
export const MCP_WORKFLOW_BINARIES = ['xcproject'];
export const MCP_PACKAGED_BINARIES = [...MCP_TOOL_BINARIES, ...MCP_WORKFLOW_BINARIES];
/** Binaries the plugin runs that have no MCP tool; the served footer tells MCP clients so. */
export const CLI_ONLY_BINARIES = ['axbuild', 'xcui', ...MCP_WORKFLOW_BINARIES];
