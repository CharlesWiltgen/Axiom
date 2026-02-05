import MiniSearch, { type AsPlainObject } from 'minisearch';
import { Skill, SkillType, SkillSource } from '../loader/parser.js';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'was', 'were', 'will', 'with', 'you', 'your',
]);

export interface SearchResult {
  name: string;
  score: number;
  skillType: SkillType;
  source: SkillSource;
  category?: string;
  description: string;
  matchingSections: string[];
}

interface SkillDocument {
  name: string;
  nameText: string;
  description: string;
  tags: string;
  sectionHeadings: string;
  body: string;
  skillType: SkillType;
  source: SkillSource;
  category: string;
}

export interface SearchIndex {
  _engine: MiniSearch<SkillDocument>;
  _sectionTerms: Map<string, Map<string, Set<string>>>;
  docCount: number;
}

export interface SerializedSearchIndex {
  engine: AsPlainObject;
  sectionTerms: Record<string, Record<string, string[]>>;
  docCount: number;
}

/**
 * Split text into raw tokens (camelCase split, lowercase, separator split, filter).
 * This is the "tokenize" phase for MiniSearch — splitting only, no suffix stripping.
 */
function tokenizeField(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9@]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Process a single term (suffix stripping). Returns null to reject.
 * This is the "processTerm" phase for MiniSearch.
 */
function processTermField(term: string): string | null {
  if (term.length <= 1) return null;
  if (STOPWORDS.has(term)) return null;
  if (term.endsWith('ing') && term.length > 5) return term.slice(0, -3);
  if (term.endsWith('tion') && term.length > 6) return term.slice(0, -4);
  if (term.endsWith('ness') && term.length > 6) return term.slice(0, -4);
  if (term.endsWith('ment') && term.length > 6) return term.slice(0, -4);
  return term;
}

/**
 * Tokenize text into normalized terms.
 * Composes tokenizeField + processTermField for backward compatibility.
 * Simple suffix stripping instead of Porter stemmer to preserve
 * technical terms like NavigationStack, Sendable.
 * Avoids -able/-ible stripping since Swift protocols (Sendable,
 * Observable, Codable, Identifiable) collide with those suffixes.
 */
export function tokenize(text: string): string[] {
  return tokenizeField(text)
    .map(processTermField)
    .filter((t): t is string => t !== null);
}

// Keys stored in MiniSearch index for filtering/display without needing the skills Map.
// Typed to SkillDocument keys so a rename is caught at compile time.
const STORED_FIELDS: (keyof SkillDocument)[] = ['skillType', 'source', 'category', 'description'];

const MINISEARCH_OPTIONS = {
  fields: ['nameText', 'description', 'tags', 'sectionHeadings', 'body'],
  storeFields: STORED_FIELDS as string[],
  idField: 'name',
  tokenize: tokenizeField,
  processTerm: processTermField,
  searchOptions: {
    boost: { nameText: 3, description: 2, tags: 2, sectionHeadings: 1.5, body: 1 },
  },
};

function toDocument(name: string, skill: Skill): SkillDocument {
  return {
    name,
    nameText: skill.name.replace(/[-_]/g, ' '),
    description: skill.description,
    tags: skill.tags.join(' '),
    sectionHeadings: skill.sections.map(s => s.heading).join(' '),
    body: skill.content,
    skillType: skill.skillType,
    source: skill.source,
    category: skill.category || '',
  };
}

function buildSectionTerms(skill: Skill): Map<string, Set<string>> {
  const docSections = new Map<string, Set<string>>();
  for (const section of skill.sections) {
    const lines = skill.content.split('\n').slice(section.startLine, section.endLine + 1);
    const sectionText = section.heading + ' ' + lines.join(' ');
    docSections.set(section.heading, new Set(tokenize(sectionText)));
  }
  return docSections;
}

/**
 * Build a search index from a collection of skills.
 */
export function buildIndex(skills: Map<string, Skill>): SearchIndex {
  const engine = new MiniSearch<SkillDocument>(MINISEARCH_OPTIONS);
  const sectionTerms = new Map<string, Map<string, Set<string>>>();
  const documents: SkillDocument[] = [];

  for (const [name, skill] of skills) {
    if (skill.skillType === 'router') continue;
    documents.push(toDocument(name, skill));
    sectionTerms.set(name, buildSectionTerms(skill));
  }

  engine.addAll(documents);

  return {
    _engine: engine,
    _sectionTerms: sectionTerms,
    docCount: documents.length,
  };
}

/**
 * Incrementally add new skills to an existing search index.
 * Mutates the index in place — avoids rebuilding the entire MiniSearch index.
 */
export function addSkills(index: SearchIndex, skills: Map<string, Skill>): void {
  const documents: SkillDocument[] = [];

  for (const [name, skill] of skills) {
    if (skill.skillType === 'router') continue;
    if (index._engine.has(name)) continue;
    documents.push(toDocument(name, skill));
    index._sectionTerms.set(name, buildSectionTerms(skill));
  }

  index._engine.addAll(documents);
  index.docCount += documents.length;
}

/**
 * Search the index using MiniSearch BM25+ scoring with field weights.
 */
export function search(
  index: SearchIndex,
  query: string,
  options?: { limit?: number; skillType?: string; category?: string; source?: string },
  skills?: Map<string, Skill>,
): SearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const limit = options?.limit ?? 10;

  const miniResults = index._engine.search(query, {
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'AND',
    filter: (result) => {
      if (options?.skillType && result.skillType !== options.skillType) return false;
      if (options?.category && result.category !== options.category) return false;
      if (options?.source && result.source !== options.source) return false;
      return true;
    },
  });

  const results: SearchResult[] = [];
  for (const hit of miniResults.slice(0, limit)) {
    const matchingSections: string[] = [];
    const docSections = index._sectionTerms.get(hit.id as string);
    if (docSections) {
      for (const [heading, terms] of docSections) {
        if (queryTerms.some(qt => terms.has(qt))) {
          matchingSections.push(heading);
        }
      }
    }

    const skill = skills?.get(hit.id as string);

    results.push({
      name: hit.id as string,
      score: hit.score,
      skillType: (hit.skillType as SkillType) || skill?.skillType || 'discipline',
      source: (hit.source as SkillSource) || skill?.source || 'axiom',
      category: (hit.category as string) || skill?.category,
      description: (hit.description as string) || skill?.description || '',
      matchingSections,
    });
  }

  return results;
}

/**
 * Serialize a SearchIndex to a plain JSON-safe object for bundling.
 */
export function serializeIndex(index: SearchIndex): SerializedSearchIndex {
  const sectionTerms: Record<string, Record<string, string[]>> = {};
  for (const [doc, sections] of index._sectionTerms) {
    sectionTerms[doc] = {};
    for (const [heading, terms] of sections) {
      sectionTerms[doc][heading] = Array.from(terms);
    }
  }

  return {
    engine: index._engine.toJSON(),
    sectionTerms,
    docCount: index.docCount,
  };
}

/**
 * Deserialize a bundled SearchIndex back into the runtime format.
 * Returns null if the data is an incompatible format (e.g. pre-MiniSearch bundle).
 */
export function deserializeIndex(data: SerializedSearchIndex): SearchIndex | null {
  if (!data.engine || typeof data.engine.serializationVersion !== 'number') return null;

  const engine = MiniSearch.loadJS<SkillDocument>(data.engine, MINISEARCH_OPTIONS);

  const sectionTerms = new Map<string, Map<string, Set<string>>>();
  for (const [doc, sections] of Object.entries(data.sectionTerms)) {
    const sectionMap = new Map<string, Set<string>>();
    for (const [heading, terms] of Object.entries(sections)) {
      sectionMap.set(heading, new Set(terms));
    }
    sectionTerms.set(doc, sectionMap);
  }

  return {
    _engine: engine,
    _sectionTerms: sectionTerms,
    docCount: data.docCount,
  };
}
