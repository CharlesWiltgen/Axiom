import { Skill, Command, Agent, SkillSection } from './parser.js';
import { Config, Logger } from '../config.js';
import { Loader } from './types.js';
import { SearchResult } from '../search/index.js';
import { CatalogResult } from '../catalog/index.js';
/**
 * Production mode loader - reads from pre-generated bundle.json
 */
export declare class ProdLoader implements Loader {
    private bundlePath;
    private logger;
    private config?;
    private skillsCache;
    private commandsCache;
    private agentsCache;
    private searchIdx;
    private catalogCache;
    private loaded;
    constructor(bundlePath: string, logger: Logger, config?: Config | undefined);
    private ensureLoaded;
    loadSkills(): Promise<Map<string, Skill>>;
    loadCommands(): Promise<Map<string, Command>>;
    loadAgents(): Promise<Map<string, Agent>>;
    getNames(): Promise<{
        skills: string[];
        agents: string[];
    }>;
    getSkill(name: string): Promise<Skill | undefined>;
    getCommand(name: string): Promise<Command | undefined>;
    getAgent(name: string): Promise<Agent | undefined>;
    getSkillSections(name: string, sectionNames?: string[]): Promise<{
        skill: Skill;
        content: string;
        sections: SkillSection[];
    } | undefined>;
    searchSkills(query: string, options?: {
        limit?: number;
        skillType?: string;
        category?: string;
        source?: string;
    }): Promise<SearchResult[]>;
    getCatalog(category?: string): Promise<CatalogResult>;
}
