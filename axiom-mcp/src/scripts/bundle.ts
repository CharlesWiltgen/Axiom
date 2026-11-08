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

import { readdir, readFile, writeFile, mkdir, stat, copyFile, chmod } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { parseSkill, parseCommand, parseAgent, parseReferenceFile, applyAnnotations, isGeneratedSubSkill } from '../loader/parser.js';
import type { Skill, SkillAnnotations } from '../loader/parser.js';
import type { BundleV2 } from '../loader/types.js';
import { SkillSourceError, isMissingFile, readExistingAnnotations, readSource } from './generate-annotations.js';
import { buildIndex, serializeIndex } from '../search/index.js';
import { buildCatalog } from '../catalog/index.js';
import { MCP_PACKAGED_BINARIES } from '../tools/binaries.js';

async function loadAnnotations(): Promise<SkillAnnotations> {
  const { entries, content } = await readExistingAnnotations(join(process.cwd(), 'skill-annotations.json'));
  if (content === null) console.warn('Warning: skill-annotations.json not found, using defaults');
  return entries;
}

/** Parses one plugin source; a parse failure stops the build rather than shipping without it. */
function parseSource<T>(path: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new SkillSourceError(path, `doesn't parse (${(error as Error).message})`, { cause: error });
  }
}

export async function generateBundle(pluginPath: string): Promise<BundleV2> {
  console.log(`Reading plugin from: ${pluginPath}`);

  const bundle: BundleV2 = {
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    skills: {},
    commands: {},
    agents: {},
  };

  // Load annotations for MCP metadata
  const annotations = await loadAnnotations();

  // Load skills recursively (skills/<name>/SKILL.md and skills/<parent>/<name>/SKILL.md)
  const skillsDir = join(pluginPath, 'skills');

  async function loadSkillsFromDir(dir: string): Promise<void> {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;   // editor locks, AppleDouble copies, .DS_Store
      const entryPath = join(dir, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        const skillFile = join(entryPath, 'SKILL.md');
        const content = await readSource(skillFile);
        // Load reference files from skills/ subdirectory (suite pattern)
        if (content !== null) {
          const skill = applyAnnotations(parseSource(skillFile, () => parseSkill(content, entry)), annotations);
          bundle.skills[skill.name] = skill;
          const refsDir = join(entryPath, 'skills');
          let refEntries: string[] = [];
          try {
            refEntries = await readdir(refsDir);
          } catch (error) {
            if (!isMissingFile(error)) throw new SkillSourceError(refsDir, `can't be listed (${(error as Error).message})`, { cause: error });
          }
          for (const refFile of refEntries) {
            // Dot files are editor locks and macOS AppleDouble copies, never sources.
            if (refFile.startsWith('.') || !refFile.endsWith('.md')) continue;
            const refPath = join(refsDir, refFile);
            const refContent = await readSource(refPath, { mustExist: true });
            if (refContent === null) continue;
            // Bundling the inlined copies would double-count and trip the
            // pre-deploy mcp-fidelity check. See isGeneratedSubSkill in loader/parser.ts.
            if (isGeneratedSubSkill(refContent)) continue;
            const refSkill = applyAnnotations(
              parseSource(refPath, () => parseReferenceFile(refContent, refFile, entry)),
              annotations,
            );
            bundle.skills[refSkill.name] = refSkill;
          }
        }
        // Recurse into subdirectories (e.g., axiom-ai/coreml/)
        await loadSkillsFromDir(entryPath);
      }
    }
  }

  await loadSkillsFromDir(skillsDir);
  console.log(`Found ${Object.keys(bundle.skills).length} skills`);

  // Warn about orphaned annotation entries (typos, renames, deletions)
  const orphanedAnnotations = Object.keys(annotations).filter(name => !bundle.skills[name]);
  if (orphanedAnnotations.length > 0) {
    console.warn(`Warning: ${orphanedAnnotations.length} annotation(s) have no matching skill:`);
    for (const name of orphanedAnnotations) {
      console.warn(`  - ${name}`);
    }
  }

  // Load commands
  const commandsDir = join(pluginPath, 'commands');
  const commandFiles = (await readdir(commandsDir)).filter(f => !f.startsWith('.') && f.endsWith('.md'));
  console.log(`Found ${commandFiles.length} command files`);

  for (const file of commandFiles) {
    const path = join(commandsDir, file);
    const content = await readSource(path, { mustExist: true });
    if (content === null) continue;
    const command = parseSource(path, () => parseCommand(content, file));
    bundle.commands[command.name] = command;
  }

  // Load agents
  const agentsDir = join(pluginPath, 'agents');
  const agentFiles = (await readdir(agentsDir)).filter(f => !f.startsWith('.') && f.endsWith('.md'));
  console.log(`Found ${agentFiles.length} agent files`);

  for (const file of agentFiles) {
    const path = join(agentsDir, file);
    const content = await readSource(path, { mustExist: true });
    if (content === null) continue;
    const agent = parseSource(path, () => parseAgent(content, file));
    bundle.agents[agent.name] = agent;
  }

  // Build search index
  const skillsMap = new Map<string, Skill>();
  for (const [name, skill] of Object.entries(bundle.skills)) {
    skillsMap.set(name, skill as Skill);
  }

  const agentsMap = new Map(Object.entries(bundle.agents));

  console.log('Building search index...');
  const searchIndex = buildIndex(skillsMap);
  bundle.searchIndex = serializeIndex(searchIndex);
  console.log(`Search index: ${searchIndex.docCount} documents`);

  // Build catalog
  console.log('Building catalog...');
  const catalog = buildCatalog(skillsMap, agentsMap);
  bundle.catalog = catalog;
  console.log(`Catalog: ${Object.keys(catalog.categories).length} categories`);

  return bundle;
}

export interface BundleStats {
  totalBytes: number;
  skills: { count: number; bytes: number };
  commands: { count: number; bytes: number };
  agents: { count: number; bytes: number };
  searchIndex: { bytes: number };
  generatedAt: string;
}

export function computeBundleStats(bundle: BundleV2): BundleStats {
  const jsonSize = (obj: unknown) => Buffer.byteLength(JSON.stringify(obj), 'utf-8');

  const skillsBytes = Object.keys(bundle.skills).length > 0 ? jsonSize(bundle.skills) : 0;
  const commandsBytes = Object.keys(bundle.commands).length > 0 ? jsonSize(bundle.commands) : 0;
  const agentsBytes = Object.keys(bundle.agents).length > 0 ? jsonSize(bundle.agents) : 0;
  const searchIndexBytes = bundle.searchIndex ? jsonSize(bundle.searchIndex) : 0;

  return {
    totalBytes: skillsBytes + commandsBytes + agentsBytes + searchIndexBytes,
    skills: { count: Object.keys(bundle.skills).length, bytes: skillsBytes },
    commands: { count: Object.keys(bundle.commands).length, bytes: commandsBytes },
    agents: { count: Object.keys(bundle.agents).length, bytes: agentsBytes },
    searchIndex: { bytes: searchIndexBytes },
    generatedAt: bundle.generatedAt,
  };
}

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
export async function copyToolBinaries(pluginPath: string, outputDir: string): Promise<void> {
  const destDir = join(outputDir, 'bin');
  await mkdir(destDir, { recursive: true });
  for (const name of MCP_PACKAGED_BINARIES) {
    const src = join(pluginPath, 'tools', name);
    const dest = join(destDir, name);
    let info;
    try {
      info = await stat(src);
    } catch (err) {
      throw new Error(
        `MCP tool binary '${name}' is missing at ${src} (${(err as Error).message}). ` +
        `It is listed in MCP_PACKAGED_BINARIES and committed in the plugin tools/, so it must be ` +
        `present before bundling — refusing to publish a package missing its helpers.`,
      );
    }
    await copyFile(src, dest);
    await chmod(dest, 0o755);
    console.log(`Copied ${name} binary (${(info.size / 1024 / 1024).toFixed(1)} MB) to ${dest}`);
  }
  const licenseDir = join(outputDir, 'licenses');
  await mkdir(licenseDir, { recursive: true });
  try {
    const license = await readFile(join(pluginPath, 'licenses/xcproject.txt'));
    if (license.length === 0) throw new Error('empty license');
    await writeFile(join(licenseDir, 'xcproject.txt'), license, { mode: 0o644 });
  } catch (err) {
    throw new Error(`Cannot package xcproject license from ${pluginPath}: ${(err as Error).message}`);
  }
}

async function main() {
  const pluginPath = process.argv[2] || join(process.cwd(), '../.claude-plugin/plugins/axiom');
  const outputDir = join(process.cwd(), 'dist');
  const outputPath = join(outputDir, 'bundle.json');

  console.log('Axiom MCP Server - Bundle Generator v2');
  console.log('======================================');
  console.log();

  try {
    // Ensure dist/ exists
    await mkdir(outputDir, { recursive: true });

    const bundle = await generateBundle(pluginPath);

    console.log();
    console.log('Bundle Summary:');
    console.log(`- Skills: ${Object.keys(bundle.skills).length}`);
    console.log(`- Commands: ${Object.keys(bundle.commands).length}`);
    console.log(`- Agents: ${Object.keys(bundle.agents).length}`);
    console.log(`- Search Index: ${bundle.searchIndex?.docCount ?? 0} documents`);
    console.log(`- Catalog Categories: ${Object.keys(bundle.catalog?.categories ?? {}).length}`);
    console.log(`- Generated: ${bundle.generatedAt}`);

    await writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf-8');

    console.log();
    console.log(`Bundle written to: ${outputPath}`);

    const fileStats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const sizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    console.log(`Size: ${sizeMB} MB`);

    // Write bundle stats for tracking/regression testing
    const bundleStats = computeBundleStats(bundle);
    const statsPath = join(outputDir, 'bundle-stats.json');
    await writeFile(statsPath, JSON.stringify(bundleStats, null, 2), 'utf-8');
    console.log();
    console.log('Size Breakdown:');
    console.log(`  Skills:       ${(bundleStats.skills.bytes / 1024).toFixed(1)} KB (${bundleStats.skills.count} files)`);
    console.log(`  Commands:     ${(bundleStats.commands.bytes / 1024).toFixed(1)} KB (${bundleStats.commands.count} files)`);
    console.log(`  Agents:       ${(bundleStats.agents.bytes / 1024).toFixed(1)} KB (${bundleStats.agents.count} files)`);
    console.log(`  Search Index: ${(bundleStats.searchIndex.bytes / 1024).toFixed(1)} KB`);
    console.log(`  Total:        ${(bundleStats.totalBytes / 1024).toFixed(1)} KB`);
    console.log(`Stats written to: ${statsPath}`);

    await copyToolBinaries(pluginPath, outputDir);

  } catch (error) {
    console.error('Error generating bundle:', error);
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
