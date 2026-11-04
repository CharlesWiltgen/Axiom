import MiniSearch, { type AsPlainObject } from 'minisearch';
import { Skill, SkillType, SkillSource } from '../loader/parser.js';
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
 * Tokenize text into normalized terms.
 * Composes tokenizeField + processTermField for backward compatibility.
 * Simple suffix stripping instead of Porter stemmer to preserve
 * technical terms like NavigationStack, Sendable.
 * Avoids -able/-ible stripping since Swift protocols (Sendable,
 * Observable, Codable, Identifiable) collide with those suffixes.
 */
export declare function tokenize(text: string): string[];
/**
 * Build a search index from a collection of skills.
 */
export declare function buildIndex(skills: Map<string, Skill>): SearchIndex;
/**
 * Incrementally add new skills to an existing search index.
 * Mutates the index in place — avoids rebuilding the entire MiniSearch index.
 */
export declare function addSkills(index: SearchIndex, skills: Map<string, Skill>): void;
/**
 * Search the index using MiniSearch BM25+ scoring with field weights.
 */
export declare function search(index: SearchIndex, query: string, options?: {
    limit?: number;
    skillType?: string;
    category?: string;
    source?: string;
}, skills?: Map<string, Skill>): SearchResult[];
/**
 * Serialize a SearchIndex to a plain JSON-safe object for bundling.
 */
export declare function serializeIndex(index: SearchIndex): SerializedSearchIndex;
/**
 * Deserialize a bundled SearchIndex back into the runtime format.
 * Returns null if the data is an incompatible format (e.g. pre-MiniSearch bundle).
 */
export declare function deserializeIndex(data: SerializedSearchIndex): SearchIndex | null;
export {};
