import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { asStringArray, failureText, isNonEmpty, makeDefaultExec, requireString, resolveToolPath, text, } from './binary-exec.js';
import { MCP_TOOL_NAMES } from './binaries.js';
// Ceiling on a single xcsym invocation. Parsing/symbolication is seconds;
// list-dsyms/find-dsym can fan out to Spotlight (mdfind) and atos across large
// dSYM stores, so 120s gives headroom. Raise via AXIOM_XCSYM_TIMEOUT (seconds).
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 64 * 1024 * 1024;
const FORMATS = ['summary', 'standard', 'full'];
const SOURCES = ['archives', 'deriveddata', 'downloads', 'toolchain', 'frameworks', 'env', 'all'];
/**
 * Resolve the xcsym binary: explicit env override → dev plugin bin → the binary
 * bundled into dist/bin at publish time.
 */
export function resolveXcsymPath(config, env = process.env) {
    return resolveToolPath('xcsym', 'AXIOM_XCSYM_PATH', config, env);
}
function timeoutMs(env = process.env) {
    const n = Number(env.AXIOM_XCSYM_TIMEOUT);
    return Number.isFinite(n) && n > 0 ? n * 1000 : DEFAULT_TIMEOUT_MS;
}
function defaultExec(env = process.env) {
    return makeDefaultExec(timeoutMs(env), MAX_BUFFER);
}
/**
 * Wraps the bundled `xcsym` CLI as MCP tools so non-Claude-Code clients (Cursor,
 * Codex, Gemini) can symbolicate and triage crashes. Every verb is read-only
 * analysis — parse/symbolicate/inspect — never mutating the input report. JSON
 * output (the CLI default) is left as-is for LLM consumption. dSYM discovery and
 * symbolication lean on atos/dwarfdump/Spotlight, so the tools are macOS-only.
 */
export class XcsymTools {
    static toolNames = MCP_TOOL_NAMES.xcsym;
    binaryPath;
    exec;
    logger;
    constructor(opts) {
        this.binaryPath = opts.binaryPath;
        this.exec = opts.exec ?? defaultExec();
        this.logger = opts.logger;
    }
    handles(name) {
        return XcsymTools.toolNames.includes(name);
    }
    listTools() {
        const readOnly = {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        };
        const dsymPaths = { type: 'string', description: 'Extra dSYM search roots, colon-separated.' };
        const arch = { type: 'string', description: 'Preferred architecture slice: arm64, arm64e, or x86_64.' };
        return [
            {
                name: 'axiom_xcsym_crash',
                description: 'Symbolicate and categorize one crash file end-to-end: parse, discover dSYMs, run atos, classify the cause. Accepts .ips (v1/v2), MetricKit MXCrashDiagnostic JSON, legacy .crash, and .xccrashpoint bundles (auto-detected). Returns a JSON report. Exits 3, 4 and 7 mean symbolication was incomplete, not that the tool failed (3=UUID mismatch, 4=arch mismatch — on the main binary, or on another image when the main binary could not be checked — 7=other images missing, or mismatched while the main binary matched); 2 means the input is missing, unreadable or unsupported, or the main-binary dSYM is missing; 1 is a usage error, or a hang or non-fatal EXC_RESOURCE report rejected with JSON whose error field (hang_report, non_fatal_resource) says where to route it; 5, 6 and 8 are real failures (tool, timeout, output). When a report was written it is still returned, followed by the exit code. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', description: 'Path to the crash file or .xccrashpoint bundle.' },
                        format: { type: 'string', enum: FORMATS, description: 'Output tier (default standard).' },
                        dsym: { type: 'string', description: 'Explicit dSYM path override. Applies to every image, so the others report a UUID mismatch instead of being searched.' },
                        dsymPaths,
                        filter: { type: 'string', description: 'For .xccrashpoint inputs: pick the Filter_* dir whose name contains this substring (default: most-recent mtime).' },
                        preferLocallySymbolicated: { type: 'boolean', description: 'For .xccrashpoint inputs: prefer Logs/LocallySymbolicated/*.crash over the raw .crash.' },
                        fromMetrickit: { type: 'boolean', description: 'Force MetricKit format (skip auto-detect).' },
                        noSymbolicate: { type: 'boolean', description: 'Skip atos; keep frames as parsed (works without dSYMs / off-device).' },
                        noCache: { type: 'boolean', description: 'Skip the persistent UUID cache.' },
                        noSpotlight: { type: 'boolean', description: 'Skip Spotlight (mdfind) dSYM lookups.' },
                        noDefaults: { type: 'boolean', description: 'Skip default dSYM search roots (Archives, DerivedData, Downloads, toolchain, frameworks); dsym, the UUID cache, Spotlight and dsymPaths (else $XCSYM_DSYM_PATHS) still apply.' },
                    },
                    required: ['file'],
                },
                annotations: { title: 'xcsym: Symbolicate Crash', ...readOnly },
            },
            {
                name: 'axiom_xcsym_triage',
                description: 'Triage a corpus of NormalizedReport JSONL (one report per line): classify each, flag suspension/idle-runloop noise, and cluster into root-cause families. Returns a JSON TriageResult. Network-free (no symbolication or dSYM discovery). Requires a file path — stdin piping is not available over MCP. macOS only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', description: 'Path to the NormalizedReport JSONL corpus.' },
                        latestVersion: { type: 'string', description: 'Marketing version of the latest shipped build (for noise/enrichment).' },
                        osFloor: { type: 'string', description: 'Lowest supported OS version.' },
                        minUsers: { type: 'number', description: 'Issues below this user count are flagged long_tail (0 disables).' },
                    },
                    required: ['file'],
                },
                annotations: { title: 'xcsym: Triage Crash Corpus', ...readOnly },
            },
            {
                name: 'axiom_xcsym_resolve',
                description: 'Resolve one or more runtime addresses to symbols against a specific dSYM at a given load address (atos). Returns JSON. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        addresses: { type: 'array', items: { type: 'string' }, description: 'Runtime address(es) to resolve, e.g. ["0x100abc000"].' },
                        dsym: { type: 'string', description: 'dSYM or Mach-O binary path.' },
                        loadAddr: { type: 'string', description: 'Load address of the image, e.g. "0x100a00000".' },
                        arch,
                    },
                    required: ['addresses', 'dsym', 'loadAddr'],
                },
                annotations: { title: 'xcsym: Resolve Addresses', ...readOnly },
            },
            {
                name: 'axiom_xcsym_find_dsym',
                description: 'Locate a dSYM by its Mach-O UUID across the cache, default roots, and Spotlight. Returns JSON. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string', description: 'Mach-O UUID to locate.' },
                        arch,
                        dsymPaths,
                        noCache: { type: 'boolean', description: 'Skip the persistent UUID cache.' },
                        noSpotlight: { type: 'boolean', description: 'Skip Spotlight (mdfind) lookups.' },
                        noDefaults: { type: 'boolean', description: 'Skip default dSYM search roots (Archives, DerivedData, Downloads, toolchain, frameworks); the UUID cache, Spotlight and dsymPaths (else $XCSYM_DSYM_PATHS) still apply.' },
                    },
                    required: ['uuid'],
                },
                annotations: { title: 'xcsym: Find dSYM by UUID', ...readOnly },
            },
            {
                name: 'axiom_xcsym_list_dsyms',
                description: 'Inventory known dSYMs across Archives, DerivedData, Downloads, toolchains, frameworks, and env roots. Returns JSON. macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        source: { type: 'string', enum: SOURCES, description: 'Which sources to scan (default all).' },
                        dsymPaths,
                    },
                },
                annotations: { title: 'xcsym: List dSYMs', ...readOnly },
            },
            {
                name: 'axiom_xcsym_verify',
                description: 'Verify that the discoverable dSYMs match each image in a crash file by UUID and architecture. Returns JSON. Exits 3 (UUID mismatch), 4 (arch mismatch) and 7 (missing images) flag dSYM problems and still return the report; 2 means the input is missing, unreadable or unsupported; 1, 5, 6 and 8 are real failures (usage, tool, timeout, output). macOS + Xcode only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', description: 'Path to the crash file or .xccrashpoint bundle.' },
                        dsym: { type: 'string', description: 'Explicit dSYM path override (bypasses discovery).' },
                        dsymPaths,
                        noCache: { type: 'boolean', description: 'Skip the persistent UUID cache.' },
                        noSpotlight: { type: 'boolean', description: 'Skip Spotlight (mdfind) lookups.' },
                        noDefaults: { type: 'boolean', description: 'Skip default dSYM search roots (Archives, DerivedData, Downloads, toolchain, frameworks); dsym, the UUID cache, Spotlight and dsymPaths (else $XCSYM_DSYM_PATHS) still apply.' },
                    },
                    required: ['file'],
                },
                annotations: { title: 'xcsym: Verify dSYM Match', ...readOnly },
            },
            {
                name: 'axiom_xcsym_anonymize',
                description: 'Strip PII (paths, device names, identifiers) from a crash file to produce a shareable fixture. Returns the anonymized crash, or writes it to a path. Does not modify the source. macOS only.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', description: 'Path to the crash file to anonymize.' },
                        output: { type: 'string', description: 'Write the anonymized crash to this path instead of returning it.' },
                    },
                    required: ['file'],
                },
                annotations: { title: 'xcsym: Anonymize Crash', ...readOnly },
            },
        ];
    }
    async callTool(name, args) {
        if (platform() !== 'darwin') {
            return text('xcsym requires macOS — dSYM discovery and symbolication rely on atos/dwarfdump/Spotlight, which are macOS-only, so this tool is unavailable on the current platform.');
        }
        if (!existsSync(this.binaryPath)) {
            return text(`xcsym binary not found at ${this.binaryPath}. Reinstall the Axiom plugin/package, or set AXIOM_XCSYM_PATH to a valid xcsym binary.`);
        }
        const argv = this.buildArgv(name, args);
        this.logger?.debug(`Running xcsym: ${argv.join(' ')}`);
        const { stdout, stderr, code } = await this.exec(this.binaryPath, argv);
        if (code === 0) {
            return text(stdout.trim() || '(xcsym produced no output)');
        }
        // crash/verify exit non-zero to signal dSYM-match completeness while still
        // emitting a full JSON report — surface that report, not just the code.
        return failureText('xcsym', { stdout, stderr, code });
    }
    /**
     * Translate validated tool input into an xcsym argv. Throws on bad input.
     *
     * Positional arguments (file/uuid/addresses) always go LAST, behind a `--`
     * terminator, so a value beginning with `-` can never be misparsed as a flag
     * (xcsym's parser interprets a leading-dash positional as an unknown flag and
     * errors). Flags come first; the parser accepts any order.
     */
    buildArgv(name, args) {
        switch (name) {
            case 'axiom_xcsym_crash': {
                const argv = ['crash'];
                if (isNonEmpty(args.format))
                    argv.push('--format', args.format);
                if (isNonEmpty(args.dsym))
                    argv.push('--dsym', args.dsym);
                if (isNonEmpty(args.dsymPaths))
                    argv.push('--dsym-paths', args.dsymPaths);
                if (isNonEmpty(args.filter))
                    argv.push('--filter', args.filter);
                if (args.preferLocallySymbolicated === true)
                    argv.push('--prefer-locally-symbolicated');
                if (args.fromMetrickit === true)
                    argv.push('--from-metrickit');
                if (args.noSymbolicate === true)
                    argv.push('--no-symbolicate');
                if (args.noCache === true)
                    argv.push('--no-cache');
                if (args.noSpotlight === true)
                    argv.push('--no-spotlight');
                if (args.noDefaults === true)
                    argv.push('--no-defaults');
                argv.push('--', requireString(args.file, 'file'));
                return argv;
            }
            case 'axiom_xcsym_triage': {
                const argv = ['triage'];
                if (isNonEmpty(args.latestVersion))
                    argv.push('--latest-version', args.latestVersion);
                if (isNonEmpty(args.osFloor))
                    argv.push('--os-floor', args.osFloor);
                if (Number.isFinite(args.minUsers))
                    argv.push('--min-users', String(args.minUsers));
                argv.push('--', requireString(args.file, 'file'));
                return argv;
            }
            case 'axiom_xcsym_resolve': {
                const addresses = asStringArray(args.addresses);
                if (addresses.length === 0) {
                    throw new Error('Required parameter "addresses" must be a non-empty array of strings');
                }
                const dsym = requireString(args.dsym, 'dsym');
                const loadAddr = requireString(args.loadAddr, 'loadAddr');
                const argv = ['resolve', '--dsym', dsym, '--load-addr', loadAddr];
                if (isNonEmpty(args.arch))
                    argv.push('--arch', args.arch);
                argv.push('--', ...addresses);
                return argv;
            }
            case 'axiom_xcsym_find_dsym': {
                const uuid = requireString(args.uuid, 'uuid');
                const argv = ['find-dsym'];
                if (isNonEmpty(args.arch))
                    argv.push('--arch', args.arch);
                if (args.noCache === true)
                    argv.push('--no-cache');
                if (args.noSpotlight === true)
                    argv.push('--no-spotlight');
                if (args.noDefaults === true)
                    argv.push('--no-defaults');
                if (isNonEmpty(args.dsymPaths))
                    argv.push('--dsym-paths', args.dsymPaths);
                argv.push('--', uuid);
                return argv;
            }
            case 'axiom_xcsym_list_dsyms': {
                const argv = ['list-dsyms'];
                if (isNonEmpty(args.source))
                    argv.push('--source', args.source);
                if (isNonEmpty(args.dsymPaths))
                    argv.push('--dsym-paths', args.dsymPaths);
                return argv;
            }
            case 'axiom_xcsym_verify': {
                const file = requireString(args.file, 'file');
                const argv = ['verify'];
                if (isNonEmpty(args.dsym))
                    argv.push('--dsym', args.dsym);
                if (isNonEmpty(args.dsymPaths))
                    argv.push('--dsym-paths', args.dsymPaths);
                if (args.noCache === true)
                    argv.push('--no-cache');
                if (args.noSpotlight === true)
                    argv.push('--no-spotlight');
                if (args.noDefaults === true)
                    argv.push('--no-defaults');
                argv.push('--', file);
                return argv;
            }
            case 'axiom_xcsym_anonymize': {
                const file = requireString(args.file, 'file');
                const argv = ['anonymize'];
                if (isNonEmpty(args.output))
                    argv.push('--output', args.output);
                argv.push('--', file);
                return argv;
            }
            default:
                throw new Error(`Unknown xcsym tool: ${name}`);
        }
    }
}
