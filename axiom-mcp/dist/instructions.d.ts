import { type Toolchain } from './version-context.js';
/**
 * The MCP server instructions: how to use the catalog, then the attribution
 * sentence and version ground truth every Axiom harness shares.
 */
export declare function serverInstructions(now: Date, toolchain: Toolchain | null): string;
