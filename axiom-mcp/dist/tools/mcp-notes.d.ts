/**
 * "MCP-only clients:" notes give the MCP form of a CLI instruction in canonical agent and
 * command text, for clients that have the `axiom_<binary>_*` tools but no shell binary:
 * inline after the instruction, as in
 *   `xcsym verify <file>` (MCP-only clients: `axiom_xcsym_verify` with `file`)
 * or as a line after a fenced block or table, one `; `-separated entry per command (a single
 * entry covers every command of its tool). A leaf module with no imports: root scripts load
 * it as `.ts` under bare-node type-stripping, and the MCP server as `./mcp-notes.js`.
 */
/**
 * The text without its notes, for harnesses that run the binaries or render their own MCP form.
 * A note inside a code block is left in place: nothing checks it there, so the checker reports it.
 */
export declare function stripMcpClientNotes(text: string): string;
/** Every recognized note's body outside code blocks, inline and line notes alike, in text order. */
export declare function mcpClientNoteBodies(text: string): string[];
/** "MCP-only clients:" lines nothing strips or checks: inside a code block, or in neither recognized form. */
export declare function unrecognizedMcpClientNotes(text: string): Array<{
    line: string;
    fenced: boolean;
}>;
/**
 * Flags and binary-prefixed env vars (as camelCase) that a wrapped CLI takes but its MCP tools
 * have no param for, because the server supplies or never needs them.
 */
export declare const MCP_IMPLIED_FLAGS: Readonly<Record<string, readonly string[]>>;
export interface NotedMcpTool {
    name: string;
    inputSchema: {
        properties?: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Disagreements between the notes in served agent or command text and the server's
 * `listTools()` schemas: `tools` are the wrapped binaries' tools, `otherTools` every other
 * registered tool. Every wrapped instruction (a backticked command with arguments, or a fenced
 * line) needs its own note naming a wrapped tool, and a bare subcommand name needs some note
 * naming its tool, unless `requireNotes` is false. Every tool a note names must be registered;
 * its params must exist, include its required inputs (given, not `no \`x\``) and hold values its
 * schema allows; and every flag or binary-prefixed env var of the command it follows must map to
 * a param the note names, unless the server implies it. A note that names only params is held to
 * the family of the command before it. One entry per tool covers all of that tool's commands in
 * a block; otherwise entries pair with commands in order. A note in neither recognized form is
 * reported too, since nothing strips or checks it.
 */
export declare function mcpClientNoteMismatches(text: string, tools: NotedMcpTool[], impliedFlags?: Readonly<Record<string, readonly string[]>>, otherTools?: NotedMcpTool[], { requireNotes }?: {
    requireNotes?: boolean;
}): string[];
/**
 * Text for an MCP-only harness: each wrapped command whose note covers it exactly becomes the
 * note's MCP call. An inline note covers the backticked command just before it when every entry
 * names one of that command's tools. A line note covers the fence before it when every entry
 * names a tool and pairs with the fence's wrapped lines one per tool or in order, with each line
 * running one wrapped command and none continued. Anything else is left as is, notes included,
 * for `stripMcpClientNotes` and the harness's own rewrites.
 */
export declare function renderMcpClientNotes(text: string, toolForSubcommand: ReadonlyMap<string, string>): string;
/** The flags the text passes to wrapped commands, in backticked spans and fences, sorted. */
export declare function wrappedCommandFlags(text: string, subcommands: readonly string[]): string[];
export declare function mcpCallMismatches(text: string, tools: NotedMcpTool[]): string[];
export declare const FLAG_EXAMPLES: Readonly<Record<string, string>>;
/**
 * A note for served agent, skill, prompt and resource text that names a wrapped subcommand or a
 * binary with no MCP tool, or '' when it names neither. That text is written for harnesses that
 * run the CLI, and a section-filtered read can miss the reference that maps a CLI call to its
 * MCP tool. It maps only the subcommands the text names that the server registers.
 */
export declare function mcpToolFooter(text: string, toolNames: readonly string[], cliOnly: readonly string[]): string;
