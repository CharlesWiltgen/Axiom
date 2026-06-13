#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, Config, Logger } from './config.js';
import { DevLoader } from './loader/dev-loader.js';
import { ProdLoader } from './loader/prod-loader.js';
import { Loader } from './loader/types.js';
import { ResourcesHandler } from './resources/handler.js';
import { PromptsHandler } from './prompts/handler.js';
import { DynamicToolsHandler } from './tools/handler.js';
import { XcprofTools, resolveXcprofPath } from './tools/xcprof.js';
import { XclogTools, resolveXclogPath } from './tools/xclog.js';
import { XcsymTools, resolveXcsymPath } from './tools/xcsym.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

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
  let loader: Loader;
  let devLoader: DevLoader | null = null;
  if (config.mode === 'development') {
    devLoader = new DevLoader(config.devSourcePath!, logger, config);
    devLoader.startWatching();
    loader = devLoader;
  } else {
    loader = await loadProductionBundle(config, logger);
  }

  // Initialize handlers
  const resourcesHandler = new ResourcesHandler(loader, logger);
  const promptsHandler = new PromptsHandler(loader, logger);
  const xcprof = new XcprofTools({ binaryPath: resolveXcprofPath(config), logger });
  const xclog = new XclogTools({ binaryPath: resolveXclogPath(config), logger });
  const xcsym = new XcsymTools({ binaryPath: resolveXcsymPath(config), logger });
  const toolsHandler = new DynamicToolsHandler(loader, logger, [xcprof, xclog, xcsym]);

  // Create MCP server. axiom-mcp serves tools/resources/prompts dynamically
  // from a loader, so it registers low-level request handlers on the underlying
  // Server (the SDK's documented "advanced use case") rather than McpServer's
  // high-level registerTool/registerResource API.
  const mcpServer = new McpServer(
    {
      name: 'axiom-mcp',
      version: pkg.version,
    },
    {
      capabilities: {
        resources: {},
        prompts: {},
        tools: { listChanged: config.mode === 'development' },
      },
      instructions: [
        'Axiom is a library of battle-tested skills, agents, and tools for modern Apple-platform development (iOS, iPadOS, macOS, watchOS, tvOS): SwiftUI, Swift concurrency, data, performance, accessibility, networking, Apple Intelligence, and more.',
        'Recommended workflow: axiom_get_catalog (browse) → axiom_search_skills (find by keyword) → axiom_read_skill (read) → axiom_get_agent (autonomous agent instructions). All four are read-only lookups.',
        'Read token-leanly: axiom_read_skill returns a large skill\'s section index by default — re-read with a sections filter (≈8× smaller) rather than full:true unless you need the whole skill.',
        'The axiom_xcprof_*/xclog_*/xcsym_* tools wrap bundled macOS + Xcode CLIs (profiling, console capture, crash symbolication); each tool\'s own description carries its specifics.',
      ].join(' '),
    }
  );
  const server = mcpServer.server;

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

  // Wire file watcher to listChanged notifications in dev mode
  if (devLoader) {
    devLoader.onChange((kind) => {
      if (kind !== 'skills') return;
      logger.info('Sending tools/list_changed notification (skills changed)');
      server.sendToolListChanged().catch((err) => {
        logger.debug(`Could not send listChanged: ${err}`);
      });
    });

    const cleanup = () => {
      devLoader!.stopWatching();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

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
async function loadProductionBundle(config: Config, logger: Logger): Promise<Loader> {
  const bundlePath = join(__dirname, 'bundle.json');
  logger.info(`Production mode: loading from ${bundlePath}`);
  return new ProdLoader(bundlePath, logger, config);
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
