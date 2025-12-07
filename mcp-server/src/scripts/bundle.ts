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

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseSkill, parseCommand, parseAgent } from '../loader/parser.js';

interface Bundle {
  version: string;
  generatedAt: string;
  skills: Record<string, any>;
  commands: Record<string, any>;
  agents: Record<string, any>;
}

async function generateBundle(pluginPath: string): Promise<Bundle> {
  console.log(`Reading plugin from: ${pluginPath}`);

  const bundle: Bundle = {
    version: '0.1.0', // TODO: Read from package.json
    generatedAt: new Date().toISOString(),
    skills: {},
    commands: {},
    agents: {}
  };

  // Load skills
  const skillsDir = join(pluginPath, 'skills');
  const skillFiles = (await readdir(skillsDir)).filter(f => f.endsWith('.md'));
  console.log(`Found ${skillFiles.length} skill files`);

  for (const file of skillFiles) {
    const content = await readFile(join(skillsDir, file), 'utf-8');
    const skill = parseSkill(content, file);
    bundle.skills[skill.name] = skill;
  }

  // Load commands
  const commandsDir = join(pluginPath, 'commands');
  const commandFiles = (await readdir(commandsDir)).filter(f => f.endsWith('.md'));
  console.log(`Found ${commandFiles.length} command files`);

  for (const file of commandFiles) {
    const content = await readFile(join(commandsDir, file), 'utf-8');
    const command = parseCommand(content, file);
    bundle.commands[command.name] = command;
  }

  // Load agents
  const agentsDir = join(pluginPath, 'agents');
  const agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'));
  console.log(`Found ${agentFiles.length} agent files`);

  for (const file of agentFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8');
    const agent = parseAgent(content, file);
    bundle.agents[agent.name] = agent;
  }

  return bundle;
}

async function main() {
  const pluginPath = process.argv[2] || join(process.cwd(), '../plugins/axiom');
  const outputPath = join(process.cwd(), 'dist', 'bundle.json');

  console.log('Axiom MCP Server - Bundle Generator');
  console.log('===================================');
  console.log();

  try {
    const bundle = await generateBundle(pluginPath);

    console.log();
    console.log('Bundle Summary:');
    console.log(`- Skills: ${Object.keys(bundle.skills).length}`);
    console.log(`- Commands: ${Object.keys(bundle.commands).length}`);
    console.log(`- Agents: ${Object.keys(bundle.agents).length}`);
    console.log(`- Generated: ${bundle.generatedAt}`);

    await writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf-8');

    console.log();
    console.log(`✅ Bundle written to: ${outputPath}`);

    // Calculate size
    const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   Size: ${sizeMB} MB`);

  } catch (error) {
    console.error('Error generating bundle:', error);
    process.exit(1);
  }
}

main();
