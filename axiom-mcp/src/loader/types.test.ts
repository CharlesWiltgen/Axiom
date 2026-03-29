import { describe, it, expect } from 'vitest';
import type { BundleV2 } from './types.js';
import type { CatalogResult } from '../catalog/index.js';
import type { SerializedSearchIndex } from '../search/index.js';

describe('BundleV2', () => {
  it('accepts a minimal bundle with only required fields', () => {
    const bundle: BundleV2 = {
      version: '2.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      skills: {},
      commands: {},
      agents: {},
    };

    expect(bundle.version).toBe('2.0.0');
    expect(bundle.catalog).toBeUndefined();
    expect(bundle.searchIndex).toBeUndefined();
  });

  it('accepts a full bundle with optional fields populated', () => {
    const bundle: BundleV2 = {
      version: '2.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      skills: {
        'test-skill': {
          name: 'test-skill',
          description: 'A test',
          content: 'Content',
          skillType: 'discipline',
          source: 'axiom',
          tags: [],
          related: [],
          sections: [],
        },
      },
      commands: {},
      agents: {},
      catalog: { categories: {}, agents: [], totalSkills: 1, totalAgents: 0 } satisfies CatalogResult,
      searchIndex: { engine: {}, sectionTerms: {}, docCount: 1 } as unknown as SerializedSearchIndex,
    };

    expect(bundle.catalog).toBeDefined();
    expect(bundle.searchIndex).toBeDefined();
  });
});
