import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';
import { Agent } from '../loader/parser.js';

/**
 * MCP Tool representation
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tools handler
 * Implements tools/list and tools/call for agents
 */
export class ToolsHandler {
  constructor(
    private loader: Loader,
    private logger: Logger
  ) {}

  /**
   * Handle tools/list request
   * Returns all available agents as tools
   */
  async listTools(): Promise<{ tools: McpTool[] }> {
    this.logger.debug('Handling tools/list');

    const agents = await this.loader.loadAgents();
    const tools: McpTool[] = [];

    for (const [name, agent] of agents) {
      tools.push(this.agentToTool(agent));
    }

    this.logger.info(`Returning ${tools.length} tools`);

    return { tools };
  }

  /**
   * Handle tools/call request
   * Executes a tool (agent)
   *
   * Note: For Phase 3, this is a placeholder. Actual agent execution
   * would require deeper integration with Claude Code's agent runtime.
   */
  async callTool(
    name: string,
    args: Record<string, any>
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.logger.debug(`Handling tools/call: ${name}`);

    const agent = await this.loader.getAgent(name);

    if (!agent) {
      throw new Error(`Agent not found: ${name}`);
    }

    this.logger.warn(`Tool execution not yet implemented: ${name}`);

    // Placeholder response
    return {
      content: [
        {
          type: 'text',
          text: `Tool '${name}' execution is not yet implemented in this version of the MCP server.\n\n` +
                `This would normally trigger the ${agent.description}\n\n` +
                `Arguments received: ${JSON.stringify(args, null, 2)}\n\n` +
                `For full agent execution, use Claude Code directly with: /axiom:${name}`
        }
      ]
    };
  }

  /**
   * Convert an Agent to an MCP Tool
   */
  private agentToTool(agent: Agent): McpTool {
    // Use inputSchema from MCP annotations if available
    const inputSchema = agent.mcp?.inputSchema || {
      type: 'object',
      properties: {}
    };

    // Ensure schema has required type field
    if (!inputSchema.type) {
      inputSchema.type = 'object';
    }

    return {
      name: `axiom_${agent.name.replace(/-/g, '_')}`,
      description: agent.description,
      inputSchema
    };
  }
}
