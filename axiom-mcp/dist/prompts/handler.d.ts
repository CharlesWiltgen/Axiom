import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';
/**
 * MCP Prompt representation
 */
export interface McpPrompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required: boolean;
    }>;
}
/**
 * MCP Prompts handler
 * Implements prompts/list and prompts/get for commands
 */
export declare class PromptsHandler {
    private loader;
    private logger;
    private binaryToolNames;
    constructor(loader: Loader, logger: Logger, binaryToolNames: readonly string[]);
    /**
     * Handle prompts/list request
     * Returns all available commands as prompts
     */
    listPrompts(): Promise<{
        prompts: McpPrompt[];
    }>;
    /**
     * Handle prompts/get request
     * Returns a specific command prompt with arguments substituted
     */
    getPrompt(name: string, args?: Record<string, string>): Promise<{
        description?: string;
        messages: Array<{
            role: string;
            content: {
                type: string;
                text: string;
            };
        }>;
    }>;
    /**
     * Convert a Command to an MCP Prompt
     */
    private commandToPrompt;
    /**
     * Substitute argument placeholders in command content
     *
     * Supports:
     * - {{argument_name}} - Simple substitution
     * - Default values from MCP annotations
     */
    private substituteArguments;
}
