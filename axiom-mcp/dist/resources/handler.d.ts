import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';
/**
 * MCP Resource representation
 */
export interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}
/**
 * MCP Resources handler
 * Implements resources/list and resources/read for skills
 */
export declare class ResourcesHandler {
    private loader;
    private logger;
    private binaryToolNames;
    constructor(loader: Loader, logger: Logger, binaryToolNames: readonly string[]);
    /**
     * Handle resources/list request
     * Returns all available skills as resources
     */
    listResources(): Promise<{
        resources: McpResource[];
    }>;
    /**
     * Handle resources/read request
     * Returns the full content of a specific skill
     */
    readResource(uri: string): Promise<{
        contents: Array<{
            uri: string;
            mimeType: string;
            text: string;
        }>;
    }>;
    /**
     * Convert a Skill to an MCP Resource
     */
    private skillToResource;
    /**
     * Format skill name for display (kebab-case to Title Case)
     */
    private formatSkillName;
    /**
     * Format skill content with frontmatter metadata preserved as human-readable header
     */
    private formatSkillContent;
}
