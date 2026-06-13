import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { makeDefaultExec, resolveToolPath } from './binary-exec.js';

const NODE = process.execPath;
const MB = 1024 * 1024;

describe('resolveToolPath', () => {
  it('prefers an explicit env override', () => {
    expect(resolveToolPath('xctool', 'AXIOM_XCTOOL_PATH', { mode: 'production' }, { AXIOM_XCTOOL_PATH: '/custom/xctool' }))
      .toBe('/custom/xctool');
  });

  it('resolves to the plugin bin in development mode', () => {
    expect(resolveToolPath('xctool', 'AXIOM_XCTOOL_PATH', { mode: 'development', devSourcePath: '/plug' }, {}))
      .toBe(join('/plug', 'bin', 'xctool'));
  });

  it('resolves to the packaged binary in production', () => {
    const p = resolveToolPath('xctool', 'AXIOM_XCTOOL_PATH', { mode: 'production' }, {});
    expect(p.endsWith(join('bin', 'xctool'))).toBe(true);
  });
});

describe('makeDefaultExec', () => {
  it('reports stdout and exit 0 on success', async () => {
    const exec = makeDefaultExec(5000, 64 * MB);
    const r = await exec(NODE, ['-e', "process.stdout.write('hello')"]);
    expect(r).toEqual({ stdout: 'hello', stderr: '', code: 0 });
  });

  it('relays a numeric non-zero exit with its streams', async () => {
    const exec = makeDefaultExec(5000, 64 * MB);
    const r = await exec(NODE, ['-e', "process.stderr.write('boom');process.exit(3)"]);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain('boom');
  });

  it('closes child stdin so a stdin-reading child gets EOF instead of hanging', async () => {
    // Without child.stdin.end() this child would block until the timeout and be
    // SIGTERM-killed; a clean EOF makes 'end' fire and the child exit normally.
    const exec = makeDefaultExec(3000, 64 * MB);
    const r = await exec(NODE, [
      '-e',
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write('end:'+d.length));process.stdin.resume()",
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('end:0');
  });

  it('reports truncation (not malformed JSON) when output exceeds maxBuffer', async () => {
    const exec = makeDefaultExec(5000, 16); // tiny cap
    const r = await exec(NODE, ['-e', "process.stdout.write('x'.repeat(100000))"]);
    expect(r.stdout).toBe(''); // truncated prefix discarded, not surfaced
    expect(r.stderr).toContain('exceeded');
    expect(r.stderr).toContain('truncated');
  });

  it('labels a timeout kill distinctly from a usage error', async () => {
    const exec = makeDefaultExec(200, 64 * MB);
    const r = await exec(NODE, ['-e', 'setTimeout(() => {}, 5000)']);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('timed out');
  });
});
