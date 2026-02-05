import { describe, it, expect } from 'vitest';
import { tokenize, buildIndex, addSkills, search, serializeIndex, deserializeIndex } from './index.js';
import type { Skill } from '../loader/parser.js';
import { makeSkill } from '../test-helpers.js';

describe('tokenize', () => {
  it('splits on non-alphanumeric characters and removes stopwords', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
  });

  it('removes single-character tokens', () => {
    expect(tokenize('a b cd ef')).toEqual(['cd', 'ef']);
  });

  it('removes common stopwords', () => {
    expect(tokenize('the quick and slow')).toEqual(['quick', 'slow']);
  });

  it('strips common English suffixes', () => {
    expect(tokenize('running navigation darkness')).toEqual(['runn', 'naviga', 'dark']);
  });

  it('does not strip -able/-ible suffixes (Swift protocol names)', () => {
    expect(tokenize('Sendable Observable Codable flexible')).toEqual([
      'sendable', 'observable', 'codable', 'flexible',
    ]);
  });

  it('preserves short tokens that look like suffixed words', () => {
    // "doing" is 5 chars, suffix strip only applies when length > 5
    expect(tokenize('doing')).toEqual(['doing']);
  });

  it('preserves Swift protocol names ending in -able', () => {
    expect(tokenize('Sendable')).toEqual(['sendable']);
    expect(tokenize('Observable')).toEqual(['observable']);
    expect(tokenize('Codable')).toEqual(['codable']);
    expect(tokenize('Identifiable')).toEqual(['identifiable']);
    expect(tokenize('Hashable')).toEqual(['hashable']);
  });

  it('splits camelCase into separate tokens', () => {
    expect(tokenize('NavigationStack')).toEqual(['naviga', 'stack']);
  });

  it('splits acronym + camelCase (URLSession)', () => {
    expect(tokenize('URLSession')).toEqual(['url', 'session']);
  });

  it('handles mixed camelCase and separators', () => {
    expect(tokenize('axiom-swiftConcurrency test')).toEqual(['axiom', 'swift', 'concurrency', 'test']);
  });

  it('preserves @ prefix tokens', () => {
    expect(tokenize('@MainActor')).toEqual(['@main', 'actor']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for only stopwords', () => {
    expect(tokenize('the and is')).toEqual([]);
  });
});

describe('buildIndex', () => {
  it('creates a searchable index from skills', () => {
    const skills = new Map<string, Skill>([
      ['test-skill', makeSkill({ name: 'test-skill', description: 'a test skill', content: 'some content here' })],
    ]);

    const index = buildIndex(skills);

    expect(index.docCount).toBe(1);
    const results = search(index, 'test skill', {}, skills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('test-skill');
  });

  it('excludes router skills from the index', () => {
    const skills = new Map<string, Skill>([
      ['my-router', makeSkill({ name: 'my-router', skillType: 'router', description: 'routes things uniquely' })],
      ['real-skill', makeSkill({ name: 'real-skill', description: 'does real work' })],
    ]);

    const index = buildIndex(skills);

    expect(index.docCount).toBe(1);
    const results = search(index, 'routes uniquely', {}, skills);
    expect(results.length).toBe(0);
  });

  it('handles empty skills map', () => {
    const index = buildIndex(new Map());
    expect(index.docCount).toBe(0);
    const results = search(index, 'anything', {});
    expect(results).toEqual([]);
  });
});

describe('search', () => {
  const skills = new Map<string, Skill>([
    ['axiom-swift-concurrency', makeSkill({
      name: 'axiom-swift-concurrency',
      description: 'Swift concurrency patterns and async await',
      content: '# Concurrency\nLearn about actors and Sendable types',
      tags: ['concurrency', 'async', 'swift'],
      sections: [{ heading: 'Concurrency', level: 1, startLine: 0, endLine: 1, charCount: 50 }],
    })],
    ['axiom-swiftui-nav', makeSkill({
      name: 'axiom-swiftui-nav',
      description: 'SwiftUI navigation patterns',
      content: '# Navigation\nNavigationStack and NavigationSplitView',
      tags: ['swiftui', 'navigation'],
      sections: [{ heading: 'Navigation', level: 1, startLine: 0, endLine: 1, charCount: 50 }],
    })],
  ]);

  const index = buildIndex(skills);

  it('returns results ranked by relevance', () => {
    const results = search(index, 'concurrency async', {}, skills);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('axiom-swift-concurrency');
  });

  it('respects limit option', () => {
    const results = search(index, 'swift', { limit: 1 }, skills);
    expect(results.length).toBe(1);
  });

  it('filters by skillType', () => {
    const results = search(index, 'swift', { skillType: 'reference' }, skills);
    expect(results.length).toBe(0);
  });

  it('filters by source', () => {
    const results = search(index, 'swift', { source: 'apple' }, skills);
    expect(results.length).toBe(0);
  });

  it('filters by category', () => {
    const catSkills = new Map<string, Skill>([
      ['skill-a', makeSkill({ name: 'skill-a', description: 'swift patterns', category: 'concurrency' })],
      ['skill-b', makeSkill({ name: 'skill-b', description: 'swift layouts', category: 'ui-design' })],
    ]);
    const catIndex = buildIndex(catSkills);

    const all = search(catIndex, 'swift', {}, catSkills);
    expect(all.length).toBe(2);

    const filtered = search(catIndex, 'swift', { category: 'concurrency' }, catSkills);
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('skill-a');
  });

  it('returns empty for no-match query', () => {
    const results = search(index, 'xyznonexistent', {}, skills);
    expect(results).toEqual([]);
  });

  it('returns empty for empty query', () => {
    const results = search(index, '', {}, skills);
    expect(results).toEqual([]);
  });

  it('includes matching section names in results', () => {
    const results = search(index, 'concurrency', {}, skills);
    expect(results[0].matchingSections).toContain('Concurrency');
  });

  it('matches despite typos via fuzzy search', () => {
    // "Navagation" (typo: extra 'a') has no exact-matching token in the index.
    // After tokenize+process: "navaga" (suffix strip -tion).
    // Indexed term is "naviga". Distance("navaga","naviga") = 1, fuzzy 0.2 * 6 = 1.2 → allows 1.
    // Without fuzzy, this returns 0 results.
    const results = search(index, 'Navagation', {}, skills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('axiom-swiftui-nav');
  });

  it('matches prefix queries', () => {
    // "Navig" tokenizes to "navig" — prefix should match "naviga" in the index
    const results = search(index, 'Navig', {}, skills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('axiom-swiftui-nav');
  });

  it('still returns exact matches with high relevance', () => {
    // Exact queries should not lose precision from fuzzy/prefix
    const results = search(index, 'NavigationStack', {}, skills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('axiom-swiftui-nav');
  });

  it('uses AND for multi-word queries', () => {
    // "swift concurrency" should strongly prefer the skill with both terms
    const results = search(index, 'swift concurrency', {}, skills);
    expect(results[0].name).toBe('axiom-swift-concurrency');
  });
});

describe('addSkills', () => {
  it('incrementally adds new skills to an existing index', () => {
    const originalSkills = new Map<string, Skill>([
      ['skill-a', makeSkill({ name: 'skill-a', description: 'concurrency patterns', content: 'async await actors' })],
    ]);
    const index = buildIndex(originalSkills);
    expect(index.docCount).toBe(1);

    const newSkills = new Map<string, Skill>([
      ['skill-b', makeSkill({ name: 'skill-b', description: 'navigation patterns', content: 'NavigationStack deep linking' })],
    ]);
    addSkills(index, newSkills);

    expect(index.docCount).toBe(2);
    const results = search(index, 'navigation', {}, new Map([...originalSkills, ...newSkills]));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('skill-b');
  });

  it('preserves existing index entries after adding', () => {
    const originalSkills = new Map<string, Skill>([
      ['skill-a', makeSkill({ name: 'skill-a', description: 'concurrency patterns', content: 'async await actors' })],
    ]);
    const index = buildIndex(originalSkills);

    const newSkills = new Map<string, Skill>([
      ['skill-b', makeSkill({ name: 'skill-b', description: 'navigation', content: 'NavigationStack' })],
    ]);
    addSkills(index, newSkills);

    const results = search(index, 'concurrency async', {}, new Map([...originalSkills, ...newSkills]));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('skill-a');
  });

  it('skips router skills', () => {
    const index = buildIndex(new Map());
    const newSkills = new Map<string, Skill>([
      ['my-router', makeSkill({ name: 'my-router', skillType: 'router', description: 'routes things' })],
      ['real-skill', makeSkill({ name: 'real-skill', description: 'does real work' })],
    ]);
    addSkills(index, newSkills);

    expect(index.docCount).toBe(1);
  });

  it('silently skips skills already in the index', () => {
    const skills = new Map<string, Skill>([
      ['skill-a', makeSkill({ name: 'skill-a', description: 'original description', content: 'original content' })],
    ]);
    const index = buildIndex(skills);
    expect(index.docCount).toBe(1);

    const duplicateSkills = new Map<string, Skill>([
      ['skill-a', makeSkill({ name: 'skill-a', description: 'updated description', content: 'updated content' })],
      ['skill-b', makeSkill({ name: 'skill-b', description: 'brand new skill', content: 'new content' })],
    ]);
    addSkills(index, duplicateSkills);

    expect(index.docCount).toBe(2);
  });

  it('builds section terms for new skills', () => {
    const index = buildIndex(new Map());
    const newSkills = new Map<string, Skill>([
      ['skill-a', makeSkill({
        name: 'skill-a',
        description: 'test skill',
        content: '# Overview\nSome overview content\n# Details\nDetailed content here',
        sections: [
          { heading: 'Overview', level: 1, startLine: 0, endLine: 1, charCount: 25 },
          { heading: 'Details', level: 1, startLine: 2, endLine: 3, charCount: 25 },
        ],
      })],
    ]);
    addSkills(index, newSkills);

    const results = search(index, 'overview', {}, newSkills);
    expect(results.length).toBe(1);
    expect(results[0].matchingSections).toContain('Overview');
  });
});

describe('serializeIndex / deserializeIndex roundtrip', () => {
  it('preserves search behavior through serialization', () => {
    const skills = new Map<string, Skill>([
      ['test-skill', makeSkill({
        name: 'test-skill',
        description: 'test description',
        content: '# Heading\nBody content here',
        sections: [{ heading: 'Heading', level: 1, startLine: 0, endLine: 1, charCount: 25 }],
      })],
    ]);

    const original = buildIndex(skills);
    const serialized = serializeIndex(original);
    const restored = deserializeIndex(serialized);

    expect(restored.docCount).toBe(original.docCount);

    const originalResults = search(original, 'test description', {}, skills);
    const restoredResults = search(restored, 'test description', {}, skills);
    expect(restoredResults.map(r => r.name)).toEqual(originalResults.map(r => r.name));
    expect(restoredResults.length).toBeGreaterThan(0);
  });

  it('preserves stored fields (skillType, source, category, description) through roundtrip', () => {
    const skills = new Map<string, Skill>([
      ['test-skill', makeSkill({
        name: 'test-skill',
        description: 'specific description text',
        skillType: 'reference',
        source: 'apple',
        category: 'concurrency',
        content: '# Test\nSome body',
        sections: [{ heading: 'Test', level: 1, startLine: 0, endLine: 1, charCount: 15 }],
      })],
    ]);

    const index = buildIndex(skills);
    const restored = deserializeIndex(serializeIndex(index));

    // Search without skills map — result metadata must come from stored fields alone
    const results = search(restored!, 'specific description');
    expect(results.length).toBe(1);
    expect(results[0]).toMatchObject({
      name: 'test-skill',
      skillType: 'reference',
      source: 'apple',
      category: 'concurrency',
      description: 'specific description text',
    });
  });

  it('returns null for incompatible serialized data', () => {
    const oldFormat = { invertedIndex: {}, docLengths: {}, avgDocLength: 0, docCount: 0, sectionTerms: {} };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(deserializeIndex(oldFormat as any)).toBeNull();
  });

  it('produces identical search results after roundtrip', () => {
    const skills = new Map<string, Skill>([
      ['test-skill', makeSkill({
        name: 'test-skill',
        description: 'SwiftUI performance optimization',
        content: '# Performance\nOptimize your views',
        tags: ['swiftui', 'performance'],
        sections: [{ heading: 'Performance', level: 1, startLine: 0, endLine: 1, charCount: 30 }],
      })],
    ]);

    const original = buildIndex(skills);
    const restored = deserializeIndex(serializeIndex(original));

    const originalResults = search(original, 'performance', {}, skills);
    const restoredResults = search(restored, 'performance', {}, skills);

    expect(restoredResults).toEqual(originalResults);
  });
});
