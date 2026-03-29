import { describe, it, expect, vi } from 'vitest';
import { DynamicToolsHandler } from './handler.js';
import type { Loader } from '../loader/types.js';
import { Logger, type Config } from '../config.js';

function makeMockLoader(overrides: Partial<Loader> = {}): Loader {
  return {
    loadSkills: vi.fn().mockResolvedValue(new Map()),
    loadCommands: vi.fn().mockResolvedValue(new Map()),
    loadAgents: vi.fn().mockResolvedValue(new Map()),
    getSkill: vi.fn().mockResolvedValue(undefined),
    getCommand: vi.fn().mockResolvedValue(undefined),
    getAgent: vi.fn().mockResolvedValue(undefined),
    getSkillSections: vi.fn().mockResolvedValue(undefined),
    searchSkills: vi.fn().mockResolvedValue([]),
    getCatalog: vi.fn().mockResolvedValue({ categories: {}, agents: [], totalSkills: 0, totalAgents: 0 }),
    ...overrides,
  };
}

const mockLogger = new Logger({ mode: 'production', enableAppleDocs: false, logLevel: 'error' } satisfies Config);

describe('DynamicToolsHandler', () => {
  describe('handleGetAgent', () => {
    it('returns inline error for missing agent instead of throwing', async () => {
      const loader = makeMockLoader({ getAgent: vi.fn().mockResolvedValue(undefined) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_get_agent', { agent: 'nonexistent' });

      expect(result.content[0].text).toContain('Agent not found');
      expect(result.content[0].text).toContain('nonexistent');
    });

    it('returns agent content when found', async () => {
      const loader = makeMockLoader({
        getAgent: vi.fn().mockResolvedValue({
          name: 'build-fixer',
          description: 'Fixes builds',
          content: 'Instructions here',
        }),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_get_agent', { agent: 'build-fixer' });

      expect(result.content[0].text).toContain('build-fixer');
      expect(result.content[0].text).toContain('Instructions here');
    });
  });

  describe('handleGetCatalog', () => {
    const catalogWithSkills = {
      categories: {
        'ui-design': {
          label: 'UI & Design',
          skills: [
            { name: 'axiom-swiftui-nav', description: 'Navigation patterns', skillType: 'discipline', source: 'axiom' },
            { name: 'axiom-swiftui-nav-ref', description: 'Navigation reference', skillType: 'reference', source: 'axiom' },
          ],
        },
        'apple-docs': {
          label: 'Apple Documentation',
          skills: [
            { name: 'liquid-glass-swiftui', description: 'Liquid Glass guide', skillType: 'reference', source: 'apple' },
          ],
        },
      },
      agents: [{ name: 'build-fixer', description: 'Fixes builds' }],
      totalSkills: 3,
      totalAgents: 1,
    };

    it('returns formatted catalog with skill names', async () => {
      const loader = makeMockLoader({ getCatalog: vi.fn().mockResolvedValue(catalogWithSkills) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_get_catalog', {});
      const text = result.content[0].text;

      expect(text).toContain('3 skills, 1 agents');
      expect(text).toContain('## UI & Design (2)');
      expect(text).toContain('- axiom-swiftui-nav');
      expect(text).toContain('- axiom-swiftui-nav-ref [reference]');
      expect(text).toContain('- liquid-glass-swiftui [reference] [Apple]');
      expect(text).toContain('## Agents (1)');
      expect(text).toContain('- build-fixer');
    });

    it('includes descriptions when includeDescriptions is true', async () => {
      const loader = makeMockLoader({ getCatalog: vi.fn().mockResolvedValue(catalogWithSkills) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_get_catalog', { includeDescriptions: true });
      const text = result.content[0].text;

      expect(text).toContain('**axiom-swiftui-nav**: Navigation patterns');
      expect(text).toContain('**build-fixer**: Fixes builds');
    });

    it('passes category filter to loader', async () => {
      const getCatalogFn = vi.fn().mockResolvedValue({ categories: {}, agents: [], totalSkills: 0, totalAgents: 0 });
      const loader = makeMockLoader({ getCatalog: getCatalogFn });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      await handler.callTool('axiom_get_catalog', { category: 'UI & Design' });

      expect(getCatalogFn).toHaveBeenCalledWith('UI & Design');
    });
  });

  describe('handleSearchSkills', () => {
    it('clamps limit to valid range', async () => {
      const searchFn = vi.fn().mockResolvedValue([]);
      const loader = makeMockLoader({ searchSkills: searchFn });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      await handler.callTool('axiom_search_skills', { query: 'test', limit: 999 });
      expect(searchFn).toHaveBeenCalledWith('test', expect.objectContaining({ limit: 50 }));

      await handler.callTool('axiom_search_skills', { query: 'test', limit: -5 });
      expect(searchFn).toHaveBeenCalledWith('test', expect.objectContaining({ limit: 1 }));

      await handler.callTool('axiom_search_skills', { query: 'test' });
      expect(searchFn).toHaveBeenCalledWith('test', expect.objectContaining({ limit: 10 }));
    });

    it('returns formatted results with scores and sections', async () => {
      const results = [
        { name: 'axiom-swift-concurrency', score: 12.5, skillType: 'discipline' as const, source: 'axiom' as const, category: 'Concurrency', description: 'Swift 6 concurrency', matchingSections: ['@MainActor', 'Sendable'] },
        { name: 'concurrency-guide', score: 8.2, skillType: 'reference' as const, source: 'apple' as const, category: undefined, description: 'Apple guide', matchingSections: [] },
      ];
      const loader = makeMockLoader({ searchSkills: vi.fn().mockResolvedValue(results) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_search_skills', { query: 'concurrency' });
      const text = result.content[0].text;

      expect(text).toContain('Search Results for "concurrency"');
      expect(text).toContain('2 results');
      expect(text).toContain('### axiom-swift-concurrency (Concurrency)');
      expect(text).toContain('Score: 12.50');
      expect(text).toContain('Matching sections: @MainActor, Sendable');
      expect(text).toContain('### concurrency-guide [reference] [Apple]');
    });

    it('returns empty message when no results found', async () => {
      const loader = makeMockLoader({ searchSkills: vi.fn().mockResolvedValue([]) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_search_skills', { query: 'xyznonexistent' });

      expect(result.content[0].text).toContain('No skills found');
      expect(result.content[0].text).toContain('xyznonexistent');
    });

    it('throws for missing query parameter', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);

      await expect(handler.callTool('axiom_search_skills', {})).rejects.toThrow('query');
    });
  });

  describe('handleReadSkill', () => {
    it('rejects more than 10 skills per request', async () => {
      const loader = makeMockLoader();
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const skills = Array.from({ length: 11 }, (_, i) => ({ name: `skill-${i}` }));
      const result = await handler.callTool('axiom_read_skill', { skills });

      expect(result.content[0].text).toContain('Too many skills');
      expect(result.content[0].text).toContain('Maximum is 10');
    });

    it('allows up to 10 skills per request', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue(undefined),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const skills = Array.from({ length: 10 }, (_, i) => ({ name: `skill-${i}` }));
      const result = await handler.callTool('axiom_read_skill', { skills });

      // Should not contain the "too many" error
      expect(result.content[0].text).not.toContain('Too many skills');
    });

    it('reports not found for missing skills', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue(undefined),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', { skills: [{ name: 'nope' }] });

      expect(result.content[0].text).toContain('Skill not found');
    });

    it('returns section TOC when listSections is true', async () => {
      const skill = {
        name: 'axiom-swift-concurrency',
        description: 'Concurrency patterns',
        content: 'full content here',
        skillType: 'discipline',
        source: 'axiom',
        sections: [
          { heading: 'Overview', level: 2, startLine: 1, endLine: 10, charCount: 500 },
          { heading: '@MainActor', level: 2, startLine: 11, endLine: 30, charCount: 1200 },
        ],
        tags: [],
        related: [],
      };
      const loader = makeMockLoader({ getSkill: vi.fn().mockResolvedValue(skill) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-swift-concurrency' }],
        listSections: true,
      });
      const text = result.content[0].text;

      expect(text).toContain('axiom-swift-concurrency — Sections');
      expect(text).toContain('| Overview | 500 |');
      expect(text).toContain('| @MainActor | 1200 |');
      expect(text).not.toContain('Related Skills');
    });

    it('listSections mode omits related skills even when present', async () => {
      const skill = {
        name: 'axiom-memory-debugging',
        description: 'Memory debugging',
        content: 'full content here',
        skillType: 'discipline',
        source: 'axiom',
        sections: [
          { heading: 'Overview', level: 2, startLine: 1, endLine: 10, charCount: 500 },
        ],
        tags: [],
        related: ['axiom-performance-profiling', 'axiom-objc-block-retain-cycles'],
      };
      const loader = makeMockLoader({ getSkill: vi.fn().mockResolvedValue(skill) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-memory-debugging' }],
        listSections: true,
      });
      const text = result.content[0].text;

      expect(text).toContain('axiom-memory-debugging — Sections');
      expect(text).not.toContain('Related Skills');
    });

    it('returns filtered content when sections specified', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue({
          skill: { name: 'axiom-swift-concurrency', skillType: 'discipline' },
          content: 'Filtered content about MainActor',
          sections: [{ heading: '@MainActor', level: 2, startLine: 11, endLine: 30, charCount: 1200 }],
        }),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-swift-concurrency', sections: ['MainActor'] }],
      });
      const text = result.content[0].text;

      expect(text).toContain('axiom-swift-concurrency (filtered: @MainActor)');
      expect(text).toContain('Filtered content about MainActor');
    });

    it('returns full content when no sections filter', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue({
          skill: { name: 'axiom-swift-concurrency', skillType: 'discipline' },
          content: 'Full skill content',
          sections: [],
        }),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-swift-concurrency' }],
      });
      const text = result.content[0].text;

      expect(text).toContain('## axiom-swift-concurrency');
      expect(text).not.toContain('filtered');
      expect(text).toContain('Full skill content');
    });

    it('includes related skills when present', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue({
          skill: {
            name: 'axiom-memory-debugging',
            skillType: 'discipline',
            related: ['axiom-performance-profiling', 'axiom-objc-block-retain-cycles'],
          },
          content: 'Memory debugging content',
          sections: [],
        }),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-memory-debugging' }],
      });
      const text = result.content[0].text;

      expect(text).toContain('**Related Skills**: axiom-performance-profiling, axiom-objc-block-retain-cycles');
    });

    it('omits related skills line when none present', async () => {
      const loader = makeMockLoader({
        getSkillSections: vi.fn().mockResolvedValue({
          skill: { name: 'axiom-swift-concurrency', skillType: 'discipline', related: [] },
          content: 'Full skill content',
          sections: [],
        }),
      });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_read_skill', {
        skills: [{ name: 'axiom-swift-concurrency' }],
      });
      const text = result.content[0].text;

      expect(text).not.toContain('Related Skills');
    });
  });

  describe('tool annotations', () => {
    it('all tools have annotations with title', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);
      const { tools } = await handler.listTools();

      for (const tool of tools) {
        expect(tool.annotations, `${tool.name} missing annotations`).toBeDefined();
        expect(tool.annotations!.title, `${tool.name} missing title`).toBeDefined();
        expect(typeof tool.annotations!.title).toBe('string');
      }
    });

    it('all tools are marked read-only', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);
      const { tools } = await handler.listTools();

      for (const tool of tools) {
        expect(tool.annotations!.readOnlyHint, `${tool.name} should be readOnlyHint: true`).toBe(true);
      }
    });

    it('all tools are marked closed-world', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);
      const { tools } = await handler.listTools();

      for (const tool of tools) {
        expect(tool.annotations!.openWorldHint, `${tool.name} should be openWorldHint: false`).toBe(false);
      }
    });

    it('has expected titles for each tool', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);
      const { tools } = await handler.listTools();

      const titles = Object.fromEntries(tools.map(t => [t.name, t.annotations!.title]));
      expect(titles).toEqual({
        axiom_get_catalog: 'Browse Axiom Skills Catalog',
        axiom_search_skills: 'Search Axiom Skills',
        axiom_read_skill: 'Read Axiom Skill Content',
        axiom_get_agent: 'Get Axiom Agent Instructions',
      });
    });
  });

  describe('unknown tool', () => {
    it('throws for unknown tool name', async () => {
      const handler = new DynamicToolsHandler(makeMockLoader(), mockLogger);

      await expect(handler.callTool('unknown_tool', {})).rejects.toThrow('Unknown tool');
    });
  });
});
