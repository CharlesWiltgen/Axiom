import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { Loader } from '../loader/types.js';
import { Logger } from '../config.js';
export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
    annotations?: ToolAnnotations;
}
export interface ToolResponse {
    [key: string]: unknown;
    content: Array<{
        type: string;
        text: string;
    }>;
}
/**
 * A self-contained group of MCP tools backed by a bundled CLI binary
 * (xcprof, xclog, …). The handler merges each provider's tools into the
 * tool list and dispatches calls by `handles(name)`, so adding a new binary
 * tool means implementing this interface and registering the instance in index.ts.
 */
export interface BinaryToolProvider {
    listTools(): McpTool[];
    callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
    handles(name: string): boolean;
}
/**
 * Dynamic toolset handler implementing 4 tools:
 * - axiom_get_catalog: Structured taxonomy of skills by category
 * - axiom_search_skills: BM25 text search with ranked results
 * - axiom_read_skill: Section-filtered content delivery
 * - axiom_get_agent: Agent instructions and metadata
 */
export declare class DynamicToolsHandler {
    private loader;
    private logger;
    private binaryTools;
    constructor(loader: Loader, logger: Logger, binaryTools?: BinaryToolProvider[]);
    listTools(): Promise<{
        tools: McpTool[];
    }>;
    callTool(name: string, args: Record<string, any>): Promise<ToolResponse>;
    private handleGetCatalog;
    private handleSearchSkills;
    private handleReadSkill;
    private knownNames;
    private skillNotFound;
    private binaryToolNames;
    private handleGetAgent;
}
