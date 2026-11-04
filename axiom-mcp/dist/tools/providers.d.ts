import type { Logger } from '../config.js';
import type { McpToolBinary } from './binaries.js';
import type { BinaryToolProvider } from './handler.js';
/** The server's wrapped-binary tool providers, keyed by binary; every consumer builds them here. */
export declare function createBinaryToolProviders(opts: {
    paths: Record<McpToolBinary, string>;
    logger?: Logger;
}): Record<McpToolBinary, BinaryToolProvider>;
