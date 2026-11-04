/**
 * MCP-specific annotations for skills
 */
export interface SkillMcpAnnotation {
    category?: string;
    tags?: string[];
    related?: string[];
}
/**
 * MCP-specific annotations for commands (prompts)
 */
export interface CommandMcpAnnotation {
    category?: string;
    tags?: string[];
    related?: string[];
    arguments?: {
        name: string;
        description: string;
        required: boolean;
        default?: string;
    }[];
}
/**
 * MCP-specific annotations for agents (tools)
 */
export interface AgentMcpAnnotation {
    category?: string;
    tags?: string[];
    related?: string[];
    inputSchema?: any;
    annotations?: {
        readOnly?: boolean;
        destructive?: boolean;
    };
}
/**
 * A section within a skill's markdown content
 */
export interface SkillSection {
    heading: string;
    level: number;
    startLine: number;
    endLine: number;
    charCount: number;
}
export type SkillType = 'discipline' | 'reference' | 'diagnostic' | 'router' | 'meta';
export type SkillSource = 'axiom' | 'apple';
/**
 * Parsed skill metadata
 */
export interface Skill {
    name: string;
    description: string;
    content: string;
    skillType: SkillType;
    source: SkillSource;
    category?: string;
    tags: string[];
    related: string[];
    sections: SkillSection[];
    mcp?: SkillMcpAnnotation;
}
/**
 * Parsed command metadata
 */
export interface Command {
    name: string;
    description: string;
    content: string;
    mcp?: CommandMcpAnnotation;
}
/**
 * Parsed agent metadata
 */
export interface Agent {
    name: string;
    description: string;
    model?: string;
    content: string;
    mcp?: AgentMcpAnnotation;
}
/**
 * Marks each line that is ordinary markdown, as opposed to a fence line or a
 * line inside a fenced code block. A `#` comment in a bash block is not a
 * heading, and a fence is not prose.
 */
export declare function outsideFences(lines: string[]): boolean[];
/** Index of the `#` title line, ignoring `#` comments inside code blocks; -1 if none. */
export declare function titleIndex(lines: string[], prose: boolean[]): number;
/**
 * The first prose line after a suite file's `#` title: skips headings, bold
 * labels, tables, horizontal rules and code blocks. Shared by parseReferenceFile and the annotation
 * generator so the two descriptions cannot drift.
 */
export declare function referenceDescription(content: string): string;
/**
 * Parse markdown content into sections based on ## headings.
 * Content before the first ## heading becomes the "_preamble" section.
 */
export declare function parseSections(content: string): SkillSection[];
/**
 * Parse a skill markdown file.
 * MCP annotations (category, tags, related) are merged externally via applyAnnotations().
 */
export declare function parseSkill(content: string, filename: string): Skill;
/**
 * MCP annotations for skills that need explicit search/catalog metadata.
 * Loaded from skill-annotations.json to keep SKILL.md files spec-compliant.
 */
export interface SkillAnnotations {
    [skillName: string]: SkillMcpAnnotation;
}
/**
 * Apply external MCP annotations to a parsed skill.
 * Annotations from the file override any existing values.
 */
export declare function applyAnnotations(skill: Skill, annotations: SkillAnnotations): Skill;
/**
 * Parse a command markdown file
 */
export declare function parseCommand(content: string, filename: string): Command;
/**
 * Parse an agent markdown file
 */
export declare function parseAgent(content: string, filename: string): Agent;
/**
 * Parse an Apple documentation markdown file (no frontmatter).
 * Used for Xcode-bundled AdditionalDocumentation and Swift diagnostics.
 */
export declare function parseAppleDoc(content: string, filename: string, docType: 'guide' | 'diagnostic'): Skill;
export declare const SUB_SKILL_SEPARATOR = "--";
/**
 * Parse a frontmatter-free suite reference file into a Skill.
 * Used for files in a skill suite's skills/ subdirectory.
 * Name is formatted as `${parentSuite}--${baseName}` to prevent cross-suite collisions.
 */
export declare function parseReferenceFile(content: string, filename: string, parentSuite: string): Skill;
/**
 * Filter a skill's content to only matching sections.
 * Returns full content if no sectionNames provided.
 */
export declare function filterSkillSections(skill: Skill, sectionNames?: string[]): {
    skill: Skill;
    content: string;
    sections: SkillSection[];
};
/**
 * Inlined auditor copies are generated for harnesses that cannot invoke an agent.
 * MCP ships every auditor as a first-class agent, so every consumer that walks
 * a suite's skills directory must skip them identically — the bundler drops them, the
 * annotation generator must not annotate them, and dev mode must not serve them,
 * or dev and prod disagree on the skill set, the catalog counts and the search
 * corpus.
 *
 * This lives in the parser rather than in scripts/bundle.ts because the runtime
 * loader needs it too: a long-running server must not import a build CLI just to
 * reach one predicate. The literal is duplicated from scripts/inline-auditors.ts
 * (the root repo is unreachable from the published package) and a test asserts
 * the two stay equal.
 */
export declare const GENERATED_PREFIX = "<!-- GENERATED from agents/";
export declare function isGeneratedSubSkill(content: string): boolean;
