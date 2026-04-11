import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeBundleStats, generateBundle } from './bundle.js';
import type { BundleV2 } from '../loader/types.js';
import { makeSkill, makeAgent } from '../test-helpers.js';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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
    await mkdir(join(tmpDir, 'skills', 'axiom-test-suite', 'references'), { recursive: true });
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
      join(tmpDir, 'skills', 'axiom-test-suite', 'references', 'patterns.md'),
      `# Patterns

Common patterns.
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
});
