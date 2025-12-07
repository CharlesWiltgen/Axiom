#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, Logger } from './config.js';
import { DevLoader } from './loader/dev-loader.js';
import { ProdLoader } from './loader/prod-loader.js';
import { Loader } from './loader/types.js';
import { ResourcesHandler } from './resources/handler.js';
import { PromptsHandler } from './prompts/handler.js';
import { ToolsHandler } from './tools/handler.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main entry point for Axiom MCP Server
 */
async function main() {
  // Load configuration
  const config = loadConfig();
  const logger = new Logger(config);

  logger.info('Starting Axiom MCP Server');
  logger.info(`Mode: ${config.mode}`);
  logger.info(`Log Level: ${config.logLevel}`);

  if (config.mode === 'development') {
    if (!config.devSourcePath) {
      logger.error('Development mode requires AXIOM_DEV_PATH environment variable');
      process.exit(1);
    }
    logger.info(`Plugin Path: ${config.devSourcePath}`);
  }

  // Initialize loader
  const loader = config.mode === 'development'
    ? new DevLoader(config.devSourcePath!, logger)
    : await loadProductionBundle(logger);

  // Initialize handlers
  const resourcesHandler = new ResourcesHandler(loader, logger);
  const promptsHandler = new PromptsHandler(loader, logger);
  const toolsHandler = new ToolsHandler(loader, logger);

  // Create MCP server
  const server = new Server(
    {
      name: 'axiom-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
        prompts: {},
        tools: {},
      },
    }
  );

  // Register resources handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return await resourcesHandler.listResources();
    } catch (error) {
      logger.error('Error listing resources:', error);
      throw error;
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      return await resourcesHandler.readResource(request.params.uri);
    } catch (error) {
      logger.error('Error reading resource:', error);
      throw error;
    }
  });

  // Register prompts handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      return await promptsHandler.listPrompts();
    } catch (error) {
      logger.error('Error listing prompts:', error);
      throw error;
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      return await promptsHandler.getPrompt(
        request.params.name,
        request.params.arguments
      );
    } catch (error) {
      logger.error('Error getting prompt:', error);
      throw error;
    }
  });

  // Register tools handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return await toolsHandler.listTools();
    } catch (error) {
      logger.error('Error listing tools:', error);
      throw error;
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await toolsHandler.callTool(
        request.params.name,
        request.params.arguments || {}
      );
    } catch (error) {
      logger.error('Error calling tool:', error);
      throw error;
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Axiom MCP Server started successfully');
  logger.info('Waiting for requests on stdin/stdout');
}

/**
 * Load production bundle
 * Returns a loader compatible with Loader interface
 */
async function loadProductionBundle(logger: Logger): Promise<Loader> {
  const bundlePath = join(__dirname, 'bundle.json');
  logger.info(`Production mode: loading from ${bundlePath}`);
  return new ProdLoader(bundlePath, logger);
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
