import type { Config } from '../config.js';
import type { ToolResponse } from './handler.js';
export interface BinaryExecResult {
    stdout: string;
    stderr: string;
    code: number;
}
/** Injectable runner; production uses execFile against the resolved binary. */
export type BinaryExec = (binaryPath: string, args: string[]) => Promise<BinaryExecResult>;
/**
 * Resolve a bundled Go tool binary: explicit env override → dev plugin bin →
 * the binary bundled into dist/bin at publish time. The packaged path is
 * relative to this module (dist/tools/binary-exec.js → dist/bin/<name>).
 *
 * Each tool wrapper passes its binary name as a string LITERAL at the call
 * site; the binary-coverage scanner keys off that literal, so the bundler can
 * never silently drop a binary a tool resolves. (Do not write a real binary
 * name as a literal argument here in a comment — the scanner would count it.)
 */
export declare function resolveToolPath(binaryName: string, envKey: string, config: Pick<Config, 'mode' | 'devSourcePath'>, env?: NodeJS.ProcessEnv): string;
/**
 * Build the production execFile-backed runner. Each tool picks its own timeout
 * (record/streaming verbs need more headroom than a parse), so the bound is a
 * parameter rather than a shared constant.
 */
export declare function makeDefaultExec(timeoutMs: number, maxBuffer: number): BinaryExec;
export declare function text(body: string): ToolResponse;
/**
 * Response for a non-zero exit. A tool that wrote output before failing (a
 * partial capture, a report flagging incomplete symbolication) keeps it,
 * followed by the exit code; otherwise the error text stands alone.
 */
export declare function failureText(tool: string, { stdout, stderr, code }: BinaryExecResult): ToolResponse;
export declare function requireString(value: unknown, field: string): string;
export declare function isNonEmpty(value: unknown): value is string;
export declare function asStringArray(value: unknown): string[];
