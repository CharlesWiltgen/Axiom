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

import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { parseSkill, parseCommand, parseAgent, applyAnnotations, Skill, Command, Agent, SkillAnnotations } from '../loader/parser.js';
import { buildIndex, serializeIndex, SerializedSearchIndex } from '../search/index.js';
import { buildCatalog, CatalogResult } from '../catalog/index.js';

interface BundleV2 {
  version: string;
  generatedAt: string;
  skills: Record<string, Skill>;
  commands: Record<string, Command>;
  agents: Record<string, Agent>;
  catalog: CatalogResult | null;
  searchIndex: SerializedSearchIndex | null;
}

async function loadAnnotations(): Promise<SkillAnnotations> {
  try {
    const annotationsPath = join(process.cwd(), 'skill-annotations.json');
    const content = await readFile(annotationsPath, 'utf-8');
    return JSON.parse(content) as SkillAnnotations;
  } catch {
    console.warn('Warning: skill-annotations.json not found, using defaults');
    return {};
  }
}

async function generateBundle(pluginPath: string): Promise<BundleV2> {
  console.log(`Reading plugin from: ${pluginPath}`);

  const bundle: BundleV2 = {
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    skills: {},
    commands: {},
    agents: {},
    catalog: null,
    searchIndex: null,
  };

  // Load annotations for MCP metadata
  const annotations = await loadAnnotations();

  // Load skills (subdirectories: skills/<name>/SKILL.md)
  const skillsDir = join(pluginPath, 'skills');
  const skillEntries = await readdir(skillsDir);

  for (const entry of skillEntries) {
    const entryPath = join(skillsDir, entry);
    const entryStat = await stat(entryPath);

    if (entryStat.isDirectory()) {
      const skillFile = join(entryPath, 'SKILL.md');
      try {
        const content = await readFile(skillFile, 'utf-8');
        const skill = applyAnnotations(parseSkill(content, entry), annotations);
        bundle.skills[skill.name] = skill;
      } catch {
        // No SKILL.md in this directory, skip
      }
    }
  }
  console.log(`Found ${Object.keys(bundle.skills).length} skills`);

  // Load commands
  const commandsDir = join(pluginPath, 'commands');
  const commandFiles = (await readdir(commandsDir)).filter(f => f.endsWith('.md'));
  console.log(`Found ${commandFiles.length} command files`);

  for (const file of commandFiles) {
    try {
      const content = await readFile(join(commandsDir, file), 'utf-8');
      const command = parseCommand(content, file);
      bundle.commands[command.name] = command;
    } catch (err) {
      console.warn(`Warning: Failed to parse command ${file}, skipping: ${(err as Error).message?.slice(0, 100)}`);
    }
  }

  // Load agents
  const agentsDir = join(pluginPath, 'agents');
  const agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'));
  console.log(`Found ${agentFiles.length} agent files`);

  for (const file of agentFiles) {
    try {
      const content = await readFile(join(agentsDir, file), 'utf-8');
      const agent = parseAgent(content, file);
      bundle.agents[agent.name] = agent;
    } catch (err) {
      console.warn(`Warning: Failed to parse agent ${file}, skipping: ${(err as Error).message?.slice(0, 100)}`);
    }
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

    const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Size: ${sizeMB} MB`);

  } catch (error) {
    console.error('Error generating bundle:', error);
    process.exit(1);
  }
}

main();
