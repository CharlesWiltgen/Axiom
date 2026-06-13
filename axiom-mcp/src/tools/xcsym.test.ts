import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { XcsymTools, resolveXcsymPath, type XcsymExec, type XcsymExecResult } from './xcsym.js';

describe('resolveXcsymPath', () => {
  it('prefers an explicit AXIOM_XCSYM_PATH override', () => {
    const path = resolveXcsymPath({ mode: 'production' }, { AXIOM_XCSYM_PATH: '/custom/xcsym' });
    expect(path).toBe('/custom/xcsym');
  });

  it('resolves to the plugin bin in development mode', () => {
    const path = resolveXcsymPath({ mode: 'development', devSourcePath: '/plug' }, {});
    expect(path).toBe(join('/plug', 'bin', 'xcsym'));
  });

  it('resolves to the packaged binary in production', () => {
    const path = resolveXcsymPath({ mode: 'production' }, {});
    expect(path.endsWith(join('bin', 'xcsym'))).toBe(true);
  });
});

// Capture the argv each call would pass to the binary, with a canned result.
function recorder(result: Partial<XcsymExecResult> = {}) {
  const calls: string[][] = [];
  const exec: XcsymExec = async (_bin, args) => {
    calls.push(args);
    return { stdout: result.stdout ?? '{"ok":true}', stderr: result.stderr ?? '', code: result.code ?? 0 };
  };
  return { calls, exec };
}

// process.execPath always exists, so the existsSync guard passes and the
// injected exec (never the real node) handles the call.
function toolsWith(exec: XcsymExec): XcsymTools {
  return new XcsymTools({ binaryPath: process.execPath, exec });
}

describe('XcsymTools.listTools', () => {
  const tools = new XcsymTools({ binaryPath: process.execPath }).listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

  it('exposes exactly the seven xcsym tools, matching toolNames', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([...XcsymTools.toolNames].sort());
  });

  it('marks every tool read-only (xcsym only reads and symbolicates)', () => {
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('gives every tool a title', () => {
    for (const tool of tools) {
      expect(typeof tool.annotations?.title).toBe('string');
    }
  });

  it('requires the expected parameters per tool', () => {
    expect(byName.axiom_xcsym_crash.inputSchema.required).toEqual(['file']);
    expect(byName.axiom_xcsym_triage.inputSchema.required).toEqual(['file']);
    expect(byName.axiom_xcsym_resolve.inputSchema.required).toEqual(['addresses', 'dsym', 'loadAddr']);
    expect(byName.axiom_xcsym_find_dsym.inputSchema.required).toEqual(['uuid']);
    expect(byName.axiom_xcsym_verify.inputSchema.required).toEqual(['file']);
    expect(byName.axiom_xcsym_anonymize.inputSchema.required).toEqual(['file']);
    expect(byName.axiom_xcsym_list_dsyms.inputSchema.required).toBeUndefined();
  });
});

describe('XcsymTools.handles', () => {
  const tools = new XcsymTools({ binaryPath: process.execPath });
  it('owns its tool names and nothing else', () => {
    expect(tools.handles('axiom_xcsym_crash')).toBe(true);
    expect(tools.handles('axiom_xcsym_list_dsyms')).toBe(true);
    expect(tools.handles('axiom_xclog_show')).toBe(false);
    expect(tools.handles('axiom_xcprof_record')).toBe(false);
  });
});

// callTool short-circuits off macOS, so argv-mapping assertions only run on darwin.
const onMac = process.platform === 'darwin';

describe.runIf(onMac)('XcsymTools.callTool argv mapping', () => {
  it('crash maps flags then the file behind a -- terminator', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_crash', {
      file: 'crash.ips', format: 'full', dsym: 'A.dSYM', noSymbolicate: true,
    });
    expect(calls[0]).toEqual(['crash', '--format', 'full', '--dsym', 'A.dSYM', '--no-symbolicate', '--', 'crash.ips']);
  });

  it('crash maps xccrashpoint and discovery flags, file last behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_crash', {
      file: 'sample.xccrashpoint', filter: 'iphoneos', preferLocallySymbolicated: true,
      noDefaults: true, dsymPaths: '/a:/b',
    });
    expect(calls[0]).toEqual([
      'crash', '--dsym-paths', '/a:/b', '--filter', 'iphoneos',
      '--prefer-locally-symbolicated', '--no-defaults', '--', 'sample.xccrashpoint',
    ]);
  });

  it('crash does not expose an --output flag (MCP returns the report inline)', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_crash', { file: 'crash.ips', output: '/tmp/out.json' });
    expect(calls[0]).toEqual(['crash', '--', 'crash.ips']);
  });

  it('triage maps threshold flags then the file behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_triage', {
      file: 'corpus.jsonl', latestVersion: '3.2', osFloor: '17.0', minUsers: 5,
    });
    expect(calls[0]).toEqual([
      'triage', '--latest-version', '3.2', '--os-floor', '17.0', '--min-users', '5', '--', 'corpus.jsonl',
    ]);
  });

  it('resolve maps required flags then all addresses behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_resolve', {
      addresses: ['0x100000000', '0x100000040'], dsym: 'A.dSYM', loadAddr: '0x100000000', arch: 'arm64e',
    });
    expect(calls[0]).toEqual([
      'resolve', '--dsym', 'A.dSYM', '--load-addr', '0x100000000', '--arch', 'arm64e', '--', '0x100000000', '0x100000040',
    ]);
  });

  it('find_dsym maps discovery flags then the uuid behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_find_dsym', {
      uuid: 'D1B2C3D4', arch: 'arm64', noSpotlight: true, noCache: true,
    });
    expect(calls[0]).toEqual(['find-dsym', '--arch', 'arm64', '--no-cache', '--no-spotlight', '--', 'D1B2C3D4']);
  });

  it('list_dsyms maps source and search roots (no positional, no --)', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_list_dsyms', { source: 'archives', dsymPaths: '/a:/b' });
    expect(calls[0]).toEqual(['list-dsyms', '--source', 'archives', '--dsym-paths', '/a:/b']);
  });

  it('verify maps the dsym override then the file behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_verify', { file: 'crash.ips', dsym: 'A.dSYM' });
    expect(calls[0]).toEqual(['verify', '--dsym', 'A.dSYM', '--', 'crash.ips']);
  });

  it('anonymize maps the output path then the file behind --', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_anonymize', { file: 'crash.ips', output: '/tmp/clean.ips' });
    expect(calls[0]).toEqual(['anonymize', '--output', '/tmp/clean.ips', '--', 'crash.ips']);
  });

  it('guards a leading-dash file path behind -- (never parsed as a flag)', async () => {
    const { calls, exec } = recorder();
    await toolsWith(exec).callTool('axiom_xcsym_crash', { file: '-weird.ips' });
    expect(calls[0]).toEqual(['crash', '--', '-weird.ips']);
  });

  it('throws when a required string parameter is missing', async () => {
    const { exec } = recorder();
    await expect(toolsWith(exec).callTool('axiom_xcsym_crash', {})).rejects.toThrow(/file/);
    await expect(toolsWith(exec).callTool('axiom_xcsym_find_dsym', {})).rejects.toThrow(/uuid/);
    await expect(toolsWith(exec).callTool('axiom_xcsym_resolve', { dsym: 'A', loadAddr: '0x0' })).rejects.toThrow(/addresses/);
    await expect(toolsWith(exec).callTool('axiom_xcsym_resolve', { addresses: ['0x0'], loadAddr: '0x0' })).rejects.toThrow(/dsym/);
  });
});

describe.runIf(onMac)('XcsymTools.callTool results', () => {
  it('returns stdout on success', async () => {
    const { exec } = recorder({ stdout: '{"tool":"xcsym","ok":true}' });
    const res = await toolsWith(exec).callTool('axiom_xcsym_list_dsyms', {});
    expect(res.content[0].text).toBe('{"tool":"xcsym","ok":true}');
  });

  it('surfaces the JSON report when crash exits non-zero for missing dSYMs', async () => {
    // exit 2 means "report produced, some dSYMs missing" — not a failure.
    const { exec } = recorder({ code: 2, stdout: '{"report":{"symbolicated":false}}' });
    const res = await toolsWith(exec).callTool('axiom_xcsym_crash', { file: 'crash.ips' });
    expect(res.content[0].text).toContain('{"report":{"symbolicated":false}}');
    expect(res.content[0].text).toContain('exit 2');
  });

  it('surfaces stderr on a hard failure with no stdout', async () => {
    const { exec } = recorder({ code: 5, stdout: '', stderr: 'unsupported or unrecognized crash format' });
    const res = await toolsWith(exec).callTool('axiom_xcsym_crash', { file: 'notes.txt' });
    expect(res.content[0].text).toContain('unsupported or unrecognized crash format');
    expect(res.content[0].text).toContain('exit 5');
  });

  it('reports an honest message when the binary is absent', async () => {
    const { exec } = recorder();
    const tools = new XcsymTools({ binaryPath: '/nonexistent/path/to/xcsym', exec });
    const res = await tools.callTool('axiom_xcsym_list_dsyms', {});
    expect(res.content[0].text).toContain('not found');
    expect(res.content[0].text).toContain('/nonexistent/path/to/xcsym');
  });
});
