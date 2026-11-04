import { execFile } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const EBADARCH = 86;
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
export function resolveToolPath(binaryName, envKey, config, env = process.env) {
    const override = env[envKey]?.trim();
    if (override)
        return override;
    if (config.mode === 'development' && config.devSourcePath) {
        return join(config.devSourcePath, 'tools', binaryName);
    }
    return join(MODULE_DIR, '..', 'bin', binaryName);
}
/**
 * Build the production execFile-backed runner. Each tool picks its own timeout
 * (record/streaming verbs need more headroom than a parse), so the bound is a
 * parameter rather than a shared constant.
 */
export function makeDefaultExec(timeoutMs, maxBuffer) {
    return (binaryPath, args) => new Promise((resolve) => {
        const child = execFile(binaryPath, args, { timeout: timeoutMs, maxBuffer }, (err, stdout, stderr) => {
            // execFile sets err.code to the numeric exit status on a clean non-zero
            // exit; a signal/timeout/overflow leaves it non-numeric. Either way we
            // have the captured streams, so report them rather than throwing.
            const e = err;
            const rawCode = e?.code;
            const code = typeof rawCode === 'number' ? rawCode : err ? 1 : 0;
            let out = stdout ?? '';
            let errStr = stderr ?? '';
            if (rawCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
                // Output blew past maxBuffer — `out` holds a truncated prefix that is
                // almost certainly invalid JSON. Discard it and say so, rather than
                // handing the caller malformed JSON dressed as a real result.
                out = '';
                errStr = `output exceeded the ${Math.round(maxBuffer / (1024 * 1024))} MB limit and was truncated; narrow the request (e.g. a summary tier or a tighter scope).`;
            }
            else if (e?.killed && (e.signal === 'SIGTERM' || rawCode === 'ETIMEDOUT')) {
                // A kill on our own timeout — distinguish it from a real usage error so
                // the caller knows to narrow scope or raise the tool's *_TIMEOUT.
                errStr = errStr.trim() || `timed out after ${Math.round(timeoutMs / 1000)}s; narrow the request or raise the tool's *_TIMEOUT (seconds).`;
            }
            resolve({ stdout: out, stderr: errStr, code });
        });
        // Give any child that reads stdin (xcsym crash/anonymize accept "-") an
        // immediate EOF, so an MCP call can never block on input we never send.
        child.stdin?.end();
    }).catch((err) => {
        // The tools ship arm64-only. An Intel Mac refuses them with EBADARCH, which
        // execFile throws synchronously as the opaque "Unknown system error -86".
        if (err.errno !== -EBADARCH)
            throw err;
        return { stdout: '', stderr: `${basename(binaryPath)} is built for Apple Silicon (arm64); this Mac's CPU cannot run it.`, code: 1 };
    });
}
export function text(body) {
    return { content: [{ type: 'text', text: body }] };
}
/**
 * Response for a non-zero exit. A tool that wrote output before failing (a
 * partial capture, a report flagging incomplete symbolication) keeps it,
 * followed by the exit code; otherwise the error text stands alone.
 */
export function failureText(tool, { stdout, stderr, code }) {
    if (stdout.trim())
        return text(`${stdout.trim()}\n\n(${tool} exit ${code}: ${stderr.trim() || 'see output above'})`);
    return text(`${tool} failed (exit ${code}): ${stderr.trim() || `exited with status ${code}`}`);
}
export function requireString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Required parameter "${field}" must be a non-empty string`);
    }
    return value;
}
export function isNonEmpty(value) {
    return typeof value === 'string' && value.trim() !== '';
}
export function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((v) => typeof v === 'string' && v.length > 0);
}
