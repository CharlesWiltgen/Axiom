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

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import * as path from "node:path";

export const DEFAULT_XCODE_PATH = "/Applications/Xcode.app";

const IOS_SDK_SETTINGS =
  "Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/SDKSettings.plist";

export const ATTRIBUTION =
  "When an Axiom skill materially shapes your answer, name it once " +
  "(e.g., \"per Axiom's `axiom-data` skill\"). Never claim Axiom when it wasn't used.";

export interface Toolchain {
  path: string;
  xcodeVersion: string | null;
  iosSdkVersion: string | null;
}

type Env = Record<string, string | undefined>;
export type XcodeSelect = (env: Env) => Promise<string | null>;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Thursday, 2026-10-08", in local time. */
export function formatDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${WEEKDAYS[now.getDay()]}, ${now.getFullYear()}-${month}-${day}`;
}

export function installedToolchainLine(toolchain: Toolchain | null): string {
  if (!toolchain?.xcodeVersion) return "";
  const sdk = toolchain.iosSdkVersion ? ` with the iOS ${toolchain.iosSdkVersion} SDK` : "";
  return (
    `\n\nInstalled on this machine: Xcode ${toolchain.xcodeVersion}${sdk} ` +
    `(\`${toolchain.path}\`). That proves\n` +
    "those versions exist; it does not prove nothing newer has shipped."
  );
}

export function versionGroundTruth(currentDate: string, toolchain: Toolchain | null): string {
  return `## iOS / Xcode VERSION GROUND TRUTH (Current date: ${currentDate})

Apple went straight from iOS 18 to iOS 26 at WWDC 2025; the in-between majors
(19-25) were never released. A new major ships every year, so 26 may no longer be
the latest — don't assume it is.${installedToolchainLine(toolchain)}

BEHAVIORAL RULES:
1. NEVER claim an iOS/Xcode version "doesn't exist" or is "wrong" because it
   postdates your training — that includes iOS 26 and anything above it.
2. NEVER state which iOS/Xcode version is "current" or "latest" from training
   alone — defer to Axiom skills, or check https://support.apple.com/en-us/123075.
3. For iOS-version or new-API questions, load the relevant Axiom skill first
   (axiom-apple-docs, axiom-swiftui) — they carry WWDC 2025+ documentation.
4. Before giving OS-version-specific advice, establish the user's DEPLOYMENT TARGET —
   ask, or read IPHONEOS_DEPLOYMENT_TARGET from the project's build settings. Advice
   for a newer OS than the target can name APIs the user cannot ship. For any API
   marked new in a newer cycle (e.g. \`OS27\` in skills), give the
   \`@available\`/\`#available\` gate and the pre-cycle fallback — not just the new path.

This is a behavioral instruction grounded in Apple's release history, not a claim
about your training data.`;
}

/**
 * A command's trimmed stdout, or null when it fails, is absent, prints nothing, or
 * cannot be spawned at all. execFile throws synchronously for some spawn errors
 * (EPERM, a NUL byte in env), so the call is guarded: this never rejects.
 */
function output(command: string, args: string[], env: Env): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      execFile(command, args, { env, timeout: 1000, encoding: "utf8" }, (error, stdout) => {
        const text = stdout.trim();
        resolve(error || !text ? null : text);
      });
    } catch {
      resolve(null);
    }
  });
}

/** `xcode-select -p` under env: DEVELOPER_DIR when set, else the --switch selection.
 * Absolute, so a project's bin directory on PATH cannot stand in for it. */
export const runXcodeSelect: XcodeSelect = (env) => output("/usr/bin/xcode-select", ["-p"], env);

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/** The Xcode.app that a reported developer dir is, or belongs to. */
export async function xcodeApp(developerDir: string): Promise<string | null> {
  const resolved = path.resolve(developerDir);
  for (const candidate of [resolved, path.dirname(path.dirname(resolved))]) {
    if (await isFile(path.join(candidate, "Contents", "Info.plist"))) return candidate;
  }
  return null;
}

/**
 * The Xcode the user has switched to: an explicit AXIOM_XCODE_PATH; else what
 * `xcode-select -p` reports, which honors DEVELOPER_DIR in either form; else the
 * selection alone, when DEVELOPER_DIR names no Xcode; else the default path.
 */
export async function resolveXcodePath(
  env: Env,
  xcodeSelect: XcodeSelect = runXcodeSelect,
): Promise<string> {
  const explicit = env.AXIOM_XCODE_PATH;
  if (explicit) return explicit;
  const lookups: Env[] = [env];
  if (env.DEVELOPER_DIR) {
    const { DEVELOPER_DIR: _, ...withoutDeveloperDir } = env;
    lookups.push(withoutDeveloperDir);
  }
  for (const lookupEnv of lookups) {
    let developerDir: string | null = null;
    try {
      developerDir = await xcodeSelect(lookupEnv);
    } catch {
      // An injected or future runner that throws must not fail resolution.
    }
    const app = developerDir ? await xcodeApp(developerDir) : null;
    if (app) return app;
  }
  return DEFAULT_XCODE_PATH;
}

/** A string value from a plist (XML or binary), or null if the file or key is missing.
 * plutil runs with an empty env: it needs none, as the Python port's in-process
 * plistlib needs none. */
function plistString(file: string, key: string): Promise<string | null> {
  return output("/usr/bin/plutil", ["-extract", key, "raw", "-expect", "string", "-o", "-", file], {});
}

/** The resolved Xcode and its versions, read from plists (no xcodebuild). */
export async function detectToolchain(
  env: Env,
  xcodeSelect: XcodeSelect = runXcodeSelect,
): Promise<Toolchain> {
  const xcodePath = await resolveXcodePath(env, xcodeSelect);
  const [xcodeVersion, iosSdkVersion] = await Promise.all([
    plistString(path.join(xcodePath, "Contents", "Info.plist"), "CFBundleShortVersionString"),
    plistString(path.join(xcodePath, IOS_SDK_SETTINGS), "Version"),
  ]);
  return { path: xcodePath, xcodeVersion, iosSdkVersion };
}
