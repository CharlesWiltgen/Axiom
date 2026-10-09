import { describe, it, expect } from 'vitest';
import { serverInstructions } from './instructions.js';
import { ATTRIBUTION, versionGroundTruth } from './version-context.js';

describe('serverInstructions', () => {
  const toolchain = { path: '/Applications/Xcode-beta.app', xcodeVersion: '27.2', iosSdkVersion: '27.2' };

  it('carries the catalog workflow, the attribution sentence and the shared version ground truth', () => {
    const text = serverInstructions(new Date(2026, 9, 8), toolchain);
    const missing = [
      'axiom_get_catalog',
      ATTRIBUTION,
      versionGroundTruth('Thursday, 2026-10-08', toolchain),
    ].filter((part) => !text.includes(part));
    expect(missing).toEqual([]);
  });
});
