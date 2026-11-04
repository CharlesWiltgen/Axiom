import { Skill } from './parser.js';
import { Logger } from '../config.js';
export interface XcodeDocsConfig {
    xcodePath: string;
    additionalDocsPath: string | null;
    diagnosticsPath: string | null;
}
/**
 * Detect Xcode installation and resolve paths to Apple's for-LLM documentation.
 * Without an override, reads the Xcode the user has switched to — the same one
 * every harness's session context names (version-context.ts).
 * Returns null if Xcode is not found or doc paths are missing.
 */
export declare function detectXcode(overridePath?: string, env?: Record<string, string | undefined>): Promise<XcodeDocsConfig | null>;
/**
 * Load Apple's for-LLM documentation from Xcode installation.
 * Reads AdditionalDocumentation (guides) and Swift diagnostics.
 */
export declare function loadAppleDocs(config: XcodeDocsConfig, logger: Logger): Promise<Map<string, Skill>>;
