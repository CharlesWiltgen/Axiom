/**
 * Owns the artifacts derived from SKILL.md frontmatter.
 *
 * Two committed files are generated from the router frontmatter rather than
 * hand-written:
 *
 *   - the `skills[]` array in `claude-code.json`, and
 *   - `commands/ask.md`, built from that array plus the agents on disk.
 *
 * Both used to live inline in `set-version.js`, which meant the only way to
 * regenerate a *content* derivation was to run a *version* script — and that
 * script refuses to run without a version argument. On 2026-09-17 a one-line
 * description edit that way sat stale through a green local gate and four red CI
 * runs, and the failing check's own message pointed at the version script.
 *
 * Keeping the generation here gives it a name that says what it does, and lets
 * both callers share one definition instead of diverging copies:
 * `scripts/build-manifest.js` for a content-only regeneration, and
 * `scripts/set-version.js` for a release (which must also stamp versions).
 */

import fs from "node:fs";
import path from "node:path";
import { manifestSkillsFromDisk } from "./skill-listing.ts";

export interface ListingSkill {
  name: string;
  description: string;
}

export interface ManifestUpdate {
  path: string;
  content: string;
  label: string;
}

// Category mapping patterns for skills
// Ordered from most specific to least specific to prevent greedy matching
const CATEGORY_PATTERNS: Record<string, string[]> = {
  Utility: ["getting-started"],
  Testing: ["testing", "ui-testing", "simulator"],
  "Persistence & Storage": [
    "swiftdata",
    "grdb",
    "sqlite",
    "cloudkit",
    "icloud",
    "storage",
    "realm",
    "core-data",
    "database",
    "cloud-sync",
  ],
  Integration: [
    "networking",
    "app-intent",
    "storekit",
    "in-app",
    "foundation-model",
    "extension",
    "widget",
    "avfoundation",
    "now-playing",
    "app-shortcut",
    "core-spotlight",
    "app-discovera",
    "network-framework",
  ],
  "Build & Environment": ["build", "xcode"],
  "Code Quality": ["concurrency", "codable"],
  "UI & Design": [
    "swiftui",
    "hig",
    "liquid-glass",
    "layout",
    "nav",
    "gesture",
    "textkit",
    "typography",
    "animation",
    "auto-layout",
    "accessibility",
  ],
  Debugging: ["debugging", "profiling", "memory", "objc-block"],
};

/** Categorize a skill based on its name and description. */
function categorizeSkill(skillName: string, description: string): string {
  const lowerName = skillName.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // First pass: match by NAME only (more reliable)
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerName.includes(pattern)) {
        return category;
      }
    }
  }

  // Second pass: match by description (fallback)
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerDesc.includes(pattern)) {
        return category;
      }
    }
  }

  // Default to Debugging for diagnostic skills
  if (skillName.endsWith("-diag")) {
    return "Debugging";
  }

  // Default category for unmatched skills
  return "Integration";
}

/** Group skills by category. */
function categorizeSkills(skills: ListingSkill[]): Record<string, ListingSkill[]> {
  const categories: Record<string, ListingSkill[]> = {};

  for (const skill of skills) {
    const category = categorizeSkill(skill.name, skill.description);

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(skill);
  }

  // Sort skills within each category by name
  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return categories;
}

/** Generate skills section markdown. */
function generateSkillsSection(categories: Record<string, ListingSkill[]>): string {
  let markdown = "## Skills Reference\n\n";

  // Define category order (matching our docs structure)
  const categoryOrder = [
    "Utility",
    "Build & Environment",
    "UI & Design",
    "Code Quality",
    "Debugging",
    "Persistence & Storage",
    "Integration",
    "Testing",
  ];

  for (const category of categoryOrder) {
    const skills = categories[category];
    if (!skills || skills.length === 0) continue;

    markdown += `### ${category}\n\n`;

    for (const skill of skills) {
      // Truncate description to first sentence or 120 chars
      let desc = skill.description;
      const firstSentence = desc.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        desc = firstSentence[0];
      } else if (desc.length > 120) {
        desc = desc.substring(0, 120) + "...";
      }

      markdown += `- **${skill.name}** — ${desc}\n`;
    }

    markdown += "\n";
  }

  return markdown;
}

/** Generate agents section markdown. */
function generateAgentsSection(agents: ListingSkill[]): string {
  let markdown = "## Agents Reference\n\n";
  markdown +=
    'When user asks to "audit", "review", "scan", or "check" code, launch the appropriate agent:\n\n';

  // Sort agents by name
  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  for (const agent of sortedAgents) {
    // Extract key phrase from description (first clause before dash or comma)
    let desc = agent.description;
    const match = desc.match(/^[^—,]+/);
    if (match) {
      desc = match[0].trim();
      // Remove "Use this agent when" prefix if present
      desc = desc.replace(/^Use this agent when (the user mentions )?/i, "");
      desc = desc.replace(/^Automatically (runs|scans)/i, "Scans for");
    }

    markdown += `- **${agent.name}** — ${desc}\n`;
  }

  markdown += "\n";

  return markdown;
}

// Read agents from disk — name + description from each agent's frontmatter.
//
// Agents are deliberately NOT listed in claude-code.json (see
// .claude/rules/skill-descriptions.md: only router skills go in the
// manifest, to stay under the description budget). Reading
// `claudeCode.agents` therefore always yielded [], so /axiom:ask shipped
// claiming "0 autonomous agents" with an empty Agents Reference — the
// natural-language entry point could not route to any of them.
export function readAgentsFromDisk(agentsDir: string): ListingSkill[] {
  if (!fs.existsSync(agentsDir)) return [];
  return fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(agentsDir, f), "utf8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/);
      const name = f.replace(/\.md$/, "");
      if (!fm) return { name, description: "" };
      // description is a `|` block scalar in every agent; take its first
      // non-empty line, which is the trigger sentence.
      const lines = fm[1].split("\n");
      let description = "";
      for (let i = 0; i < lines.length; i++) {
        if (!/^description:\s*[|>][-+]?\s*$/.test(lines[i])) continue;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^[a-zA-Z][\w-]*:/.test(lines[j])) break;
          const text = lines[j].trim();
          if (text) {
            description = text;
            break;
          }
        }
        break;
      }
      return { name, description };
    });
}

/** Generate the complete ask.md from the template plus the manifest and agents. */
export function generateAskMd(claudeCode: { skills?: ListingSkill[] }, agentsDir: string): string {
  const skills = claudeCode.skills || [];
  const agents = readAgentsFromDisk(agentsDir);

  // Group skills by category
  const categories = categorizeSkills(skills);

  // Generate sections
  const skillsSection = generateSkillsSection(categories);
  const agentsSection = generateAgentsSection(agents);

  // Read template and replace placeholders
  const templatePath = path.join(import.meta.dirname, "templates/ask.md.template");
  const template = fs.readFileSync(templatePath, "utf8");

  return template
    .replace("{{skillCount}}", String(skills.length))
    .replace("{{agentCount}}", String(agents.length))
    .replace("{{skillsSection}}", skillsSection)
    .replace("{{agentsSection}}", agentsSection);
}

/**
 * Regenerate both frontmatter-derived artifacts.
 *
 * Mutates `claudeCode.skills` in place (preserving the committed ordering) and
 * returns the write set, so callers can fold it into their own atomic-write pass
 * — `set-version.js` has one, and `build-manifest.js` writes them directly.
 *
 * Version is left untouched: stamping belongs to the caller.
 */
export function manifestUpdates(
  claudeCode: { skills?: ListingSkill[] },
  pluginDir: string,
): ManifestUpdate[] {
  claudeCode.skills = manifestSkillsFromDisk(
    pluginDir,
    (claudeCode.skills ?? []).map((s) => s.name),
  );

  return [
    {
      path: path.join(pluginDir, "claude-code.json"),
      content: JSON.stringify(claudeCode, null, 2) + "\n",
      label: ".claude-plugin/plugins/axiom/claude-code.json",
    },
    {
      path: path.join(pluginDir, "commands/ask.md"),
      content: generateAskMd(claudeCode, path.join(pluginDir, "agents")),
      label: ".claude-plugin/plugins/axiom/commands/ask.md",
    },
  ];
}
