import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parseSkill, parseCommand, parseAgent, Skill, Command, Agent } from './parser.js';
import { Logger } from '../config.js';
import { Loader } from './types.js';

/**
 * Development mode loader - reads live files from Claude Code plugin directory
 */
export class DevLoader implements Loader {
  private skillsCache = new Map<string, Skill>();
  private commandsCache = new Map<string, Command>();
  private agentsCache = new Map<string, Agent>();

  constructor(
    private pluginPath: string,
    private logger: Logger
  ) {}

  /**
   * Load all skills from the plugin directory
   */
  async loadSkills(): Promise<Map<string, Skill>> {
    const skillsDir = join(this.pluginPath, 'skills');
    this.logger.debug(`Loading skills from: ${skillsDir}`);

    try {
      const files = await readdir(skillsDir);
      const skillFiles = files.filter(f => f.endsWith('.md'));

      this.logger.info(`Found ${skillFiles.length} skill files`);

      for (const file of skillFiles) {
        const filePath = join(skillsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const skill = parseSkill(content, file);

        this.skillsCache.set(skill.name, skill);
        this.logger.debug(`Loaded skill: ${skill.name}`);
      }

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
        const filePath = join(commandsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const command = parseCommand(content, file);

        this.commandsCache.set(command.name, command);
        this.logger.debug(`Loaded command: ${command.name}`);
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

  /**
   * Get a specific skill by name
   */
  async getSkill(name: string): Promise<Skill | undefined> {
    if (this.skillsCache.size === 0) {
      await this.loadSkills();
    }
    return this.skillsCache.get(name);
  }

  /**
   * Get a specific command by name
   */
  async getCommand(name: string): Promise<Command | undefined> {
    if (this.commandsCache.size === 0) {
      await this.loadCommands();
    }
    return this.commandsCache.get(name);
  }

  /**
   * Get a specific agent by name
   */
  async getAgent(name: string): Promise<Agent | undefined> {
    if (this.agentsCache.size === 0) {
      await this.loadAgents();
    }
    return this.agentsCache.get(name);
  }

  /**
   * Get all skills
   */
  getSkills(): Map<string, Skill> {
    return this.skillsCache;
  }

  /**
   * Get all commands
   */
  getCommands(): Map<string, Command> {
    return this.commandsCache;
  }

  /**
   * Get all agents
   */
  getAgents(): Map<string, Agent> {
    return this.agentsCache;
  }
}
