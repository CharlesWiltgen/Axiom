export type ServerMode = 'development' | 'production';
export interface Config {
    mode: ServerMode;
    devSourcePath?: string;
    xcodePath?: string;
    enableAppleDocs: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
/**
 * Load configuration from environment variables
 *
 * Environment variables:
 * - AXIOM_MCP_MODE: 'development' or 'production' (default: 'production')
 * - AXIOM_DEV_PATH: Path to Claude Code plugin for dev mode (default: ~/Projects/Axiom/plugins/axiom)
 * - AXIOM_LOG_LEVEL: Log level (default: 'info')
 */
export declare function loadConfig(): Config;
/**
 * Simple logger that respects log level
 */
export declare class Logger {
    private config;
    private levels;
    private minLevel;
    constructor(config: Config);
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}
