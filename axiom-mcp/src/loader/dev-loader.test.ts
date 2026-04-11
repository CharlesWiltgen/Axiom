import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { classifyChange, DevLoader } from './dev-loader.js';

describe('classifyChange', () => {
  it('classifies skill paths', () => {
    expect(classifyChange('skills/axiom-concurrency/SKILL.md')).toBe('skills');
    expect(classifyChange('skills/new-skill/SKILL.md')).toBe('skills');
  });

  it('classifies command paths', () => {
    expect(classifyChange('commands/fix-build.md')).toBe('commands');
    expect(classifyChange('commands/audit.md')).toBe('commands');
  });

  it('classifies agent paths', () => {
    expect(classifyChange('agents/build-fixer.md')).toBe('agents');
    expect(classifyChange('agents/accessibility-auditor.md')).toBe('agents');
  });

  it('returns null for unrelated paths', () => {
    expect(classifyChange('claude-code.json')).toBeNull();
    expect(classifyChange('hooks/session-start.sh')).toBeNull();
    expect(classifyChange('README.md')).toBeNull();
  });
});

describe('DevLoader reference file discovery', () => {
  let tmpPlugin: string;
  let loader: DevLoader;

  const noopLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const skillFrontmatter = `---
name: axiom-test-suite
description: Test suite for reference file loading
license: MIT
---

# Axiom Test Suite

A test discipline skill for validating reference file discovery.
`;

  const patternsContent = `# Patterns Reference

Use these patterns when implementing common test scenarios.

## Pattern A

First pattern.
`;

  const apiRefContent = `# API Reference

Complete API listing for the test suite.

## Core API

Main entry points.
`;

  beforeAll(async () => {
    tmpPlugin = await mkdtemp(join(tmpdir(), 'axiom-devloader-test-'));

    // Create minimal plugin structure
    const skillDir = join(tmpPlugin, 'skills', 'axiom-test-suite');
    const refsDir = join(skillDir, 'references');
    await mkdir(refsDir, { recursive: true });
    await mkdir(join(tmpPlugin, 'commands'), { recursive: true });
    await mkdir(join(tmpPlugin, 'agents'), { recursive: true });

    await writeFile(join(skillDir, 'SKILL.md'), skillFrontmatter, 'utf-8');
    await writeFile(join(refsDir, 'patterns.md'), patternsContent, 'utf-8');
    await writeFile(join(refsDir, 'api-ref.md'), apiRefContent, 'utf-8');

    loader = new DevLoader(tmpPlugin, noopLogger as any, { mode: 'dev', logLevel: 'error', enableAppleDocs: false } as any);
    await loader.loadSkills();
  });

  afterAll(async () => {
    await rm(tmpPlugin, { recursive: true, force: true });
  });

  it('discovers suite SKILL.md and its reference files', async () => {
    const skillsMap = await loader.loadSkills();
    expect(skillsMap.has('axiom-test-suite')).toBe(true);
    expect(skillsMap.has('axiom-test-suite--patterns')).toBe(true);
    expect(skillsMap.has('axiom-test-suite--api-ref')).toBe(true);
  });

  it('infers skill type from reference filename', async () => {
    const skillsMap = await loader.loadSkills();
    const patterns = skillsMap.get('axiom-test-suite--patterns');
    const apiRef = skillsMap.get('axiom-test-suite--api-ref');

    expect(patterns?.skillType).toBe('discipline');
    expect(apiRef?.skillType).toBe('reference');
  });

  it('extracts description from reference file content', async () => {
    const skillsMap = await loader.loadSkills();
    const patterns = skillsMap.get('axiom-test-suite--patterns');

    expect(patterns?.description).toBe('Use these patterns when implementing common test scenarios.');
  });

  it('makes reference files searchable', async () => {
    const results = await loader.searchSkills('patterns testing');
    const names = results.map(r => r.name);

    expect(names).toContain('axiom-test-suite--patterns');
  });
});
