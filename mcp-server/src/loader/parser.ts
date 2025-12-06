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
 * Parsed skill metadata
 */
export interface Skill {
  name: string;
  description: string;
  content: string;
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
 * Parse a skill markdown file
 */
export function parseSkill(content: string, filename: string): Skill {
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
