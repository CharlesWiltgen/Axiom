/**
 * The iOS/Xcode version ground truth every Axiom harness injects, and the
 * resolution of the Xcode it describes.
 *
 * TypeScript port of the plugin's hooks/version_context.py and hooks/xcode_path.py,
 * which Claude Code, Codex and Cursor run directly. axiom-pi/src and axiom-mcp/src
 * each carry this file; scripts/version-context.test.ts fails unless the two copies
 * are identical and render and resolve exactly what the Python modules do. Edit the
 * Python first, then copy this file to both places.
 */
export declare const DEFAULT_XCODE_PATH = "/Applications/Xcode.app";
export declare const ATTRIBUTION: string;
export interface Toolchain {
    path: string;
    xcodeVersion: string | null;
    iosSdkVersion: string | null;
}
type Env = Record<string, string | undefined>;
export type XcodeSelect = (env: Env) => Promise<string | null>;
/** "Thursday, 2026-10-08", in local time. */
export declare function formatDate(now: Date): string;
export declare function installedToolchainLine(toolchain: Toolchain | null): string;
export declare function versionGroundTruth(currentDate: string, toolchain: Toolchain | null): string;
/** `xcode-select -p` under env: DEVELOPER_DIR when set, else the --switch selection.
 * Absolute, so a project's bin directory on PATH cannot stand in for it. */
export declare const runXcodeSelect: XcodeSelect;
/** The Xcode.app that a reported developer dir is, or belongs to. */
export declare function xcodeApp(developerDir: string): Promise<string | null>;
/**
 * The Xcode the user has switched to: an explicit AXIOM_XCODE_PATH; else what
 * `xcode-select -p` reports, which honors DEVELOPER_DIR in either form; else the
 * selection alone, when DEVELOPER_DIR names no Xcode; else the default path.
 */
export declare function resolveXcodePath(env: Env, xcodeSelect?: XcodeSelect): Promise<string>;
/** The resolved Xcode and its versions, read from plists (no xcodebuild). */
export declare function detectToolchain(env: Env, xcodeSelect?: XcodeSelect): Promise<Toolchain>;
export {};
