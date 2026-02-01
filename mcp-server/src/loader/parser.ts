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

/**
 * Parsed skill metadata
 */
export interface Skill {
  name: string;
  description: string;
  content: string;
  skillType: SkillType;
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
 * Infer skill type from frontmatter or name conventions
 */
function inferSkillType(data: Record<string, any>, name: string): SkillType {
  if (data.skill_type) {
    return data.skill_type as SkillType;
  }
  if (name.match(/^axiom-ios-/)) return 'router';
  if (name === 'axiom-using-axiom' || name === 'axiom-getting-started') return 'meta';
  if (name.endsWith('-ref')) return 'reference';
  if (name.endsWith('-diag')) return 'diagnostic';
  return 'discipline';
}

/**
 * Parse a skill markdown file
 */
export function parseSkill(content: string, filename: string): Skill {
  const parsed = matter(content);
  const data = parsed.data;
  const name = data.name || extractNameFromFilename(filename);

  return {
    name,
    description: data.description || '',
    content: parsed.content,
    skillType: inferSkillType(data, name),
    category: data.mcp?.category,
    tags: data.mcp?.tags || [],
    related: data.mcp?.related || [],
    sections: parseSections(parsed.content),
    mcp: data.mcp,
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
 * Extract name from filename (remove extension)
 */
function extractNameFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}
