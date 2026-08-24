/**
 * Tracks Axiom's ALWAYS-ON FOOTPRINT per harness — everything Axiom puts in the
 * model's context before the user has typed anything.
 *
 * Why this exists separately from scripts/skill-listing.ts: the skill listing is
 * only about 10% of what Axiom costs on Claude Code. Agent descriptions are ~7x
 * larger, and the session-start hook injects a whole SKILL.md. Gating the
 * listing alone left the dominant cost unmeasured.
 *
 * Why it matters beyond Claude Code: Axiom targets harnesses running
 * non-Anthropic models, some with far smaller context windows than the 1M
 * Claude Code assumes. Claude Code's listing budget does not govern those — the
 * total below does. Read the per-harness totals as "what a small-context model
 * pays to have Axiom installed".
 *
 * Measured 2026-08-23 (chars, ~3 chars/token):
 *   claude-code  54,678  (~18,200 tok) — agents are 39,080 of it
 *   cursor       12,961  (~4,300 tok)  — same agents, first-sentence only
 *   codex        10,908  (~3,600 tok)  — 69 skills, no separate agent listing
 *   mcp           1,594  (~500 tok)    — 4 tools; skills fetched on demand
 *
 * The claude-code/cursor gap is the same content at 4x the price: build-cursor
 * truncates each agent description to its first sentence. Nothing forces Claude
 * Code to carry the full <example> dialogues.
 */

import fs from "node:fs";
import path from "node:path";

/** Claude Code reports its listing budget in chars at roughly this ratio. */
export const CHARS_PER_TOKEN = 3;

/**
 * Regression ratchets, set just above the 2026-08-23 measurements. These only
 * ever move DOWN. Raising one to make a build pass re-opens exactly the growth
 * this module exists to catch — reduce the footprint instead.
 */
export const FOOTPRINT_CEILINGS: Record<string, number> = {
  "claude-code": 56_000,
  cursor: 14_000,
  codex: 12_000,
  mcp: 3_000,
};

export type FootprintPart = { label: string; chars: number; count: number };
export type HarnessFootprint = {
  harness: string;
  parts: FootprintPart[];
  total: number;
};

function frontmatter(file: string): string {
  const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, "utf8"));
  return m ? m[1] : "";
}

/**
 * Frontmatter `description`, handling BOTH single-line values and `|`/`>` block
 * scalars. Agents use block scalars; a single-line-only reader scores them at
 * one character and makes the largest cost on Claude Code look like nothing.
 */
function description(block: string): string {
  const lines = block.split("\n");
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i === -1) return "";
  const inline = lines[i].replace(/^description:[ \t]*/, "").trim();
  if (inline && !/^[|>][-+]?$/.test(inline)) return inline;
  const body: string[] = [];
  for (const line of lines.slice(i + 1)) {
    if (/^[A-Za-z][\w-]*:/.test(line)) break;
    body.push(line.trim());
  }
  return body.join("\n").trim();
}

function sumDescriptions(files: string[]): FootprintPart {
  return {
    label: "",
    count: files.length,
    chars: files.reduce((n, f) => n + description(frontmatter(f)).length, 0),
  };
}

function glob(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const nested = path.join(full, "SKILL.md");
        return fs.existsSync(nested) ? [nested] : [];
      }
      return pattern.test(e.name) ? [full] : [];
    });
}

function part(label: string, files: string[]): FootprintPart {
  return { ...sumDescriptions(files), label };
}

/**
 * MCP declares its tools in TypeScript rather than frontmatter, so this counts
 * the `description:` string literals in the tool handler. Approximate (schema
 * scaffolding is excluded), but it tracks the right direction: MCP exposes 4
 * tools and fetches skills on demand, which is why it is two orders of
 * magnitude cheaper than the Claude Code listing.
 */
function mcpToolChars(root: string): FootprintPart {
  const file = path.join(root, "axiom-mcp/src/tools/handler.ts");
  if (!fs.existsSync(file)) return { label: "tool definitions", chars: 0, count: 0 };
  const src = fs.readFileSync(file, "utf8");
  const literals = src.match(/description:\s*(['"`])([\s\S]*?)\1/g) ?? [];
  const tools = (src.match(/^\s*name: '(axiom_[a-z_]+)'/gm) ?? []).length;
  return {
    label: "tool definitions",
    count: tools,
    chars: literals.reduce((n, l) => n + l.length, 0),
  };
}

export function measureFootprints(root: string): HarnessFootprint[] {
  const cc = path.join(root, ".claude-plugin/plugins/axiom");
  const toolsSkill = path.join(cc, "skills/axiom-tools/SKILL.md");

  const withTotal = (harness: string, parts: FootprintPart[]): HarnessFootprint => ({
    harness,
    parts,
    total: parts.reduce((n, p) => n + p.chars, 0),
  });

  return [
    withTotal("claude-code", [
      part("skill listing", glob(path.join(cc, "skills"), /^$/)),
      part("agent listing", glob(path.join(cc, "agents"), /\.md$/)),
      part("command listing", glob(path.join(cc, "commands"), /\.md$/)),
      {
        label: "session-start hook injection",
        count: 1,
        // The hook injects axiom-tools/SKILL.md in full, not just its description.
        chars: fs.existsSync(toolsSkill) ? fs.readFileSync(toolsSkill, "utf8").length : 0,
      },
    ]),
    withTotal("cursor", [
      part("skill listing", glob(path.join(root, "axiom-cursor/skills"), /^$/)),
      part("agent listing", glob(path.join(root, "axiom-cursor/agents"), /\.md$/)),
      part("command listing", glob(path.join(root, "axiom-cursor/commands"), /\.md$/)),
    ]),
    withTotal("codex", [
      part("skill listing", glob(path.join(root, "axiom-codex/skills"), /\.md$/)),
    ]),
    withTotal("mcp", [mcpToolChars(root)]),
  ];
}

export function reportFootprints(root: string): string {
  const out: string[] = ["Axiom always-on footprint (context cost before the user speaks)", ""];
  for (const f of measureFootprints(root)) {
    const ceiling = FOOTPRINT_CEILINGS[f.harness] ?? Infinity;
    const flag = f.total > ceiling ? `  OVER CEILING ${ceiling}` : "";
    out.push(
      `${f.harness.padEnd(12)} ${String(f.total).padStart(7)} chars  ` +
        `~${Math.round(f.total / CHARS_PER_TOKEN).toLocaleString()} tokens${flag}`,
    );
    for (const p of f.parts) {
      if (!p.chars) continue;
      const pct = Math.round((p.chars / f.total) * 100);
      out.push(`  ${String(p.chars).padStart(7)}  ${String(pct).padStart(3)}%  ${p.label} (${p.count})`);
    }
    out.push("");
  }
  return out.join("\n");
}

if (import.meta.filename === process.argv[1]) {
  console.log(reportFootprints(path.join(path.dirname(import.meta.filename), "..")));
}
