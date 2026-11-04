import { Skill, Agent } from '../loader/parser.js';
/**
 * Map annotation category slugs to human-readable catalog labels.
 * This is the single source of truth for slug → label mapping.
 */
export declare const SLUG_TO_LABEL: Record<string, string>;
interface CatalogCategory {
    label: string;
    skills: {
        name: string;
        description: string;
        skillType: string;
        source: string;
    }[];
}
export interface CatalogResult {
    categories: Record<string, CatalogCategory>;
    agents: {
        name: string;
        description: string;
    }[];
    totalSkills: number;
    totalAgents: number;
}
/**
 * Build a structured catalog from skills and agents.
 * Router skills are excluded from the catalog output.
 */
export declare function buildCatalog(skills: Map<string, Skill>, agents: Map<string, Agent>, filterCategory?: string): CatalogResult;
export {};
