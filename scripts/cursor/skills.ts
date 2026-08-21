import { isGeneratedSubSkill } from "../inline-auditors.ts";
import { compareCursorPaths } from "./compare.ts";
import {
  assertNoUnsupportedClaudeTokens,
  CURSOR_MCP_TOOL_BOUNDARY,
  CURSOR_XCUI_TOOL_BOUNDARY,
  rewriteCursorSkillReferences,
} from "./references.ts";
import { CURSOR_ALLOWED_SKILL_FIELDS } from "./source.ts";
import type { SourceSkill, VirtualFile } from "./types.ts";

function yamlScalar(value: unknown): string {
  const text = String(value);
  return /^[a-zA-Z0-9_.-]+$/.test(text) ? text : JSON.stringify(text);
}

function assertKnownSkillFields(frontmatter: Record<string, unknown>): void {
  for (const field of Object.keys(frontmatter)) {
    if (!CURSOR_ALLOWED_SKILL_FIELDS.has(field)) {
      throw new Error(`unknown skill frontmatter field: ${field}`);
    }
  }
}

const CURSOR_EMITTED_SKILL_FIELDS = ["name", "description"] as const;

function prependBody(content: string, sections: readonly string[]): string {
  if (sections.length === 0) return content;
  const preamble = `${sections.join("\n\n")}\n\n`;
  const frontmatter = content.match(/^---\n[\s\S]*?\n---\n\n?/);
  return frontmatter
    ? `${frontmatter[0]}${preamble}${content.slice(frontmatter[0].length)}`
    : `${preamble}${content}`;
}

function transformFile(file: VirtualFile): VirtualFile {
  const withoutGeneratedMirrorRouting = file.content.replace(
    /<!-- AXIOM_AUDITOR_INLINE_BEGIN[\s\S]*?AXIOM_AUDITOR_INLINE_END -->/g,
    "## Cursor Subagent Routing\n\nDelegate to the appropriate Cursor subagent when this router calls for a specialized auditor.",
  );
  const translated = rewriteCursorSkillReferences(withoutGeneratedMirrorRouting);
  const content = prependBody(translated, [
    ...(/\b(?:xclog|xcsym|xcprof)\b/.test(translated) ? [CURSOR_MCP_TOOL_BOUNDARY] : []),
    ...(/\bxcui\b/.test(translated) ? [CURSOR_XCUI_TOOL_BOUNDARY] : []),
  ]);
  assertNoUnsupportedClaudeTokens(content);
  return { ...file, content, mode: 0o644 };
}

export function transformSkill(skill: SourceSkill): VirtualFile[] {
  assertKnownSkillFields(skill.frontmatter);
  const router: VirtualFile = transformFile({
    path: `${skill.relativeDir}/SKILL.md`,
    content: `---\n${CURSOR_EMITTED_SKILL_FIELDS
      .map((key) => `${key}: ${yamlScalar(skill.frontmatter[key])}`)
      .join("\n")}\n---\n\n${skill.body}`,
    mode: 0o644,
  });
  const resources = skill.resources
    .filter((resource) => !isGeneratedSubSkill(resource.content))
    .map(transformFile)
    .sort((left, right) => compareCursorPaths(left.path, right.path));
  return [router, ...resources];
}
