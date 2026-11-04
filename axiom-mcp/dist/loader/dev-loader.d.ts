import type { Skill, Command, Agent, SkillSection } from './parser.js';
import type { Config, Logger } from '../config.js';
import type { Loader } from './types.js';
import type { SearchResult } from '../search/index.js';
import type { CatalogResult } from '../catalog/index.js';
export type ChangeKind = 'skills' | 'commands' | 'agents' | null;
export declare function classifyChange(relativePath: string): ChangeKind;
/**
 * Development mode loader - reads live files from Claude Code plugin directory
 */
export declare class DevLoader implements Loader {
    private pluginPath;
    private logger;
    private config?;
    private skillsCache;
    private commandsCache;
    private agentsCache;
    private searchIndex;
    constructor(pluginPath: string, logger: Logger, config?: Config | undefined);
    /**
     * Load MCP annotations from skill-annotations.json (co-located with axiom-mcp/)
     */
    private loadAnnotations;
    /**
     * Load all skills from the plugin directory
     * Skills live in subdirectories: skills/<name>/SKILL.md
     */
    loadSkills(): Promise<Map<string, Skill>>;
    private loadAppleDocsIntoCache;
    /**
     * Load all commands from the plugin directory
     */
    loadCommands(): Promise<Map<string, Command>>;
    /**
     * Load all agents from the plugin directory
     */
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
    private watchAbort;
    private debounceTimer;
    private pendingKinds;
    private onChangeCallback;
    onChange(callback: (kind: ChangeKind) => void): void;
    startWatching(): void;
    stopWatching(): void;
    private invalidate;
}
/**
 * The SDK's stdio transport ignores the end of its input, and the watcher keeps the process
 * alive, so a client that exits without killing the server would leak it. A pipe ends with
 * 'end'; a reset socket emits only 'close'. Only the watcher stops: exiting here would drop
 * responses still in flight. stopWatching is idempotent.
 */
export declare function stopWatchingWhenInputCloses(input: NodeJS.EventEmitter, loader: {
    stopWatching(): void;
}): void;
