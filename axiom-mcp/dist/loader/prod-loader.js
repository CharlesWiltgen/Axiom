import { readFile } from 'fs/promises';
import { filterSkillSections } from './parser.js';
import { deserializeIndex, search, buildIndex, addSkills } from '../search/index.js';
import { buildCatalog } from '../catalog/index.js';
import { detectXcode, loadAppleDocs } from './xcode-docs.js';
import { resolveSkillName } from './skill-names.js';
/**
 * Production mode loader - reads from pre-generated bundle.json
 */
export class ProdLoader {
    bundlePath;
    logger;
    config;
    skillsCache = new Map();
    commandsCache = new Map();
    agentsCache = new Map();
    searchIdx = null;
    catalogCache = null;
    loaded = false;
    constructor(bundlePath, logger, config) {
        this.bundlePath = bundlePath;
        this.logger = logger;
        this.config = config;
    }
    async ensureLoaded() {
        if (this.loaded)
            return;
        this.logger.info(`Loading bundle from: ${this.bundlePath}`);
        try {
            const content = await readFile(this.bundlePath, 'utf-8');
            const bundle = JSON.parse(content);
            this.logger.info(`Bundle version: ${bundle.version}`);
            this.logger.info(`Bundle generated: ${bundle.generatedAt}`);
            for (const [name, skill] of Object.entries(bundle.skills)) {
                // Default source for bundles generated before source tracking was added
                if (!skill.source)
                    skill.source = 'axiom';
                this.skillsCache.set(name, skill);
            }
            for (const [name, command] of Object.entries(bundle.commands)) {
                this.commandsCache.set(name, command);
            }
            for (const [name, agent] of Object.entries(bundle.agents)) {
                this.agentsCache.set(name, agent);
            }
            // Load pre-computed search index or build one (deserialize returns null for incompatible bundles)
            if (bundle.searchIndex) {
                this.searchIdx = deserializeIndex(bundle.searchIndex);
            }
            if (this.searchIdx) {
                this.logger.info(`Search index loaded from bundle: ${this.searchIdx.docCount} documents`);
            }
            else {
                this.searchIdx = buildIndex(this.skillsCache);
                this.logger.info(`Search index built at startup: ${this.searchIdx.docCount} documents`);
            }
            this.logger.info(`Loaded ${this.skillsCache.size} skills`);
            this.logger.info(`Loaded ${this.commandsCache.size} commands`);
            this.logger.info(`Loaded ${this.agentsCache.size} agents`);
            // Overlay Apple docs at runtime (not bundled)
            if (this.config?.enableAppleDocs !== false) {
                const xcodeConfig = await detectXcode(this.config?.xcodePath);
                if (xcodeConfig) {
                    const appleDocs = await loadAppleDocs(xcodeConfig, this.logger);
                    for (const [name, skill] of appleDocs) {
                        this.skillsCache.set(name, skill);
                    }
                    // Incrementally add Apple docs to existing index
                    addSkills(this.searchIdx, appleDocs);
                    this.logger.info(`Loaded ${appleDocs.size} Apple docs, search index updated incrementally`);
                }
                else {
                    this.logger.info('Xcode not found, skipping Apple docs');
                }
            }
            this.loaded = true;
        }
        catch (error) {
            this.logger.error('Failed to load bundle:', error);
            throw error;
        }
    }
    async loadSkills() {
        await this.ensureLoaded();
        return this.skillsCache;
    }
    async loadCommands() {
        await this.ensureLoaded();
        return this.commandsCache;
    }
    async loadAgents() {
        await this.ensureLoaded();
        return this.agentsCache;
    }
    async getNames() {
        await this.ensureLoaded();
        return { skills: [...this.skillsCache.keys()], agents: [...this.agentsCache.keys()] };
    }
    async getSkill(name) {
        await this.ensureLoaded();
        const resolved = resolveSkillName(name, this.skillsCache);
        return resolved === undefined ? undefined : this.skillsCache.get(resolved);
    }
    async getCommand(name) {
        await this.ensureLoaded();
        return this.commandsCache.get(name);
    }
    async getAgent(name) {
        await this.ensureLoaded();
        const resolved = resolveSkillName(name, this.agentsCache);
        return resolved === undefined ? undefined : this.agentsCache.get(resolved);
    }
    async getSkillSections(name, sectionNames) {
        const skill = await this.getSkill(name);
        if (!skill)
            return undefined;
        return filterSkillSections(skill, sectionNames);
    }
    async searchSkills(query, options) {
        await this.ensureLoaded();
        return search(this.searchIdx, query, options, this.skillsCache);
    }
    async getCatalog(category) {
        await this.ensureLoaded();
        // Cache unfiltered catalog; filtered calls bypass cache (different result shape)
        if (!category) {
            if (!this.catalogCache) {
                this.catalogCache = buildCatalog(this.skillsCache, this.agentsCache);
            }
            return this.catalogCache;
        }
        return buildCatalog(this.skillsCache, this.agentsCache, category);
    }
}
