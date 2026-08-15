#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  CODEX_EXCLUDED_SUITES,
  isEmittableAgent,
  isExcludedSubSkill,
  dropExcludedSubSkillRows,
  agentToSkillName,
} from './codex-exclude.js';
import { translateHooksToCodex, shouldCopyHookScript } from './codex-hooks.js';
import { isGeneratedSubSkill, parseAgentTools } from './inline-auditors.ts';

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(__filename));

const SOURCE_SKILLS = path.join(root, '.claude-plugin/plugins/axiom/skills');
const OUTPUT_DIR = path.join(root, 'axiom-codex');
const OUTPUT_SKILLS = path.join(OUTPUT_DIR, 'skills');
const OUTPUT_MANIFEST = path.join(OUTPUT_DIR, '.codex-plugin');

// Suites withheld from the Codex variant — the curated list + rationale live in
// scripts/codex-exclude.js, the single source of truth shared with the pre-deploy
// fidelity gate so the two can't drift (axiom-altb).
const EXCLUDE_SKILLS = new Set(CODEX_EXCLUDED_SUITES);

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
  alarmkit: 'AlarmKit', shazamkit: 'ShazamKit', musickit: 'MusicKit',
  carplay: 'CarPlay', haptics: 'Haptics',
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

// Recursively find all SKILL.md files (supports nested skills like axiom-ios-ml/coreml/)
interface SkillEntry {
  name: string;       // from frontmatter or directory name
  sourcePath: string; // full path to SKILL.md
  content: string;    // file content
  frontmatter: Record<string, string>;
}

function findSkillEntries(dir: string): SkillEntry[] {
  const results: SkillEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(dir, entry.name);
    const skillFile = path.join(entryPath, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      const content = fs.readFileSync(skillFile, 'utf8');
      const fm = parseFrontmatter(content);
      const name = fm.name || entry.name;
      if (!EXCLUDE_SKILLS.has(name)) {
        results.push({ name, sourcePath: skillFile, content, frontmatter: fm });
      }
    }
    // Recurse into subdirectories
    results.push(...findSkillEntries(entryPath));
  }
  return results;
}

// Verbs agentToSkillName puts first, so a skill name reads as an instruction.
const SKILL_VERBS = new Set([
  'audit', 'analyze', 'scan', 'fix', 'test', 'run', 'debug',
  'profile', 'validate', 'resolve', 'implement', 'optimize', 'modernize',
]);

// The task half of `default_prompt`, derived from the skill's own verb-first NAME
// rather than its description. Descriptions are trigger-shaped ("The user mentions
// memory leak prevention…") and do not read as an instruction; the name already
// encodes the action, so `axiom-audit-memory` → "audit memory in this project".
// Names that aren't verb-first fall back to a phrasing that stays grammatical.
function toDefaultPromptTask(skillName: string): string {
  const words = skillName.replace(/^axiom-/, '').split('-');
  if (words.length > 1 && SKILL_VERBS.has(words[0])) {
    return `${words.join(' ')} in this project.`;
  }
  if (words.length === 1 && SKILL_VERBS.has(words[0])) {
    return `${words[0]} this project.`;
  }
  return `run the ${toDisplayName(skillName)} skill on this project.`;
}

// The AXIOM_AUDITOR_INLINE block tells non-Claude-Code harnesses to READ an
// auditor's sub-skill file. That instruction is false on Codex: the refsDir loop
// below deliberately skips those files, because the agent-conversion pass emits
// every auditor as a first-class skill instead. Shipped verbatim, the block aims
// ~14 pointers at files this build never writes — the same dangling-pointer defect
// that suite-level exclusion used to cause (Axiom-ky1). Translate names, don't drop
// the block: the routing advice is right, only the addresses are wrong.
function rewriteInlineAuditorBlockForCodex(content: string): string {
  const BLOCK = /<!-- AXIOM_AUDITOR_INLINE_BEGIN[\s\S]*?AXIOM_AUDITOR_INLINE_END -->/;
  return content.replace(BLOCK, (block) => {
    const names = new Set<string>();
    for (const m of block.matchAll(/`(?:axiom-[a-z0-9-]+\/)?skills\/([a-z0-9-]+)\.md`/g)) {
      names.add(agentToSkillName(m[1]));
    }
    if (names.size === 0) return block;
    const list = [...names].sort().map((n) => `\`${n}\``).join(', ');
    return [
      '<!-- AXIOM_AUDITOR_INLINE_BEGIN — rewritten for Codex by scripts/build-codex.ts; do not hand-edit -->',
      '> **Auditors are skills here.** Where this router says "Launch `some-auditor` agent", invoke the',
      '> matching Codex skill instead — same procedure, no Claude Code agent required.',
      '>',
      `> Available: ${list}.`,
      '>',
      '> The ones that shell out — builds, tests, simulators, crash symbolication — need shell access to run.',
      '<!-- AXIOM_AUDITOR_INLINE_END -->',
    ].join('\n');
  });
}

// `/axiom:<cmd>` → Codex skill, for the cases the mechanical `axiom-<cmd>` rule
// misses because the command and its agent were named independently. `null` means
// no Codex skill provides it, so the text is labelled Claude-Code-only rather than
// redirected to something that does a different job.
const CODEX_COMMAND_MAP: Record<string, string | null> = {
  profile: 'axiom-profile-performance',
  triage: 'axiom-analyze-triage',
  screenshot: 'axiom-validate-screenshots',
  'audit screenshots': 'axiom-validate-screenshots',
  'audit swift-simplify': 'axiom-swift-simplifier',
  'audit swiftui-performance': 'axiom-analyze-swiftui-performance',
  'audit swift-performance': 'axiom-analyze-swift-performance',
  'audit test-failures': 'axiom-analyze-test-failures',
  'audit security': 'axiom-scan-security-privacy',
  'audit modernization': 'axiom-modernize',
  'fix-build': 'axiom-fix-build',
  'run-tests': 'axiom-run-tests',
  'test-simulator': 'axiom-test-simulator',
  'resolve-deps': 'axiom-resolve-spm',
  modernize: 'axiom-modernize',
  // No Codex equivalent: xclog console capture and trace comparison are
  // Claude-Code-only surfaces today.
  console: null,
  'compare-traces': null,
};

// Routers tell the reader to "Launch `build-fixer` agent or `/axiom:fix-build`".
// Neither exists on Codex: there are no agents, and `/axiom:*` commands aren't
// emitted. What DOES exist is a skill named `axiom-fix-build` — and the mapping is
// not derivable (spm-conflict-resolver → axiom-resolve-spm), so a Codex model cannot
// recover it from the bare agent name.
//
// Rewriting the AXIOM_AUDITOR_INLINE block alone was not enough: that block only
// names agents with an inlined sub-skill file, which is 2 of the 7 axiom-build
// launches. The other five (fix-build, resolve-spm, optimize-build, analyze-crash,
// test-runner) shell out, have no inline copy, and were left pointing at nothing.
// This is the Axiom-ky1 defect one indirection deeper — same fix, applied to the
// primary invoke instruction rather than the cross-reference.
function rewriteAgentInvokesForCodex(content: string): string {
  return content
    // "Launch `X` agent or `/axiom:y`"  →  "Invoke the `axiom-…` skill"
    // Only rewrite names that are REAL agents. The inline block's own illustrative
    // text says "Launch `some-auditor` agent"; an unguarded rewrite turned that
    // placeholder into `axiom-audit-some`, inventing a skill that does not exist.
    .replace(
      /Launch `([a-z0-9-]+)` agent(?: or `\/axiom:[^`]+`)?/g,
      (whole: string, agent: string) =>
        sourceAgentNames.has(agent) ? `\`${agentToSkillName(agent)}\`` : whole,
    )
    // Codex ships no `/axiom:*` commands at all. Most map mechanically
    // (`/axiom:audit energy` → `axiom-audit-energy`); a few need the explicit map
    // below because the command and the agent were named independently.
    .replace(
      /`\/axiom:(audit\s+)?([a-z0-9-]+)(\s+[a-z0-9-]+)?`/g,
      (whole: string, audit: string | undefined, name: string, arg: string | undefined) => {
        const key = audit ? `audit ${name}` : name;
        const mapped = CODEX_COMMAND_MAP[key] ?? CODEX_COMMAND_MAP[name];
        if (mapped === null) {
          // Genuinely Claude-Code-only: no Codex skill provides this. Say so rather
          // than redirect to something that does a different job.
          return `${whole} (Claude Code only)`;
        }
        if (mapped) return `\`${mapped}\``;
        const candidate = audit ? `axiom-audit-${name}` : `axiom-${name}`;
        if (codexSkillNames.has(candidate)) {
          // `/axiom:triage sentry` carries an argument the skill still accepts.
          return arg ? `\`${candidate}\`${arg}` : `\`${candidate}\``;
        }
        return whole;
      },
    );
}

// Copy skills and generate openai.yaml
const skillEntries = findSkillEntries(SOURCE_SKILLS);

// Every skill name the Codex build will emit, so the rewrite above only redirects to
// targets that actually ship. Derived from the source agents through the same naming
// function the builder and the pre-deploy gate use.
const sourceAgentNames = new Set<string>(
  fs
    .readdirSync(path.join(root, ".claude-plugin/plugins/axiom/agents"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.basename(f, ".md")),
);

const codexSkillNames = new Set<string>(
  fs
    .readdirSync(path.join(root, '.claude-plugin/plugins/axiom/agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => agentToSkillName(path.basename(f, '.md'))),
);

let copied = 0;
for (const skill of skillEntries) {
  const destDir = path.join(OUTPUT_SKILLS, skill.name);
  fs.mkdirSync(destDir, { recursive: true });
  // Router content is written, not copied: a per-file sub-skill exclusion must also
  // remove the router's routing-table row for it, or the Codex build ships a pointer
  // to a file it never wrote.
  fs.writeFileSync(
    path.join(destDir, 'SKILL.md'),
    rewriteAgentInvokesForCodex(
      rewriteInlineAuditorBlockForCodex(dropExcludedSubSkillRows(skill.content, skill.name))
    )
  );

  // Copy skills/ directory if it exists (skill suites).
  //
  // Router-inlined auditors are SKIPPED here. They exist so harnesses that
  // install via the Agent-Skills spec can reach an auditor's procedure at all;
  // Codex already gets every auditor as a first-class `axiom-audit-*` skill
  // from the agent-conversion pass below, with proper frontmatter and
  // disable-model-invocation. Copying them too would ship each procedure twice
  // in one plugin (~459 KB) under two different names.
  const refsDir = path.join(path.dirname(skill.sourcePath), 'skills');
  if (fs.existsSync(refsDir)) {
    const destRefs = path.join(destDir, 'skills');
    fs.mkdirSync(destRefs, { recursive: true });
    for (const ref of fs.readdirSync(refsDir)) {
      const refPath = path.join(refsDir, ref);
      if (isGeneratedSubSkill(fs.readFileSync(refPath, 'utf8'))) continue;
      if (isExcludedSubSkill(skill.name, ref)) continue;
      // Sub-skills cite agents and /axiom: commands too, so they need the same
      // translation as routers — a verbatim copy reintroduces the dangling invokes.
      fs.writeFileSync(
        path.join(destRefs, ref),
        rewriteAgentInvokesForCodex(fs.readFileSync(refPath, "utf8"))
      );
    }
  }

  // Generate agents/openai.yaml from frontmatter
  if (skill.frontmatter.name && skill.frontmatter.description) {
    const agentsDir = path.join(destDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    const yaml = [
      'interface:',
      `  display_name: "${toDisplayName(skill.name)}"`,
      `  short_description: "${toShortDescription(skill.frontmatter.description)}"`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), yaml);
  } else {
    console.warn(`  warn: skipped openai.yaml for ${skill.name} (missing name or description in frontmatter)`);
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
  // Relative path from the plugin root (axiom-codex/) to the MCP
  // server list. Codex's plugin loader resolves this path against the
  // plugin root and reads PluginMcpFile from it. The file itself is
  // written alongside plugin.json below. Schema source:
  //   https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/loader.rs
  mcpServers: './.mcp.json',
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

// Generate .mcp.json — the plugin-local MCP server list Codex reads when
// a user installs the plugin. Keyed by logical server name; each value
// maps onto Codex's McpServerConfig (same shape as ~/.codex/config.toml's
// [mcp_servers.NAME] section). Lives at the plugin root so the
// pluginManifest.mcpServers path ('./.mcp.json') resolves correctly.
const mcpFile = {
  mcpServers: {
    axiom: {
      command: 'npx',
      args: ['-y', 'axiom-mcp'],
    },
  },
};
fs.writeFileSync(
  path.join(OUTPUT_DIR, '.mcp.json'),
  JSON.stringify(mcpFile, null, 2) + '\n'
);

// --- Generate hooks/ — port the Claude Code lifecycle hooks to Codex (bd axiom-25ll) ---
// Codex plugins auto-discover hooks at the plugin-root hooks/hooks.json. translateHooksToCodex
// rewrites ${CLAUDE_PLUGIN_ROOT} -> ${PLUGIN_ROOT}, drops groups Codex can't fire ("Read"),
// and strips matchers Codex rejects (UserPromptSubmit/Stop). The script copy is a DENYLIST
// (shouldCopyHookScript) so transitive deps (session-start.sh -> session-start.py ->
// project_detect.py, none of which appear in hooks.json) are copied automatically.
const SOURCE_HOOKS = path.join(root, '.claude-plugin/plugins/axiom/hooks');
const OUTPUT_HOOKS = path.join(OUTPUT_DIR, 'hooks');
fs.mkdirSync(OUTPUT_HOOKS, { recursive: true });

const ccHooks = JSON.parse(fs.readFileSync(path.join(SOURCE_HOOKS, 'hooks.json'), 'utf8'));
fs.writeFileSync(
  path.join(OUTPUT_HOOKS, 'hooks.json'),
  JSON.stringify(translateHooksToCodex(ccHooks), null, 2) + '\n'
);

let hookScriptsCopied = 0;
for (const file of fs.readdirSync(SOURCE_HOOKS)) {
  if (!shouldCopyHookScript(file)) continue;
  const dest = path.join(OUTPUT_HOOKS, file);
  fs.copyFileSync(path.join(SOURCE_HOOKS, file), dest);
  // session-start.sh is invoked directly under Codex's `sh -lc`, so it needs the
  // execute bit (copyFileSync does not guarantee mode preservation). The .py hooks are
  // invoked via `python3 "..."`, so they don't.
  if (file.endsWith('.sh')) fs.chmodSync(dest, 0o755);
  hookScriptsCopied++;
}

// --- Convert agents to on-demand Codex skills ---
const SOURCE_AGENTS = path.join(root, '.claude-plugin/plugins/axiom/agents');

// Agents that declare Bash need interactive capabilities, and their Codex skill
// says so. Derived from the agent's own tools: declaration rather than a
// hand-maintained list — the previous hardcoded set listed 8 agents while 11
// actually declare Bash (iap-implementation, spm-conflict-resolver and
// triage-analyzer were missing their note), and any new Bash agent would have
// silently missed it too.
function agentNeedsBash(content: string): boolean {
  const parsed = parseAgentTools(content);
  return parsed.kind === 'ok' && parsed.tools.includes('Bash');
}

// Extract first sentence of agent description for skill description
function agentDescriptionToSkillDescription(desc: string): string {
  // Strip example blocks and "Explicit command" lines
  let clean = desc
    .replace(/<example>[\s\S]*?<\/example>/g, '')
    .replace(/Explicit command:.*$/gm, '')
    .trim();
  // Take the first sentence. The terminating period must be followed by whitespace
  // or end-of-string: Axiom descriptions are full of file extensions (`.ips`,
  // `.crash`, `.xccrashpoint`), and a plain /^[^.]+\./ ended the sentence at the
  // first of those. crash-analyzer's description became "Use when the user has a
  // crash log (." — the string Codex actually routes on (Axiom-izi).
  const firstSentence = clean.match(/^[\s\S]*?\.(?=\s|$)/)?.[0] || clean.split('\n')[0];
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

  if (!isEmittableAgent(fm)) {
    console.warn(`  warn: skipped agent ${agentName} (missing name or description)`);
    continue;
  }

  const description = agentDescriptionToSkillDescription(
    typeof fm.description === 'string' ? fm.description : ''
  );

  const needsBash = agentNeedsBash(content);
  const bashNote = needsBash
    ? '\n\n> **Note:** This audit may use Bash commands to run builds, tests, or CLI tools.\n'
    : '';

  // NO `disable-model-invocation` here. Codex's own plugin validator rejects it:
  //
  //   if disable_model_invocation not in (None, False):
  //       errors.append("... frontmatter field `disable-model-invocation` must be false")
  //   — codex-rs/skills/src/assets/samples/plugin-creator/scripts/validate_plugin.py
  //
  // Emitting it failed validation on all 42 agent-skills (verified against Codex
  // 0.147.0 on 2026-08-15: exit 1, 42 errors, that rule and nothing else). Axiom-izi
  // advised keeping the key on the theory that Cursor honors the same spelling from
  // .agents/skills/ — but Axiom ships no .agents/skills/, only the Codex marketplace
  // manifest, so nothing was gained and validation was lost.
  //
  // Explicit-invoke-only on Codex is carried by `policy.allow_implicit_invocation:
  // false` in agents/openai.yaml below, which is what the runtime actually reads.
  // The Claude Code plugin keeps the frontmatter key, where it IS the supported
  // mechanism — this omission is Codex-only.
  const skillContent = [
    '---',
    `name: ${skillName}`,
    `description: ${description}`,
    'license: MIT',
    '---',
    // Agent-skills cite sibling agents and /axiom: commands the same way routers do,
    // and Codex has neither — so they need the same translation.
    bashNote + rewriteAgentInvokesForCodex(body.trim()),
    '',
  ].join('\n');

  const destDir = path.join(OUTPUT_SKILLS, skillName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'SKILL.md'), skillContent);

  // Generate openai.yaml for the skill too.
  //
  // `policy.allow_implicit_invocation: false` is what actually makes an auditor
  // explicit-invoke-only on Codex. The `disable-model-invocation: true` frontmatter
  // key above does NOT: Codex's skill frontmatter struct deserializes only name,
  // description, and metadata, with no deny_unknown_fields, so serde drops the key
  // silently — and allows_implicit_invocation() reads the sidecar policy alone,
  // defaulting to TRUE when absent (codex-rs/skills/src/model.rs). Emitting the key
  // without the policy block left all 42 auditors competing for implicit activation
  // on every prompt — the exact routing regression the design meant to prevent,
  // failing silently in both directions (Axiom-izi).
  //
  // Keep the frontmatter key: Cursor honors that spelling and also reads
  // .agents/skills/, so one directory carrying both controls covers Claude Code,
  // Cursor, and Codex.
  //
  // default_prompt is required for a skill that no longer surfaces itself: it must
  // name the skill as `$skill-name`, which is how a user invokes an explicit-only
  // skill. Codex's own review-agent sample pairs the two for this reason.
  const displayName = toDisplayName(skillName);
  const shortDesc = toShortDescription(description);
  const yaml = [
    'interface:',
    `  display_name: "${displayName}"`,
    `  short_description: "${shortDesc}"`,
    `  default_prompt: "Use $${skillName} to ${toDefaultPromptTask(skillName)}"`,
    'policy:',
    '  allow_implicit_invocation: false',
    '',
  ].join('\n');
  const agentsDir = path.join(destDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), yaml);

  agentsCopied++;
}

// Summary
const skipped = EXCLUDE_SKILLS.size;
console.log(`axiom-codex built: ${copied} skills (${skipped} routers excluded) + ${agentsCopied} agent-skills + ${hookScriptsCopied} hook scripts, v${version}`);
