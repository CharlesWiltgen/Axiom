import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import type { Config, Logger } from '../config.js';
import type { BinaryToolProvider, McpTool, ToolResponse } from './handler.js';
import {
  type BinaryExec,
  type BinaryExecResult,
  asStringArray,
  isNonEmpty,
  makeDefaultExec,
  requireString,
  resolveToolPath,
  text,
} from './binary-exec.js';

// Default ceiling on a single xcprof invocation. analyze/compare/doctor finish
// well within this; record bounds itself (--max-duration default 60s + a
// finalization grace), so 300s covers the common capture. Long recordings can
// raise it via AXIOM_XCPROF_TIMEOUT (seconds).
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_BUFFER = 64 * 1024 * 1024;

// Re-exported aliases keep this file the home for xcprof's exec types (imported
// by xcprof.test.ts) while the implementation lives in binary-exec.
export type XcprofExecResult = BinaryExecResult;
export type XcprofExec = BinaryExec;

/**
 * Resolve the xcprof binary: explicit env override → dev plugin bin → the
 * binary bundled into dist/bin at publish time.
 */
export function resolveXcprofPath(
  config: Pick<Config, 'mode' | 'devSourcePath'>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveToolPath('xcprof', 'AXIOM_XCPROF_PATH', config, env);
}

function timeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.AXIOM_XCPROF_TIMEOUT);
  return Number.isFinite(n) && n > 0 ? n * 1000 : DEFAULT_TIMEOUT_MS;
}

function defaultExec(env: NodeJS.ProcessEnv = process.env): XcprofExec {
  return makeDefaultExec(timeoutMs(env), MAX_BUFFER);
}

const PRESETS = ['cpu', 'memory', 'network', 'energy', 'full', 'full-ios'];

/**
 * Wraps the bundled `xcprof` CLI as MCP tools so non-Claude-Code clients
 * (Cursor, Codex, Gemini) get the same profiling workflow. record is the only
 * side-effecting tool; its launch / all-processes modes stay gated behind
 * explicit allow flags the caller must set (mirroring the CLI's ADR-002 gates).
 */
export class XcprofTools implements BinaryToolProvider {
  private readonly binaryPath: string;
  private readonly exec: XcprofExec;
  private readonly logger?: Logger;

  constructor(opts: { binaryPath: string; exec?: XcprofExec; logger?: Logger }) {
    this.binaryPath = opts.binaryPath;
    this.exec = opts.exec ?? defaultExec();
    this.logger = opts.logger;
  }

  handles(name: string): boolean {
    return (XcprofTools.toolNames as readonly string[]).includes(name);
  }

  /** Tool names this handler owns, used by the parent handler to dispatch. */
  static readonly toolNames = [
    'axiom_xcprof_doctor',
    'axiom_xcprof_analyze',
    'axiom_xcprof_compare',
    'axiom_xcprof_record',
  ] as const;

  listTools(): McpTool[] {
    return [
      {
        name: 'axiom_xcprof_doctor',
        description: 'Check the profiling environment: verifies xctrace is available and counts Instruments templates and connected devices. Run this first when profiling tools misbehave. macOS + Xcode only.',
        inputSchema: { type: 'object', properties: {} },
        annotations: {
          title: 'xcprof: Profiling Doctor',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      {
        name: 'axiom_xcprof_analyze',
        description: 'Analyze an existing .trace bundle and return structured CPU/hang/network findings as JSON. Use to find main-thread stalls, heavy stacks, and user-code attribution. macOS + Xcode only.',
        inputSchema: {
          type: 'object',
          properties: {
            trace: { type: 'string', description: 'Path to the .trace bundle to analyze.' },
            startMs: { type: 'number', description: 'Scope analysis to samples at or after this offset (ms).' },
            endMs: { type: 'number', description: 'Scope analysis to samples at or before this offset (ms).' },
            hangThresholdMs: { type: 'number', description: 'Main-thread gap (ms) counted as a candidate stall. Default 250.' },
            userBinary: { type: 'string', description: 'Comma-separated binary names to attribute as user code (default: all non-system frames).' },
            dsym: { type: 'string', description: 'Path to a .dSYM or Mach-O for symbolication (default: auto-discover by UUID).' },
          },
          required: ['trace'],
        },
        annotations: {
          title: 'xcprof: Analyze Trace',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      {
        name: 'axiom_xcprof_compare',
        description: 'Diff two .trace bundles (baseline vs current) and return per-function CPU-share deltas as JSON. Use for before/after regression detection in CI. macOS + Xcode only.',
        inputSchema: {
          type: 'object',
          properties: {
            baseline: { type: 'string', description: 'Path to the baseline .trace bundle.' },
            current: { type: 'string', description: 'Path to the current .trace bundle.' },
            failOnRegression: { type: 'boolean', description: 'Exit non-zero (gate CI) if any regression meets the threshold.' },
            thresholdPct: { type: 'number', description: 'CPU-share increase (percentage points) counted as a regression. Default 5.' },
            dsym: { type: 'string', description: 'Path to a .dSYM or Mach-O for symbolicating both traces (default: auto-discover).' },
          },
          required: ['baseline', 'current'],
        },
        annotations: {
          title: 'xcprof: Compare Traces',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      {
        name: 'axiom_xcprof_record',
        description: 'Record a new .trace by attaching to a process (default), launching a command, or capturing system-wide. Launch and all-processes are blocked unless allowLaunch / allowAllProcesses is set. Always non-interactive. macOS + Xcode only.',
        inputSchema: {
          type: 'object',
          properties: {
            attach: { type: 'string', description: 'Attach to a running process by pid or name (the safe default target).' },
            launch: { type: 'array', items: { type: 'string' }, description: 'Launch and profile a command (argv). Requires allowLaunch: true.' },
            allProcesses: { type: 'boolean', description: 'Capture all processes system-wide. Requires allowAllProcesses: true.' },
            allowLaunch: { type: 'boolean', description: 'Explicitly permit launching the process named in `launch`.' },
            allowAllProcesses: { type: 'boolean', description: 'Explicitly permit system-wide --all-processes capture.' },
            preset: { type: 'string', enum: PRESETS, description: 'Instrument preset (default cpu).' },
            template: { type: 'string', description: 'Record a single Instruments template instead of a preset.' },
            instruments: { type: 'array', items: { type: 'string' }, description: 'Add instruments by name (overrides preset).' },
            timeLimit: { type: 'string', description: 'Recording duration, e.g. "30s" or "500ms" (capped by maxDuration).' },
            maxDuration: { type: 'string', description: 'Hard ceiling on duration (default 60s).' },
            output: { type: 'string', description: '.trace output path or directory (default: generated under XCPROF_TRACE_ROOT).' },
            device: { type: 'string', description: 'Record on the named device or UDID (default: host).' },
            runName: { type: 'string', description: 'Name the run inside the trace.' },
            allowExternalOutput: { type: 'boolean', description: 'Permit an output path outside the trace sandbox.' },
            dryRun: { type: 'boolean', description: 'Print the planned xctrace command without recording.' },
          },
        },
        annotations: {
          title: 'xcprof: Record Trace',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResponse> {
    if (platform() !== 'darwin') {
      return text('xcprof requires macOS with Xcode installed — xctrace (the underlying profiler) is macOS-only, so this tool is unavailable on the current platform.');
    }
    if (!existsSync(this.binaryPath)) {
      return text(`xcprof binary not found at ${this.binaryPath}. Reinstall the Axiom plugin/package, or set AXIOM_XCPROF_PATH to a valid xcprof binary.`);
    }

    const argv = this.buildArgv(name, args);
    this.logger?.debug(`Running xcprof: ${argv.join(' ')}`);
    const { stdout, stderr, code } = await this.exec(this.binaryPath, argv);

    if (code === 0) {
      return text(stdout.trim() || '(xcprof produced no output)');
    }
    const detail = stderr.trim() || stdout.trim() || `exited with status ${code}`;
    // compare uses exit 3 for "regression found" — surface its JSON, not just the code.
    const body = stdout.trim() ? `${stdout.trim()}\n\n(xcprof exit ${code}: ${stderr.trim() || 'see output above'})` : `xcprof failed (exit ${code}): ${detail}`;
    return text(body);
  }

  /** Translate validated tool input into an xcprof argv. Throws on bad input. */
  private buildArgv(name: string, args: Record<string, any>): string[] {
    switch (name) {
      case 'axiom_xcprof_doctor':
        return ['doctor'];

      case 'axiom_xcprof_analyze': {
        const trace = requireString(args.trace, 'trace');
        const argv = ['analyze', trace, '--json'];
        if (Number.isFinite(args.startMs)) argv.push('--start-ms', String(args.startMs));
        if (Number.isFinite(args.endMs)) argv.push('--end-ms', String(args.endMs));
        if (Number.isFinite(args.hangThresholdMs)) argv.push('--hang-threshold-ms', String(args.hangThresholdMs));
        if (isNonEmpty(args.userBinary)) argv.push('--user-binary', args.userBinary);
        if (isNonEmpty(args.dsym)) argv.push('--dsym', args.dsym);
        return argv;
      }

      case 'axiom_xcprof_compare': {
        const baseline = requireString(args.baseline, 'baseline');
        const current = requireString(args.current, 'current');
        const argv = ['compare', baseline, current];
        if (args.failOnRegression === true) argv.push('--fail-on-regression');
        if (Number.isFinite(args.thresholdPct)) argv.push('--threshold-pct', String(args.thresholdPct));
        if (isNonEmpty(args.dsym)) argv.push('--dsym', args.dsym);
        return argv;
      }

      case 'axiom_xcprof_record':
        return this.buildRecordArgv(args);

      default:
        throw new Error(`Unknown xcprof tool: ${name}`);
    }
  }

  // Targeting and the launch / all-processes gates are enforced by the binary
  // itself (single source of truth). This only plumbs the caller's explicit
  // allow flags through; without them the binary refuses with a clear message.
  // The launch command must come last because xctrace consumes everything
  // after `--`.
  private buildRecordArgv(args: Record<string, any>): string[] {
    const argv = ['record'];
    if (isNonEmpty(args.preset)) argv.push('--preset', args.preset);
    if (isNonEmpty(args.template)) argv.push('--template', args.template);
    for (const inst of asStringArray(args.instruments)) argv.push('--instrument', inst);
    if (isNonEmpty(args.device)) argv.push('--device', args.device);
    if (isNonEmpty(args.timeLimit)) argv.push('--time-limit', args.timeLimit);
    if (isNonEmpty(args.maxDuration)) argv.push('--max-duration', args.maxDuration);
    if (isNonEmpty(args.output)) argv.push('--output', args.output);
    if (isNonEmpty(args.runName)) argv.push('--run-name', args.runName);
    if (args.allowExternalOutput === true) argv.push('--allow-external-output');
    if (args.dryRun === true) argv.push('--dry-run');
    // No TTY over MCP — never let xctrace block on a privacy prompt.
    argv.push('--no-prompt');

    const launch = asStringArray(args.launch);
    if (args.allProcesses === true) {
      argv.push('--all-processes');
      if (args.allowAllProcesses === true) argv.push('--allow-all-processes');
    } else if (isNonEmpty(args.attach)) {
      argv.push('--attach', args.attach);
    } else if (launch.length > 0) {
      if (args.allowLaunch === true) argv.push('--allow-launch');
      argv.push('--', ...launch);
    }
    return argv;
  }
}
