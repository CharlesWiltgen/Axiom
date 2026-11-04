import type { Config, Logger } from '../config.js';
import type { BinaryToolProvider, McpTool, ToolResponse } from './handler.js';
import { type BinaryExec, type BinaryExecResult } from './binary-exec.js';
export type XclogExecResult = BinaryExecResult;
export type XclogExec = BinaryExec;
/**
 * Resolve the xclog binary: explicit env override → dev plugin bin → the binary
 * bundled into dist/bin at publish time.
 */
export declare function resolveXclogPath(config: Pick<Config, 'mode' | 'devSourcePath'>, env?: NodeJS.ProcessEnv): string;
/**
 * Wraps the bundled `xclog` CLI as MCP tools so non-Claude-Code clients (Cursor,
 * Codex, Gemini) can capture simulator console output. `list`/`show` are
 * read-only; `launch` starts an app and `attach` connects to a running process —
 * both stream and are bounded so an MCP call always returns. JSON output (the CLI
 * default) is left as-is for LLM consumption. Simulator tooling is macOS-only.
 */
export declare class XclogTools implements BinaryToolProvider {
    static readonly toolNames: readonly ["axiom_xclog_launch", "axiom_xclog_attach", "axiom_xclog_show", "axiom_xclog_list"];
    private readonly binaryPath;
    private readonly exec;
    private readonly logger?;
    constructor(opts: {
        binaryPath: string;
        exec?: XclogExec;
        logger?: Logger;
    });
    handles(name: string): boolean;
    listTools(): McpTool[];
    callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
    /** Translate validated tool input into an xclog argv. Throws on bad input. */
    private buildArgv;
}
