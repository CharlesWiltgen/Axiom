#!/usr/bin/env node

/**
 * Generates skill-annotations.json for MCP search discovery.
 *
 * Reads SKILL.md frontmatter and content to derive category, tags, and related
 * fields. Tags get 2x boost in MiniSearch BM25 scoring — same as description,
 * higher than body (1x).
 *
 * Preserves existing manual annotations. Only generates for unannotated skills.
 *
 * Usage:
 *   npm run build && node dist/scripts/generate-annotations.js [plugin-path]
 */

import { readdir, readFile, rename, rm, writeFile, stat } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { inferSkillType, isGeneratedSubSkill, outsideFences, referenceDescription } from '../loader/parser.js';
import type { SkillType } from '../loader/parser.js';

// --- Types ---

interface AnnotationEntry {
  category?: string;
  tags?: string[];
  related?: string[];
}

/** The curated annotations file exists but can't be used, so nothing may overwrite it. */
export class AnnotationsFileError extends Error {
  override readonly name = 'AnnotationsFileError';
  constructor(readonly path: string, reason: string, options?: { cause?: unknown }) {
    super(`${path}: ${reason}. Its curated annotations would be lost, so nothing was written; fix or restore the file (git checkout -- ${basename(path)}) and rerun.`, options);
  }
}

/** A plugin source file exists but can't be read or parsed, so the build must stop. */
export class SkillSourceError extends Error {
  override readonly name = 'SkillSourceError';
  constructor(readonly path: string, reason: string, options?: { cause?: unknown }) {
    super(`${path}: ${reason}. Skipping it would drop it from the annotations and the bundle; fix it and rerun.`, options);
  }
}

export function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/** The file's text, or null when it doesn't exist; any other failure throws SkillSourceError. */
export async function readSource(path: string, options: { mustExist?: boolean } = {}): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if (isMissingFile(error) && !options.mustExist) return null;
    throw new SkillSourceError(path, `can't be read (${(error as Error).message})`, { cause: error });
  }
}

function invalidEntryReason(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'is not an object';
  const entry = value as Record<string, unknown>;
  if (entry.category !== undefined && typeof entry.category !== 'string') return 'has a non-string category';
  for (const field of ['tags', 'related'] as const) {
    const list = entry[field];
    if (list !== undefined && !(Array.isArray(list) && list.every((item) => typeof item === 'string'))) {
      return `has ${field} that isn't an array of strings`;
    }
  }
  return null;
}

/**
 * Curated annotations to preserve: none when the file doesn't exist, otherwise its
 * entries. Any other failure throws, because treating an unreadable or corrupt file
 * as empty replaces every curated entry with heuristic output (Axiom-dfd).
 */
export async function readExistingAnnotations(
  path: string,
): Promise<{ entries: Record<string, AnnotationEntry>; content: string | null }> {
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch (error) {
    if (isMissingFile(error)) return { entries: {}, content: null };
    throw new AnnotationsFileError(path, `can't be read (${(error as Error).message})`, { cause: error });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new AnnotationsFileError(path, `isn't valid JSON (${(error as Error).message})`, { cause: error });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AnnotationsFileError(path, 'is not a JSON object of annotation entries');
  }
  for (const [key, value] of Object.entries(parsed)) {
    const reason = invalidEntryReason(value);
    if (reason) throw new AnnotationsFileError(path, `entry "${key}" ${reason}`);
  }
  return { entries: parsed as Record<string, AnnotationEntry>, content };
}

/** Writes through a temporary file and a rename, so an interrupted write can't leave a truncated file. */
export async function writeAnnotationsAtomically(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, content, 'utf-8');
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch((cleanupError: Error) => {
      console.warn(`Warning: couldn't remove ${temporary}: ${cleanupError.message}`);
    });
    throw error;
  }
}

interface SkillInfo {
  name: string;
  description: string;
  content: string;
  skillType: SkillType;
  parentSuite?: string;  // For reference files within suites
}

// --- Category label → slug mapping ---

export const CATEGORY_SLUGS: Record<string, string> = {
  'Build & Environment': 'build',
  'UI & Design': 'ui',
  'Data & Persistence': 'data',
  'Concurrency & Async': 'concurrency',
  'Performance': 'performance',
  'Networking': 'networking',
  'System Integration': 'integration',
  'Accessibility': 'accessibility',
  'Apple Intelligence': 'ai',
  'Machine Learning': 'ml',
  'Computer Vision': 'vision',
  'Graphics & Metal': 'graphics',
  'Games': 'games',
  'Testing': 'testing',
  'Media': 'media',
  'Shipping': 'shipping',
  'General': 'general',
};

// Words too generic to be useful as search tags
const NOISE_WORDS = new Set([
  'use', 'when', 'any', 'all', 'ios', 'app', 'apps', 'fix', 'bugs',
  'code', 'work', 'make', 'need', 'the', 'for', 'and', 'with', 'from',
  'that', 'this', 'your', 'are', 'not', 'you', 'can', 'has', 'have',
  'will', 'into', 'also', 'see', 'new', 'before', 'after', 'should',
  'must', 'may', 'could', 'would', 'about', 'other', 'more', 'just',
  'only', 'first', 'last', 'most', 'some', 'xcode', 'swift', 'apple',
  'framework', 'patterns', 'guide', 'prevents', 'provides',
  'comprehensive', 'complete', 'based', 'including', 'covering',
  'covers', 'implementing', 'debugging', 'fixing', 'handling',
  'managing', 'using', 'building', 'creating', 'adding', 'working',
  'running', 'checking', 'reviewing', 'optimizing', 'common', 'issues',
  'errors', 'problems', 'solutions', 'ipados', 'macos', 'watchos',
  'visionos', 'tvos', 'sdk', 'key', 'null', 'type', 'value', 'error',
  'feature', 'features', 'support', 'design', 'system', 'event',
  'events', 'state', 'model', 'view', 'views', 'safe', 'data',
  'file', 'files', 'process', 'thread', 'service', 'custom',
  'specific', 'adopt', 'adopting', 'modern', 'current', 'latest',
  'legacy', 'existing', 'relevant', 'approach', 'best', 'practice',
  'practices', 'wrong', 'right', 'avoid', 'prevent', 'ensure',
  // Prose words from section headings (not framework terms)
  'critical', 'mandatory', 'optional', 'important', 'overview',
  'example', 'examples', 'quick', 'advanced', 'basic', 'both',
  'good', 'bad', 'step', 'steps', 'summary', 'resources',
  'related', 'pattern', 'decision', 'tree', 'gotcha', 'gotchas', 'one',
  'troubleshooting', 'checklist', 'when', 'what', 'how', 'why',
]);

// --- Category overrides for names where heuristic order causes mismatches ---
// e.g., "metal-migration" matches "migration" → data before "metal" → graphics

const CATEGORY_OVERRIDES: Record<string, string> = {
  // Suite-level overrides (suite names don't contain framework-specific keywords)
  'axiom-ai': 'Apple Intelligence',
  'axiom-design': 'UI & Design',
  'axiom-integration': 'System Integration',
  'axiom-location': 'System Integration',
  'axiom-media': 'Media',
  'axiom-security': 'General',
  'axiom-swift': 'General',
  'axiom-shipping': 'Shipping',
  'axiom-tools': 'General',
};

// Apple doc filename patterns → category (mirrors catalog/index.ts APPLE_DOC_CATEGORIES)
const APPLE_DOC_CATEGORIES: Record<string, string> = {
  'swiftui': 'UI & Design',
  'uikit': 'UI & Design',
  'appkit': 'UI & Design',
  'widgetkit': 'System Integration',
  'swift-concurrency': 'Concurrency & Async',
  'swift-inlinearray': 'Performance',
  'swiftdata': 'Data & Persistence',
  'storekit': 'System Integration',
  'foundationmodels': 'Apple Intelligence',
  'appintents': 'System Integration',
  'mapkit': 'System Integration',
  'swift-charts': 'UI & Design',
  'implementing-visual': 'Computer Vision',
  'implementing-assistive': 'Accessibility',
  'widgets-for-visionos': 'System Integration',
  'foundation-attributedstring': 'UI & Design',
  'alarmkit': 'System Integration',
  'webkit': 'UI & Design',
  'toolbar': 'UI & Design',
  'styled-text': 'UI & Design',
  'liquid-glass': 'UI & Design',
};

// --- Category inference (mirrors catalog/index.ts inferCategoryFromName) ---

// NOTE: Duplicated from catalog/index.ts (without CATEGORY_OVERRIDES) — keep both in sync.
export function inferCategoryFromName(name: string): string {
  if (CATEGORY_OVERRIDES[name]) return CATEGORY_OVERRIDES[name];
  if (name.startsWith('apple-diag-')) return 'Build & Environment';
  if (name.startsWith('apple-guide-')) {
    for (const [pattern, category] of Object.entries(APPLE_DOC_CATEGORIES)) {
      if (name.includes(pattern)) return category;
    }
    return 'General';
  }
  if (name.includes('build') || name.includes('xcode') || name.includes('spm') || name.includes('asc-mcp')) return 'Build & Environment';
  if (name.includes('swiftui') || name.includes('uikit') || name.includes('layout') || name.includes('liquid-glass') || name.includes('hig') || name.includes('typography') || name.includes('textkit') || name.includes('animation') || name.includes('ui-recording') || name.includes('ui-testing') || name.includes('sf-symbols') || name.includes('tvos') || name.includes('pencilkit') || name.includes('paperkit')) return 'UI & Design';
  if (name.includes('data') || name.includes('sqlite') || name.includes('grdb') || name.includes('realm') || name.includes('codable') || name.includes('cloud') || name.includes('storage') || name.includes('migration') || name.includes('icloud')) return 'Data & Persistence';
  if (name.includes('concurrency') || name.includes('async') || name.includes('synchroniz') || name.includes('isolated')) return 'Concurrency & Async';
  if (name.includes('performance') || name.includes('energy') || name.includes('memory') || name.includes('profil') || name.includes('hang') || name.includes('display')) return 'Performance';
  if (name.includes('network') || name.includes('url')) return 'Networking';
  if (name.includes('accessibility')) return 'Accessibility';
  if (name.includes('test') || name.includes('xctest') || name.includes('xctrace') || name.includes('axe')) return 'Testing';
  if (name.includes('camera') || name.includes('photo') || name.includes('haptic') || name.includes('now-playing') || name.includes('shazamkit') || name.includes('avfoundation') || name.includes('musickit') || name.includes('carplay') || name.includes('dockkit')) return 'Media';
  if (name.includes('vision')) return 'Computer Vision';
  if (name.includes('foundation-model') || name.includes('intelligence') || name.includes('coreml') || name === 'speech') return 'Apple Intelligence';
  if (name.includes('metal') || name.includes('graphics')) return 'Graphics & Metal';
  if (name.includes('spritekit') || name.includes('scenekit') || name.includes('game')) return 'Games';
  if (name.includes('debug')) return 'Build & Environment';
  if (name.includes('triage') || name.includes('app-store-connect')) return 'Build & Environment';
  if (name.includes('intent') || name.includes('shortcut') || name.includes('widget') || name.includes('extension') || name.includes('storekit') || name.includes('iap') || name.includes('localization') || name.includes('spotlight') || name.includes('privacy') || name.includes('deep-link') || name.includes('app-store') || name.includes('background-process') || name.includes('shipping') || name.includes('push-notif') || name.includes('timer-pattern') || name.includes('eventkit') || name.includes('contacts') || name.includes('alarmkit') || name.includes('live-activit') || name.includes('accessorysetupkit') || name.includes('weatherkit') || name.includes('callkit') || name.includes('app-clip')) return 'System Integration';
  if (name.includes('docs-research') || name.includes('getting-started')) return 'General';
  return 'General';
}

// --- Tag extraction ---

// Generic tags that provide no search differentiation
const GENERIC_TAGS = new Set([
  'api', 'reference', 'diagnostic', 'wwdc', 'ui', 'swiftui',
]);

export function extractTags(
  description: string,
  skillName: string,
  _categorySlug: string,
  _skillType: string,
  content?: string,
): string[] {
  const tags = new Set<string>();

  // Also scan section headings from content (## headers contain framework terms)
  if (content) {
    const lines = content.split('\n');
    const prose = outsideFences(lines);
    const headings = lines.filter((line, i) => prose[i] && /^#{1,4}\s+.+$/.test(line));
    if (headings.length) {
      const headingText = headings.join(' ');
      // PascalCase from headings
      const pascalInHeadings = headingText.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]*)+\b/g);
      if (pascalInHeadings) {
        for (const pt of pascalInHeadings) {
          const lower = pt.toLowerCase();
          if (!NOISE_WORDS.has(lower) && !GENERIC_TAGS.has(lower) && lower.length > 3) {
            tags.add(lower);
          }
        }
      }
      // @-prefixed from headings
      const atInHeadings = headingText.match(/@[A-Za-z]\w+/g);
      if (atInHeadings) {
        for (const at of atInHeadings) {
          tags.add(at.toLowerCase());
        }
      }
      // Abbreviations from headings (3+ chars to skip DO, ID, SE etc.)
      const abbrInHeadings = headingText.match(/\b[A-Z]{3,}\b/g);
      if (abbrInHeadings) {
        for (const ab of abbrInHeadings) {
          const lower = ab.toLowerCase();
          if (!NOISE_WORDS.has(lower) && !GENERIC_TAGS.has(lower) && lower !== 'ios' && lower !== 'not' && lower !== 'any') {
            tags.add(lower);
          }
        }
      }
    }
  }

  // Quoted terms from description (single, double, curly quotes — error messages, keywords)
  const quotedPatterns = [
    /'([^']+)'/g,
    /"([^"]+)"/g,
    /\u2018([^\u2019]+)\u2019/g,
    /\u201C([^\u201D]+)\u201D/g,
  ];
  for (const pattern of quotedPatterns) {
    let qMatch;
    while ((qMatch = pattern.exec(description)) !== null) {
      const term = qMatch[1].trim();
      // Skip multi-word phrases (more than 3 spaces = 4+ words)
      if (term.split(/\s+/).length > 3) continue;
      if (term.length >= 2 && term.length <= 35) {
        const slug = term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9@-]/g, '');
        if (slug.length >= 2) tags.add(slug);
      }
    }
  }

  // @-prefixed terms (@MainActor, @Sendable, @Observable, etc.)
  const atTerms = description.match(/@[A-Za-z]\w+/g);
  if (atTerms) {
    for (const at of atTerms) {
      tags.add(at.toLowerCase());
    }
  }

  // PascalCase compound words (SwiftUI, NavigationStack, CoreData, etc.)
  const pascalTerms = description.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]*)+\b/g);
  if (pascalTerms) {
    for (const pt of pascalTerms) {
      const lower = pt.toLowerCase();
      if (!NOISE_WORDS.has(lower) && !GENERIC_TAGS.has(lower) && lower.length > 3) {
        tags.add(lower);
      }
    }
  }

  // Uppercase abbreviations 2+ chars (GRDB, LLDB, IAP, etc.)
  const abbrTerms = description.match(/\b[A-Z]{2,}\b/g);
  if (abbrTerms) {
    for (const ab of abbrTerms) {
      const lower = ab.toLowerCase();
      if (!NOISE_WORDS.has(lower) && !GENERIC_TAGS.has(lower) && lower !== 'ios' && lower !== 'not' && lower !== 'any') {
        tags.add(lower);
      }
    }
  }

  // Remove tags that are already name components (name gets 3x boost)
  const nameTerms = new Set(
    skillName.replace(/^axiom-/, '').split('-').filter(t => t.length > 2),
  );
  for (const tag of Array.from(tags)) {
    if (nameTerms.has(tag)) tags.delete(tag);
  }

  // Deduplicate @foo / foo pairs — keep only the @-prefixed form
  for (const tag of Array.from(tags)) {
    if (tag.startsWith('@') && tags.has(tag.slice(1))) {
      tags.delete(tag.slice(1));
    }
  }

  // Remove question-style phrase tags (how-do-i-*, what-is-*, etc.)
  const questionPrefixes = ['how-do-i', 'what-is', 'why-is', 'where-should',
    'where-do', 'where-does', 'when-should', 'my-app', 'should-i', 'mvvm-vs'];
  for (const tag of Array.from(tags)) {
    if (questionPrefixes.some(p => tag.startsWith(p))) {
      tags.delete(tag);
    }
  }

  // Remove category-slug echo and generic tags
  const allCategorySlugs = new Set(Object.values(CATEGORY_SLUGS));
  for (const tag of Array.from(tags)) {
    if (allCategorySlugs.has(tag) || GENERIC_TAGS.has(tag)) {
      tags.delete(tag);
    }
  }

  return Array.from(tags).sort();
}

// --- Related skills ---

function findRelatedByNaming(skillName: string, allNames: Set<string>): string[] {
  const related = new Set<string>();

  // Strip suffixes to find base name
  const base = skillName
    .replace(/-migration-diag$/, '')
    .replace(/-ref$/, '')
    .replace(/-diag$/, '')
    .replace(/-migration$/, '');

  // Look for all family variants
  const suffixes = ['', '-ref', '-diag', '-migration', '-migration-diag'];
  for (const suffix of suffixes) {
    const variant = base + suffix;
    if (variant !== skillName && allNames.has(variant)) {
      related.add(variant);
    }
  }

  // Handle special groupings (now-playing variants)
  if (skillName.startsWith('axiom-now-playing')) {
    for (const name of allNames) {
      if (name.startsWith('axiom-now-playing') && name !== skillName) {
        related.add(name);
      }
    }
  }

  // Handle xcode-mcp variants
  if (skillName.startsWith('axiom-xcode-mcp')) {
    for (const name of allNames) {
      if (name.startsWith('axiom-xcode-mcp') && name !== skillName) {
        related.add(name);
      }
    }
  }

  return Array.from(related);
}

// Skills that are poor related candidates — platform/broad skills mentioned in many
// skills' patch sections but not genuinely related (e.g., tvOS patches in data skills).
const RELATED_EXCLUDES = new Set([
  'axiom-tvos',
  'axiom-using-axiom',
  'axiom-getting-started',
]);

function findRelatedByContent(content: string, skillName: string, allNames: Set<string>): string[] {
  const refs = new Set<string>();

  // Backtick-quoted skill names
  const backtickPattern = /`(axiom-[\w-]+)`/g;
  let match;
  while ((match = backtickPattern.exec(content)) !== null) {
    const name = match[1];
    if (name !== skillName && allNames.has(name) && !RELATED_EXCLUDES.has(name)) {
      refs.add(name);
    }
  }

  // /skill axiom-xxx references
  const slashPattern = /\/skill\s+(axiom-[\w-]+)/g;
  while ((match = slashPattern.exec(content)) !== null) {
    const name = match[1];
    if (name !== skillName && allNames.has(name) && !RELATED_EXCLUDES.has(name)) {
      refs.add(name);
    }
  }

  return Array.from(refs);
}

export function findRelatedSkills(
  skillName: string,
  content: string,
  allNames: Set<string>,
): string[] {
  const namingRelated = findRelatedByNaming(skillName, allNames);
  const contentRelated = findRelatedByContent(content, skillName, allNames);

  // Merge, naming-based first (more reliable), cap at 6
  const combined = new Set([...namingRelated, ...contentRelated]);

  return Array.from(combined).sort().slice(0, 6);
}

/**
 * Every skill and sub-skill under `skillsDir`. A directory with no SKILL.md, or a
 * suite with no skills/ folder, is skipped; any other read or parse failure throws,
 * because a skipped source looks deleted and the prune step drops its curated
 * annotations (Axiom-dfd).
 */
export async function loadSkillSources(skillsDir: string): Promise<Map<string, SkillInfo>> {
  const skills = new Map<string, SkillInfo>();

  async function loadSkillsFromDir(dir: string): Promise<void> {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;   // editor locks, AppleDouble copies, .DS_Store
      const entryPath = join(dir, entry);
      const entryStat = await stat(entryPath);
      if (!entryStat.isDirectory()) continue;

      const skillFile = join(entryPath, 'SKILL.md');
      const raw = await readSource(skillFile);
      if (raw !== null) {
        let parsed: matter.GrayMatterFile<string>;
        try {
          parsed = matter(raw, {});   // options bypass gray-matter's cache, which keeps broken input from throwing twice
        } catch (error) {
          throw new SkillSourceError(skillFile, `frontmatter doesn't parse (${(error as Error).message})`, { cause: error });
        }
        const name = parsed.data.name || entry;
        const description = parsed.data.description || '';
        skills.set(name, { name, description, content: parsed.content, skillType: inferSkillType(name, parsed.content) });

        // Load reference files from skills/ subdirectory (mirrors dev-loader.ts)
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
          // The bundler drops these, so annotating them only produces entries
          // that bundle.ts then reports as orphaned.
          if (isGeneratedSubSkill(refContent)) continue;
          const refName = `${entry}--${refFile.replace(/\.md$/, '')}`;
          skills.set(refName, {
            name: refName,
            description: referenceDescription(refContent),
            content: refContent,
            skillType: inferSkillType(refName, refContent, true),
            parentSuite: entry,
          });
        }
      }

      // Recurse into subdirectories
      await loadSkillsFromDir(entryPath);
    }
  }

  await loadSkillsFromDir(skillsDir);
  return skills;
}

// --- Main ---

async function main() {
  const pluginPath = process.argv[2] || join(process.cwd(), '../.claude-plugin/plugins/axiom');
  const annotationsPath = join(process.cwd(), 'skill-annotations.json');
  const skillsDir = join(pluginPath, 'skills');

  console.log('Axiom MCP — Annotation Generator');
  console.log('=================================');
  console.log(`Skills dir: ${skillsDir}`);
  console.log(`Output:     ${annotationsPath}`);
  console.log();

  // 1. Read all skill frontmatters and content
  const skills = await loadSkillSources(skillsDir);

  const routerCount = Array.from(skills.values()).filter(s => s.skillType === 'router').length;
  const metaCount = Array.from(skills.values()).filter(s => s.skillType === 'meta').length;
  const targetCount = skills.size - routerCount - metaCount;
  console.log(`Found ${skills.size} skills (${routerCount} routers, ${metaCount} meta, ${targetCount} targets)`);

  // 2. Load existing annotations
  const { entries: existing, content: existingContent } = await readExistingAnnotations(annotationsPath);
  console.log(existingContent === null
    ? 'No existing annotations found, starting fresh'
    : `Loaded ${Object.keys(existing).length} existing annotations`);

  // 3. Generate annotations for unannotated non-router, non-meta skills
  const allNames = new Set(skills.keys());
  const annotations: Record<string, AnnotationEntry> = { ...existing };
  let generated = 0;
  let preserved = 0;

  for (const [name, info] of skills) {
    // Skip routers and meta
    if (info.skillType === 'router' || info.skillType === 'meta') continue;

    // Preserve existing annotations
    if (existing[name]) {
      preserved++;
      continue;
    }

    // Inherit category from parent suite if this is a reference file
    let categoryLabel: string;
    if (info.parentSuite) {
      categoryLabel = inferCategoryFromName(info.parentSuite);
    } else {
      categoryLabel = inferCategoryFromName(name);
    }
    const categorySlug = CATEGORY_SLUGS[categoryLabel] || 'general';
    const tags = extractTags(info.description, name, categorySlug, info.skillType, info.content);
    const related = findRelatedSkills(name, info.content, allNames);

    // Add parent suite to related for reference files
    if (info.parentSuite && allNames.has(info.parentSuite) && !related.includes(info.parentSuite)) {
      related.unshift(info.parentSuite);
    }

    const entry: AnnotationEntry = { category: categorySlug };
    if (tags.length > 0) entry.tags = tags;
    if (related.length > 0) entry.related = related;

    annotations[name] = entry;
    generated++;
  }

  // 4. Prune entries for skills that no longer exist, and for routers and meta
  // skills: search and the catalog skip them, so an entry for one is never used.
  let pruned = 0;
  for (const key of Object.keys(annotations)) {
    const type = skills.get(key)?.skillType;
    if (!allNames.has(key) || type === 'router' || type === 'meta') {
      delete annotations[key];
      pruned++;
    }
  }

  // 4b. Prune stale related references within remaining entries
  let staleRelated = 0;
  for (const entry of Object.values(annotations)) {
    if (entry.related) {
      const valid = entry.related.filter(r => allNames.has(r));
      staleRelated += entry.related.length - valid.length;
      if (valid.length > 0) {
        entry.related = valid;
      } else {
        delete entry.related;
      }
    }
  }

  // 5. Sort by key and write
  const sorted: Record<string, AnnotationEntry> = {};
  for (const key of Object.keys(annotations).sort()) {
    sorted[key] = annotations[key];
  }

  // Write only on a real change. Not for the build:bundle path — there the
  // bundle is written after this, so its mtime always wins. It matters when this
  // is run standalone (`pnpm run annotations`) while skill-annotations.json is
  // already git-dirty, or when git is unavailable: staleness.ts only forgives a
  // newer mtime it can prove is git-clean (staleness.ts:75-88), so an
  // unconditional rewrite would report a stale bundle over identical bytes.
  const serialized = JSON.stringify(sorted, null, 2) + '\n';
  const unchanged = existingContent === serialized;
  if (!unchanged) await writeAnnotationsAtomically(annotationsPath, serialized);

  console.log();
  console.log('Results:');
  console.log(`  Preserved: ${preserved} existing annotations`);
  console.log(`  Generated: ${generated} new annotations`);
  if (pruned > 0) console.log(`  Pruned:    ${pruned} stale annotations`);
  if (staleRelated > 0) console.log(`  Cleaned:   ${staleRelated} stale related references`);
  console.log(`  Total:     ${Object.keys(sorted).length} annotations`);
  console.log();
  console.log(unchanged ? `Unchanged: ${annotationsPath}` : `Written to: ${annotationsPath}`);
}

// Run when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
