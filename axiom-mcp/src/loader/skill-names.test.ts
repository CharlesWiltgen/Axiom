import { describe, it, expect } from 'vitest';
import { asksForAudit, resolveSkillName, suggestNames } from './skill-names.js';

const KNOWN = new Set([
  'axiom-concurrency',
  'axiom-concurrency--swift-concurrency',
  'axiom-concurrency--swift-concurrency-ref',
  'axiom-data',
  'axiom-data--sqlitedata',
  'axiom-data--cloud-sync',
  'apple-guide-swift-concurrency-updates',
]);

describe('resolveSkillName', () => {
  it.each([
    ['exact router name', 'axiom-concurrency', 'axiom-concurrency'],
    ['exact sub-skill id', 'axiom-data--sqlitedata', 'axiom-data--sqlitedata'],
    ['bare sub-skill basename', 'swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['router-relative path', 'skills/swift-concurrency.md', 'axiom-concurrency--swift-concurrency'],
    ['suite path', 'axiom-data/skills/cloud-sync.md', 'axiom-data--cloud-sync'],
    ['installed absolute path', '/opt/plugins/cache/axiom-marketplace/axiom/27.7.2/skills/axiom-data/skills/sqlitedata.md', 'axiom-data--sqlitedata'],
    ['router SKILL.md path', 'skills/axiom-data/SKILL.md', 'axiom-data'],
    ['skill-text cross-reference', 'axiom-data (skills/cloud-sync.md)', 'axiom-data--cloud-sync'],
    ['mixed case and padding', '  Swift-Concurrency.md ', 'axiom-concurrency--swift-concurrency'],
    ['basename with .md', 'sqlitedata.md', 'axiom-data--sqlitedata'],
    ['backticked path', '`skills/sqlitedata.md`', 'axiom-data--sqlitedata'],
    ['quoted path', '"skills/sqlitedata.md"', 'axiom-data--sqlitedata'],
    ['plugin-namespaced router', 'axiom:axiom-data', 'axiom-data'],
    ['padding inside quotes', '" axiom-data "', 'axiom-data'],
    ['backticked name after the plugin namespace', 'axiom:`axiom-data`', 'axiom-data'],
    ['Windows path', 'skills\\axiom-data\\skills\\cloud-sync.md', 'axiom-data--cloud-sync'],
    ['cross-reference with trailing text', 'axiom-data (skills/cloud-sync.md Part 2)', 'axiom-data--cloud-sync'],
    ['cross-reference listing two files', 'axiom-data (skills/sqlitedata.md, skills/cloud-sync.md)', 'axiom-data--sqlitedata'],
    ['a path under an unknown suite, by basename', 'swiftui/skills/sqlitedata.md', 'axiom-data--sqlitedata'],
    ['suite:file', 'axiom-concurrency:swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['suite::file', 'axiom-concurrency::swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['suite.file', 'axiom-concurrency.swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['a spaced separator', 'axiom-concurrency -- swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['the plugin namespace before suite:file', 'axiom:axiom-data:sqlitedata', 'axiom-data--sqlitedata'],
    ['a router file name', 'axiom-data.md', 'axiom-data'],
    ['a trailing slash', 'skills/sqlitedata.md/', 'axiom-data--sqlitedata'],
    ['a path with a section anchor', 'skills/sqlitedata.md#Migrations', 'axiom-data--sqlitedata'],
    ['a cross-reference with a section anchor', 'axiom-data (skills/cloud-sync.md#conflicts)', 'axiom-data--cloud-sync'],
    ['suite:SKILL.md', 'axiom-data:SKILL.md', 'axiom-data'],
    ['a doubled plugin-namespace colon', 'axiom::axiom-data', 'axiom-data'],
    ['a trailing slash after a backticked name', '`axiom-data`/', 'axiom-data'],
  ])('resolves %s', (_label, input, expected) => {
    expect(resolveSkillName(input, KNOWN)).toBe(expected);
  });

  it.each([
    ['an unknown name', 'database-migration'],
    ['a suite path naming the wrong suite', 'axiom-data/skills/swift-concurrency.md'],
    ['a cross-reference naming the wrong suite', 'axiom-concurrency (skills/sqlitedata.md)'],
    ['suite:file naming the wrong suite', 'axiom-data:swift-concurrency'],
    ['an empty string', '   '],
  ])('returns undefined for %s', (_label, input) => {
    expect(resolveSkillName(input, KNOWN)).toBeUndefined();
  });

  it('prefers an exact top-level name over a sub-skill with that basename', () => {
    expect(resolveSkillName('axiom-data', new Set(['axiom-data', 'axiom-x--axiom-data']))).toBe('axiom-data');
  });

  it('returns undefined when a bare basename exists in two suites', () => {
    const known = new Set(['axiom-a--shared', 'axiom-b--shared']);
    expect(resolveSkillName('shared', known)).toBeUndefined();
  });
});

describe('suggestNames', () => {
  it('keeps only the best-scoring candidates', () => {
    expect(suggestNames('concurrency-ref', KNOWN, 5)).toEqual(['axiom-concurrency--swift-concurrency-ref']);
  });

  it('orders tied candidates shortest first and honors the limit', () => {
    expect(suggestNames('concurrency', KNOWN, 3)).toEqual([
      'axiom-concurrency',
      'axiom-concurrency--swift-concurrency',
      'apple-guide-swift-concurrency-updates',
    ]);
  });

  it('ranks an exact token above a prefix match', () => {
    const known = ['axiom-swift', 'axiom-swift--tvos', 'axiom-data--swiftdata'];
    expect(suggestNames('axiom-audit-swiftdata', known, 5)).toEqual(['axiom-data--swiftdata']);
  });

  it('ignores the audit token, so audit skills are not suggested for every auditor name', () => {
    expect(suggestNames('axiom-audit-resize', ['axiom-accessibility--ux-flow-audit', 'axiom-uikit--resize'], 5)).toEqual(['axiom-uikit--resize']);
  });

  it('maps a Codex auditor skill name to its agent', () => {
    const agents = ['concurrency-auditor', 'memory-auditor', 'build-fixer'];
    expect(suggestNames('axiom-audit-concurrency', agents, 3)).toEqual(['concurrency-auditor']);
  });

  it.each([
    ['android', ['axiom-design--color-and-contrast']],
    ['refactoring', ['axiom-swiftui--26-ref']],
    ['payload', ['axiom-payments--apple-pay']],
  ])('does not treat a three-letter token as a prefix of %s', (name, known) => {
    expect(suggestNames(name, known, 5)).toEqual([]);
  });

  it('returns nothing when no token is shared', () => {
    expect(suggestNames('zzz-qqq', KNOWN, 5)).toEqual([]);
  });
});

describe('asksForAudit', () => {
  it.each([
    ['axiom-audit-concurrency', true],
    ['concurrency-auditor', true],
    ['Audit memory', true],
    ['auditory-feedback', false],
    ['axiom-concurrency', false],
  ])('%s -> %s', (name, expected) => {
    expect(asksForAudit(name)).toBe(expected);
  });
});
