import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { Loader } from '../loader/types.js';
import type { SkillSection } from '../loader/parser.js';
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

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: string; text: string }>;
}

/**
 * A self-contained group of MCP tools backed by a bundled CLI binary
 * (xcprof, xclog, …). The handler merges each provider's tools into the
 * tool list and dispatches calls by `handles(name)`, so adding a new binary
 * tool means implementing this interface and registering the instance in index.ts.
 */
export interface BinaryToolProvider {
  listTools(): McpTool[];
  callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
  handles(name: string): boolean;
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
    private binaryTools: BinaryToolProvider[] = [],
  ) {}

  async listTools(): Promise<{ tools: McpTool[] }> {
    return {
      tools: [
        {
          name: 'axiom_get_catalog',
          description: 'Browse the Axiom skill catalog grouped by category (names by default; set includeDescriptions for blurbs). Start here to see what exists.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Filter to one category (e.g. "UI & Design"); omit for all.',
              },
              includeDescriptions: {
                type: 'boolean',
                description: 'Include per-skill descriptions (default false, compact).',
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
          description: 'Keyword-search Axiom skills (BM25-ranked) with matching section names. Use to locate skills for a topic, e.g. "data race", "SwiftUI navigation".',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Keywords, e.g. "data race swift 6".',
              },
              limit: {
                type: 'number',
                description: 'Max results (default 10).',
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
          description: 'Read skill content, token-efficiently. An unscoped read of a large skill returns its section index (not the full text) so you can re-read only the sections you need (~3 KB/section vs ~26 KB full). Pass sections to filter, full:true to force the whole skill, or listSections for just the index. Up to 10 skills per call.',
          inputSchema: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Skill name, e.g. "axiom-concurrency".' },
                    sections: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Section headings to include (case-insensitive substring). The token-lean path.',
                    },
                    full: {
                      type: 'boolean',
                      description: 'Force the entire skill even if large (default: large skills return their section index).',
                    },
                  },
                  required: ['name'],
                },
                description: 'Skills to read; each may scope to sections.',
              },
              listSections: {
                type: 'boolean',
                description: 'Return only the section index (heading + size), no content.',
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
          description: 'Get an Axiom agent\'s full instructions and metadata (e.g. build-fixer, accessibility-auditor).',
          inputSchema: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                description: 'Agent name, e.g. "build-fixer".',
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
        ...this.binaryTools.flatMap((t) => t.listTools()),
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
      default: {
        const provider = this.binaryTools.find((t) => t.handles(name));
        if (provider) return provider.callTool(name, args);
        throw new Error(`Unknown tool: ${name}`);
      }
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
        parts.push(...sectionTocLines(skill.skillType, skill.content.length, skill.sections));
        parts.push('');
        continue;
      }

      const result = await this.loader.getSkillSections(skillReq.name, skillReq.sections);
      if (!result) {
        parts.push(`## ${skillReq.name}\nSkill not found.\n`);
        continue;
      }

      const scoped = Array.isArray(skillReq.sections) && skillReq.sections.length > 0;
      // Section-first default: an unscoped read of a large skill returns the
      // section index instead of dumping the whole skill into context. The
      // caller re-reads with `sections` (token-lean) or `full: true` to override.
      // Only when there are ≥2 sections to choose from — otherwise the index
      // would be empty/trivial and scoping buys nothing, so deliver it whole.
      if (!scoped && skillReq.full !== true && result.content.length > fullReadLimit() && result.skill.sections.length > 1) {
        parts.push(`## ${result.skill.name} — Sections (large skill: ${result.content.length} chars > ${fullReadLimit()} limit; index shown to save context)`);
        parts.push(...sectionTocLines(result.skill.skillType, result.content.length, result.skill.sections));
        parts.push('Re-read with sections:["…"] for specific sections, or full:true for the entire skill.');
        parts.push('');
        continue;
      }

      if (scoped) {
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

/**
 * Char ceiling above which an unscoped `axiom_read_skill` returns the section
 * index instead of the full skill (the section-first default). Override via
 * AXIOM_FULL_READ_LIMIT. Default 20000 (~5k tokens) targets the genuinely-large
 * upper tail — the bundle median is ~19000 chars, so a typical skill still
 * reads whole; only the big references trip section-first, where the saving is
 * largest and a second round-trip to scope sections clearly pays off.
 */
function fullReadLimit(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.AXIOM_FULL_READ_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

/** Render a skill's section index (Type line + size table) as markdown lines. */
function sectionTocLines(skillType: string, totalChars: number, sections: SkillSection[]): string[] {
  const lines = [
    `Type: ${skillType} | Total: ${totalChars} chars`,
    '',
    '| Section | Chars |',
    '|---------|-------|',
  ];
  for (const s of sections) lines.push(`| ${s.heading} | ${s.charCount} |`);
  return lines;
}
