import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeBundleStats, generateBundle } from './bundle.js';
import type { BundleV2 } from '../loader/types.js';
import { makeSkill, makeAgent } from '../test-helpers.js';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { MCP_TOOL_BINARIES } from '../tools/binaries.js';
import { scanReferencedToolBinaries } from './binary-coverage.js';

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
