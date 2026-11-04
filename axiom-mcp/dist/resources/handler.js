import { mcpToolFooter } from '../tools/mcp-notes.js';
import { CLI_ONLY_BINARIES } from '../tools/binaries.js';
/**
 * MCP Resources handler
 * Implements resources/list and resources/read for skills
 */
export class ResourcesHandler {
    loader;
    logger;
    binaryToolNames;
    constructor(loader, logger, binaryToolNames) {
        this.loader = loader;
        this.logger = logger;
        this.binaryToolNames = binaryToolNames;
    }
    /**
     * Handle resources/list request
     * Returns all available skills as resources
     */
    async listResources() {
        this.logger.debug('Handling resources/list');
        const skills = await this.loader.loadSkills();
        const resources = [];
        for (const [name, skill] of skills) {
            resources.push(this.skillToResource(skill));
        }
        this.logger.info(`Returning ${resources.length} resources`);
        return { resources };
    }
    /**
     * Handle resources/read request
     * Returns the full content of a specific skill
     */
    async readResource(uri) {
        this.logger.debug(`Handling resources/read: ${uri}`);
        // Extract skill name from URI (axiom://skill/{name})
        const match = uri.match(/^axiom:\/\/skill\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid resource URI: ${uri}`);
        }
        const skillName = match[1];
        const skill = await this.loader.getSkill(skillName);
        if (!skill) {
            throw new Error(`Skill not found: ${skillName}`);
        }
        this.logger.info(`Returning skill content: ${skillName} (${skill.content.length} bytes)`);
        return {
            contents: [{
                    uri,
                    mimeType: 'text/markdown',
                    text: this.formatSkillContent(skill)
                }]
        };
    }
    /**
     * Convert a Skill to an MCP Resource
     */
    skillToResource(skill) {
        return {
            uri: `axiom://skill/${skill.name}`,
            name: this.formatSkillName(skill.name),
            description: skill.description,
            mimeType: 'text/markdown'
        };
    }
    /**
     * Format skill name for display (kebab-case to Title Case)
     */
    formatSkillName(name) {
        return name
            .split(/-+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    /**
     * Format skill content with frontmatter metadata preserved as human-readable header
     */
    formatSkillContent(skill) {
        const header = [
            `# ${this.formatSkillName(skill.name)}`,
            '',
            skill.description,
            ''
        ];
        if (skill.mcp) {
            header.push('## Metadata');
            if (skill.mcp.category) {
                header.push(`- **Category**: ${skill.mcp.category}`);
            }
            if (skill.mcp.tags && skill.mcp.tags.length > 0) {
                header.push(`- **Tags**: ${skill.mcp.tags.join(', ')}`);
            }
            if (skill.mcp.related && skill.mcp.related.length > 0) {
                header.push(`- **Related Skills**: ${skill.mcp.related.join(', ')}`);
            }
            header.push('');
        }
        header.push('---');
        header.push('');
        const footer = mcpToolFooter(skill.content, this.binaryToolNames, CLI_ONLY_BINARIES);
        return header.join('\n') + skill.content + (footer ? `\n\n---\n${footer}` : '');
    }
}
