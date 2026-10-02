import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  query: vi.fn(),
  createSdkMcpServer: vi.fn((o: { name: string }) => ({ type: 'sdk', name: o.name })),
  tool: vi.fn((name: string) => ({ name })),
}));
vi.mock('@anthropic-ai/claude-agent-sdk', () => sdk);

import type { PinoLogger } from 'nestjs-pino';
import type { JournalSourceService } from '../journal/journal-source.service.js';
import type { JournalWriterService } from '../journal/journal-writer.service.js';
import { PeriodDocService } from '../period-doc/period-doc.service.js';
import { RollupSummarizerService } from '../rollup/rollup-summarizer.service.js';
import { DailySummarizerService } from '../summarizer/daily-summarizer.service.js';
import type { WorklogStatsService } from '../worklog-stats/worklog-stats.service.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;

// 결과 메시지 없이 끝나는 스트림 — 서비스는 submission 없음으로 fallback
async function* empty(): AsyncIterable<unknown> {}

beforeEach(() => {
  sdk.query.mockReset().mockImplementation(() => empty());
  sdk.createSdkMcpServer.mockClear();
});

function expectIsolated(): void {
  expect(sdk.query).toHaveBeenCalledTimes(1);
  const { options } = sdk.query.mock.calls[0]![0] as { options: Record<string, unknown> };
  expect(options).toMatchObject({ tools: [], settingSources: [], strictMcpConfig: true });
  expect(sdk.createSdkMcpServer).toHaveBeenCalledWith(
    expect.objectContaining({ alwaysLoad: true }),
  );
}

describe('요약 에이전트 도구 격리', () => {
  it('daily summarizer', async () => {
    await new DailySummarizerService(logger).summarize(
      { date: '2026-10-02', github: null, localGit: null },
      'ko',
    );
    expectIsolated();
  });

  it('rollup summarizer', async () => {
    await new RollupSummarizerService(logger).summarize(
      {
        activity: {
          period: 'weekly',
          rangeStart: '2026-09-28',
          rangeEnd: '2026-10-04',
          dailies: [],
          summaries: [],
          metrics: { prCount: 0, commitCount: 0, dailyCount: 0 },
        },
      },
      'ko',
    );
    expectIsolated();
  });

  it('period doc', async () => {
    const journalSource = {
      listDailyEntries: () => [
        {
          date: '2026-10-01',
          fileName: '2026-10-01.md',
          blocks: [
            { type: 'heading_2', text: 'Done' },
            { type: 'bulleted_list_item', text: '[cairn] 기간 정리 문서' },
          ],
        },
      ],
    } as unknown as JournalSourceService;
    const stats = { readAll: () => ({}) } as unknown as WorklogStatsService;
    const service = new PeriodDocService(journalSource, {} as JournalWriterService, stats, logger);
    await expect(
      service.generate({ since: '2026-10-01', until: '2026-10-02', lang: 'ko' }),
    ).rejects.toThrow();
    expectIsolated();
  });
});
