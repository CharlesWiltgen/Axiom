import { readFile } from 'fs/promises';
import { join } from 'path';
import { Skill, Command, Agent } from './parser.js';
import { Logger } from '../config.js';
import { Loader } from './types.js';

/**
 * Bundle format (matches output from scripts/bundle.ts)
 */
interface Bundle {
  version: string;
  generatedAt: string;
  skills: Record<string, Skill>;
  commands: Record<string, Command>;
  agents: Record<string, Agent>;
}

/**
 * Production mode loader - reads from pre-generated bundle.json
 */
export class ProdLoader implements Loader {
  private skillsCache = new Map<string, Skill>();
  private commandsCache = new Map<string, Command>();
  private agentsCache = new Map<string, Agent>();
  private loaded = false;

  constructor(
    private bundlePath: string,
    private logger: Logger
  ) {}

  /**
   * Load bundle from disk (called once on startup)
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    this.logger.info(`Loading bundle from: ${this.bundlePath}`);

    try {
      const content = await readFile(this.bundlePath, 'utf-8');
      const bundle: Bundle = JSON.parse(content);

      this.logger.info(`Bundle version: ${bundle.version}`);
      this.logger.info(`Bundle generated: ${bundle.generatedAt}`);

      // Populate caches
      for (const [name, skill] of Object.entries(bundle.skills)) {
        this.skillsCache.set(name, skill);
      }

      for (const [name, command] of Object.entries(bundle.commands)) {
        this.commandsCache.set(name, command);
      }

      for (const [name, agent] of Object.entries(bundle.agents)) {
        this.agentsCache.set(name, agent);
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

  /**
   * Load all skills (returns cached data)
   */
  async loadSkills(): Promise<Map<string, Skill>> {
    await this.ensureLoaded();
    return this.skillsCache;
  }

  /**
   * Load all commands (returns cached data)
   */
  async loadCommands(): Promise<Map<string, Command>> {
    await this.ensureLoaded();
    return this.commandsCache;
  }

  /**
   * Load all agents (returns cached data)
   */
  async loadAgents(): Promise<Map<string, Agent>> {
    await this.ensureLoaded();
    return this.agentsCache;
  }

  /**
   * Get a specific skill by name
   */
  async getSkill(name: string): Promise<Skill | undefined> {
    await this.ensureLoaded();
    return this.skillsCache.get(name);
  }

  /**
   * Get a specific command by name
   */
  async getCommand(name: string): Promise<Command | undefined> {
    await this.ensureLoaded();
    return this.commandsCache.get(name);
  }

  /**
   * Get a specific agent by name
   */
  async getAgent(name: string): Promise<Agent | undefined> {
    await this.ensureLoaded();
    return this.agentsCache.get(name);
  }

  /**
   * Get all skills (cached)
   */
  getSkills(): Map<string, Skill> {
    return this.skillsCache;
  }

  /**
   * Get all commands (cached)
   */
  getCommands(): Map<string, Command> {
    return this.commandsCache;
  }

  /**
   * Get all agents (cached)
   */
  getAgents(): Map<string, Agent> {
    return this.agentsCache;
  }
}
