import matter from 'gray-matter';

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
  inputSchema?: any; // JSON Schema
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
export function outsideFences(lines: string[]): boolean[] {
  // A fence closes only on its own character at no shorter a length, so a
  // ```` block can quote a ``` one (CommonMark). An unclosed fence runs to the end.
  let open: string | null = null;
  return lines.map((line) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (open === null) {
      if (marker === undefined) return true;
      open = marker;
      return false;
    }
    if (marker !== undefined && marker[0] === open[0] && marker.length >= open.length && line.trim() === marker) {
      open = null;
    }
    return false;
  });
}

/** Index of the `#` title line, ignoring `#` comments inside code blocks; -1 if none. */
export function titleIndex(lines: string[], prose: boolean[]): number {
  return lines.findIndex((line, i) => prose[i] && /^#\s+/.test(line));
}

/**
 * The first prose line after a suite file's `#` title: skips headings, bold
 * labels, tables, horizontal rules and code blocks. Shared by parseReferenceFile and the annotation
 * generator so the two descriptions cannot drift.
 */
export function referenceDescription(content: string): string {
  const lines = content.split('\n');
  const prose = outsideFences(lines);
  const title = titleIndex(lines, prose);
  if (title < 0) return '';
  for (let i = title + 1; i < lines.length; i++) {
    if (!prose[i]) continue;
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) continue;  // skip sub-headers, keep looking
    if (trimmed.startsWith('|') || /^([-*_])\1{2,}$/.test(trimmed)) continue;  // skip table rows and horizontal rules
    if (trimmed.startsWith('**') && trimmed.includes('**:')) continue;  // skip bold labels
    if (trimmed.startsWith('**') && !trimmed.endsWith('**')) continue;  // skip bold-prefixed meta lines
    return trimmed;
  }
  return '';
}

/**
 * Parse markdown content into sections based on ## headings.
 * Content before the first ## heading becomes the "_preamble" section.
 */
export function parseSections(content: string): SkillSection[] {
  const lines = content.split('\n');
  const sections: SkillSection[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentStart = 0;

  const prose = outsideFences(lines);

  for (let i = 0; i < lines.length; i++) {
    const match = prose[i] ? lines[i].match(/^(#{1,6})\s+(.+)$/) : null;
    if (match && match[1].length <= 2) {
      // Close previous section
      if (currentHeading !== null || (i > 0 && sections.length === 0)) {
        const heading = currentHeading ?? '_preamble';
        const startLine = currentStart;
        const endLine = i - 1;
        const sectionContent = lines.slice(startLine, i).join('\n');
        sections.push({
          heading,
          level: currentHeading ? currentLevel : 0,
          startLine,
          endLine,
          charCount: sectionContent.length,
        });
      }
      currentHeading = match[2].trim();
      currentLevel = match[1].length;
      currentStart = i;
    } else if (i === 0 && !lines[i].match(/^#{1,2}\s/)) {
      // Content starts before any heading — will become preamble
      currentHeading = null;
      currentStart = 0;
    }
  }

  // Close final section
  const finalHeading = currentHeading ?? (sections.length === 0 ? '_preamble' : null);
  if (finalHeading !== null) {
    const sectionContent = lines.slice(currentStart).join('\n');
    sections.push({
      heading: finalHeading,
      level: currentHeading ? currentLevel : 0,
      startLine: currentStart,
      endLine: lines.length - 1,
      charCount: sectionContent.length,
    });
  }

  return sections;
}

/**
 * Skills whose type can't be inferred from name conventions alone.
 * Maintained here so SKILL.md frontmatter doesn't need a non-standard skill_type field.
 */
const SKILL_TYPE_OVERRIDES: Record<string, SkillType> = {
  'axiom-apple-docs': 'router',
  'axiom-getting-started': 'discipline',
  'axiom-sqlitedata-migration': 'reference',
};

/**
 * Infer skill type from name conventions, with explicit overrides for edge cases.
 * Content is optionally checked for suite routers (SKILL.md files that reference skills/*.md).
 */
export function inferSkillType(name: string, content?: string, isReferenceFile?: boolean): SkillType {
  if (SKILL_TYPE_OVERRIDES[name]) return SKILL_TYPE_OVERRIDES[name];
  if (name === 'axiom-using-axiom') return 'meta';
  if (name.endsWith('-ref')) return 'reference';
  if (name.endsWith('-diag')) return 'diagnostic';
  // Suite routers reference their skills/ directory — but reference files
  // also cross-reference siblings, so skip this check for reference files
  if (!isReferenceFile && content) {
    const lines = content.split('\n');
    const prose = outsideFences(lines);
    if (lines.some((line, i) => prose[i] && /skills\/\S+\.md/.test(line))) return 'router';
  }
  return 'discipline';
}

/**
 * Parse a skill markdown file.
 * MCP annotations (category, tags, related) are merged externally via applyAnnotations().
 */
export function parseSkill(content: string, filename: string): Skill {
  // Options bypass gray-matter's cache, which returns a second parse of broken input without throwing.
  const parsed = matter(content, {});
  const data = parsed.data;
  const name = data.name || extractNameFromFilename(filename);

  // Support both spec-compliant frontmatter and legacy mcp: block (backward-compatible)
  const mcp = data.mcp as SkillMcpAnnotation | undefined;

  return {
    name,
    description: data.description || '',
    content: parsed.content,
    skillType: inferSkillType(name, parsed.content),
    source: 'axiom',
    category: mcp?.category,
    tags: mcp?.tags || [],
    related: mcp?.related || [],
    sections: parseSections(parsed.content),
    mcp,
  };
}

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
export function applyAnnotations(skill: Skill, annotations: SkillAnnotations): Skill {
  const ann = annotations[skill.name];
  if (!ann) return skill;

  return {
    ...skill,
    category: ann.category ?? skill.category,
    tags: ann.tags ?? skill.tags,
    related: ann.related ?? skill.related,
    mcp: ann,
  };
}

/**
 * Parse a command markdown file
 */
export function parseCommand(content: string, filename: string): Command {
  // Options bypass gray-matter's cache, which returns a second parse of broken input without throwing.
  const parsed = matter(content, {});
  const data = parsed.data;

  return {
    name: data.name || extractNameFromFilename(filename),
    description: data.description || '',
    content: parsed.content,
    mcp: data.mcp
  };
}

/**
 * Parse an agent markdown file
 */
export function parseAgent(content: string, filename: string): Agent {
  // Options bypass gray-matter's cache, which returns a second parse of broken input without throwing.
  const parsed = matter(content, {});
  const data = parsed.data;

  return {
    name: data.name || extractNameFromFilename(filename),
    description: data.description || '',
    model: data.model,
    content: parsed.content,
    mcp: data.mcp
  };
}

/**
 * Parse an Apple documentation markdown file (no frontmatter).
 * Used for Xcode-bundled AdditionalDocumentation and Swift diagnostics.
 */
export function parseAppleDoc(
  content: string,
  filename: string,
  docType: 'guide' | 'diagnostic',
): Skill {
  const baseName = filename.replace(/\.md$/, '');

  // Build a normalized skill name from the filename
  const slug = baseName
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const prefix = docType === 'guide' ? 'apple-guide' : 'apple-diag';
  const name = `${prefix}-${slug}`;

  // Title from the first # heading, then the description from the first paragraph after it
  const lines = content.split('\n');
  const prose = outsideFences(lines);
  const titleAt = titleIndex(lines, prose);
  const title = titleAt >= 0 ? lines[titleAt].replace(/^#\s+/, '').trim() : baseName.replace(/-/g, ' ');
  let description = '';
  for (let i = titleAt + 1; titleAt >= 0 && i < lines.length; i++) {
    if (!prose[i]) continue;
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) break;
    description = trimmed;
    break;
  }

  // Infer tags from filename components
  const tags = baseName
    .split(/[-_]/)
    .filter(t => t.length > 2)
    .map(t => t.toLowerCase());

  return {
    name,
    description: description || title,
    content,
    skillType: docType === 'diagnostic' ? 'diagnostic' : 'reference',
    source: 'apple',
    tags,
    related: [],
    sections: parseSections(content),
  };
}

export const SUB_SKILL_SEPARATOR = '--';

/**
 * Parse a frontmatter-free suite reference file into a Skill.
 * Used for files in a skill suite's skills/ subdirectory.
 * Name is formatted as `${parentSuite}--${baseName}` to prevent cross-suite collisions.
 */
export function parseReferenceFile(
  content: string,
  filename: string,
  parentSuite: string,
): Skill {
  const baseName = filename.replace(/\.md$/, '');
  const name = `${parentSuite}${SUB_SKILL_SEPARATOR}${baseName}`;

  const lines = content.split('\n');
  const titleAt = titleIndex(lines, outsideFences(lines));
  const title = titleAt >= 0 ? lines[titleAt].replace(/^#\s+/, '').trim() : baseName.replace(/-/g, ' ');

  const description = referenceDescription(content);

  // Infer tags from filename components
  const tags = baseName
    .split(/[-_]/)
    .filter(t => t.length > 2)
    .map(t => t.toLowerCase());

  return {
    name,
    description: description || title,
    content,
    skillType: inferSkillType(name, content, true),
    source: 'axiom',
    tags,
    related: [],
    sections: parseSections(content),
  };
}

/**
 * Filter a skill's content to only matching sections.
 * Returns full content if no sectionNames provided.
 */
export function filterSkillSections(
  skill: Skill,
  sectionNames?: string[],
): { skill: Skill; content: string; sections: SkillSection[] } {
  if (!sectionNames || sectionNames.length === 0) {
    return { skill, content: skill.content, sections: skill.sections };
  }

  const lines = skill.content.split('\n');
  const prose = outsideFences(lines);
  const contains = (text: string, filter: string) => text.toLowerCase().includes(filter.toLowerCase());
  const subheadings = (section: SkillSection) =>
    lines.slice(section.startLine, section.endLine + 1).flatMap((line, k) => {
      const sub = prose[section.startLine + k] ? line.match(/^#{3,6}\s+(.+)$/) : null;
      return sub ? [sub[1]] : [];
    });

  // Each filter resolves on its own: a section heading first; failing that, a
  // ### (or deeper) subheading, which returns the section containing it, since
  // only # and ## start a section. Fenced lines are code, not subheadings.
  const wanted = new Set<SkillSection>();
  for (const filter of sectionNames) {
    const byHeading = skill.sections.filter(section => contains(section.heading, filter));
    const hits = byHeading.length > 0
      ? byHeading
      : skill.sections.filter(section => subheadings(section).some(sub => contains(sub, filter)));
    for (const section of hits) wanted.add(section);
  }
  const matchedSections = skill.sections.filter(section => wanted.has(section));
  const contentParts = matchedSections.map(section => lines.slice(section.startLine, section.endLine + 1).join('\n'));

  return {
    skill,
    content: contentParts.join('\n\n'),
    sections: matchedSections,
  };
}

/**
 * Extract name from filename (remove extension)
 */
function extractNameFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}

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
export const GENERATED_PREFIX = '<!-- GENERATED from agents/';

export function isGeneratedSubSkill(content: string): boolean {
  return content.startsWith(GENERATED_PREFIX);
}
