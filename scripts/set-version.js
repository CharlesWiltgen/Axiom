#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get version from command line
const version = process.argv[2];
if (!version?.match(/^\d+\.\d+\.\d+$/)) {
  console.error('❌ Usage: node set-version.js X.Y.Z');
  console.error('   Example: node set-version.js 0.9.37');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const pluginDir = path.join(root, '.claude-plugin/plugins/axiom');

try {
  // Auto-count components
  const skillsDir = path.join(pluginDir, 'skills');
  if (!fs.existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }
  const skillsCount = fs.readdirSync(skillsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(skillsDir, name), { throwIfNoEntry: false });
      if (!stat?.isDirectory()) return false;
      const skillFile = path.join(skillsDir, name, 'SKILL.md');
      return fs.existsSync(skillFile);
    }).length;

  const agentsDir = path.join(pluginDir, 'agents');
  if (!fs.existsSync(agentsDir)) {
    throw new Error(`Agents directory not found: ${agentsDir}`);
  }
  const agentsCount = fs.readdirSync(agentsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(agentsDir, name), { throwIfNoEntry: false });
      return stat?.isFile() && name.endsWith('.md');
    }).length;

  const commandsDir = path.join(pluginDir, 'commands');
  if (!fs.existsSync(commandsDir)) {
    throw new Error(`Commands directory not found: ${commandsDir}`);
  }
  const commandsCount = fs.readdirSync(commandsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(commandsDir, name), { throwIfNoEntry: false });
      return stat?.isFile() && name.endsWith('.md');
    }).length;

  // Prepare all updates
  const updates = [];

  // 1. Read and prepare claude-code.json update
  const claudeCodePath = path.join(pluginDir, 'claude-code.json');
  if (!fs.existsSync(claudeCodePath)) {
    throw new Error(`Plugin manifest not found: ${claudeCodePath}`);
  }
  let claudeCode;
  try {
    claudeCode = JSON.parse(fs.readFileSync(claudeCodePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse claude-code.json: ${err.message}`);
  }
  claudeCode.version = version;
  updates.push({
    path: claudeCodePath,
    content: JSON.stringify(claudeCode, null, 2) + '\n',
    label: '.claude-plugin/plugins/axiom/claude-code.json'
  });

  // 2. Read and prepare marketplace.json update
  const marketplacePath = path.join(root, '.claude-plugin/marketplace.json');
  if (!fs.existsSync(marketplacePath)) {
    throw new Error(`Marketplace manifest not found: ${marketplacePath}`);
  }
  let marketplace;
  try {
    marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse marketplace.json: ${err.message}`);
  }
  const plugin = marketplace.plugins?.find(p => p.name === 'axiom');
  if (!plugin) {
    throw new Error('axiom plugin not found in marketplace.json');
  }
  plugin.version = version;
  updates.push({
    path: marketplacePath,
    content: JSON.stringify(marketplace, null, 2) + '\n',
    label: '.claude-plugin/marketplace.json'
  });

  // 3. Prepare VitePress config.ts update
  const configPath = path.join(root, 'docs/.vitepress/config.ts');
  if (!fs.existsSync(configPath)) {
    throw new Error(`VitePress config not found: ${configPath}`);
  }
  let configContent = fs.readFileSync(configPath, 'utf8');
  const versionRegex = /(copyright: '[^']*• v)(\d+\.\d+\.\d+)(')/;
  if (!versionRegex.test(configContent)) {
    throw new Error('Version string not found in config.ts footer');
  }
  configContent = configContent.replace(versionRegex, `$1${version}$3`);
  updates.push({
    path: configPath,
    content: configContent,
    label: 'docs/.vitepress/config.ts'
  });

  // 4. Prepare metadata.txt update
  const metadataPath = path.join(pluginDir, 'hooks/metadata.txt');
  const hooksDir = path.dirname(metadataPath);
  if (!fs.existsSync(hooksDir)) {
    throw new Error(`Hooks directory not found: ${hooksDir}`);
  }
  const metadata = `${version}\n${skillsCount}\n${agentsCount}\n${commandsCount}\n`;
  updates.push({
    path: metadataPath,
    content: metadata,
    label: '.claude-plugin/plugins/axiom/hooks/metadata.txt'
  });

  // Write all files atomically (write to temp, then rename)
  const tempFiles = [];
  try {
    for (const update of updates) {
      const tempPath = update.path + '.tmp';
      tempFiles.push(tempPath);
      fs.writeFileSync(tempPath, update.content);
    }

    // All writes succeeded, now rename atomically
    for (let i = 0; i < updates.length; i++) {
      fs.renameSync(tempFiles[i], updates[i].path);
    }
  } catch (err) {
    // Cleanup temp files on failure
    for (const tempFile of tempFiles) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
    throw err;
  }

  // Success - print summary
  console.log(`✓ Version set to ${version}`);
  console.log(`  Skills: ${skillsCount}`);
  console.log(`  Agents: ${agentsCount}`);
  console.log(`  Commands: ${commandsCount}`);
  console.log();
  console.log('Updated:');
  for (const update of updates) {
    console.log(`  ✓ ${update.label}`);
  }

} catch (err) {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
}
