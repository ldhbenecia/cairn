import { describe, expect, it, vi } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import type { SecretsService } from '../secrets/secrets.service.js';
import type { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import type { NotionApiClient } from './notion-api.client.js';
import { NotionPublisherService } from './notion-publisher.service.js';

function makeSummary(overrides: Partial<WorklogSummary> = {}): WorklogSummary {
  return {
    paragraph: 'clean summary paragraph',
    shareBullets: [],
    doneBullets: ['clean done bullet'],
    reviewedBullets: [],
    inProgressBullets: [],
    notesBullets: [],
    ...overrides,
  };
}

function setup() {
  const createWorklogPage = vi.fn((_args: { children: readonly unknown[] }) =>
    Promise.resolve({ id: 'page-1', url: 'https://notion/page-1' }),
  );
  const findWorklogPageByDate = vi.fn(() => Promise.resolve(null));
  const client = { createWorklogPage, findWorklogPageByDate } as unknown as NotionApiClient;
  const workspace = {
    label: 'Personal',
    tokenEnv: 'NOTION_TOKEN_PERSONAL',
    worklog: { pageId: 'parent', databaseId: 'db', dataSourceId: 'ds' },
  };
  const worklogConfig = {
    findWorklogWorkspace: () => workspace,
    persistWorklogTarget: vi.fn(),
  } as unknown as WorklogConfigService;
  const secrets = { getEnv: () => 'tok' } as unknown as SecretsService;
  const warn = vi.fn();
  const logger = { info: vi.fn(), warn } as unknown as PinoLogger;

  const service = new NotionPublisherService(client, worklogConfig, secrets, logger);
  return { service, createWorklogPage, warn };
}

describe('NotionPublisherService egress item-drop (ADR 0021)', () => {
  it('drops only the violating block and still publishes the summary', async () => {
    const { service, createWorklogPage, warn } = setup();
    const summary = makeSummary({
      doneBullets: ['clean done bullet', 'leaked path /Users/leak/secret-work.ts'],
    });

    const res = await service.publish({
      date: '2026-07-03',
      force: false,
      github: null,
      localGit: null,
      summary,
      lang: 'ko',
    });

    expect(res).toMatchObject({ kind: 'created', pageId: 'page-1' });
    expect(createWorklogPage).toHaveBeenCalledTimes(1);
    const json = JSON.stringify(createWorklogPage.mock.calls[0]![0].children);
    expect(json).toContain('clean done bullet');
    expect(json).toContain('clean summary paragraph');
    expect(json).not.toContain('/Users/');
    // 위반 블록 1개 때문에 통짜 fallback 으로 degrade 되면 안 된다
    expect(json).not.toContain('Summarizer 미실행');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('publishes clean summaries untouched without warnings', async () => {
    const { service, createWorklogPage, warn } = setup();

    const res = await service.publish({
      date: '2026-07-03',
      force: false,
      github: null,
      localGit: null,
      summary: makeSummary(),
      lang: 'ko',
    });

    expect(res).toMatchObject({ kind: 'created' });
    const json = JSON.stringify(createWorklogPage.mock.calls[0]![0].children);
    expect(json).toContain('clean done bullet');
    expect(warn).not.toHaveBeenCalled();
  });
});
