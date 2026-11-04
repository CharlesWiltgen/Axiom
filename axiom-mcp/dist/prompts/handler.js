import { mcpToolFooter } from '../tools/mcp-notes.js';
import { CLI_ONLY_BINARIES } from '../tools/binaries.js';
/**
 * MCP Prompts handler
 * Implements prompts/list and prompts/get for commands
 */
export class PromptsHandler {
    loader;
    logger;
    binaryToolNames;
    constructor(loader, logger, binaryToolNames) {
        this.loader = loader;
        this.logger = logger;
        this.binaryToolNames = binaryToolNames;
    }
    /**
     * Handle prompts/list request
     * Returns all available commands as prompts
     */
    async listPrompts() {
        this.logger.debug('Handling prompts/list');
        const commands = await this.loader.loadCommands();
        const prompts = [];
        for (const [name, command] of commands) {
            prompts.push(this.commandToPrompt(command));
        }
        this.logger.info(`Returning ${prompts.length} prompts`);
        return { prompts };
    }
    /**
     * Handle prompts/get request
     * Returns a specific command prompt with arguments substituted
     */
    async getPrompt(name, args) {
        this.logger.debug(`Handling prompts/get: ${name}`);
        const command = await this.loader.getCommand(name);
        if (!command) {
            throw new Error(`Command not found: ${name}`);
        }
        // Substitute arguments in command content
        const substituted = this.substituteArguments(command, args || {});
        const footer = mcpToolFooter(command.content, this.binaryToolNames, CLI_ONLY_BINARIES);
        const content = footer ? `${substituted}\n\n---\n${footer}` : substituted;
        this.logger.info(`Returning prompt: ${name}`);
        return {
            description: command.description,
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: content
                    }
                }
            ]
        };
    }
    /**
     * Convert a Command to an MCP Prompt
     */
    commandToPrompt(command) {
        const prompt = {
            name: command.name,
            description: command.description
        };
        // Add arguments from MCP annotations if present
        if (command.mcp?.arguments) {
            prompt.arguments = command.mcp.arguments.map(arg => ({
                name: arg.name,
                description: arg.description,
                required: arg.required
            }));
        }
        return prompt;
    }
    /**
     * Substitute argument placeholders in command content
     *
     * Supports:
     * - {{argument_name}} - Simple substitution
     * - Default values from MCP annotations
     */
    substituteArguments(command, args) {
        let content = command.content;
        // Apply defaults from MCP annotations
        if (command.mcp?.arguments) {
            for (const argDef of command.mcp.arguments) {
                if (!args[argDef.name] && argDef.default) {
                    args[argDef.name] = argDef.default;
                }
            }
        }
        // Substitute placeholders. Defense-in-depth against hostile MCP clients:
        //   1. If the command declares arguments, treat that as an allowlist.
        //   2. Always regex-escape the key so a key like "(a+)+" or ".*" can't
        //      become a ReDoS pattern or over-replace template content.
        const declaredArgs = command.mcp?.arguments
            ? new Set(command.mcp.arguments.map(a => a.name))
            : null;
        for (const [key, value] of Object.entries(args)) {
            if (declaredArgs && !declaredArgs.has(key))
                continue;
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const placeholder = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g');
            content = content.replace(placeholder, value);
        }
        return content;
    }
}
