import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: ToolAnnotations;
}

interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: string; text: string }>;
}

/**
 * Dynamic toolset handler implementing 4 tools:
 * - axiom_get_catalog: Structured taxonomy of skills by category
 * - axiom_search_skills: BM25 text search with ranked results
 * - axiom_read_skill: Section-filtered content delivery
 * - axiom_get_agent: Agent instructions and metadata
 */
export class DynamicToolsHandler {
  constructor(
    private loader: Loader,
    private logger: Logger,
  ) {}

  async listTools(): Promise<{ tools: McpTool[] }> {
    return {
      tools: [
        {
          name: 'axiom_get_catalog',
          description: 'Get the Axiom skills catalog organized by category. Returns skill names, types, and descriptions grouped into categories like "UI & Design", "Data & Persistence", etc.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Filter to a specific category (e.g. "UI & Design"). Omit for all categories.',
              },
              includeDescriptions: {
                type: 'boolean',
                description: 'Include skill descriptions in output. Default false for compact listing.',
              },
            },
          },
          annotations: {
            title: 'Browse Axiom Skills Catalog',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: 'axiom_search_skills',
          description: 'Search Axiom skills by keyword query. Returns ranked results with matching section names. Use to find relevant skills for a topic like "data race", "SwiftUI navigation", or "memory leak".',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g. "data race swift 6", "SwiftUI performance")',
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return. Default 10.',
              },
              skillType: {
                type: 'string',
                enum: ['discipline', 'reference', 'diagnostic'],
                description: 'Filter by skill type.',
              },
              category: {
                type: 'string',
                description: 'Filter by category name.',
              },
              source: {
                type: 'string',
                enum: ['axiom', 'apple'],
                description: 'Filter by content source.',
              },
            },
            required: ['query'],
          },
          annotations: {
            title: 'Search Axiom Skills',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: 'axiom_read_skill',
          description: 'Read skill content with optional section filtering. Supports reading specific sections to reduce token usage (~3 KB per section vs ~26 KB full skill). Can read multiple skills in one call.',
          inputSchema: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Skill name (e.g. "axiom-swift-concurrency")',
                    },
                    sections: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Section headings to include (case-insensitive substring match). Omit for full content.',
                    },
                  },
                  required: ['name'],
                },
                description: 'Skills to read. Each can specify section filters.',
              },
              listSections: {
                type: 'boolean',
                description: 'If true, return only the section table of contents (heading + size) without content.',
              },
            },
            required: ['skills'],
          },
          annotations: {
            title: 'Read Axiom Skill Content',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: 'axiom_get_agent',
          description: 'Get agent instructions and metadata for an Axiom agent. Returns the agent\'s full prompt and configuration.',
          inputSchema: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                description: 'Agent name (e.g. "build-fixer", "accessibility-auditor")',
              },
            },
            required: ['agent'],
          },
          annotations: {
            title: 'Get Axiom Agent Instructions',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
      ],
    };
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResponse> {
    this.logger.debug(`Handling tools/call: ${name}`);

    switch (name) {
      case 'axiom_get_catalog':
        return this.handleGetCatalog(args);
      case 'axiom_search_skills':
        return this.handleSearchSkills(args);
      case 'axiom_read_skill':
        return this.handleReadSkill(args);
      case 'axiom_get_agent':
        return this.handleGetAgent(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async handleGetCatalog(args: Record<string, any>): Promise<ToolResponse> {
    const catalog = await this.loader.getCatalog(args.category);
    const includeDescriptions = args.includeDescriptions === true;
    const lines: string[] = [];

    lines.push(`# Axiom Skills Catalog`);
    lines.push(`${catalog.totalSkills} skills, ${catalog.totalAgents} agents`);
    lines.push('');

    const sortedCategories = Object.entries(catalog.categories)
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [, category] of sortedCategories) {
      lines.push(`## ${category.label} (${category.skills.length})`);

      for (const skill of category.skills) {
        const typeTag = skill.skillType !== 'discipline' ? ` [${skill.skillType}]` : '';
        const sourceTag = skill.source === 'apple' ? ' [Apple]' : '';
        if (includeDescriptions) {
          lines.push(`- **${skill.name}**${typeTag}${sourceTag}: ${skill.description}`);
        } else {
          lines.push(`- ${skill.name}${typeTag}${sourceTag}`);
        }
      }
      lines.push('');
    }

    if (catalog.agents.length > 0) {
      lines.push(`## Agents (${catalog.agents.length})`);
      for (const agent of catalog.agents) {
        if (includeDescriptions) {
          lines.push(`- **${agent.name}**: ${agent.description}`);
        } else {
          lines.push(`- ${agent.name}`);
        }
      }
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  private async handleSearchSkills(args: Record<string, any>): Promise<ToolResponse> {
    if (!args.query || typeof args.query !== 'string') {
      throw new Error('Required parameter "query" must be a non-empty string');
    }

    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));

    const results = await this.loader.searchSkills(args.query, {
      limit,
      skillType: args.skillType,
      category: args.category,
      source: args.source,
    });

    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No skills found for query: "${args.query}"` }] };
    }

    const lines: string[] = [];
    lines.push(`# Search Results for "${args.query}"`);
    lines.push(`${results.length} results`);
    lines.push('');

    for (const result of results) {
      const typeTag = result.skillType !== 'discipline' ? ` [${result.skillType}]` : '';
      const sourceTag = result.source === 'apple' ? ' [Apple]' : '';
      const catTag = result.category ? ` (${result.category})` : '';
      lines.push(`### ${result.name}${typeTag}${sourceTag}${catTag}`);
      lines.push(`Score: ${result.score.toFixed(2)}`);
      lines.push(result.description);
      if (result.matchingSections.length > 0) {
        lines.push(`Matching sections: ${result.matchingSections.join(', ')}`);
      }
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  private async handleReadSkill(args: Record<string, any>): Promise<ToolResponse> {
    if (!args.skills || !Array.isArray(args.skills) || args.skills.length === 0) {
      throw new Error('Required parameter "skills" must be a non-empty array');
    }

    if (args.skills.length > 10) {
      return { content: [{ type: 'text', text: `Too many skills requested (${args.skills.length}). Maximum is 10 per call.` }] };
    }

    const listSections = args.listSections === true;
    const parts: string[] = [];

    for (const skillReq of args.skills) {
      if (!skillReq.name || typeof skillReq.name !== 'string') {
        throw new Error('Each skill entry must have a "name" string');
      }

      if (listSections) {
        const skill = await this.loader.getSkill(skillReq.name);
        if (!skill) {
          parts.push(`## ${skillReq.name}\nSkill not found.\n`);
          continue;
        }

        parts.push(`## ${skill.name} — Sections`);
        parts.push(`Type: ${skill.skillType} | Total: ${skill.content.length} chars`);
        parts.push('');
        parts.push('| Section | Chars |');
        parts.push('|---------|-------|');
        for (const section of skill.sections) {
          parts.push(`| ${section.heading} | ${section.charCount} |`);
        }
        parts.push('');
      } else {
        const result = await this.loader.getSkillSections(skillReq.name, skillReq.sections);
        if (!result) {
          parts.push(`## ${skillReq.name}\nSkill not found.\n`);
          continue;
        }

        if (skillReq.sections && skillReq.sections.length > 0) {
          parts.push(`## ${result.skill.name} (filtered: ${result.sections.map(s => s.heading).join(', ')})`);
        } else {
          parts.push(`## ${result.skill.name}`);
        }
        parts.push(`Type: ${result.skill.skillType} | ${result.content.length} chars`);
        parts.push('');
        parts.push(result.content);

        if (result.skill.related && result.skill.related.length > 0) {
          parts.push('');
          parts.push(`**Related Skills**: ${result.skill.related.join(', ')}`);
        }
        parts.push('');
      }
    }

    return { content: [{ type: 'text', text: parts.join('\n') }] };
  }

  // Validation errors (bad input) throw; not-found errors (valid input, missing data) return inline
  private async handleGetAgent(args: Record<string, any>): Promise<ToolResponse> {
    if (!args.agent || typeof args.agent !== 'string') {
      throw new Error('Required parameter "agent" must be a non-empty string');
    }

    const agent = await this.loader.getAgent(args.agent);
    if (!agent) {
      return { content: [{ type: 'text', text: `Agent not found: "${args.agent}". Use axiom_get_catalog to see available agents.` }] };
    }

    const lines: string[] = [];
    lines.push(`# Agent: ${agent.name}`);
    lines.push(`${agent.description}`);
    if (agent.model) {
      lines.push(`Model: ${agent.model}`);
    }
    lines.push('');
    lines.push(agent.content);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
}
