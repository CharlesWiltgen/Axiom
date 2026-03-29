import { describe, it, expect } from 'vitest';
import { classifyChange } from './dev-loader.js';

describe('classifyChange', () => {
  it('classifies skill paths', () => {
    expect(classifyChange('skills/axiom-swift-concurrency/SKILL.md')).toBe('skills');
    expect(classifyChange('skills/new-skill/SKILL.md')).toBe('skills');
  });

  it('classifies command paths', () => {
    expect(classifyChange('commands/fix-build.md')).toBe('commands');
    expect(classifyChange('commands/audit.md')).toBe('commands');
  });

  it('classifies agent paths', () => {
    expect(classifyChange('agents/build-fixer.md')).toBe('agents');
    expect(classifyChange('agents/accessibility-auditor.md')).toBe('agents');
  });

  it('returns null for unrelated paths', () => {
    expect(classifyChange('claude-code.json')).toBeNull();
    expect(classifyChange('hooks/session-start.sh')).toBeNull();
    expect(classifyChange('README.md')).toBeNull();
  });
});
