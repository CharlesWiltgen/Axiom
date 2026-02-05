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
  describe('handleRunAgent', () => {
    it('returns inline error for missing agent instead of throwing', async () => {
      const loader = makeMockLoader({ getAgent: vi.fn().mockResolvedValue(undefined) });
      const handler = new DynamicToolsHandler(loader, mockLogger);

      const result = await handler.callTool('axiom_run_agent', { agent: 'nonexistent' });

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

      const result = await handler.callTool('axiom_run_agent', { agent: 'build-fixer' });

      expect(result.content[0].text).toContain('build-fixer');
      expect(result.content[0].text).toContain('Instructions here');
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
        axiom_run_agent: 'Get Axiom Agent Instructions',
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
