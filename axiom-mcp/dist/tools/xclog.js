import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { failureText, isNonEmpty, makeDefaultExec, requireString, resolveToolPath, text, } from './binary-exec.js';
import { MCP_TOOL_NAMES } from './binaries.js';
// xclog launch/attach stream until a bound is hit; the others finish quickly.
// This ceiling is a hard backstop only — the wrapper injects a --timeout bound
// for the streaming verbs so a call can't hang. Override via AXIOM_XCLOG_TIMEOUT (s).
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 64 * 1024 * 1024;
// Bound injected into launch/attach when the caller supplies neither --timeout
// nor --max-lines, so an MCP call always terminates.
const STREAM_FALLBACK_TIMEOUT = '30s';
/**
 * Resolve the xclog binary: explicit env override → dev plugin bin → the binary
 * bundled into dist/bin at publish time.
 */
export function resolveXclogPath(config, env = process.env) {
    return resolveToolPath('xclog', 'AXIOM_XCLOG_PATH', config, env);
}
function timeoutMs(env = process.env) {
    const n = Number(env.AXIOM_XCLOG_TIMEOUT);
    return Number.isFinite(n) && n > 0 ? n * 1000 : DEFAULT_TIMEOUT_MS;
}
function defaultExec(env = process.env) {
    return makeDefaultExec(timeoutMs(env), MAX_BUFFER);
}
/**
 * Wraps the bundled `xclog` CLI as MCP tools so non-Claude-Code clients (Cursor,
 * Codex, Gemini) can capture simulator console output. `list`/`show` are
 * read-only; `launch` starts an app and `attach` connects to a running process —
 * both stream and are bounded so an MCP call always returns. JSON output (the CLI
 * default) is left as-is for LLM consumption. Simulator tooling is macOS-only.
 */
export class XclogTools {
    static toolNames = MCP_TOOL_NAMES.xclog;
    binaryPath;
    exec;
    logger;
    constructor(opts) {
        this.binaryPath = opts.binaryPath;
        this.exec = opts.exec ?? defaultExec();
        this.logger = opts.logger;
    }
    handles(name) {
        return XclogTools.toolNames.includes(name);
    }
    listTools() {
        const device = { type: 'string', description: 'Simulator UDID (default: the booted simulator).' };
        const filter = { type: 'string', description: 'Filter output lines by regex.' };
        const subsystem = { type: 'string', description: 'Filter os_log output by subsystem.' };
        const maxLines = { type: 'number', description: 'Stop after N lines (default: unlimited).' };
        const timeout = { type: 'string', description: 'Stop after a duration, e.g. "30s" or "5m".' };
        return [
            {
                name: 'axiom_xclog_launch',
                description: 'Launch a simulator app by bundle id and capture all of its console output (print/debugPrint/NSLog/os_log/Logger) as JSON. Bounded by timeout/maxLines so it always returns. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bundleId: { type: 'string', description: 'Bundle identifier of the app to launch, e.g. com.example.MyApp.' },
                        device,
                        timeout,
                        maxLines,
                        filter,
                        subsystem,
                        output: { type: 'string', description: 'Also write captured output to this file.' },
                    },
                    required: ['bundleId'],
                },
                annotations: {
                    title: 'xclog: Launch & Capture',
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                    openWorldHint: true,
                },
            },
            {
                name: 'axiom_xclog_attach',
                description: 'Attach to a running simulator process by name or pid and capture its os_log output (NSLog/os_log/Logger; not print/debugPrint) as JSON. Bounded by timeout/maxLines. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        target: { type: 'string', description: 'Process name or pid to attach to.' },
                        device,
                        timeout,
                        maxLines,
                        filter,
                        subsystem,
                    },
                    required: ['target'],
                },
                annotations: {
                    title: 'xclog: Attach & Capture',
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                    openWorldHint: true,
                },
            },
            {
                name: 'axiom_xclog_show',
                description: 'Show recent logs for a process (post-mortem) by name or pid, from the simulator or a physical device, as JSON. Read-only. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        target: { type: 'string', description: 'Process name or pid.' },
                        device,
                        deviceUdid: { type: 'string', description: 'Physical device UDID (instead of a simulator).' },
                        last: { type: 'string', description: 'How far back to search, e.g. "5m" or "10m" (default: 5m).' },
                        filter,
                        subsystem,
                        maxLines,
                    },
                    required: ['target'],
                },
                annotations: {
                    title: 'xclog: Show Recent Logs',
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true,
                    openWorldHint: true,
                },
            },
            {
                name: 'axiom_xclog_list',
                description: 'List the apps installed on a simulator as JSON. Read-only. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: { device },
                },
                annotations: {
                    title: 'xclog: List Installed Apps',
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true,
                    openWorldHint: true,
                },
            },
        ];
    }
    async callTool(name, args) {
        if (platform() !== 'darwin') {
            return text('xclog requires macOS with Xcode — the iOS Simulator and `simctl`/`log` it drives are macOS-only, so this tool is unavailable on the current platform.');
        }
        if (!existsSync(this.binaryPath)) {
            return text(`xclog binary not found at ${this.binaryPath}. Reinstall the Axiom plugin/package, or set AXIOM_XCLOG_PATH to a valid xclog binary.`);
        }
        const argv = this.buildArgv(name, args);
        this.logger?.debug(`Running xclog: ${argv.join(' ')}`);
        const { stdout, stderr, code } = await this.exec(this.binaryPath, argv);
        if (code === 0) {
            return text(stdout.trim() || '(xclog produced no output)');
        }
        return failureText('xclog', { stdout, stderr, code });
    }
    /** Translate validated tool input into an xclog argv. Throws on bad input. */
    buildArgv(name, args) {
        switch (name) {
            case 'axiom_xclog_list': {
                const argv = ['list'];
                if (isNonEmpty(args.device))
                    argv.push('--device', args.device);
                return argv;
            }
            case 'axiom_xclog_show': {
                const target = requireString(args.target, 'target');
                const argv = ['show'];
                if (isNonEmpty(args.device))
                    argv.push('--device', args.device);
                if (isNonEmpty(args.deviceUdid))
                    argv.push('--device-udid', args.deviceUdid);
                if (isNonEmpty(args.last))
                    argv.push('--last', args.last);
                pushCommonFilters(argv, args);
                argv.push('--', target);
                return argv;
            }
            case 'axiom_xclog_launch': {
                const bundleId = requireString(args.bundleId, 'bundleId');
                const argv = ['launch'];
                if (isNonEmpty(args.device))
                    argv.push('--device', args.device);
                if (isNonEmpty(args.output))
                    argv.push('--output', args.output);
                pushStreamBounds(argv, args);
                pushCommonFilters(argv, args);
                argv.push('--', bundleId);
                return argv;
            }
            case 'axiom_xclog_attach': {
                const target = requireString(args.target, 'target');
                const argv = ['attach'];
                if (isNonEmpty(args.device))
                    argv.push('--device', args.device);
                pushStreamBounds(argv, args);
                pushCommonFilters(argv, args);
                argv.push('--', target);
                return argv;
            }
            default:
                throw new Error(`Unknown xclog tool: ${name}`);
        }
    }
}
function pushCommonFilters(argv, args) {
    if (isNonEmpty(args.filter))
        argv.push('--filter', args.filter);
    if (isNonEmpty(args.subsystem))
        argv.push('--subsystem', args.subsystem);
    if (Number.isFinite(args.maxLines))
        argv.push('--max-lines', String(args.maxLines));
}
// launch/attach stream; without an explicit bound they would run until the exec
// timeout. Inject a default --timeout when the caller gave neither bound.
function pushStreamBounds(argv, args) {
    if (isNonEmpty(args.timeout))
        argv.push('--timeout', args.timeout);
    if (!isNonEmpty(args.timeout) && !Number.isFinite(args.maxLines)) {
        argv.push('--timeout', STREAM_FALLBACK_TIMEOUT);
    }
}
