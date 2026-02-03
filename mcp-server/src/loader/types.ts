import { Skill, Command, Agent, SkillSection } from './parser.js';
import type { SearchResult } from '../search/index.js';
import type { CatalogResult } from '../catalog/index.js';

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

  /**
   * Get skill content filtered to specific sections
   */
  getSkillSections(name: string, sectionNames?: string[]): Promise<{ skill: Skill; content: string; sections: SkillSection[] } | undefined>;

  /**
   * Search skills using BM25
   */
  searchSkills(query: string, options?: { limit?: number; skillType?: string; category?: string; source?: string }): Promise<SearchResult[]>;

  /**
   * Get the catalog (skills organized by category)
   */
  getCatalog(category?: string): Promise<CatalogResult>;
}
