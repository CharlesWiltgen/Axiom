/**
 * Build/validation checks shared by the MCP test suite, root pre-deploy and the Cursor
 * build tests. A leaf module (node built-ins only), so root scripts can import it as
 * `.ts` under bare-node type-stripping while vitest imports it as `./binary-coverage.js`.
 *
 * 1. `scanReferencedToolBinaries` — which Go tool binaries the MCP tools resolve under
 *    `bin/`, compared against `MCP_TOOL_BINARIES` (bundle.test.ts and pre-deploy 12h) to
 *    catch a tool needing a binary the bundler won't ship, or a listed binary no tool uses.
 *    It matches a binary NAME written as a string literal at the resolve site:
 *      resolveToolPath('<name>', …)  — shared-helper form (xcprof/xclog/xcsym)
 *      join(..., 'bin', '<name>')   — segment-pair form (raw resolve, pre-helper)
 *      '<...>/bin/<name>'           — single-literal path form (a leading '/' or
 *                                     start-of-literal is required, so node_modules/.bin
 *                                     paths do NOT match)
 *    A name held in a variable is intentionally NOT detected: pass the binary name as a
 *    literal at the resolve site so coverage stays statically verifiable.
 * 2. `invocationSection` / `referenceMismatches` — whether each wrapped CLI's reference
 *    skill tells MCP and Pi readers the truth about the MCP tools (bundle.test.ts runs it
 *    against live `listTools()`; scripts/cursor/skills.test.ts reuses the section reader).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// First char allows A-Z too: a capitalized binary name would otherwise be
// silently dropped (the dangerous direction — a tool resolves a binary the
// bundler never ships). Names are lowercase by convention; this is a guard.
const RESOLVE_CALL = /resolveToolPath\(\s*['"`]([A-Za-z][\w-]*)['"`]/g;
const SEGMENT_PAIR = /['"`]bin['"`]\s*,\s*['"`]([A-Za-z][\w-]*)['"`]/g;
const PATH_LITERAL = /['"`](?:[^'"`]*\/)?bin\/([A-Za-z][\w-]*)['"`]/g;

/** Names like `xcprof` that a tool module resolves under `bin/`. */
export function scanReferencedToolBinaries(toolsDir: string): Set<string> {
  const referenced = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'binaries.ts') {
      continue;
    }
    const src = readFileSync(join(toolsDir, file), 'utf-8');
    for (const m of src.matchAll(RESOLVE_CALL)) referenced.add(m[1]);
    for (const m of src.matchAll(SEGMENT_PAIR)) referenced.add(m[1]);
    for (const m of src.matchAll(PATH_LITERAL)) referenced.add(m[1]);
  }
  return referenced;
}

/** A wrapped tool as `listTools()` reports it; only the fields the reference check reads. */
export interface ReferencedMcpTool {
  name: string;
  inputSchema: { properties?: Record<string, unknown>; required?: string[] };
}

/** The `## Invocation` section of a CLI reference, without its heading. */
export function invocationSection(reference: string): string {
  return reference.match(/^## Invocation\n([\s\S]*?)(?=^## )/m)?.[1] ?? '';
}

/**
 * Disagreements between a CLI reference's Invocation section and the MCP tools wrapping
 * that CLI, read from `listTools()` so a renamed, added or newly required param fails here.
 *
 * The table is the only place a flag may map to a param: one row per registered tool,
 * `| \`<binary> <subcommand> …\` | \`tool\` | inputs | flags |`. Inputs name every required
 * param; flags is `—` or a comma list of `` `--flag`→`param` `` items whose param is the
 * flag in camelCase unless a parenthetical explains the difference. Between them the row
 * must name every param the tool has and nothing it lacks, because a model maps flags onto
 * the tool it is calling and the server drops unknown params silently.
 *
 * Prose is checked per clause (split at `.`, `;`, `!`, `?`). A clause's subcommands are the
 * subcommands or tool names it backticks, else those of the latest clause in its paragraph
 * that named any. Each backticked param must belong to every subject (`no \`param\`` denies
 * it instead); with no subject, a param only some tools have is reported as unattributed,
 * and a clause that names a subcommand may not name a lowerCamel word that is neither a
 * param nor a param's enum value.
 * A Pi bullet must check `command -v`.
 */
export function referenceMismatches(binary: string, reference: string, tools: ReferencedMcpTool[]): string[] {
  const section = invocationSection(reference);
  const prefix = `axiom_${binary}_`;
  const params = (tool: ReferencedMcpTool) => Object.keys(tool.inputSchema.properties ?? {});
  const subcommand = (tool: ReferencedMcpTool) => tool.name.slice(prefix.length).replace(/_/g, '-');
  const subject = (word: string) =>
    tools.find((tool) => tool.name === word || subcommand(tool) === word);
  const camel = (flag: string) => flag.slice(2).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const IDENTIFIER = /`([A-Za-z][A-Za-z0-9_]*)`/g;
  const ROW = /^\| `([^`]+)` \| `([^`]+)` \| ([^|]*?) \| ([^|]*?) \|$/gm;
  const MAPPING = /^`(--[a-z][a-z0-9-]*)`→`([A-Za-z][A-Za-z0-9_]*)`(?: \((?![^)]*(?:→|--))[^)]*\))?$/;
  const problems: string[] = [];

  const seen = new Set<string>();
  for (const [, cli, toolName, inputs, flags] of section.matchAll(ROW)) {
    const tool = tools.find((candidate) => candidate.name === toolName);
    if (!tool) {
      problems.push(`table row for unregistered ${toolName}`);
      continue;
    }
    if (seen.has(toolName)) {
      problems.push(`duplicate table row for ${toolName}`);
      continue;
    }
    seen.add(toolName);
    const command = `${binary} ${subcommand(tool)}`;
    if (cli !== command && !cli.startsWith(`${command} `)) {
      problems.push(`${toolName} row's CLI cell \`${cli}\` should start with \`${command}\``);
    }
    const inputNames = [...inputs.matchAll(IDENTIFIER)].map((m) => m[1]);
    const named = [...inputNames];
    for (const item of flags.trim() === '—' ? [] : flags.split(/,\s+(?=`)/)) {
      const mapping = item.trim().match(MAPPING);
      if (!mapping) {
        problems.push(`${toolName} row has an unreadable mapping: ${item.trim()}`);
      } else if (!params(tool).includes(mapping[2])) {
        problems.push(`\`${mapping[1]}\`→\`${mapping[2]}\`: ${toolName} has no \`${mapping[2]}\``);
      } else if (mapping[2] !== camel(mapping[1]) && !item.includes('(')) {
        problems.push(`\`${mapping[1]}\`→\`${mapping[2]}\`: expected \`${camel(mapping[1])}\`; put the reason for a different name in parentheses`);
      } else {
        named.push(mapping[2]);
      }
    }
    for (const input of inputNames.filter((name) => !params(tool).includes(name))) {
      problems.push(`${toolName} row lists \`${input}\`, which the tool lacks`);
    }
    const required = tool.inputSchema.required ?? [];
    for (const param of required.filter((name) => !inputNames.includes(name))) {
      problems.push(`${toolName} row omits required \`${param}\` from Required input`);
    }
    for (const param of params(tool).filter((name) => !named.includes(name) && !required.includes(name))) {
      problems.push(`${toolName} row omits \`${param}\``);
    }
  }
  for (const tool of tools.filter((candidate) => !seen.has(candidate.name))) {
    problems.push(`no table row for ${tool.name}`);
  }

  const prose = section.replace(ROW, '');
  const HINT = '; write one subcommand per clause and `no` directly before each denied param';
  for (const [stray] of prose.matchAll(/`--[a-z][a-z0-9-]*`\s*(?:→|->)/g)) {
    problems.push(`flag mapping outside the table: ${stray}`);
  }
  const WORD = /`([A-Za-z][A-Za-z0-9_-]*)`/g;
  const enumValues = new Set(
    tools.flatMap((tool) =>
      Object.values(tool.inputSchema.properties ?? {}).flatMap((schema) => {
        const values = (schema as { enum?: unknown }).enum;
        return Array.isArray(values) ? values.map(String) : [];
      }),
    ),
  );
  for (const paragraph of prose.split(/\n\s*\n/)) {
    let subjects: ReferencedMcpTool[] = [];
    for (const clause of paragraph.split(/(?<!\b(?:e\.g|i\.e)\.)(?<=[.;!?])\s+/)) {
      const words = [...clause.matchAll(WORD)];
      const named = [...new Set(words.flatMap((m) => subject(m[1]) ?? []))];
      if (named.length > 0) subjects = named;
      for (const match of words) {
        const word = match[1];
        if (subject(word)) continue;
        if (!tools.some((tool) => params(tool).includes(word))) {
          if (named.length > 0 && word !== binary && !enumValues.has(word) && /^[a-z][A-Za-z0-9]*$/.test(word)) {
            problems.push(`prose names \`${word}\`, which no ${prefix}* tool has; unbacktick it if it is not a param`);
          }
          continue;
        }
        if (subjects.length === 0) {
          if (!tools.every((tool) => params(tool).includes(word))) {
            problems.push(`prose names \`${word}\` without the subcommand it belongs to`);
          }
          continue;
        }
        const denied = clause.slice(0, match.index).endsWith('no ');
        for (const tool of subjects) {
          if (denied && params(tool).includes(word)) {
            problems.push(`prose says \`${subcommand(tool)}\` has no \`${word}\`, but it does${HINT}`);
          } else if (!denied && !params(tool).includes(word)) {
            problems.push(`prose gives \`${subcommand(tool)}\` the param \`${word}\`, which it lacks${HINT}`);
          }
        }
      }
    }
  }

  if (!new RegExp(`^- \\*\\*Pi\\*\\* —.*\`command -v ${binary}\``, 'm').test(section)) {
    problems.push(`no Pi bullet with a \`command -v ${binary}\` check`);
  }
  return [...new Set(problems)];
}
