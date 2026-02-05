import { readdir, readFile, stat, watch } from 'fs/promises';
import { join } from 'path';
import { parseSkill, parseCommand, parseAgent, applyAnnotations, filterSkillSections, Skill, Command, Agent, SkillSection, SkillAnnotations } from './parser.js';
import { Config, Logger } from '../config.js';
import { Loader } from './types.js';
import { buildIndex, search, SearchIndex, SearchResult } from '../search/index.js';
import { buildCatalog, CatalogResult } from '../catalog/index.js';
import { detectXcode, loadAppleDocs } from './xcode-docs.js';

export type ChangeKind = 'skills' | 'commands' | 'agents' | null;

export function classifyChange(relativePath: string): ChangeKind {
  if (/^skills\//.test(relativePath)) return 'skills';
  if (/^commands\//.test(relativePath)) return 'commands';
  if (/^agents\//.test(relativePath)) return 'agents';
  return null;
}

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
    private logger: Logger,
    private config?: Config,
  ) {}

  /**
   * Load MCP annotations from skill-annotations.json (co-located with mcp-server/)
   */
  private async loadAnnotations(): Promise<SkillAnnotations> {
    // Try multiple resolution strategies for skill-annotations.json
    const candidates = [
      join(this.pluginPath, '..', '..', 'mcp-server', 'skill-annotations.json'),
      join(process.cwd(), 'skill-annotations.json'),
    ];

    for (const annotationsPath of candidates) {
      try {
        const content = await readFile(annotationsPath, 'utf-8');
        this.logger.debug(`Loaded annotations from: ${annotationsPath}`);
        return JSON.parse(content) as SkillAnnotations;
      } catch {
        // Try next candidate
      }
    }

    this.logger.debug('No skill-annotations.json found, using defaults');
    return {};
  }

  /**
   * Load all skills from the plugin directory
   * Skills live in subdirectories: skills/<name>/SKILL.md
   */
  async loadSkills(): Promise<Map<string, Skill>> {
    const skillsDir = join(this.pluginPath, 'skills');
    this.logger.debug(`Loading skills from: ${skillsDir}`);

    // Invalidate search index so it rebuilds with the new skill set
    this.searchIndex = null;

    try {
      const annotations = await this.loadAnnotations();
      const entries = await readdir(skillsDir);
      let loadedCount = 0;

      for (const entry of entries) {
        const entryPath = join(skillsDir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          const skillFile = join(entryPath, 'SKILL.md');
          let content: string;
          try {
            content = await readFile(skillFile, 'utf-8');
          } catch {
            this.logger.debug(`No SKILL.md in ${entry}, skipping`);
            continue;
          }
          try {
            const skill = applyAnnotations(parseSkill(content, entry), annotations);
            this.skillsCache.set(skill.name, skill);
            this.logger.debug(`Loaded skill: ${skill.name}`);
            loadedCount++;
          } catch (err) {
            this.logger.warn(`Failed to parse skill ${entry}: ${(err as Error).message}`);
          }
        }
      }

      this.logger.info(`Found ${loadedCount} skills`);

      // Load Apple docs from Xcode (runtime, not bundled)
      if (this.config?.enableAppleDocs !== false) {
        await this.loadAppleDocsIntoCache();
      }

      return this.skillsCache;
    } catch (error) {
      this.logger.error(`Failed to load skills:`, error);
      throw error;
    }
  }

  private async loadAppleDocsIntoCache(): Promise<void> {
    const xcodeConfig = await detectXcode(this.config?.xcodePath);
    if (!xcodeConfig) {
      this.logger.info('Xcode not found, skipping Apple docs');
      return;
    }

    const appleDocs = await loadAppleDocs(xcodeConfig, this.logger);
    for (const [name, skill] of appleDocs) {
      this.skillsCache.set(name, skill);
    }
    this.logger.info(`Loaded ${appleDocs.size} Apple docs from Xcode`);
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

    return filterSkillSections(skill, sectionNames);
  }

  async searchSkills(
    query: string,
    options?: { limit?: number; skillType?: string; category?: string; source?: string },
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

  private watchAbort: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingKinds = new Set<Exclude<ChangeKind, null>>();
  private onChangeCallback: ((kind: ChangeKind) => void) | null = null;

  onChange(callback: (kind: ChangeKind) => void): void {
    this.onChangeCallback = callback;
  }

  startWatching(): void {
    if (this.watchAbort) return;

    this.watchAbort = new AbortController();
    const signal = this.watchAbort.signal;

    this.logger.info(`Watching for file changes in: ${this.pluginPath}`);

    (async () => {
      try {
        const watcher = watch(this.pluginPath, { recursive: true, signal });
        for await (const event of watcher) {
          if (!event.filename) continue;
          const kind = classifyChange(event.filename);
          if (!kind) continue;

          // Accumulate changed kinds during debounce window
          this.pendingKinds.add(kind);
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            for (const k of this.pendingKinds) {
              this.invalidate(k);
            }
            this.pendingKinds.clear();
          }, 200);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        this.logger.error('File watcher error:', err);
      }
    })();
  }

  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingKinds.clear();
    if (this.watchAbort) {
      this.watchAbort.abort();
      this.watchAbort = null;
    }
  }

  private invalidate(kind: Exclude<ChangeKind, null>): void {
    this.logger.info(`Invalidating ${kind} cache`);

    switch (kind) {
      case 'skills':
        this.skillsCache.clear();
        this.searchIndex = null;
        break;
      case 'commands':
        this.commandsCache.clear();
        break;
      case 'agents':
        this.agentsCache.clear();
        break;
    }

    this.onChangeCallback?.(kind);
  }
}
