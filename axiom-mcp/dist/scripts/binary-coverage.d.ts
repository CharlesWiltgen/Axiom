/** Names like `xcprof` that a tool module resolves under the package's `dist/bin/`. */
export declare function scanReferencedToolBinaries(toolsDir: string): Set<string>;
/** A wrapped tool as `listTools()` reports it; only the fields the reference check reads. */
export interface ReferencedMcpTool {
    name: string;
    inputSchema: {
        properties?: Record<string, unknown>;
        required?: string[];
    };
}
/** The `## Invocation` section of a CLI reference, without its heading. */
export declare function invocationSection(reference: string): string;
/**
 * Disagreements between a CLI reference's Invocation section and the MCP tools wrapping
 * that CLI, read from `listTools()` so a renamed, added or newly required param fails here.
 *
 * The table is the only place a flag may map to a param: one row per registered tool,
 * `| \`<binary> <subcommand> …\` | \`tool\` | inputs | flags |`. Inputs name every required
 * param; flags is `—` or a comma list of `` `--flag`→`param` `` items whose param is the
 * flag in camelCase unless a parenthetical explains the difference. Between them the row
 * must name every param the tool has and nothing it lacks, because a model maps flags onto
 * the tool it is calling and the server drops unknown params silently.
 *
 * Prose is checked per clause (split at `.`, `;`, `!`, `?`). A clause's subcommands are the
 * subcommands or tool names it backticks, else those of the latest clause in its paragraph
 * that named any. Each backticked param must belong to every subject (`no \`param\`` denies
 * it instead); with no subject, a param only some tools have is reported as unattributed,
 * and a clause that names a subcommand may not name a lowerCamel word that is neither a
 * param nor a param's enum value.
 * A Pi bullet must check `command -v`.
 */
export declare function referenceMismatches(binary: string, reference: string, tools: ReferencedMcpTool[]): string[];
