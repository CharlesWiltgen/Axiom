#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, Logger } from './config.js';
import { DevLoader } from './loader/dev-loader.js';
import { ResourcesHandler } from './resources/handler.js';

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

  // Create MCP server
  const server = new Server(
    {
      name: 'axiom-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
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

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Axiom MCP Server started successfully');
  logger.info('Waiting for requests on stdin/stdout');
}

/**
 * Load production bundle (Phase 4 - not yet implemented)
 */
async function loadProductionBundle(logger: Logger): Promise<DevLoader> {
  logger.error('Production mode not yet implemented');
  logger.error('Please use development mode: AXIOM_MCP_MODE=development AXIOM_DEV_PATH=/path/to/plugin');
  process.exit(1);
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
