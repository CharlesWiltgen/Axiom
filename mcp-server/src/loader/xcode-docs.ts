import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { parseAppleDoc, Skill } from './parser.js';
import { Logger } from '../config.js';

export interface XcodeDocsConfig {
  xcodePath: string;
  additionalDocsPath: string | null;
  diagnosticsPath: string | null;
}

const DEFAULT_XCODE_PATH = '/Applications/Xcode.app';
const ADDITIONAL_DOCS_SUBPATH = 'Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation';
const DIAGNOSTICS_SUBPATH = 'Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics';

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Detect Xcode installation and resolve paths to Apple's for-LLM documentation.
 * Returns null if Xcode is not found or doc paths are missing.
 */
export async function detectXcode(overridePath?: string): Promise<XcodeDocsConfig | null> {
  const xcodePath = overridePath || DEFAULT_XCODE_PATH;

  if (!await isDirectory(xcodePath)) {
    return null;
  }

  const additionalDocsPath = join(xcodePath, ADDITIONAL_DOCS_SUBPATH);
  const diagnosticsPath = join(xcodePath, DIAGNOSTICS_SUBPATH);

  const hasAdditional = await isDirectory(additionalDocsPath);
  const hasDiagnostics = await isDirectory(diagnosticsPath);

  if (!hasAdditional && !hasDiagnostics) {
    return null;
  }

  return {
    xcodePath,
    additionalDocsPath: hasAdditional ? additionalDocsPath : null,
    diagnosticsPath: hasDiagnostics ? diagnosticsPath : null,
  };
}

/**
 * Load Apple's for-LLM documentation from Xcode installation.
 * Reads AdditionalDocumentation (guides) and Swift diagnostics.
 */
export async function loadAppleDocs(
  config: XcodeDocsConfig,
  logger: Logger,
): Promise<Map<string, Skill>> {
  const docs = new Map<string, Skill>();

  // Load AdditionalDocumentation guides
  if (config.additionalDocsPath !== null) {
    try {
      const files = (await readdir(config.additionalDocsPath)).filter(f => f.endsWith('.md'));
      let loaded = 0;
      for (const file of files) {
        try {
          const content = await readFile(join(config.additionalDocsPath, file), 'utf-8');
          const skill = parseAppleDoc(content, file, 'guide');
          docs.set(skill.name, skill);
          loaded++;
          logger.debug(`Loaded Apple guide: ${skill.name}`);
        } catch {
          logger.warn(`Failed to parse Apple guide: ${file}`);
        }
      }
      logger.info(`Loaded ${loaded}/${files.length} Apple guides from AdditionalDocumentation`);
    } catch {
      logger.debug('Could not read AdditionalDocumentation directory');
    }
  }

  // Load Swift diagnostics
  if (config.diagnosticsPath !== null) {
    try {
      const files = (await readdir(config.diagnosticsPath)).filter(f => f.endsWith('.md'));
      let loaded = 0;
      for (const file of files) {
        try {
          const content = await readFile(join(config.diagnosticsPath, file), 'utf-8');
          const skill = parseAppleDoc(content, file, 'diagnostic');
          docs.set(skill.name, skill);
          loaded++;
          logger.debug(`Loaded Apple diagnostic: ${skill.name}`);
        } catch {
          logger.warn(`Failed to parse Apple diagnostic: ${file}`);
        }
      }
      logger.info(`Loaded ${loaded}/${files.length} Apple diagnostics from Xcode toolchain`);
    } catch {
      logger.debug('Could not read diagnostics directory');
    }
  }

  return docs;
}
