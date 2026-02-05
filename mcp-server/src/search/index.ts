import { Skill, SkillType, SkillSource } from '../loader/parser.js';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'was', 'were', 'will', 'with', 'you', 'your',
]);

// Field weight multipliers for BM25 scoring
const FIELD_WEIGHTS = {
  name: 3.0,
  description: 2.0,
  tags: 2.0,
  sectionHeadings: 1.5,
  body: 1.0,
};

// BM25 parameters
const K1 = 1.2;
const B = 0.75;

export interface SearchResult {
  name: string;
  score: number;
  skillType: SkillType;
  source: SkillSource;
  category?: string;
  description: string;
  matchingSections: string[];
}

interface TermEntry {
  docName: string;
  field: keyof typeof FIELD_WEIGHTS;
  tf: number;
}

export interface SearchIndex {
  invertedIndex: Map<string, TermEntry[]>;
  docLengths: Map<string, number>;
  avgDocLength: number;
  docCount: number;
  sectionTerms: Map<string, Map<string, Set<string>>>; // docName -> sectionHeading -> terms
}

export interface SerializedSearchIndex {
  invertedIndex: Record<string, TermEntry[]>;
  docLengths: Record<string, number>;
  avgDocLength: number;
  docCount: number;
  sectionTerms: Record<string, Record<string, string[]>>;
}

/**
 * Tokenize text into normalized terms.
 * Simple suffix stripping instead of Porter stemmer to preserve
 * technical terms like NavigationStack, Sendable.
 * Avoids -able/-ible stripping since Swift protocols (Sendable,
 * Observable, Codable, Identifiable) collide with those suffixes.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9@]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(t => {
      if (t.endsWith('ing') && t.length > 5) return t.slice(0, -3);
      if (t.endsWith('tion') && t.length > 6) return t.slice(0, -4);
      if (t.endsWith('ness') && t.length > 6) return t.slice(0, -4);
      if (t.endsWith('ment') && t.length > 6) return t.slice(0, -4);
      return t;
    });
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return counts;
}

/**
 * Build an inverted index from a collection of skills.
 */
export function buildIndex(skills: Map<string, Skill>): SearchIndex {
  const invertedIndex = new Map<string, TermEntry[]>();
  const docLengths = new Map<string, number>();
  const sectionTerms = new Map<string, Map<string, Set<string>>>();

  let totalLength = 0;

  function addTerms(docName: string, field: keyof typeof FIELD_WEIGHTS, tokens: string[]) {
    const counts = countTerms(tokens);
    for (const [term, tf] of counts) {
      if (!invertedIndex.has(term)) {
        invertedIndex.set(term, []);
      }
      invertedIndex.get(term)!.push({ docName, field, tf });
    }
  }

  for (const [name, skill] of skills) {
    // Skip router skills from search — they're internal routing mechanisms
    if (skill.skillType === 'router') continue;

    // Name field
    const nameTokens = tokenize(skill.name.replace(/[-_]/g, ' '));
    addTerms(name, 'name', nameTokens);

    // Description field
    const descTokens = tokenize(skill.description);
    addTerms(name, 'description', descTokens);

    // Tags field
    const tagTokens = tokenize(skill.tags.join(' '));
    addTerms(name, 'tags', tagTokens);

    // Section headings
    const headingTokens = tokenize(skill.sections.map(s => s.heading).join(' '));
    addTerms(name, 'sectionHeadings', headingTokens);

    // Body
    const bodyTokens = tokenize(skill.content);
    addTerms(name, 'body', bodyTokens);

    // Track section-level terms for matching sections in results
    const docSections = new Map<string, Set<string>>();
    for (const section of skill.sections) {
      const lines = skill.content.split('\n').slice(section.startLine, section.endLine + 1);
      const sectionText = section.heading + ' ' + lines.join(' ');
      const terms = new Set(tokenize(sectionText));
      docSections.set(section.heading, terms);
    }
    sectionTerms.set(name, docSections);

    const docLength = nameTokens.length + descTokens.length + tagTokens.length + headingTokens.length + bodyTokens.length;
    docLengths.set(name, docLength);
    totalLength += docLength;
  }

  const docCount = docLengths.size;

  return {
    invertedIndex,
    docLengths,
    avgDocLength: docCount > 0 ? totalLength / docCount : 0,
    docCount,
    sectionTerms,
  };
}

/**
 * Search the index using BM25 scoring with field weights.
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
  const scores = new Map<string, number>();
  const matchedSections = new Map<string, Set<string>>();

  for (const term of queryTerms) {
    const entries = index.invertedIndex.get(term);
    if (!entries) continue;

    // IDF: log((N - n + 0.5) / (n + 0.5) + 1)
    const docsWithTerm = new Set(entries.map(e => e.docName)).size;
    const idf = Math.log((index.docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);

    for (const entry of entries) {
      const docLen = index.docLengths.get(entry.docName) || 0;
      const weight = FIELD_WEIGHTS[entry.field];

      // BM25: idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl))
      const numerator = entry.tf * (K1 + 1);
      const denominator = entry.tf + K1 * (1 - B + B * docLen / index.avgDocLength);
      const fieldScore = idf * (numerator / denominator) * weight;

      scores.set(entry.docName, (scores.get(entry.docName) || 0) + fieldScore);

      // Track matching sections
      const docSections = index.sectionTerms.get(entry.docName);
      if (docSections) {
        if (!matchedSections.has(entry.docName)) {
          matchedSections.set(entry.docName, new Set());
        }
        for (const [heading, terms] of docSections) {
          if (terms.has(term)) {
            matchedSections.get(entry.docName)!.add(heading);
          }
        }
      }
    }
  }

  // Build results, applying filters
  const results: SearchResult[] = [];
  for (const [name, score] of scores) {
    const skill = skills?.get(name);

    if (options?.skillType && skill?.skillType !== options.skillType) continue;
    if (options?.category && skill?.category !== options.category) continue;
    if (options?.source && skill?.source !== options.source) continue;

    results.push({
      name,
      score,
      skillType: skill?.skillType || 'discipline',
      source: skill?.source || 'axiom',
      category: skill?.category,
      description: skill?.description || '',
      matchingSections: Array.from(matchedSections.get(name) || []),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Serialize a SearchIndex to a plain JSON-safe object for bundling.
 */
export function serializeIndex(index: SearchIndex): SerializedSearchIndex {
  const invertedIndex: Record<string, TermEntry[]> = {};
  for (const [term, entries] of index.invertedIndex) {
    invertedIndex[term] = entries;
  }

  const docLengths: Record<string, number> = {};
  for (const [name, length] of index.docLengths) {
    docLengths[name] = length;
  }

  const sectionTerms: Record<string, Record<string, string[]>> = {};
  for (const [doc, sections] of index.sectionTerms) {
    sectionTerms[doc] = {};
    for (const [heading, terms] of sections) {
      sectionTerms[doc][heading] = Array.from(terms);
    }
  }

  return {
    invertedIndex,
    docLengths,
    avgDocLength: index.avgDocLength,
    docCount: index.docCount,
    sectionTerms,
  };
}

/**
 * Deserialize a bundled SearchIndex back into the runtime format.
 */
export function deserializeIndex(data: SerializedSearchIndex): SearchIndex {
  const invertedIndex = new Map<string, TermEntry[]>();
  for (const [term, entries] of Object.entries(data.invertedIndex)) {
    invertedIndex.set(term, entries);
  }

  const docLengths = new Map<string, number>();
  for (const [name, length] of Object.entries(data.docLengths)) {
    docLengths.set(name, length);
  }

  const sectionTerms = new Map<string, Map<string, Set<string>>>();
  for (const [doc, sections] of Object.entries(data.sectionTerms)) {
    const sectionMap = new Map<string, Set<string>>();
    for (const [heading, terms] of Object.entries(sections)) {
      sectionMap.set(heading, new Set(terms));
    }
    sectionTerms.set(doc, sectionMap);
  }

  return {
    invertedIndex,
    docLengths,
    avgDocLength: data.avgDocLength,
    docCount: data.docCount,
    sectionTerms,
  };
}
