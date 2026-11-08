import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DynamicToolsHandler } from './tools/handler.js';
import { CLI_ONLY_BINARIES, MCP_TOOL_NAMES } from './tools/binaries.js';
import type { Loader } from './loader/types.js';
import { Logger, type Config } from './config.js';
import { detectXcode, loadAppleDocs } from './loader/xcode-docs.js';
import { loadSkillSources } from './scripts/generate-annotations.js';

// The README listed resource ids that never existed (axiom://skill/xcode-debugging) and a
// project tree missing most of tools/, because nothing compared it with the server. These
// tests hold the README and every prose mention of a tool to the names the server registers.

const repo = fileURLToPath(new URL('../../', import.meta.url));
const readme = readFileSync(join(repo, 'axiom-mcp/README.md'), 'utf8');
const pluginSkills = join(repo, '.claude-plugin/plugins/axiom/skills');

// No word boundary before axiom_, so a qualified name such as mcp__axiom__axiom_xcsym_crash is checked too.
const TOOL_FAMILIES = ['get', 'search', 'read', ...Object.keys(MCP_TOOL_NAMES), ...CLI_ONLY_BINARIES];
const TOOL_TOKEN = new RegExp(`(?<![a-z0-9])axiom_(?:${TOOL_FAMILIES.join('|')})_[a-z_]*[a-z]\\b`, 'g');

async function registeredTools(): Promise<Set<string>> {
  const logger = new Logger({ mode: 'production', enableAppleDocs: false, logLevel: 'error' } satisfies Config);
  const { tools } = await new DynamicToolsHandler({} as Loader, logger).listTools();
  return new Set([
    ...tools.map((t) => t.name),
    ...Object.values(MCP_TOOL_NAMES).flat(),
  ]);
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.vitepress') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return entry.endsWith('.md') ? [full] : [];
  });
}

function skillIdExists(id: string): boolean {
  const [router, sub] = id.split('--');
  return sub === undefined
    ? existsSync(join(pluginSkills, router, 'SKILL.md'))
    : existsSync(join(pluginSkills, router, 'skills', `${sub}.md`));
}

describe('TOOL_TOKEN', () => {
  it('finds the tool name inside a fully qualified MCP name', () => {
    expect('mcp__axiom__axiom_xcsym_crashes'.match(TOOL_TOKEN)).toEqual(['axiom_xcsym_crashes']);
  });
});

describe('axiom-mcp README', () => {
  it('names every registered tool and no other', async () => {
    const named = new Set(readme.match(TOOL_TOKEN));

    expect([...named].sort()).toEqual([...(await registeredTools())].sort());
  });

  it('gives resource examples that resolve to real skill ids', async () => {
    const ids = [...readme.matchAll(/axiom:\/\/skill\/([a-z0-9-]+)/g)].map((m) => m[1]);
    // Apple's ids come from the installed Xcode; without one they can't be checked.
    const xcode = await detectXcode();
    const logger = new Logger({ mode: 'production', enableAppleDocs: true, logLevel: 'error' } satisfies Config);
    const appleIds = xcode ? new Set((await loadAppleDocs(xcode, logger)).keys()) : null;
    const resolves = (id: string) =>
      /^apple-(?:guide|diag)-/.test(id) ? (appleIds?.has(id) ?? true) : skillIdExists(id);

    expect({ checked: ids.length > 0, unresolved: ids.filter((id) => !resolves(id)) }).toEqual({ checked: true, unresolved: [] });
  });

  it('launches the server as npx -y axiom-mcp in every config snippet', () => {
    const args = [...readme.matchAll(/"args":\s*(\[[^\]]*\])/g)].map((m) => JSON.parse(m[1]));

    expect({ checked: args.length > 0, wrong: args.filter((a) => JSON.stringify(a) !== '["-y","axiom-mcp"]') })
      .toEqual({ checked: true, wrong: [] });
  });
});

describe('tool names in shipped prose', () => {
  it('names only tools the server registers', async () => {
    const tools = await registeredTools();
    const roots = ['docs', '.claude-plugin/plugins/axiom', 'axiom-cursor', 'axiom-codex'].map((d) => join(repo, d));
    const extras = ['README.md', 'axiom-pi/README.md', 'axiom-mcp/src/instructions.ts'].map((f) => join(repo, f));
    const unknown = [...roots.flatMap(markdownFiles), ...extras]
      .flatMap((file) => (readFileSync(file, 'utf8').match(TOOL_TOKEN) ?? [])
        .filter((name) => !tools.has(name))
        .map((name) => `${file.slice(repo.length)}: ${name}`));

    expect(unknown).toEqual([]);
  });

  it('names only tool families the server registers when it writes a prefix as axiom_<prefix>_*', async () => {
    const tools = [...(await registeredTools())];
    const roots = ['docs', '.claude-plugin/plugins/axiom', 'axiom-cursor', 'axiom-codex'].map((d) => join(repo, d));
    const extras = ['README.md', 'axiom-pi/README.md', 'axiom-mcp/src/instructions.ts'].map((f) => join(repo, f));
    const prefixes = new Set([...roots.flatMap(markdownFiles), ...extras].flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/(?<![a-z0-9])(axiom_[a-z_]*[a-z])_\*/g)].map((m) => m[1])));

    expect({ checked: prefixes.size > 0, unknown: [...prefixes].filter((p) => !tools.some((t) => t.startsWith(`${p}_`))) })
      .toEqual({ checked: true, unknown: [] });
  });
});

describe('skill-annotations.json', () => {
  // applyAnnotations skips an entry whose key matches no skill, and a mistyped related id ships
  // a pointer to nothing; neither fails anywhere else.
  it('keys and links only skills that exist', () => {
    const annotations = JSON.parse(readFileSync(join(repo, 'axiom-mcp/skill-annotations.json'), 'utf8')) as Record<string, { related?: string[] }>;
    const keys = Object.keys(annotations);
    const missing = [
      ...keys.filter((id) => !skillIdExists(id)).map((id) => `key ${id}`),
      ...Object.entries(annotations).flatMap(([id, a]) => (a.related ?? []).filter((r) => !skillIdExists(r)).map((r) => `${id} → ${r}`)),
    ];
    expect({ checked: keys.length > 0, missing }).toEqual({ checked: true, missing: [] });
  });

  // Search and the catalog skip routers and meta skills, so an entry for one is
  // never used; the 26 that existed were heuristic output from a misclassification.
  it('carries no entry for a router or meta skill', async () => {
    const annotations = JSON.parse(readFileSync(join(repo, 'axiom-mcp/skill-annotations.json'), 'utf8')) as Record<string, unknown>;
    const skills = await loadSkillSources(join(repo, '.claude-plugin/plugins/axiom/skills'));
    const routerOrMeta = [...skills.values()].filter((s) => s.skillType === 'router' || s.skillType === 'meta').map((s) => s.name);
    expect({ checked: routerOrMeta.length > 0, annotated: routerOrMeta.filter((name) => name in annotations) })
      .toEqual({ checked: true, annotated: [] });
  });
});
