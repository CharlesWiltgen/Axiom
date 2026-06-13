import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { XclogTools, resolveXclogPath, type XclogExec, type XclogExecResult } from './xclog.js';

describe('resolveXclogPath', () => {
  it('prefers an explicit AXIOM_XCLOG_PATH override', () => {
    const path = resolveXclogPath({ mode: 'production' }, { AXIOM_XCLOG_PATH: '/custom/xclog' });
    expect(path).toBe('/custom/xclog');
  });

  it('resolves to the plugin bin in development mode', () => {
    const path = resolveXclogPath({ mode: 'development', devSourcePath: '/plug' }, {});
    expect(path).toBe(join('/plug', 'bin', 'xclog'));
  });

  it('resolves to the packaged binary in production', () => {
    const path = resolveXclogPath({ mode: 'production' }, {});
    expect(path.endsWith(join('bin', 'xclog'))).toBe(true);
  });
});

// Capture the argv each call would pass to the binary, with a canned result.
function recorder(result: Partial<XclogExecResult> = {}) {
  const calls: string[][] = [];
  const exec: XclogExec = async (_bin, args) => {
    calls.push(args);
    return { stdout: result.stdout ?? '{"ok":true}', stderr: result.stderr ?? '', code: result.code ?? 0 };
  };
  return { calls, exec };
}

function toolsWith(exec: XclogExec): XclogTools {
  return new XclogTools({ binaryPath: process.execPath, exec });
}

describe('XclogTools.listTools', () => {
  const tools = new XclogTools({ binaryPath: process.execPath }).listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

  it('exposes exactly the four xclog tools, matching toolNames', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([...XclogTools.toolNames].sort());
  });

  it('marks list and show read-only, launch and attach not read-only', () => {
    expect(byName.axiom_xclog_list.annotations?.readOnlyHint).toBe(true);
    expect(byName.axiom_xclog_show.annotations?.readOnlyHint).toBe(true);
    expect(byName.axiom_xclog_launch.annotations?.readOnlyHint).toBe(false);
    expect(byName.axiom_xclog_attach.annotations?.readOnlyHint).toBe(false);
  });

  it('requires bundleId for launch and target for attach/show', () => {
    expect(byName.axiom_xclog_launch.inputSchema.required).toEqual(['bundleId']);
    expect(byName.axiom_xclog_attach.inputSchema.required).toEqual(['target']);
    expect(byName.axiom_xclog_show.inputSchema.required).toEqual(['target']);
  });
});

describe('XclogTools.handles', () => {
  const tools = new XclogTools({ binaryPath: process.execPath });
  it('owns its four tool names and nothing else', () => {
    expect(tools.handles('axiom_xclog_launch')).toBe(true);
    expect(tools.handles('axiom_xclog_list')).toBe(true);
    expect(tools.handles('axiom_xcprof_record')).toBe(false);
  });
});

// callTool short-circuits off macOS, so argv-mapping assertions only run on darwin.
const onMac = process.platform === 'darwin';

describe.runIf(onMac)('XclogTools.callTool argv mapping', () => {
  it('list passes the device flag', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xclog_list', { device: 'booted' });
    expect(calls[0]).toEqual(['list', '--device', 'booted']);
  });

  it('show maps target, physical device, window, and filters', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xclog_show', {
      target: 'MyApp', deviceUdid: '00001234', last: '10m', filter: 'error', maxLines: 100,
    });
    expect(calls[0]).toEqual([
      'show', 'MyApp', '--device-udid', '00001234', '--last', '10m', '--filter', 'error', '--max-lines', '100',
    ]);
  });

  it('launch injects a default --timeout when no bound is given', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xclog_launch', { bundleId: 'com.example.App' });
    expect(calls[0]).toEqual(['launch', 'com.example.App', '--timeout', '30s']);
  });

  it('launch honors an explicit timeout and does not double-bound', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xclog_launch', { bundleId: 'com.example.App', timeout: '5m' });
    expect(calls[0]).toEqual(['launch', 'com.example.App', '--timeout', '5m']);
  });

  it('attach with an explicit maxLines bound omits the fallback timeout', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xclog_attach', { target: '1234', maxLines: 50 });
    expect(calls[0]).toEqual(['attach', '1234', '--max-lines', '50']);
  });

  it('throws when a required parameter is missing', async () => {
    const { exec } = recorder();
    await expect(toolsWith(exec).callTool('axiom_xclog_launch', {})).rejects.toThrow(/bundleId/);
  });

  it('surfaces a non-zero exit with stderr detail', async () => {
    const { exec } = recorder({ code: 2, stderr: 'no booted simulator' });
    const res = await toolsWith(exec).callTool('axiom_xclog_list', {});
    expect(res.content[0].text).toContain('no booted simulator');
  });
});
