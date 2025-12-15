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

// Category mapping patterns for skills
// Ordered from most specific to least specific to prevent greedy matching
const CATEGORY_PATTERNS = {
  'Utility': ['getting-started'],
  'Testing': ['testing', 'ui-testing', 'simulator'],
  'Persistence & Storage': ['swiftdata', 'grdb', 'sqlite', 'cloudkit', 'icloud', 'storage', 'realm', 'core-data', 'database', 'cloud-sync'],
  'Integration': ['networking', 'app-intent', 'storekit', 'in-app', 'foundation-model', 'extension', 'widget', 'avfoundation', 'now-playing', 'app-shortcut', 'core-spotlight', 'app-discovera', 'network-framework'],
  'Build & Environment': ['build', 'xcode'],
  'Code Quality': ['concurrency', 'codable'],
  'UI & Design': ['swiftui', 'hig', 'liquid-glass', 'layout', 'nav', 'gesture', 'textkit', 'typography', 'animation', 'auto-layout', 'accessibility'],
  'Debugging': ['debugging', 'profiling', 'memory', 'objc-block']
};

// Categorize a skill based on its name and description
function categorizeSkill(skillName, description) {
  const lowerName = skillName.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // First pass: match by NAME only (more reliable)
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerName.includes(pattern)) {
        return category;
      }
    }
  }

  // Second pass: match by description (fallback)
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerDesc.includes(pattern)) {
        return category;
      }
    }
  }

  // Default to Debugging for diagnostic skills
  if (skillName.endsWith('-diag')) {
    return 'Debugging';
  }

  // Default category for unmatched skills
  return 'Integration';
}

// Group skills by category
function categorizeSkills(skills) {
  const categories = {};

  for (const skill of skills) {
    const category = categorizeSkill(skill.name, skill.description);

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(skill);
  }

  // Sort skills within each category by name
  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return categories;
}

// Generate skills section markdown
function generateSkillsSection(categories) {
  let markdown = '## Skills Reference\n\n';

  // Define category order (matching our docs structure)
  const categoryOrder = [
    'Utility',
    'Build & Environment',
    'UI & Design',
    'Code Quality',
    'Debugging',
    'Persistence & Storage',
    'Integration',
    'Testing'
  ];

  for (const category of categoryOrder) {
    const skills = categories[category];
    if (!skills || skills.length === 0) continue;

    markdown += `### ${category}\n\n`;

    for (const skill of skills) {
      // Truncate description to first sentence or 120 chars
      let desc = skill.description;
      const firstSentence = desc.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        desc = firstSentence[0];
      } else if (desc.length > 120) {
        desc = desc.substring(0, 120) + '...';
      }

      markdown += `- **${skill.name}** — ${desc}\n`;
    }

    markdown += '\n';
  }

  return markdown;
}

// Generate agents section markdown
function generateAgentsSection(agents) {
  let markdown = '## Agents Reference\n\n';
  markdown += 'When user asks to "audit", "review", "scan", or "check" code, launch the appropriate agent:\n\n';

  // Sort agents by name
  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  for (const agent of sortedAgents) {
    // Extract key phrase from description (first clause before dash or comma)
    let desc = agent.description;
    const match = desc.match(/^[^—,]+/);
    if (match) {
      desc = match[0].trim();
      // Remove "Use this agent when" prefix if present
      desc = desc.replace(/^Use this agent when (the user mentions )?/i, '');
      desc = desc.replace(/^Automatically (runs|scans)/i, 'Scans for');
    }

    markdown += `- **${agent.name}** — ${desc}\n`;
  }

  markdown += '\n';

  return markdown;
}

// Generate complete ask.md from template
function generateAskMd(claudeCode) {
  const skills = claudeCode.skills || [];
  const agents = claudeCode.agents || [];

  // Group skills by category
  const categories = categorizeSkills(skills);

  // Generate sections
  const skillsSection = generateSkillsSection(categories);
  const agentsSection = generateAgentsSection(agents);

  // Read template and replace placeholders
  const templatePath = path.join(__dirname, 'templates/ask.md.template');
  const template = fs.readFileSync(templatePath, 'utf8');

  return template
    .replace('{{skillCount}}', skills.length)
    .replace('{{agentCount}}', agents.length)
    .replace('{{skillsSection}}', skillsSection)
    .replace('{{agentsSection}}', agentsSection);
}

try {
  // Auto-count components
  const skillsDir = path.join(pluginDir, 'skills');
  if (!fs.existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }
  const skillDirs = fs.readdirSync(skillsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(skillsDir, name), { throwIfNoEntry: false });
      if (!stat?.isDirectory()) return false;
      const skillFile = path.join(skillsDir, name, 'SKILL.md');
      return fs.existsSync(skillFile);
    });

  const skillsCount = skillDirs.length;

  // Count skills by type
  let disciplineCount = 0;
  let referenceCount = 0;
  let diagnosticCount = 0;

  for (const skillName of skillDirs) {
    if (skillName.endsWith('-ref')) {
      referenceCount++;
    } else if (skillName.endsWith('-diag')) {
      diagnosticCount++;
    } else {
      disciplineCount++;
    }
  }

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

  // Generate stats.json for VitePress
  const statsPath = path.join(root, 'docs/.vitepress/theme/stats.json');
  const statsData = {
    disciplineSkills: disciplineCount,
    referenceSkills: referenceCount,
    diagnosticSkills: diagnosticCount,
    commands: commandsCount,
    agents: agentsCount
  };

  // Prepare all updates
  const updates = [];

  // Add stats.json to updates
  updates.push({
    path: statsPath,
    content: JSON.stringify(statsData, null, 2) + '\n',
    label: 'docs/.vitepress/theme/stats.json'
  });

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

  // Generate ask.md from template + manifest data
  const askMdPath = path.join(pluginDir, 'commands/ask.md');
  const askMdContent = generateAskMd(claudeCode);
  updates.push({
    path: askMdPath,
    content: askMdContent,
    label: '.claude-plugin/plugins/axiom/commands/ask.md'
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
  console.log(`  Skills: ${skillsCount} (${disciplineCount} discipline, ${referenceCount} reference, ${diagnosticCount} diagnostic)`);
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
