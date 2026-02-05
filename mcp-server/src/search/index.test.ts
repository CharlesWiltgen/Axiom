import { describe, it, expect } from 'vitest';
import { tokenize, buildIndex, search, serializeIndex, deserializeIndex } from './index.js';
import type { Skill } from '../loader/parser.js';

function makeSkill(overrides: Partial<Skill> & { name: string }): Skill {
  return {
    description: '',
    content: '',
    skillType: 'discipline',
    source: 'axiom',
    tags: [],
    related: [],
    sections: [],
    ...overrides,
  };
}

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

  it('preserves short tokens that look like suffixed words', () => {
    // "doing" is 5 chars, suffix strip only applies when length > 5
    expect(tokenize('doing')).toEqual(['doing']);
  });

  it('preserves Swift technical terms from suffix stripping', () => {
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
  it('creates an index from skills', () => {
    const skills = new Map<string, Skill>([
      ['test-skill', makeSkill({ name: 'test-skill', description: 'a test skill', content: 'some content here' })],
    ]);

    const index = buildIndex(skills);

    expect(index.docCount).toBe(1);
    expect(index.avgDocLength).toBeGreaterThan(0);
    expect(index.invertedIndex.size).toBeGreaterThan(0);
  });

  it('excludes router skills from the index', () => {
    const skills = new Map<string, Skill>([
      ['my-router', makeSkill({ name: 'my-router', skillType: 'router', description: 'routes things' })],
      ['real-skill', makeSkill({ name: 'real-skill', description: 'does real work' })],
    ]);

    const index = buildIndex(skills);

    expect(index.docCount).toBe(1);
  });

  it('handles empty skills map', () => {
    const index = buildIndex(new Map());
    expect(index.docCount).toBe(0);
    expect(index.avgDocLength).toBe(0);
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
});

describe('serializeIndex / deserializeIndex roundtrip', () => {
  it('preserves index data through serialization', () => {
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
    expect(restored.avgDocLength).toBe(original.avgDocLength);
    expect(restored.invertedIndex.size).toBe(original.invertedIndex.size);
    expect(restored.docLengths.size).toBe(original.docLengths.size);
    expect(restored.sectionTerms.size).toBe(original.sectionTerms.size);
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
