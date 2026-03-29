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
 * Parse markdown content into sections based on ## headings.
 * Content before the first ## heading becomes the "_preamble" section.
 */
export function parseSections(content: string): SkillSection[] {
  const lines = content.split('\n');
  const sections: SkillSection[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
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
  'axiom-haptics': 'reference',
  'axiom-localization': 'reference',
  'axiom-privacy-ux': 'reference',
  'axiom-sqlitedata-migration': 'reference',
};

/**
 * Infer skill type from name conventions, with explicit overrides for edge cases
 */
function inferSkillType(name: string): SkillType {
  if (SKILL_TYPE_OVERRIDES[name]) return SKILL_TYPE_OVERRIDES[name];
  if (name.match(/^axiom-ios-/)) return 'router';
  if (name === 'axiom-using-axiom') return 'meta';
  if (name.endsWith('-ref')) return 'reference';
  if (name.endsWith('-diag')) return 'diagnostic';
  return 'discipline';
}

/**
 * Parse a skill markdown file.
 * MCP annotations (category, tags, related) are merged externally via applyAnnotations().
 */
export function parseSkill(content: string, filename: string): Skill {
  const parsed = matter(content);
  const data = parsed.data;
  const name = data.name || extractNameFromFilename(filename);

  // Support both spec-compliant frontmatter and legacy mcp: block (backward-compatible)
  const mcp = data.mcp as SkillMcpAnnotation | undefined;

  return {
    name,
    description: data.description || '',
    content: parsed.content,
    skillType: inferSkillType(name),
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
  const parsed = matter(content);
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
  const parsed = matter(content);
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

  // Extract title from first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : baseName.replace(/-/g, ' ');

  // Extract description from first paragraph after the title
  const lines = content.split('\n');
  let description = '';
  let pastTitle = false;
  for (const line of lines) {
    if (!pastTitle) {
      if (line.match(/^#\s+/)) {
        pastTitle = true;
      }
      continue;
    }
    const trimmed = line.trim();
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
  const matchedSections: SkillSection[] = [];
  const contentParts: string[] = [];

  for (const section of skill.sections) {
    const matches = sectionNames.some(filter =>
      section.heading.toLowerCase().includes(filter.toLowerCase()),
    );
    if (matches) {
      matchedSections.push(section);
      contentParts.push(lines.slice(section.startLine, section.endLine + 1).join('\n'));
    }
  }

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
