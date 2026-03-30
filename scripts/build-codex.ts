#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(__filename));

const SOURCE_SKILLS = path.join(root, '.claude-plugin/plugins/axiom/skills');
const OUTPUT_DIR = path.join(root, 'axiom-codex');
const OUTPUT_SKILLS = path.join(OUTPUT_DIR, 'skills');
const OUTPUT_MANIFEST = path.join(OUTPUT_DIR, '.codex-plugin');

// Router skills — Codex has native progressive disclosure, so these are unnecessary
const EXCLUDE_SKILLS = new Set([
  'axiom-ios-build',
  'axiom-ios-testing',
  'axiom-ios-ui',
  'axiom-ios-data',
  'axiom-ios-concurrency',
  'axiom-ios-performance',
  'axiom-ios-networking',
  'axiom-ios-integration',
  'axiom-ios-accessibility',
  'axiom-ios-ai',
  'axiom-ios-ml',
  'axiom-ios-vision',
  'axiom-ios-graphics',
  'axiom-ios-games',
  'axiom-apple-docs',
  'axiom-xcode-mcp',
  'axiom-shipping',
  'axiom-using-axiom', // Claude Code-specific discipline injection
]);

// Read version from Claude Code manifest
const ccManifest = JSON.parse(
  fs.readFileSync(path.join(root, '.claude-plugin/plugins/axiom/claude-code.json'), 'utf8')
);
const version = ccManifest.version;

// Clean and recreate output
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_SKILLS, { recursive: true });
fs.mkdirSync(OUTPUT_MANIFEST, { recursive: true });

// Parse SKILL.md frontmatter via gray-matter (shared with axiom-mcp)
function parseFrontmatter(content: string): Record<string, string> {
  const { data } = matter(content);
  return data as Record<string, string>;
}

// Known casing for iOS/Apple terms
const CASE_MAP: Record<string, string> = {
  swiftui: 'SwiftUI', swiftdata: 'SwiftData', coredata: 'CoreData',
  cloudkit: 'CloudKit', storekit: 'StoreKit', spritekit: 'SpriteKit',
  scenekit: 'SceneKit', realitykit: 'RealityKit', uikit: 'UIKit',
  appkit: 'AppKit', mapkit: 'MapKit', eventkit: 'EventKit',
  textkit: 'TextKit', metalkit: 'MetalKit', cryptokit: 'CryptoKit',
  lldb: 'LLDB', grdb: 'GRDB', ios: 'iOS', tvos: 'tvOS',
  iap: 'IAP', icloud: 'iCloud', hig: 'HIG', ux: 'UX',
  sf: 'SF', mcp: 'MCP', asc: 'ASC', tdd: 'TDD',
  ref: 'Reference', diag: 'Diagnostics', objc: 'Obj-C',
  avfoundation: 'AVFoundation', xctest: 'XCTest', xctrace: 'xctrace',
  xclog: 'xclog', sqlitedata: 'SQLiteData', metrickit: 'MetricKit',
  alarmkit: 'AlarmKit',
};

// Derive display name: "axiom-swiftui-performance" → "SwiftUI Performance"
function toDisplayName(skillName: string): string {
  return skillName
    .replace(/^axiom-/, '')
    .split('-')
    .map(w => CASE_MAP[w] || w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Derive short_description from full description
function toShortDescription(description: string): string {
  // Strip "Use when" / "Use for" prefix
  let short = description.replace(/^Use (?:when|for)\s*/i, '');
  // Take up to first period, em dash, or " - " delimiter — but only if we'd keep 20+ chars
  const end = short.search(/\.\s|—|\s-\s/);
  if (end >= 20) short = short.slice(0, end);
  if (short.length > 120) short = short.slice(0, 117) + '...';
  // Escape for YAML double-quoted string (backslashes first, then quotes) and trim
  short = short.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// Copy skills and generate openai.yaml
const skillDirs = fs.readdirSync(SOURCE_SKILLS, { withFileTypes: true })
  .filter(d => d.isDirectory() && !EXCLUDE_SKILLS.has(d.name));

let copied = 0;
for (const dir of skillDirs) {
  const srcSkill = path.join(SOURCE_SKILLS, dir.name, 'SKILL.md');
  if (!fs.existsSync(srcSkill)) continue;

  const destDir = path.join(OUTPUT_SKILLS, dir.name);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcSkill, path.join(destDir, 'SKILL.md'));

  // Generate agents/openai.yaml from frontmatter
  const content = fs.readFileSync(srcSkill, 'utf8');
  const fm = parseFrontmatter(content);
  if (fm.name && fm.description) {
    const agentsDir = path.join(destDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    const yaml = [
      'interface:',
      `  display_name: "${toDisplayName(dir.name)}"`,
      `  short_description: "${toShortDescription(fm.description)}"`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), yaml);
  } else {
    console.warn(`  warn: skipped openai.yaml for ${dir.name} (missing name or description in frontmatter)`);
  }

  copied++;
}

// Generate plugin.json
const pluginManifest = {
  name: 'axiom',
  version,
  description: 'Battle-tested skills for modern iOS development — SwiftUI, concurrency, data, performance, networking, accessibility, and more.',
  author: {
    name: 'Charles Wiltgen',
    url: 'https://charleswiltgen.github.io/Axiom/',
  },
  homepage: 'https://charleswiltgen.github.io/Axiom/',
  repository: 'https://github.com/CharlesWiltgen/Axiom',
  license: 'MIT',
  keywords: ['ios', 'swift', 'swiftui', 'xcode', 'apple', 'mobile', 'development'],
  skills: './skills/',
  interface: {
    displayName: 'Axiom',
    shortDescription: 'Battle-tested iOS development skills',
    longDescription: 'Axiom gives AI coding assistants deep iOS development expertise — preventing data loss from bad migrations, catching memory leaks, diagnosing build failures, and guiding Swift concurrency, SwiftUI, networking, accessibility, and more.',
    developerName: 'Charles Wiltgen',
    category: 'Development',
    capabilities: ['Read'],
    websiteURL: 'https://charleswiltgen.github.io/Axiom/',
    privacyPolicyURL: 'https://charleswiltgen.github.io/Axiom/privacy',
    termsOfServiceURL: 'https://charleswiltgen.github.io/Axiom/terms',
    brandColor: '#3451b2',
    defaultPrompt: [
      'Check my SwiftUI code for performance issues',
      'Help me fix this build failure',
      'How do I safely add a database column?',
    ],
  },
};

fs.writeFileSync(
  path.join(OUTPUT_MANIFEST, 'plugin.json'),
  JSON.stringify(pluginManifest, null, 2) + '\n'
);

// --- Convert agents to on-demand Codex skills ---
const SOURCE_AGENTS = path.join(root, '.claude-plugin/plugins/axiom/agents');

// Agents that require Bash/Edit/Write tools — these need interactive capabilities
// and should note that in their description
const AGENTS_NEEDING_BASH = new Set([
  'build-fixer', 'build-optimizer', 'crash-analyzer', 'performance-profiler',
  'screenshot-validator', 'simulator-tester', 'test-debugger', 'test-runner',
]);

// Map agent names to Codex skill names (axiom- prefix + verb-first naming)
const AGENT_NAME_MAP: Record<string, string> = {
  'build-fixer': 'axiom-fix-build',
  'build-optimizer': 'axiom-optimize-build',
  'crash-analyzer': 'axiom-analyze-crash',
  'health-check': 'axiom-health-check',
  'iap-implementation': 'axiom-implement-iap',
  'modernization-helper': 'axiom-modernize',
  'performance-profiler': 'axiom-profile-performance',
  'screenshot-validator': 'axiom-validate-screenshots',
  'simulator-tester': 'axiom-test-simulator',
  'spm-conflict-resolver': 'axiom-resolve-spm',
  'test-debugger': 'axiom-debug-tests',
  'test-failure-analyzer': 'axiom-analyze-test-failures',
  'test-runner': 'axiom-run-tests',
};

// Default: *-auditor → axiom-audit-*, *-analyzer → axiom-analyze-*, *-scanner → axiom-scan-*
function agentToSkillName(agentName: string): string {
  if (AGENT_NAME_MAP[agentName]) return AGENT_NAME_MAP[agentName];
  if (agentName.endsWith('-auditor')) return `axiom-audit-${agentName.replace(/-auditor$/, '')}`;
  if (agentName.endsWith('-analyzer')) return `axiom-analyze-${agentName.replace(/-analyzer$/, '')}`;
  if (agentName.endsWith('-scanner')) return `axiom-scan-${agentName.replace(/-scanner$/, '')}`;
  return `axiom-${agentName}`;
}

// Extract first sentence of agent description for skill description
function agentDescriptionToSkillDescription(desc: string): string {
  // Strip example blocks and "Explicit command" lines
  let clean = desc
    .replace(/<example>[\s\S]*?<\/example>/g, '')
    .replace(/Explicit command:.*$/gm, '')
    .trim();
  // Take first sentence or up to first period
  const firstSentence = clean.match(/^[^.]+\./)?.[0] || clean.split('\n')[0];
  let result = firstSentence.trim();
  // Convert from "Use this agent when..." to "Use when..."
  result = result.replace(/^Use this agent when/i, 'Use when');
  if (result.length > 250) result = result.slice(0, 247) + '...';
  return result;
}

const agentFiles = fs.readdirSync(SOURCE_AGENTS)
  .filter(f => f.endsWith('.md'));

let agentsCopied = 0;
for (const file of agentFiles) {
  const agentName = file.replace(/\.md$/, '');
  const skillName = agentToSkillName(agentName);
  const content = fs.readFileSync(path.join(SOURCE_AGENTS, file), 'utf8');
  const { data: fm, content: body } = matter(content);

  if (!fm.name || !fm.description) {
    console.warn(`  warn: skipped agent ${agentName} (missing name or description)`);
    continue;
  }

  const description = agentDescriptionToSkillDescription(
    typeof fm.description === 'string' ? fm.description : ''
  );

  const needsBash = AGENTS_NEEDING_BASH.has(agentName);
  const bashNote = needsBash
    ? '\n\n> **Note:** This audit may use Bash commands to run builds, tests, or CLI tools.\n'
    : '';

  // Build SKILL.md with disable-model-invocation (user-invoked only)
  const skillContent = [
    '---',
    `name: ${skillName}`,
    `description: ${description}`,
    'license: MIT',
    'disable-model-invocation: true',
    '---',
    bashNote + body.trim(),
    '',
  ].join('\n');

  const destDir = path.join(OUTPUT_SKILLS, skillName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'SKILL.md'), skillContent);

  // Generate openai.yaml for the skill too
  const displayName = toDisplayName(skillName);
  const shortDesc = toShortDescription(description);
  const yaml = [
    'interface:',
    `  display_name: "${displayName}"`,
    `  short_description: "${shortDesc}"`,
    '',
  ].join('\n');
  const agentsDir = path.join(destDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), yaml);

  agentsCopied++;
}

// Summary
const allDirs = fs.readdirSync(SOURCE_SKILLS, { withFileTypes: true }).filter(d => d.isDirectory());
const skipped = allDirs.filter(d => EXCLUDE_SKILLS.has(d.name)).length;
console.log(`axiom-codex built: ${copied} skills (${skipped} routers excluded) + ${agentsCopied} agent-skills, v${version}`);
