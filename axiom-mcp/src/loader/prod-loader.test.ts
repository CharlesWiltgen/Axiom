import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProdLoader } from './prod-loader.js';
import { ResourcesHandler } from '../resources/handler.js';
import { Logger, type Config } from '../config.js';
import type { BundleV2 } from './types.js';
import type { Skill } from './parser.js';

const config: Config = { mode: 'production', enableAppleDocs: false, logLevel: 'error' };

function skill(name: string): Skill {
  return { name, description: name, content: `# ${name}\n`, skillType: 'discipline', source: 'axiom', tags: [], related: [], sections: [] };
}

describe('ProdLoader skill-name resolution', () => {
  let dir: string;
  let loader: ProdLoader;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'axiom-prodloader-test-'));
    const names = ['axiom-concurrency', 'axiom-concurrency--swift-concurrency', 'axiom-data--sqlitedata'];
    const bundle: BundleV2 = {
      version: '0.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      skills: Object.fromEntries(names.map((name) => [name, skill(name)])),
      commands: {},
      agents: {},
    };
    await writeFile(join(dir, 'bundle.json'), JSON.stringify(bundle), 'utf-8');
    loader = new ProdLoader(join(dir, 'bundle.json'), new Logger(config), config);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.each([
    ['swift-concurrency', 'axiom-concurrency--swift-concurrency'],
    ['skills/sqlitedata.md', 'axiom-data--sqlitedata'],
    ['axiom-concurrency', 'axiom-concurrency'],
  ])('serves %s as %s from both lookups', async (requested, served) => {
    const read = await loader.getSkillSections(requested);
    expect([read?.skill.name, (await loader.getSkill(requested))?.name]).toEqual([served, served]);
  });

  it('serves an axiom://skill/ resource requested by a bare name', async () => {
    const { contents } = await new ResourcesHandler(loader, new Logger(config), []).readResource('axiom://skill/swift-concurrency');
    expect(contents[0].text).toContain('# axiom-concurrency--swift-concurrency');
  });

  it('still misses a name no skill has', async () => {
    expect([await loader.getSkill('database-migration'), await loader.getSkillSections('database-migration')]).toEqual([undefined, undefined]);
  });
});
