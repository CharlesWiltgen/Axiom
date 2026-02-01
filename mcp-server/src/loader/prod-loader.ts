import { readFile } from 'fs/promises';
import { join } from 'path';
import { Skill, Command, Agent, SkillSection } from './parser.js';
import { Logger } from '../config.js';
import { Loader } from './types.js';
import { SearchIndex, deserializeIndex, search, buildIndex, serializeIndex, SearchResult } from '../search/index.js';
import { buildCatalog, CatalogResult } from '../catalog/index.js';

interface BundleV2 {
  version: string;
  generatedAt: string;
  skills: Record<string, Skill>;
  commands: Record<string, Command>;
  agents: Record<string, Agent>;
  catalog?: any;
  searchIndex?: any;
}

/**
 * Production mode loader - reads from pre-generated bundle.json
 */
export class ProdLoader implements Loader {
  private skillsCache = new Map<string, Skill>();
  private commandsCache = new Map<string, Command>();
  private agentsCache = new Map<string, Agent>();
  private searchIdx: SearchIndex | null = null;
  private loaded = false;

  constructor(
    private bundlePath: string,
    private logger: Logger
  ) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    this.logger.info(`Loading bundle from: ${this.bundlePath}`);

    try {
      const content = await readFile(this.bundlePath, 'utf-8');
      const bundle: BundleV2 = JSON.parse(content);

      this.logger.info(`Bundle version: ${bundle.version}`);
      this.logger.info(`Bundle generated: ${bundle.generatedAt}`);

      for (const [name, skill] of Object.entries(bundle.skills)) {
        this.skillsCache.set(name, skill);
      }

      for (const [name, command] of Object.entries(bundle.commands)) {
        this.commandsCache.set(name, command);
      }

      for (const [name, agent] of Object.entries(bundle.agents)) {
        this.agentsCache.set(name, agent);
      }

      // Load pre-computed search index or build one
      if (bundle.searchIndex) {
        this.searchIdx = deserializeIndex(bundle.searchIndex);
        this.logger.info(`Search index loaded from bundle: ${this.searchIdx.docCount} documents`);
      } else {
        this.searchIdx = buildIndex(this.skillsCache);
        this.logger.info(`Search index built at startup: ${this.searchIdx.docCount} documents`);
      }

      this.logger.info(`Loaded ${this.skillsCache.size} skills`);
      this.logger.info(`Loaded ${this.commandsCache.size} commands`);
      this.logger.info(`Loaded ${this.agentsCache.size} agents`);

      this.loaded = true;
    } catch (error) {
      this.logger.error('Failed to load bundle:', error);
      throw error;
    }
  }

  async loadSkills(): Promise<Map<string, Skill>> {
    await this.ensureLoaded();
    return this.skillsCache;
  }

  async loadCommands(): Promise<Map<string, Command>> {
    await this.ensureLoaded();
    return this.commandsCache;
  }

  async loadAgents(): Promise<Map<string, Agent>> {
    await this.ensureLoaded();
    return this.agentsCache;
  }

  async getSkill(name: string): Promise<Skill | undefined> {
    await this.ensureLoaded();
    return this.skillsCache.get(name);
  }

  async getCommand(name: string): Promise<Command | undefined> {
    await this.ensureLoaded();
    return this.commandsCache.get(name);
  }

  async getAgent(name: string): Promise<Agent | undefined> {
    await this.ensureLoaded();
    return this.agentsCache.get(name);
  }

  async getSkillSections(
    name: string,
    sectionNames?: string[],
  ): Promise<{ skill: Skill; content: string; sections: SkillSection[] } | undefined> {
    await this.ensureLoaded();

    const skill = this.skillsCache.get(name);
    if (!skill) return undefined;

    if (!sectionNames || sectionNames.length === 0) {
      return { skill, content: skill.content, sections: skill.sections };
    }

    const lines = skill.content.split('\n');
    const matchedSections: SkillSection[] = [];
    const contentParts: string[] = [];

    for (const section of skill.sections) {
      const matches = sectionNames.some(filter =>
        section.heading.toLowerCase().includes(filter.toLowerCase()),
      );
      if (matches) {
        matchedSections.push(section);
        contentParts.push(lines.slice(section.startLine, section.endLine + 1).join('\n'));
      }
    }

    return {
      skill,
      content: contentParts.join('\n\n'),
      sections: matchedSections,
    };
  }

  async searchSkills(
    query: string,
    options?: { limit?: number; skillType?: string; category?: string },
  ): Promise<SearchResult[]> {
    await this.ensureLoaded();
    return search(this.searchIdx!, query, options, this.skillsCache);
  }

  async getCatalog(category?: string): Promise<CatalogResult> {
    await this.ensureLoaded();
    return buildCatalog(this.skillsCache, this.agentsCache, category);
  }

  getSkills(): Map<string, Skill> {
    return this.skillsCache;
  }

  getCommands(): Map<string, Command> {
    return this.commandsCache;
  }

  getAgents(): Map<string, Agent> {
    return this.agentsCache;
  }
}
