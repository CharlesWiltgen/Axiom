import { homedir } from 'os';
import { join } from 'path';
/**
 * Load configuration from environment variables
 *
 * Environment variables:
 * - AXIOM_MCP_MODE: 'development' or 'production' (default: 'production')
 * - AXIOM_DEV_PATH: Path to Claude Code plugin for dev mode (default: ~/Projects/Axiom/plugins/axiom)
 * - AXIOM_LOG_LEVEL: Log level (default: 'info')
 */
export function loadConfig() {
    const mode = (process.env.AXIOM_MCP_MODE || 'production');
    const defaultDevPath = join(homedir(), 'Projects', 'Axiom', 'plugins', 'axiom');
    const devSourcePath = mode === 'development'
        ? (process.env.AXIOM_DEV_PATH || defaultDevPath)
        : undefined;
    const logLevel = (process.env.AXIOM_LOG_LEVEL || 'info');
    const xcodePath = process.env.AXIOM_XCODE_PATH || undefined;
    const enableAppleDocs = process.env.AXIOM_APPLE_DOCS !== 'false';
    return {
        mode,
        devSourcePath,
        xcodePath,
        enableAppleDocs,
        logLevel,
    };
}
/**
 * Simple logger that respects log level
 */
export class Logger {
    config;
    levels = ['debug', 'info', 'warn', 'error'];
    minLevel;
    constructor(config) {
        this.config = config;
        this.minLevel = this.levels.indexOf(config.logLevel);
    }
    debug(message, ...args) {
        if (this.minLevel <= 0) {
            console.error('[DEBUG]', message, ...args);
        }
    }
    info(message, ...args) {
        if (this.minLevel <= 1) {
            console.error('[INFO]', message, ...args);
        }
    }
    warn(message, ...args) {
        if (this.minLevel <= 2) {
            console.error('[WARN]', message, ...args);
        }
    }
    error(message, ...args) {
        if (this.minLevel <= 3) {
            console.error('[ERROR]', message, ...args);
        }
    }
}
