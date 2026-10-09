import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectXcode } from './xcode-docs.js';

const DOCS = 'Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation';

describe('detectXcode', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function fakeXcode(name: string): string {
    const root = mkdtempSync(join(tmpdir(), 'axiom-xcode-docs-'));
    roots.push(root);
    const app = join(root, name);
    mkdirSync(join(app, DOCS), { recursive: true });
    mkdirSync(join(app, 'Contents', 'Developer'), { recursive: true });
    writeFileSync(join(app, 'Contents', 'Info.plist'), '');
    return app;
  }

  it('uses an explicit override path', async () => {
    const app = fakeXcode('Override.app');
    expect((await detectXcode(app, {}))?.xcodePath).toBe(app);
  });

  it.skipIf(process.platform !== 'darwin')(
    'reads the docs from the Xcode the user has switched to when no override is given',
    async () => {
      // An app-form DEVELOPER_DIR, as xcrun accepts it; without an override the
      // loader used to read /Applications/Xcode.app regardless.
      const app = fakeXcode('Xcode Beta.app');
      const env = { ...process.env, AXIOM_XCODE_PATH: undefined, DEVELOPER_DIR: app };
      expect((await detectXcode(undefined, env))?.xcodePath).toBe(app);
    },
  );
});
