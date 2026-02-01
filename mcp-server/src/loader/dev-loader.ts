import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { parseSkill, parseCommand, parseAgent, Skill, Command, Agent, SkillSection } from './parser.js';
import { Logger } from '../config.js';
import { Loader } from './types.js';
import { buildIndex, search, SearchIndex, SearchResult } from '../search/index.js';
import { buildCatalog, CatalogResult } from '../catalog/index.js';

/**
 * Development mode loader - reads live files from Claude Code plugin directory
 */
export class DevLoader implements Loader {
  private skillsCache = new Map<string, Skill>();
  private commandsCache = new Map<string, Command>();
  private agentsCache = new Map<string, Agent>();
  private searchIndex: SearchIndex | null = null;

  constructor(
    private pluginPath: string,
    private logger: Logger
  ) {}

  /**
   * Load all skills from the plugin directory
   * Skills live in subdirectories: skills/<name>/SKILL.md
   */
  async loadSkills(): Promise<Map<string, Skill>> {
    const skillsDir = join(this.pluginPath, 'skills');
    this.logger.debug(`Loading skills from: ${skillsDir}`);

    try {
      const entries = await readdir(skillsDir);
      let loadedCount = 0;

      for (const entry of entries) {
        const entryPath = join(skillsDir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          const skillFile = join(entryPath, 'SKILL.md');
          try {
            const content = await readFile(skillFile, 'utf-8');
            const skill = parseSkill(content, entry);
            this.skillsCache.set(skill.name, skill);
            this.logger.debug(`Loaded skill: ${skill.name}`);
            loadedCount++;
          } catch {
            this.logger.debug(`No SKILL.md in ${entry}, skipping`);
          }
        }
      }

      this.logger.info(`Found ${loadedCount} skills`);
      return this.skillsCache;
    } catch (error) {
      this.logger.error(`Failed to load skills:`, error);
      throw error;
    }
  }

  /**
   * Load all commands from the plugin directory
   */
  async loadCommands(): Promise<Map<string, Command>> {
    const commandsDir = join(this.pluginPath, 'commands');
    this.logger.debug(`Loading commands from: ${commandsDir}`);

    try {
      const files = await readdir(commandsDir);
      const commandFiles = files.filter(f => f.endsWith('.md'));

      this.logger.info(`Found ${commandFiles.length} command files`);

      for (const file of commandFiles) {
        try {
          const filePath = join(commandsDir, file);
          const content = await readFile(filePath, 'utf-8');
          const command = parseCommand(content, file);
          this.commandsCache.set(command.name, command);
          this.logger.debug(`Loaded command: ${command.name}`);
        } catch (err) {
          this.logger.warn(`Failed to parse command ${file}, skipping`);
        }
      }

      return this.commandsCache;
    } catch (error) {
      this.logger.error(`Failed to load commands:`, error);
      throw error;
    }
  }

  /**
   * Load all agents from the plugin directory
   */
  async loadAgents(): Promise<Map<string, Agent>> {
    const agentsDir = join(this.pluginPath, 'agents');
    this.logger.debug(`Loading agents from: ${agentsDir}`);

    try {
      const files = await readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));

      this.logger.info(`Found ${agentFiles.length} agent files`);

      for (const file of agentFiles) {
        const filePath = join(agentsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const agent = parseAgent(content, file);

        this.agentsCache.set(agent.name, agent);
        this.logger.debug(`Loaded agent: ${agent.name}`);
      }

      return this.agentsCache;
    } catch (error) {
      this.logger.error(`Failed to load agents:`, error);
      throw error;
    }
  }

  async getSkill(name: string): Promise<Skill | undefined> {
    if (this.skillsCache.size === 0) {
      await this.loadSkills();
    }
    return this.skillsCache.get(name);
  }

  async getCommand(name: string): Promise<Command | undefined> {
    if (this.commandsCache.size === 0) {
      await this.loadCommands();
    }
    return this.commandsCache.get(name);
  }

  async getAgent(name: string): Promise<Agent | undefined> {
    if (this.agentsCache.size === 0) {
      await this.loadAgents();
    }
    return this.agentsCache.get(name);
  }

  async getSkillSections(
    name: string,
    sectionNames?: string[],
  ): Promise<{ skill: Skill; content: string; sections: SkillSection[] } | undefined> {
    const skill = await this.getSkill(name);
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
    if (this.skillsCache.size === 0) {
      await this.loadSkills();
    }

    if (!this.searchIndex) {
      this.logger.debug('Building search index');
      this.searchIndex = buildIndex(this.skillsCache);
      this.logger.info(`Search index built: ${this.searchIndex.docCount} documents`);
    }

    return search(this.searchIndex, query, options, this.skillsCache);
  }

  async getCatalog(category?: string): Promise<CatalogResult> {
    if (this.skillsCache.size === 0) {
      await this.loadSkills();
    }
    if (this.agentsCache.size === 0) {
      await this.loadAgents();
    }

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
