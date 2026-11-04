import type { Config, Logger } from '../config.js';
import type { BinaryToolProvider, McpTool, ToolResponse } from './handler.js';
import { type BinaryExec, type BinaryExecResult } from './binary-exec.js';
export type XcprofExecResult = BinaryExecResult;
export type XcprofExec = BinaryExec;
/**
 * Resolve the xcprof binary: explicit env override → dev plugin bin → the
 * binary bundled into dist/bin at publish time.
 */
export declare function resolveXcprofPath(config: Pick<Config, 'mode' | 'devSourcePath'>, env?: NodeJS.ProcessEnv): string;
/**
 * Wraps the bundled `xcprof` CLI as MCP tools so non-Claude-Code clients
 * (Cursor, Codex, Gemini) get the same profiling workflow. record is the only
 * side-effecting tool; its launch / all-processes modes stay gated behind
 * explicit allow flags the caller must set (mirroring the CLI's ADR-002 gates).
 */
export declare class XcprofTools implements BinaryToolProvider {
    private readonly binaryPath;
    private readonly exec;
    private readonly logger?;
    constructor(opts: {
        binaryPath: string;
        exec?: XcprofExec;
        logger?: Logger;
    });
    handles(name: string): boolean;
    /** Tool names this handler owns, used by the parent handler to dispatch. */
    static readonly toolNames: readonly ["axiom_xcprof_doctor", "axiom_xcprof_analyze", "axiom_xcprof_compare", "axiom_xcprof_record"];
    listTools(): McpTool[];
    callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
    /** Translate validated tool input into an xcprof argv. Throws on bad input. */
    private buildArgv;
    private buildRecordArgv;
}
