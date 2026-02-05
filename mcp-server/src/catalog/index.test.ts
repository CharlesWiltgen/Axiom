import { describe, it, expect } from 'vitest';
import { buildCatalog } from './index.js';
import type { Skill, Agent } from '../loader/parser.js';

function makeSkill(overrides: Partial<Skill> & { name: string }): Skill {
  return {
    description: '',
    content: '',
    skillType: 'discipline',
    source: 'axiom',
    tags: [],
    related: [],
    sections: [],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> & { name: string }): Agent {
  return {
    description: '',
    content: '',
    ...overrides,
  };
}

describe('buildCatalog', () => {
  it('categorizes skills and includes agents', () => {
    const skills = new Map<string, Skill>([
      ['axiom-memory-debugging', makeSkill({
        name: 'axiom-memory-debugging',
        description: 'Memory debugging',
      })],
    ]);
    const agents = new Map<string, Agent>([
      ['build-fixer', makeAgent({ name: 'build-fixer', description: 'Fixes builds' })],
    ]);

    const result = buildCatalog(skills, agents);

    expect(result.totalSkills).toBe(1);
    expect(result.totalAgents).toBe(1);
    expect(result.agents).toEqual([{ name: 'build-fixer', description: 'Fixes builds' }]);
  });

  it('excludes router and meta skills', () => {
    const skills = new Map<string, Skill>([
      ['axiom-ios-build', makeSkill({ name: 'axiom-ios-build', skillType: 'router' })],
      ['axiom-using-axiom', makeSkill({ name: 'axiom-using-axiom', skillType: 'meta' })],
      ['axiom-regular', makeSkill({ name: 'axiom-regular', skillType: 'discipline' })],
    ]);

    const result = buildCatalog(skills, new Map());

    expect(result.totalSkills).toBe(1);
  });

  it('filters by category when provided', () => {
    const skills = new Map<string, Skill>([
      ['axiom-memory-debugging', makeSkill({ name: 'axiom-memory-debugging' })],
      ['axiom-swiftui-nav', makeSkill({ name: 'axiom-swiftui-nav' })],
    ]);

    const result = buildCatalog(skills, new Map(), 'UI & Design');

    expect(result.totalSkills).toBe(1);
    expect(Object.keys(result.categories)).toEqual(['UI & Design']);
  });

  it('excludes agents when filtering by category', () => {
    const skills = new Map<string, Skill>([
      ['axiom-swiftui-nav', makeSkill({ name: 'axiom-swiftui-nav' })],
    ]);
    const agents = new Map<string, Agent>([
      ['build-fixer', makeAgent({ name: 'build-fixer', description: 'Fixes builds' })],
    ]);

    const result = buildCatalog(skills, agents, 'UI & Design');

    expect(result.agents).toEqual([]);
  });

  it('sorts skills within each category by name', () => {
    const skills = new Map<string, Skill>([
      ['axiom-swiftui-nav', makeSkill({ name: 'axiom-swiftui-nav' })],
      ['axiom-liquid-glass', makeSkill({ name: 'axiom-liquid-glass' })],
      ['axiom-auto-layout-debugging', makeSkill({ name: 'axiom-auto-layout-debugging' })],
    ]);

    const result = buildCatalog(skills, new Map());
    const uiSkills = result.categories['UI & Design']?.skills ?? [];
    const names = uiSkills.map(s => s.name);

    expect(names).toEqual([...names].sort());
  });

  it('sorts agents alphabetically', () => {
    const agents = new Map<string, Agent>([
      ['z-agent', makeAgent({ name: 'z-agent' })],
      ['a-agent', makeAgent({ name: 'a-agent' })],
    ]);

    const result = buildCatalog(new Map(), agents);

    expect(result.agents[0].name).toBe('a-agent');
    expect(result.agents[1].name).toBe('z-agent');
  });

  it('categorizes Apple docs correctly', () => {
    const skills = new Map<string, Skill>([
      ['apple-guide-swiftui-liquid-glass', makeSkill({
        name: 'apple-guide-swiftui-liquid-glass',
        source: 'apple',
        skillType: 'reference',
      })],
      ['apple-diag-actor-isolation', makeSkill({
        name: 'apple-diag-actor-isolation',
        source: 'apple',
        skillType: 'diagnostic',
      })],
    ]);

    const result = buildCatalog(skills, new Map());

    expect(result.totalSkills).toBe(2);
    // Apple guide with 'swiftui' → UI & Design
    const uiSkills = result.categories['UI & Design']?.skills ?? [];
    expect(uiSkills.some(s => s.name === 'apple-guide-swiftui-liquid-glass')).toBe(true);
    // Apple diag → Build & Environment
    const buildSkills = result.categories['Build & Environment']?.skills ?? [];
    expect(buildSkills.some(s => s.name === 'apple-diag-actor-isolation')).toBe(true);
  });

  it('returns empty catalog for no skills and agents', () => {
    const result = buildCatalog(new Map(), new Map());

    expect(result.totalSkills).toBe(0);
    expect(result.totalAgents).toBe(0);
    expect(result.agents).toEqual([]);
    expect(Object.keys(result.categories)).toEqual([]);
  });
});
