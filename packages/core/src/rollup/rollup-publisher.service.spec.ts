import { describe, expect, it, vi } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import type { NotionApiClient } from '../notion/notion-api.client.js';
import type { NotionRollupApiClient } from '../notion/notion-rollup-api.client.js';
import type { SecretsService } from '../secrets/secrets.service.js';
import type { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { RollupPublisherService } from './rollup-publisher.service.js';

function makeActivity(): RollupActivity {
  return {
    period: 'weekly',
    rangeStart: '2026-06-15',
    rangeEnd: '2026-06-21',
    dailies: [],
    summaries: [],
    metrics: { prCount: 0, commitCount: 0, notionPageCount: 0, dailyCount: 0 },
  };
}

function setup(opts: { archiveFails?: boolean } = {}) {
  const calls: string[] = [];
  const createRollupPage = vi.fn(() => {
    calls.push('create');
    return Promise.resolve({ id: 'new-page', url: 'https://notion/new' });
  });
  const archivePage = vi.fn(() => {
    calls.push('archive');
    return opts.archiveFails ? Promise.reject(new Error('archive boom')) : Promise.resolve();
  });
  const findRollupPageByRange = vi.fn(() =>
    Promise.resolve({ pageId: 'old-page', status: 'draft' }),
  );

  const rollupApi = { findRollupPageByRange, createRollupPage } as unknown as NotionRollupApiClient;
  const api = { archivePage } as unknown as NotionApiClient;
  const worklogConfig = {
    getNotionWorkspaces: () => [
      {
        label: 'Personal',
        tokenEnv: 'NOTION_TOKEN_PERSONAL',
        rollup: { pageId: 'parent', databaseId: 'db', dataSourceId: 'ds' },
        worklog: { pageId: 'parent' },
      },
    ],
    persistRollupTarget: vi.fn(),
  } as unknown as WorklogConfigService;
  const secrets = { getEnv: () => 'tok' } as unknown as SecretsService;
  const logger = { info: vi.fn(), warn: vi.fn() } as unknown as PinoLogger;

  const service = new RollupPublisherService(api, rollupApi, worklogConfig, secrets, logger);
  return { service, calls, createRollupPage, archivePage };
}

describe('RollupPublisherService --force recreate', () => {
  it('creates the new page BEFORE archiving the old (no loss if create fails)', async () => {
    const { service, calls, createRollupPage, archivePage } = setup();

    const res = await service.publish({ activity: makeActivity(), force: true, lang: 'ko' });

    expect(calls).toEqual(['create', 'archive']);
    expect(createRollupPage).toHaveBeenCalledTimes(1);
    expect(archivePage).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      kind: 'recreated',
      pageId: 'new-page',
      archivedPageId: 'old-page',
    });
  });

  it('still reports recreated when archiving the old page fails', async () => {
    const { service, calls } = setup({ archiveFails: true });

    const res = await service.publish({ activity: makeActivity(), force: true, lang: 'ko' });

    expect(calls).toEqual(['create', 'archive']);
    expect(res).toMatchObject({ kind: 'recreated', pageId: 'new-page' });
  });

  it('skips (no create/archive) when the page exists and force is false', async () => {
    const { service, createRollupPage, archivePage } = setup();

    const res = await service.publish({ activity: makeActivity(), force: false, lang: 'ko' });

    expect(createRollupPage).not.toHaveBeenCalled();
    expect(archivePage).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'skipped', reason: 'already-published' });
  });
});
