import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { XcprofTools, resolveXcprofPath, type XcprofExec, type XcprofExecResult } from './xcprof.js';

describe('resolveXcprofPath', () => {
  it('prefers an explicit AXIOM_XCPROF_PATH override', () => {
    const path = resolveXcprofPath({ mode: 'production' }, { AXIOM_XCPROF_PATH: '/custom/xcprof' });
    expect(path).toBe('/custom/xcprof');
  });

  it('resolves to the plugin bin in development mode', () => {
    const path = resolveXcprofPath({ mode: 'development', devSourcePath: '/plug' }, {});
    expect(path).toBe(join('/plug', 'bin', 'xcprof'));
  });

  it('resolves to the packaged binary in production', () => {
    const path = resolveXcprofPath({ mode: 'production' }, {});
    expect(path.endsWith(join('bin', 'xcprof'))).toBe(true);
  });
});

// Capture the argv each call would pass to the binary, with a canned result.
function recorder(result: Partial<XcprofExecResult> = {}) {
  const calls: string[][] = [];
  const exec: XcprofExec = async (_bin, args) => {
    calls.push(args);
    return { stdout: result.stdout ?? '{"ok":true}', stderr: result.stderr ?? '', code: result.code ?? 0 };
  };
  return { calls, exec };
}

// process.execPath always exists, so the existsSync guard passes and the
// injected exec (never the real node) handles the call.
function toolsWith(exec: XcprofExec): XcprofTools {
  return new XcprofTools({ binaryPath: process.execPath, exec });
}

describe('XcprofTools.listTools', () => {
  const tools = new XcprofTools({ binaryPath: process.execPath }).listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

  it('exposes exactly the four documented tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([...XcprofTools.toolNames].sort());
  });

  it('marks doctor/analyze/compare read-only and record not read-only', () => {
    expect(byName['axiom_xcprof_doctor'].annotations!.readOnlyHint).toBe(true);
    expect(byName['axiom_xcprof_analyze'].annotations!.readOnlyHint).toBe(true);
    expect(byName['axiom_xcprof_compare'].annotations!.readOnlyHint).toBe(true);
    expect(byName['axiom_xcprof_record'].annotations!.readOnlyHint).toBe(false);
  });

  it('gives every tool a title', () => {
    for (const tool of tools) {
      expect(typeof tool.annotations!.title).toBe('string');
    }
  });
});

describe('XcprofTools.callTool argv mapping', () => {
  it('doctor takes no arguments', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_doctor', {});
    expect(calls[0]).toEqual(['doctor']);
  });

  it('analyze requests JSON and maps scoping flags', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_analyze', {
      trace: 'a.trace', startMs: 100, endMs: 700, hangThresholdMs: 300, userBinary: 'App', dsym: 'A.dSYM',
    });
    expect(calls[0]).toEqual([
      'analyze', 'a.trace', '--json',
      '--start-ms', '100', '--end-ms', '700', '--hang-threshold-ms', '300',
      '--user-binary', 'App', '--dsym', 'A.dSYM',
    ]);
  });

  it('analyze rejects a missing trace path', async () => {
    const { exec } = recorder();
    await expect(toolsWith(exec).callTool('axiom_xcprof_analyze', {})).rejects.toThrow('trace');
  });

  it('compare maps regression-gating flags', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_compare', {
      baseline: 'base.trace', current: 'cur.trace', failOnRegression: true, thresholdPct: 10,
    });
    expect(calls[0]).toEqual(['compare', 'base.trace', 'cur.trace', '--fail-on-regression', '--threshold-pct', '10']);
  });

  it('record attaches non-interactively by default', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_record', { attach: 'MyApp', preset: 'cpu' });
    expect(calls[0]).toEqual(['record', '--preset', 'cpu', '--no-prompt', '--attach', 'MyApp']);
  });

  it('record does NOT pass --allow-launch unless allowLaunch is set', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_record', { launch: ['/bin/ls'], preset: 'cpu' });
    expect(calls[0]).toEqual(['record', '--preset', 'cpu', '--no-prompt', '--', '/bin/ls']);
    expect(calls[0]).not.toContain('--allow-launch');
  });

  it('record passes --allow-launch when explicitly allowed, with the command last', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_record', { launch: ['/bin/ls', '-l'], allowLaunch: true });
    expect(calls[0]).toEqual(['record', '--no-prompt', '--allow-launch', '--', '/bin/ls', '-l']);
  });

  it('record gates all-processes behind allowAllProcesses', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcprof_record', { allProcesses: true, allowAllProcesses: true });
    expect(calls[0]).toEqual(['record', '--no-prompt', '--all-processes', '--allow-all-processes']);
  });
});

describe('XcprofTools.callTool results', () => {
  it('returns stdout on success', async () => {
    const { exec } = recorder({ stdout: '{"tool":"xcprof","ok":true}' });
    const res = await toolsWith(exec).callTool('axiom_xcprof_doctor', {});
    expect(res.content[0].text).toBe('{"tool":"xcprof","ok":true}');
  });

  it('surfaces stderr on a non-zero exit', async () => {
    const { exec } = recorder({ code: 2, stderr: 'analyze: this trace has no xctrace-exportable tables', stdout: '' });
    const res = await toolsWith(exec).callTool('axiom_xcprof_analyze', { trace: 'bad.trace' });
    expect(res.content[0].text).toContain('no xctrace-exportable tables');
    expect(res.content[0].text).toContain('exit 2');
  });

  it('reports an honest message when the binary is absent', async () => {
    const { exec } = recorder();
    const tools = new XcprofTools({ binaryPath: '/nonexistent/path/to/xcprof', exec });
    const res = await tools.callTool('axiom_xcprof_doctor', {});
    expect(res.content[0].text).toContain('not found');
    expect(res.content[0].text).toContain('/nonexistent/path/to/xcprof');
  });
});
