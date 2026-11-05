import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { codexModels } from './codex-models';

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'codex-home-'));
  process.env.CODEX_HOME = home;
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.CODEX_HOME;
});

const writeCache = (body: unknown) =>
  writeFileSync(join(home, 'models_cache.json'), JSON.stringify(body));

describe('codexModels', () => {
  it('lists only visible models with a valid id', () => {
    writeCache({
      models: [
        { slug: 'gpt-5.6-luna', display_name: 'GPT-5.6-Luna', visibility: 'list' },
        { slug: 'codex-auto-review', display_name: 'Review', visibility: 'hide' },
        { slug: '--bad', display_name: 'Bad', visibility: 'list' },
        { slug: 'gpt-6-sol', visibility: 'list' },
      ],
    });
    expect(codexModels()).toEqual([
      { slug: 'gpt-5.6-luna', name: 'GPT-5.6-Luna' },
      { slug: 'gpt-6-sol', name: 'gpt-6-sol' },
    ]);
  });

  it('returns nothing when the cache is missing or unreadable', () => {
    expect(codexModels()).toEqual([]);
    writeFileSync(join(home, 'models_cache.json'), '{not json');
    expect(codexModels()).toEqual([]);
    writeCache({ models: 'x' });
    expect(codexModels()).toEqual([]);
  });
});
