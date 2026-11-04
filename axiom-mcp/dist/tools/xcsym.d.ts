import type { Config, Logger } from '../config.js';
import type { BinaryToolProvider, McpTool, ToolResponse } from './handler.js';
import { type BinaryExec, type BinaryExecResult } from './binary-exec.js';
export type XcsymExecResult = BinaryExecResult;
export type XcsymExec = BinaryExec;
/**
 * Resolve the xcsym binary: explicit env override → dev plugin bin → the binary
 * bundled into dist/bin at publish time.
 */
export declare function resolveXcsymPath(config: Pick<Config, 'mode' | 'devSourcePath'>, env?: NodeJS.ProcessEnv): string;
/**
 * Wraps the bundled `xcsym` CLI as MCP tools so non-Claude-Code clients (Cursor,
 * Codex, Gemini) can symbolicate and triage crashes. Every verb is read-only
 * analysis — parse/symbolicate/inspect — never mutating the input report. JSON
 * output (the CLI default) is left as-is for LLM consumption. dSYM discovery and
 * symbolication lean on atos/dwarfdump/Spotlight, so the tools are macOS-only.
 */
export declare class XcsymTools implements BinaryToolProvider {
    static readonly toolNames: readonly ["axiom_xcsym_crash", "axiom_xcsym_triage", "axiom_xcsym_resolve", "axiom_xcsym_find_dsym", "axiom_xcsym_list_dsyms", "axiom_xcsym_verify", "axiom_xcsym_anonymize"];
    private readonly binaryPath;
    private readonly exec;
    private readonly logger?;
    constructor(opts: {
        binaryPath: string;
        exec?: XcsymExec;
        logger?: Logger;
    });
    handles(name: string): boolean;
    listTools(): McpTool[];
    callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
    /**
     * Translate validated tool input into an xcsym argv. Throws on bad input.
     *
     * Positional arguments (file/uuid/addresses) always go LAST, behind a `--`
     * terminator, so a value beginning with `-` can never be misparsed as a flag
     * (xcsym's parser interprets a leading-dash positional as an unknown flag and
     * errors). Flags come first; the parser accepts any order.
     */
    private buildArgv;
}
