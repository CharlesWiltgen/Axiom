import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeBundleStats, generateBundle, copyToolBinaries } from './bundle.js';
import { isGeneratedSubSkill } from '../loader/parser.js';
import type { BundleV2 } from '../loader/types.js';
import { makeSkill, makeAgent } from '../test-helpers.js';
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { MCP_TOOL_BINARIES } from '../tools/binaries.js';
import { referenceMismatches, scanReferencedToolBinaries } from './binary-coverage.js';
import { XclogTools } from '../tools/xclog.js';
import { XcsymTools } from '../tools/xcsym.js';
import { XcprofTools } from '../tools/xcprof.js';

describe('MCP tool binary coverage', () => {
  // The bundler copies exactly MCP_TOOL_BINARIES; assert that list matches the
  // binaries the MCP tools actually resolve under bin/. The scan is shared with
  // pre-deploy step 12h (binary-coverage.ts) so the two guards can't drift.
  it('MCP_TOOL_BINARIES matches the bin/<name> refs in src/tools/*.ts', () => {
    const toolsDir = fileURLToPath(new URL('../tools', import.meta.url));
    const referenced = scanReferencedToolBinaries(toolsDir);
    expect([...referenced].sort()).toEqual([...MCP_TOOL_BINARIES].sort());
  });

  it('MCP_TOOL_BINARIES is non-empty with no duplicates', () => {
    expect(MCP_TOOL_BINARIES.length).toBeGreaterThan(0);
    expect(new Set(MCP_TOOL_BINARIES).size).toBe(MCP_TOOL_BINARIES.length);
  });
});

describe('referenceMismatches', () => {
  const tools = [
    { name: 'axiom_demo_crash', inputSchema: { properties: { file: {}, format: { enum: ['summary', 'standard'] } }, required: ['file'] } },
    { name: 'axiom_demo_anonymize', inputSchema: { properties: { file: {}, output: {} }, required: ['file'] } },
  ];
  const crashRow = '| `demo crash <file>` | `axiom_demo_crash` | `file` | `--format`→`format` |';
  const anonymizeRow = '| `demo anonymize <file>` | `axiom_demo_anonymize` | `file` | `--output`→`output` |';
  const reference = (rows: string[], prose = '', pi = '- **Pi** — check `command -v demo` first.') =>
    `## Invocation\n\n${pi}\n\n| CLI subcommand | MCP tool | Required input | Flags → params |\n|---|---|---|---|\n${rows.join('\n')}\n\n${prose}\n\n## Next\n`;

  it.each([
    ['nothing when the section agrees with the schemas', [crashRow, anonymizeRow], '`crash` has no `output`; pass `output` to `anonymize`.', undefined, []],
    ['a row flag the row\'s tool lacks', ['| `demo crash <file>` | `axiom_demo_crash` | `file` | `--format`→`format`, `--output`→`output` |', anonymizeRow], '', undefined,
      ['`--output`→`output`: axiom_demo_crash has no `output`']],
    ['a table input the tool lacks', ['| `demo crash <file>` | `axiom_demo_crash` | `file`, `path` | `--format`→`format` |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row lists `path`, which the tool lacks']],
    ['an omitted required input', ['| `demo crash <file>` | `axiom_demo_crash` | — | `--format`→`format` |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row omits required `file` from Required input']],
    ['an omitted optional param', ['| `demo crash <file>` | `axiom_demo_crash` | `file` | — |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row omits `format`']],
    ['a tool with no table row', [crashRow], '', undefined, ['no table row for axiom_demo_anonymize']],
    ['a row for a tool the server does not register', [crashRow, anonymizeRow, '| `demo resolve` | `axiom_demo_resolve` | — | — |'], '', undefined,
      ['table row for unregistered axiom_demo_resolve']],
    ['a duplicate row', [crashRow, anonymizeRow, crashRow], '', undefined, ['duplicate table row for axiom_demo_crash']],
    ...['`--format` → `format`', '`--format`->`format`', '--format→format'].map((cell) => [
      `an unreadable mapping (${cell})`, [`| \`demo crash <file>\` | \`axiom_demo_crash\` | \`file\` | ${cell} |`, anonymizeRow], '', undefined,
      [`axiom_demo_crash row has an unreadable mapping: ${cell}`, 'axiom_demo_crash row omits `format`'],
    ] as const),
    ['a flag mapping outside the table', [crashRow, anonymizeRow], 'Use `--output` -> `output` there.', undefined,
      ['flag mapping outside the table: `--output` ->', 'prose names `output` without the subcommand it belongs to']],
    ['prose giving a subcommand a param it lacks', [crashRow, anonymizeRow], '`crash` and `anonymize` take `output`.', undefined,
      ['prose gives `crash` the param `output`, which it lacks; write one subcommand per clause and `no` directly before each denied param']],
    ['prose denying a subcommand a param it has', [crashRow, anonymizeRow], '`anonymize` has no `output`.', undefined,
      ['prose says `anonymize` has no `output`, but it does; write one subcommand per clause and `no` directly before each denied param']],
    ['a Pi bullet without a command -v check', [crashRow, anonymizeRow], '', '- **Pi** — unsupported.', ['no Pi bullet with a `command -v demo` check']],
    ['a flag paired with another real param', ['| `demo crash <file>` | `axiom_demo_crash` | `file` | `--format`→`file` |', anonymizeRow], '', undefined,
      ['`--format`→`file`: expected `format`; put the reason for a different name in parentheses', 'axiom_demo_crash row omits `format`']],
    ['a renamed param explained in parentheses', ['| `demo crash <file>` | `axiom_demo_crash` | `file` | `--fmt`→`format` (short name) |', anonymizeRow], '', undefined, []],
    ['a mapping hidden in a parenthetical', ['| `demo crash <file>` | `axiom_demo_crash` | `file` | `--format`→`format` (or `--out`→`output`) |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row has an unreadable mapping: `--format`→`format` (or `--out`→`output`)', 'axiom_demo_crash row omits `format`']],
    ['a required input moved to the flags cell', ['| `demo crash <file>` | `axiom_demo_crash` | — | `--file`→`file`, `--format`→`format` |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row omits required `file` from Required input']],
    ['a CLI cell that names another subcommand', ['| `demo anonymize <file>` | `axiom_demo_crash` | `file` | `--format`→`format` |', anonymizeRow], '', undefined,
      ['axiom_demo_crash row\'s CLI cell `demo anonymize <file>` should start with `demo crash`']],
    ['prose naming a tool by its MCP name', [crashRow, anonymizeRow], '`axiom_demo_crash` takes `output`.', undefined,
      ['prose gives `crash` the param `output`, which it lacks; write one subcommand per clause and `no` directly before each denied param']],
    ['prose naming a param no tool has', [crashRow, anonymizeRow], '`crash` takes `human`.', undefined,
      ['prose names `human`, which no axiom_demo_* tool has; unbacktick it if it is not a param']],
    ['a claim after "e.g."', [crashRow, anonymizeRow], '`crash` reads the report, e.g. a log, and takes `output`.', undefined,
      ['prose gives `crash` the param `output`, which it lacks; write one subcommand per clause and `no` directly before each denied param']],
    ['a claim beside a denial of the same param', [crashRow, anonymizeRow], '`crash` also takes `output` (no `output` cap).', undefined,
      ['prose gives `crash` the param `output`, which it lacks; write one subcommand per clause and `no` directly before each denied param']],
    ['a subjectless clause naming a param only some tools have', [crashRow, anonymizeRow], 'Pass `output` for files.', undefined,
      ['prose names `output` without the subcommand it belongs to']],
    ['nothing for an "e.g." inside a clause with no earlier subject', [crashRow, anonymizeRow], 'Pass `output`, e.g. for a fixture, to `anonymize`.', undefined, []],
    ['nothing for a param\'s enum value', [crashRow, anonymizeRow], '`crash` defaults `format` to `standard`.', undefined, []],
    ['nothing when a clause inherits its paragraph\'s subcommand', [crashRow, anonymizeRow], '`anonymize` writes files; pass `output` there.', undefined, []],
  ] as const)('reports %s', (_case, rows, prose, pi, expected) => {
    expect(referenceMismatches('demo', reference([...rows], prose, pi), tools)).toEqual(expected);
  });

  // MCP clients read these references through axiom_read_skill and have only the MCP
  // tools; Pi readers have neither the tools nor the binaries on PATH by default.
  it('finds no mismatch between each wrapped CLI reference and its live MCP tool schemas', async () => {
    const refsDir = fileURLToPath(
      new URL('../../../.claude-plugin/plugins/axiom/skills/axiom-tools/skills', import.meta.url),
    );
    const providers = {
      xclog: new XclogTools({ binaryPath: '' }),
      xcsym: new XcsymTools({ binaryPath: '' }),
      xcprof: new XcprofTools({ binaryPath: '' }),
    };
    const mismatches: Record<string, string[]> = {};
    for (const [binary, provider] of Object.entries(providers)) {
      const reference = await readFile(join(refsDir, `${binary}-ref.md`), 'utf-8');
      mismatches[binary] = referenceMismatches(binary, reference, provider.listTools());
    }
    expect(mismatches).toEqual(Object.fromEntries(MCP_TOOL_BINARIES.map((binary) => [binary, []])));
  });
});

describe('computeBundleStats', () => {
  it('computes size breakdown from a bundle', () => {
    const bundle: BundleV2 = {
      version: '2.20.0',
      generatedAt: '2026-02-04T00:00:00Z',
      skills: {
        'skill-a': makeSkill({ name: 'skill-a', description: 'test', content: 'x'.repeat(100) }),
        'skill-b': makeSkill({ name: 'skill-b', description: 'test', content: 'y'.repeat(200) }),
      },
      commands: {
        'cmd-a': { name: 'cmd-a', description: 'test', content: 'z'.repeat(50) },
      },
      agents: {
        'agent-a': makeAgent({ name: 'agent-a', description: 'test', content: 'w'.repeat(75) }),
      },
      searchIndex: { engine: {}, sectionTerms: {}, docCount: 2 } as any,
    };

    const stats = computeBundleStats(bundle);

    expect(stats.skills.count).toBe(2);
    expect(stats.commands.count).toBe(1);
    expect(stats.agents.count).toBe(1);
    expect(stats.skills.bytes).toBeGreaterThan(0);
    expect(stats.commands.bytes).toBeGreaterThan(0);
    expect(stats.agents.bytes).toBeGreaterThan(0);
    expect(stats.searchIndex.bytes).toBeGreaterThan(0);
    expect(stats.totalBytes).toBe(
      stats.skills.bytes + stats.commands.bytes + stats.agents.bytes + stats.searchIndex.bytes,
    );
    expect(stats.generatedAt).toBe('2026-02-04T00:00:00Z');
  });

  it('handles empty bundle', () => {
    const bundle: BundleV2 = {
      version: '2.20.0',
      generatedAt: '2026-02-04T00:00:00Z',
      skills: {},
      commands: {},
      agents: {},
    };

    const stats = computeBundleStats(bundle);

    expect(stats.skills.count).toBe(0);
    expect(stats.commands.count).toBe(0);
    expect(stats.agents.count).toBe(0);
    expect(stats.searchIndex.bytes).toBe(0);
    expect(stats.totalBytes).toBe(0);
  });
});

describe('generateBundle reference file discovery', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'axiom-bundle-test-'));

    // Create minimal plugin structure
    await mkdir(join(tmpDir, 'skills', 'axiom-test-suite', 'skills'), { recursive: true });
    await mkdir(join(tmpDir, 'commands'), { recursive: true });
    await mkdir(join(tmpDir, 'agents'), { recursive: true });

    // Suite SKILL.md with frontmatter
    await writeFile(
      join(tmpDir, 'skills', 'axiom-test-suite', 'SKILL.md'),
      `---
name: axiom-test-suite
description: Test suite skill.
license: MIT
---

# Test Suite

Content here.
`,
    );

    // Reference file — no frontmatter
    await writeFile(
      join(tmpDir, 'skills', 'axiom-test-suite', 'skills', 'patterns.md'),
      `# Patterns

Common patterns.
`,
    );

    // Generated inline-auditor sub-skill — must be EXCLUDED from the bundle.
    // MCP ships every auditor as a first-class agent, so the inlined copy would
    // double-count and trip pre-deploy's mcp-fidelity check. The marker matches
    // GENERATED_PREFIX in scripts/inline-auditors.ts.
    await writeFile(
      join(tmpDir, 'skills', 'axiom-test-suite', 'skills', 'codable-auditor.md'),
      `<!-- GENERATED from agents/codable-auditor.md by scripts/build-inlined-auditors.ts — do not edit. -->

# Codable Auditor

Generated auditor procedure.
`,
    );
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('includes reference files in generated bundle', async () => {
    const bundle = await generateBundle(tmpDir);

    expect(bundle.skills['axiom-test-suite']).toBeDefined();
    expect(bundle.skills['axiom-test-suite--patterns']).toBeDefined();
    expect(bundle.skills['axiom-test-suite--patterns']?.description).toBe('Common patterns.');
  });

  it('excludes generated inline-auditor sub-skills from the bundle', async () => {
    const bundle = await generateBundle(tmpDir);

    // The hand-written reference file is still bundled...
    expect(bundle.skills['axiom-test-suite--patterns']).toBeDefined();
    // ...but the generated inline-auditor copy is NOT — MCP delivers that
    // procedure as an agent, so bundling it would double-count (mirrors
    // build-codex.ts, and satisfies pre-deploy's mcp-fidelity source==bundle count).
    expect(bundle.skills['axiom-test-suite--codable-auditor']).toBeUndefined();
  });
});

describe(isGeneratedSubSkill, () => {
  // Every consumer that walks skills/*/skills/*.md must agree on what is a
  // generated inline-auditor copy, or the bundle and skill-annotations.json
  // disagree about which files exist (30 orphaned entries, 2026-08-11).
  it('identifies a generated inline-auditor copy by its build marker', () => {
    expect(isGeneratedSubSkill(
      '<!-- GENERATED from agents/codable-auditor.md by scripts/build-inlined-auditors.ts -->\n\n# Auditor'
    )).toBe(true);
  });

  it('does not claim a hand-written sub-skill that merely mentions auditors', () => {
    expect(isGeneratedSubSkill(
      '# Layout\n\nSee the GENERATED from agents/ note in the auditor docs.'
    )).toBe(false);
  });
});


describe('copyToolBinaries', () => {
  for (const missingLicense of [false, true]) {
    it(missingLicense ? 'rejects a missing xcproject license' : 'packages xcproject with its third-party license', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'axiom-binary-bundle-'));
      const plugin = join(directory, 'plugin');
      const output = join(directory, 'dist');
      try {
        await mkdir(join(plugin, 'bin'), { recursive: true });
        await mkdir(join(plugin, 'licenses'));
        for (const name of ['xcprof', 'xclog', 'xcsym', 'xcproject']) {
          await writeFile(join(plugin, 'bin', name), `fixture binary ${name}`, { mode: 0o644 });
        }
        if (!missingLicense) await writeFile(join(plugin, 'licenses/xcproject.txt'), 'fixture Apple license');
        if (missingLicense) {
          await expect(copyToolBinaries(plugin, output)).rejects.toThrow(/xcproject.*license|license.*xcproject/i);
        } else {
          await copyToolBinaries(plugin, output);
          expect(await readFile(join(output, 'bin/xcproject'), 'utf8')).toBe('fixture binary xcproject');
          expect((await stat(join(output, 'bin/xcproject'))).mode & 0o777).toBe(0o755);
          expect(await readFile(join(output, 'licenses/xcproject.txt'), 'utf8')).toBe('fixture Apple license');
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});


describe('packaged xcproject CLI', () => {
  it('exposes the native inspector through the npm bin mapping', async () => {
    const manifest = JSON.parse(await readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
    expect(manifest.bin.xcproject).toBe('./dist/bin/xcproject');
  });
});
