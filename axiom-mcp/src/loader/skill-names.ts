import { SUB_SKILL_SEPARATOR } from './parser.js';

type NameSet = { has(name: string): boolean; keys(): Iterable<string> };

const CROSS_REFERENCE = /^([a-z0-9-]+)\s*\(\s*(skills\/[a-z0-9._-]+?\.md)/;
const NOISE_TOKENS = new Set(['axiom', 'skills', 'skill', 'md', 'audit', 'auditor']);

/**
 * Map the names a model actually uses to a served skill id. Sub-skills are
 * served as `<suite>--<file>`, but harnesses that load the native skills see
 * them as `skills/<file>.md` paths, and skill text cites them as
 * `<suite> (skills/<file>.md)` or by bare basename. A bare basename resolves
 * only when exactly one suite has it.
 */
export function resolveSkillName(name: string, known: NameSet): string | undefined {
  if (known.has(name)) return name;
  const unquote = (text: string) => text.trim().replace(/^[`"']+|[`"']+$/g, '').trim();
  const key = unquote(unquote(name).toLowerCase().replace(/^axiom:/, ''));
  if (known.has(key)) return key;

  const crossReference = key.match(CROSS_REFERENCE);
  const path = crossReference ? `${crossReference[1]}/${crossReference[2]}` : key;
  const segments = path.replace(/\\/g, '/').replace(/\.md$/, '').split('/').filter(Boolean);
  const [suite, parent, base] = [segments.at(-3), segments.at(-2), segments.at(-1)];
  if (!base) return undefined;

  if (base === 'skill' && parent) return known.has(parent) ? parent : undefined;
  if (parent === 'skills' && suite && known.has(suite)) {
    const id = `${suite}${SUB_SKILL_SEPARATOR}${base}`;
    return known.has(id) ? id : undefined;
  }
  if (known.has(base)) return base;

  const matches = [...known.keys()].filter((id) => id.endsWith(`${SUB_SKILL_SEPARATOR}${base}`));
  return matches.length === 1 ? matches[0] : undefined;
}

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token && !NOISE_TOKENS.has(token));
}

function tokenScore(a: string, b: string): number {
  if (a === b) return 2;
  return Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)) ? 1 : 0;
}

/** Candidates sharing the most name tokens with `name`, an exact token outscoring a prefix, shortest first. */
export function suggestNames(name: string, candidates: Iterable<string>, limit: number): string[] {
  const wanted = nameTokens(name);
  const scored = [...candidates]
    .map((candidate) => {
      const tokens = nameTokens(candidate);
      const score = wanted.reduce((sum, w) => sum + Math.max(0, ...tokens.map((t) => tokenScore(w, t))), 0);
      return { candidate, score };
    })
    .filter(({ score }) => score > 0);
  const best = Math.max(0, ...scored.map(({ score }) => score));
  return scored
    .filter(({ score }) => score === best)
    .sort((a, b) => a.candidate.length - b.candidate.length || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
