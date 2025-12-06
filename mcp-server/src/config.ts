import { homedir } from 'os';
import { join } from 'path';

export type ServerMode = 'development' | 'production';

export interface Config {
  mode: ServerMode;
  devSourcePath?: string;
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
export function loadConfig(): Config {
  const mode = (process.env.AXIOM_MCP_MODE || 'production') as ServerMode;

  const defaultDevPath = join(homedir(), 'Projects', 'Axiom', 'plugins', 'axiom');
  const devSourcePath = mode === 'development'
    ? (process.env.AXIOM_DEV_PATH || defaultDevPath)
    : undefined;

  const logLevel = (process.env.AXIOM_LOG_LEVEL || 'info') as Config['logLevel'];

  return {
    mode,
    devSourcePath,
    logLevel
  };
}

/**
 * Simple logger that respects log level
 */
export class Logger {
  private levels = ['debug', 'info', 'warn', 'error'];
  private minLevel: number;

  constructor(private config: Config) {
    this.minLevel = this.levels.indexOf(config.logLevel);
  }

  debug(message: string, ...args: any[]) {
    if (this.minLevel <= 0) {
      console.error('[DEBUG]', message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.minLevel <= 1) {
      console.error('[INFO]', message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.minLevel <= 2) {
      console.error('[WARN]', message, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.minLevel <= 3) {
      console.error('[ERROR]', message, ...args);
    }
  }
}
