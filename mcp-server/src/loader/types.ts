import { Skill, Command, Agent } from './parser.js';

/**
 * Common interface for both DevLoader and ProdLoader
 * Ensures both loaders provide the same methods to handlers
 */
export interface Loader {
  /**
   * Load all skills
   */
  loadSkills(): Promise<Map<string, Skill>>;

  /**
   * Load all commands
   */
  loadCommands(): Promise<Map<string, Command>>;

  /**
   * Load all agents
   */
  loadAgents(): Promise<Map<string, Agent>>;

  /**
   * Get a specific skill by name
   */
  getSkill(name: string): Promise<Skill | undefined>;

  /**
   * Get a specific command by name
   */
  getCommand(name: string): Promise<Command | undefined>;

  /**
   * Get a specific agent by name
   */
  getAgent(name: string): Promise<Agent | undefined>;
}
