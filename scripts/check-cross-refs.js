#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const skillsRoot = path.join(root, '.claude-plugin/plugins/axiom/skills');
const manifestPath = path.join(root, '.claude-plugin/plugins/axiom/claude-code.json');

const NON_SUITE_AXIOM_TOKENS = new Set(['axiom-mcp', 'axiom-marketplace']);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestSuites = new Set(manifest.skills.map(s => s.name));
const filesystemSuites = new Set(
  fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('axiom-'))
    .map(e => e.name)
);
const validSuites = new Set([...manifestSuites, ...filesystemSuites]);
const unmanifested = [...filesystemSuites].filter(s => !manifestSuites.has(s));

const validChildren = new Map();
const childToSuites = new Map();
for (const suite of fs.readdirSync(skillsRoot)) {
  const suiteSkillsDir = path.join(skillsRoot, suite, 'skills');
  if (!fs.existsSync(suiteSkillsDir)) continue;
  const children = new Set();
  for (const f of fs.readdirSync(suiteSkillsDir)) {
    if (!f.endsWith('.md')) continue;
    const basename = f.replace(/\.md$/, '');
    children.add(basename);
    if (!childToSuites.has(basename)) childToSuites.set(basename, []);
    childToSuites.get(basename).push(suite);
  }
  validChildren.set(suite, children);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function suggestSuite(name) {
  let best = null, bestDist = Infinity;
  for (const s of validSuites) {
    const d = levenshtein(name, s);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return bestDist <= 2 ? best : null;
}

function suggestChild(basename) {
  const owners = childToSuites.get(basename);
  if (owners?.length) return `${owners[0]} (skills/${basename}.md)`;
  return null;
}

function suggestForUnknownAxiomToken(token) {
  const suffix = token.replace(/^axiom-/, '');
  const owners = childToSuites.get(suffix);
  if (owners?.length) return `${owners[0]} (skills/${suffix}.md)`;
  return suggestSuite(token);
}

const errors = [];
const warnings = [];

function report(file, lineNum, severity, ref, hint) {
  const rel = path.relative(root, file);
  const msg = hint ? `${ref} (did you mean ${hint}?)` : ref;
  (severity === 'error' ? errors : warnings).push(`${rel}:${lineNum}: ${msg}`);
}

function* walkSkillFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkSkillFiles(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

const SUITE_REF = /(?:[`*_]+)?\baxiom-([a-z0-9-]+)(?:[`*_]+)?(?:\s*\(([^)]*)\)|\/skills\/([a-z0-9-]+)\.md)?/g;
const CHILD_PATH = /\bskills\/([a-z0-9-]+)\.md/g;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

for (const file of walkSkillFiles(skillsRoot)) {
  const rel = path.relative(skillsRoot, file);
  const fileSuite = rel.split(path.sep)[0];
  const raw = fs.readFileSync(file, 'utf8');
  const body = raw.replace(FRONTMATTER, '');
  const lines = body.split('\n');

  const frontmatterLines = raw.length > body.length
    ? raw.slice(0, raw.length - body.length).split('\n').length - 1
    : 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1 + frontmatterLines;

    const structuredRanges = [];
    const bareTokens = [];
    for (const m of line.matchAll(SUITE_REF)) {
      const suite = `axiom-${m[1]}`;
      const parens = m[2];
      const slashChild = m[3];
      const hasParens = parens !== undefined && /skills\//.test(parens);
      const hasSlash = slashChild !== undefined;

      if (hasParens || hasSlash) {
        structuredRanges.push([m.index, m.index + m[0].length]);
        if (!validSuites.has(suite)) {
          report(file, lineNum, 'error', `unknown suite "${suite}"`, suggestSuite(suite));
          continue;
        }
        const children = validChildren.get(suite);
        const childList = hasParens
          ? [...parens.matchAll(CHILD_PATH)].map(cm => cm[1])
          : [slashChild];
        for (const child of childList) {
          if (!children?.has(child)) {
            const owners = childToSuites.get(child);
            const hint = owners?.length ? `${owners[0]} has it` : null;
            report(file, lineNum, 'error', `child "skills/${child}.md" not in ${suite}`, hint);
          }
        }
      } else {
        bareTokens.push({ token: suite, index: m.index });
      }
    }

    for (const m of line.matchAll(CHILD_PATH)) {
      if (structuredRanges.some(([s, e]) => m.index >= s && m.index < e)) continue;
      const child = m[1];
      const suiteChildren = validChildren.get(fileSuite);
      if (!suiteChildren?.has(child)) {
        report(file, lineNum, 'error', `sibling "skills/${child}.md" not in ${fileSuite}`, suggestChild(child));
      }
    }

    for (const { token } of bareTokens) {
      if (validSuites.has(token) || NON_SUITE_AXIOM_TOKENS.has(token)) continue;
      report(file, lineNum, 'warning', `unknown axiom-* token "${token}"`, suggestForUnknownAxiomToken(token));
    }
  }
}

if (warnings.length) {
  console.log(`⚠ ${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
  for (const w of warnings) console.log(`  ${w}`);
}
if (errors.length) {
  console.log(`\n✖ ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.log(`  ${e}`);
  console.log(`\n${errors.length} broken cross-reference${errors.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
if (unmanifested.length) {
  console.log(`ℹ ${unmanifested.length} suite${unmanifested.length === 1 ? '' : 's'} present on disk but not in claude-code.json: ${unmanifested.join(', ')}`);
}
console.log(`✓ ${[...walkSkillFiles(skillsRoot)].length} skill files scanned, ${validSuites.size} suites, all cross-references valid.`);
