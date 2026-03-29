import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';
import { Command } from '../loader/parser.js';

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
export class PromptsHandler {
  constructor(
    private loader: Loader,
    private logger: Logger
  ) {}

  /**
   * Handle prompts/list request
   * Returns all available commands as prompts
   */
  async listPrompts(): Promise<{ prompts: McpPrompt[] }> {
    this.logger.debug('Handling prompts/list');

    const commands = await this.loader.loadCommands();
    const prompts: McpPrompt[] = [];

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
  async getPrompt(
    name: string,
    args?: Record<string, string>
  ): Promise<{ description?: string; messages: Array<{ role: string; content: { type: string; text: string } }> }> {
    this.logger.debug(`Handling prompts/get: ${name}`);

    const command = await this.loader.getCommand(name);

    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }

    // Substitute arguments in command content
    const content = this.substituteArguments(command, args || {});

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
  private commandToPrompt(command: Command): McpPrompt {
    const prompt: McpPrompt = {
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
  private substituteArguments(command: Command, args: Record<string, string>): string {
    let content = command.content;

    // Apply defaults from MCP annotations
    if (command.mcp?.arguments) {
      for (const argDef of command.mcp.arguments) {
        if (!args[argDef.name] && argDef.default) {
          args[argDef.name] = argDef.default;
        }
      }
    }

    // Substitute placeholders
    for (const [key, value] of Object.entries(args)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(placeholder, value);
    }

    return content;
  }
}
