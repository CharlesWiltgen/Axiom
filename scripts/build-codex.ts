#!/usr/bin/env -S deno run --allow-read --allow-write
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Parse SKILL.md frontmatter (name, description) without external dependencies
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.+)/);
    if (m) fields[m[1]] = m[2];
  }
  return fields;
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

// Summary
const allDirs = fs.readdirSync(SOURCE_SKILLS, { withFileTypes: true }).filter(d => d.isDirectory());
const skipped = allDirs.filter(d => EXCLUDE_SKILLS.has(d.name)).length;
console.log(`axiom-codex built: ${copied} skills (${skipped} routers excluded), v${version}`);
