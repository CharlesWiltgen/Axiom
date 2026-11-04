#!/usr/bin/env node
/**
 * Bundle generator for production deployment
 *
 * Reads skills, commands, and agents from the Claude Code plugin directory
 * and generates a standalone bundle.json for production distribution.
 *
 * Usage:
 *   npm run bundle
 *   node scripts/bundle.js /path/to/plugin
 */
import type { BundleV2 } from '../loader/types.js';
export declare function generateBundle(pluginPath: string): Promise<BundleV2>;
export interface BundleStats {
    totalBytes: number;
    skills: {
        count: number;
        bytes: number;
    };
    commands: {
        count: number;
        bytes: number;
    };
    agents: {
        count: number;
        bytes: number;
    };
    searchIndex: {
        bytes: number;
    };
    generatedAt: string;
}
export declare function computeBundleStats(bundle: BundleV2): BundleStats;
/**
 * Copy every MCP tool and workflow binary (see `MCP_PACKAGED_BINARIES`) from the plugin `tools/`
 * into `dist/bin` so the published npm package (which ships only `dist/`) can
 * run them for non-Claude-Code MCP clients.
 *
 * Hard-fails if a listed binary is missing: the binaries are committed in the
 * plugin `tools/`, so absence is a real defect that must block the bundle rather
 * than silently ship a package missing its tools. (Runtime platform support is
 * the resolver's job — each tool reports itself unavailable on unsupported
 * platforms; copying the committed file works on any build host.)
 */
export declare function copyToolBinaries(pluginPath: string, outputDir: string): Promise<void>;
