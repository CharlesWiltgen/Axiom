import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  AnnotationsFileError,
  SkillSourceError,
  extractTags,
  loadSkillSources,
  readExistingAnnotations,
  writeAnnotationsAtomically,
} from './generate-annotations.js';

describe('extractTags', () => {
  // Heading terms become search tags, so a bash comment in a fenced block must
  // not contribute one (Axiom-w4d0).
  it('takes heading tags from real headings only, not from # lines in code fences', () => {
    const content = '# Guide\n\n## UserDefaultsStorage\n\n```bash\n# CheckBuildLog for warnings\n```\n';
    const tags = extractTags('', 'axiom-data--guide', 'data', 'reference', content);
    expect(['userdefaultsstorage', 'checkbuildlog'].map((t) => tags.includes(t))).toEqual([true, false]);
  });
});

describe('readExistingAnnotations', () => {
  // Axiom-dfd: a parse failure used to read as "no file", so build:bundle (and
  // prepublishOnly) silently replaced every curated entry with heuristic output.
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'axiom-annotations-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('returns no entries and no content when the file does not exist', async () => {
    expect(await readExistingAnnotations(join(dir, 'skill-annotations.json'))).toEqual({ entries: {}, content: null });
  });

  it('returns the curated entries and the raw content from a valid file', async () => {
    const path = join(dir, 'skill-annotations.json');
    const entries = { 'axiom-data--swiftdata': { category: 'data', tags: ['model'], related: ['axiom-data'] } };
    const content = JSON.stringify(entries);
    await writeFile(path, content, 'utf-8');
    expect(await readExistingAnnotations(path)).toEqual({ entries, content });
  });

  it('accepts a file that starts with a byte-order mark', async () => {
    const path = join(dir, 'skill-annotations.json');
    await writeFile(path, '\uFEFF{"axiom-data": {"category": "data"}}', 'utf-8');
    expect((await readExistingAnnotations(path)).entries).toEqual({ 'axiom-data': { category: 'data' } });
  });

  it.each([
    ['a number', 5],
    ['null', null],
    ['a string tags', { tags: 'model' }],
    ['a string related', { related: 'axiom-data' }],
    ['a numeric category', { category: 5 }],
    ['a tags array with a number', { tags: ['model', 3] }],
  ])('throws AnnotationsFileError naming the key for an entry that is %s', async (_label, value) => {
    const path = join(dir, 'skill-annotations.json');
    await writeFile(path, JSON.stringify({ 'axiom-data--swiftdata': value }), 'utf-8');
    await expect(readExistingAnnotations(path)).rejects.toMatchObject({
      name: 'AnnotationsFileError',
      message: expect.stringContaining('axiom-data--swiftdata'),
    });
  });

  it.each([
    ['truncated JSON', '{"axiom-data--swiftdata": {"category": "da'],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['an empty file', ''],
  ])('throws AnnotationsFileError naming the path for %s', async (_label, content) => {
    const path = join(dir, 'skill-annotations.json');
    await writeFile(path, content, 'utf-8');
    await expect(readExistingAnnotations(path)).rejects.toMatchObject({
      name: 'AnnotationsFileError',
      path,
    });
  });

  it('throws AnnotationsFileError for a read failure other than a missing file', async () => {
    const path = join(dir, 'skill-annotations.json');
    await mkdir(path);
    await expect(readExistingAnnotations(path)).rejects.toBeInstanceOf(AnnotationsFileError);
  });
});

describe('writeAnnotationsAtomically', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'axiom-annotations-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('rejects, leaves the target untouched, and removes its temporary file when the rename fails', async () => {
    const path = join(dir, 'skill-annotations.json');
    await mkdir(path);
    await writeFile(join(path, 'keep'), 'x', 'utf-8');
    await expect(writeAnnotationsAtomically(path, '{}\n')).rejects.toThrow();
    expect([await readdir(dir), await readdir(path)]).toEqual([['skill-annotations.json'], ['keep']]);
  });

  it('replaces the file and leaves no temporary file behind', async () => {
    const path = join(dir, 'skill-annotations.json');
    await writeFile(path, '{"old": {}}\n', 'utf-8');
    await writeAnnotationsAtomically(path, '{"new": {}}\n');
    expect([await readFile(path, 'utf-8'), await readdir(dir)]).toEqual([
      '{"new": {}}\n',
      ['skill-annotations.json'],
    ]);
  });
});

describe('loadSkillSources', () => {
  // A source that fails to parse used to be skipped, so the prune step deleted its
  // curated annotations and exited 0 (one YAML typo in a router lost 25 entries).
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'axiom-skill-sources-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const suite = async (name: string, frontmatter: string, refs: Record<string, string> = {}) => {
    await mkdir(join(dir, name, 'skills'), { recursive: true });
    await writeFile(join(dir, name, 'SKILL.md'), `---\n${frontmatter}\n---\n\n# ${name}\n`, 'utf-8');
    for (const [file, body] of Object.entries(refs)) await writeFile(join(dir, name, 'skills', file), body, 'utf-8');
  };

  it('loads suites, their sub-skills, and skips directories without a SKILL.md', async () => {
    await suite('axiom-a', 'name: axiom-a\ndescription: Use when A.', { 'guide.md': '# Guide\n\nA guide.\n' });
    await mkdir(join(dir, 'not-a-skill'));
    expect([...(await loadSkillSources(dir)).keys()].sort()).toEqual(['axiom-a', 'axiom-a--guide']);
  });

  it('classifies suites the way the MCP server does: a SKILL.md that routes to skills/*.md is a router', async () => {
    // Axiom-ss4m: a name rule (^axiom-ios-) outlived the router naming, so 26 of 27
    // routers were read as annotation targets.
    await suite('axiom-a', 'name: axiom-a\ndescription: Use when A.', { 'guide.md': '# Guide\n\nA guide.\n' });
    await writeFile(join(dir, 'axiom-a', 'SKILL.md'), '---\nname: axiom-a\ndescription: Use when A.\n---\n\nSee `skills/guide.md`.\n', 'utf-8');
    const types = Object.fromEntries([...(await loadSkillSources(dir))].map(([name, info]) => [name, info.skillType]));
    expect(types).toEqual({ 'axiom-a': 'router', 'axiom-a--guide': 'discipline' });
  });

  it('throws SkillSourceError naming the file when a SKILL.md frontmatter does not parse', async () => {
    await suite('axiom-a', 'name: axiom-a\ndescription: "unterminated Use when A.');
    await expect(loadSkillSources(dir)).rejects.toMatchObject({
      name: 'SkillSourceError',
      path: join(dir, 'axiom-a', 'SKILL.md'),
    });
  });

  it('skips dot-prefixed sub-skill files: editor lock links and macOS AppleDouble copies', async () => {
    await suite('axiom-a', 'name: axiom-a\ndescription: Use when A.', { 'guide.md': '# Guide\n\nA guide.\n' });
    await writeFile(join(dir, 'axiom-a', 'skills', '._guide.md'), Buffer.from([0, 5, 22, 7, 0, 2]));
    await symlink('user@host.123:1700000000', join(dir, 'axiom-a', 'skills', '.#guide.md'));
    expect([...(await loadSkillSources(dir)).keys()].sort()).toEqual(['axiom-a', 'axiom-a--guide']);
  });

  it('throws SkillSourceError for an unreadable sub-skill instead of skipping it', async () => {
    await suite('axiom-a', 'name: axiom-a\ndescription: Use when A.');
    await mkdir(join(dir, 'axiom-a', 'skills', 'broken.md'));
    await expect(loadSkillSources(dir)).rejects.toBeInstanceOf(SkillSourceError);
  });
});
