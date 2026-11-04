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
export declare const CATEGORY_SLUGS: Record<string, string>;
export declare function inferCategoryFromName(name: string): string;
export declare function extractTags(description: string, skillName: string, _categorySlug: string, _skillType: string, content?: string): string[];
export declare function findRelatedSkills(skillName: string, content: string, allNames: Set<string>): string[];
