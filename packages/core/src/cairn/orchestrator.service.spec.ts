import { describe, expect, it, vi } from 'vitest';
import { CairnError, ErrorCode, ErrorSource } from '../common/error.js';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import { OrchestratorService } from './orchestrator.service.js';
import type { RunOptions } from './run-options.js';

// 실패가 '활동 없음/일지 없음' 성공으로 위장되던 회귀 방지 스펙 —
// 도달하지 않아야 하는 의존성은 호출 시 throw 하는 스텁으로 고정

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const unusable = (name: string) =>
  new Proxy(
    {},
    {
      get: () => () => {
        throw new Error(`unexpected call: ${name}`);
      },
    },
  );

function makeDaily(overrides: {
  github?: Partial<GithubActivity>;
  localGit?: Partial<LocalGitActivity>;
}) {
  const notify = vi.fn().mockResolvedValue(undefined);
  const service = new OrchestratorService(
    { collect: vi.fn().mockResolvedValue({ prs: [], ...overrides.github }) } as never,
    { collect: vi.fn().mockResolvedValue({ repos: [], ...overrides.localGit }) } as never,
    unusable('notionPublisher') as never,
    unusable('summarizer') as never,
    { notify } as never,
    unusable('rollupCollector') as never,
    unusable('rollupSummarizer') as never,
    unusable('rollupPublisher') as never,
    unusable('stats') as never,
    unusable('journalWriter') as never,
    unusable('journalSource') as never,
    unusable('memoSource') as never,
    logger() as never,
  );
  return { service, notify };
}

function makeRepublish(opts: {
  published: string[];
  hasDaily: (date: string) => boolean;
  readDailySummary: (date: string) => unknown;
  publishResult: unknown;
}) {
  const notify = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(opts.publishResult);
  const service = new OrchestratorService(
    unusable('githubCollector') as never,
    unusable('localGitCollector') as never,
    {
      publish,
      findPublishedDates: vi.fn().mockResolvedValue(new Set(opts.published)),
    } as never,
    unusable('summarizer') as never,
    { notify } as never,
    unusable('rollupCollector') as never,
    unusable('rollupSummarizer') as never,
    unusable('rollupPublisher') as never,
    unusable('stats') as never,
    { hasDaily: vi.fn().mockImplementation(opts.hasDaily) } as never,
    { readDailySummary: vi.fn().mockImplementation(opts.readDailySummary) } as never,
    unusable('memoSource') as never,
    logger() as never,
  );
  return { service, notify, publish };
}

function makeRollup(activity: RollupActivity) {
  const notify = vi.fn().mockResolvedValue(undefined);
  const service = new OrchestratorService(
    unusable('githubCollector') as never,
    unusable('localGitCollector') as never,
    unusable('notionPublisher') as never,
    unusable('summarizer') as never,
    { notify } as never,
    { collect: vi.fn().mockResolvedValue(activity) } as never,
    unusable('rollupSummarizer') as never,
    unusable('rollupPublisher') as never,
    unusable('stats') as never,
    unusable('journalWriter') as never,
    unusable('journalSource') as never,
    unusable('memoSource') as never,
    logger() as never,
  );
  return { service, notify };
}

const dailyOptions: RunOptions = {
  mode: 'daily',
  date: '2026-07-09',
  dateExplicit: true,
  dryRun: false,
  force: true,
  backfillDays: 0,
  lookbackDays: 1,
  sources: 'all',
  lang: 'ko',
};

const emptyRollup = (error?: CairnError): RollupActivity => ({
  period: 'weekly',
  rangeStart: '2026-06-29',
  rangeEnd: '2026-07-05',
  dailies: [],
  summaries: [],
  metrics: { prCount: 0, commitCount: 0, dailyCount: 0 },
  ...(error ? { error } : {}),
});

describe('daily 활동 0건 판정', () => {
  it('수집 에러 없는 0건은 기존대로 "활동 없음" 알림 후 성공', async () => {
    const { service, notify } = makeDaily({});
    await expect(service.run(dailyOptions)).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith('cairn 일지', expect.stringContaining('활동 없음'));
  });

  it('github 계정 에러 + 0건이면 "활동 없음" 대신 실패로 던진다 (토큰 만료 무음 누락 방지)', async () => {
    const { service, notify } = makeDaily({
      github: {
        prs: [],
        accountErrors: [
          {
            account: 'Work',
            error: new CairnError(ErrorSource.Github, ErrorCode.AuthFailed, 'Bad credentials', 401),
          },
        ],
      },
    });
    await expect(service.run(dailyOptions)).rejects.toThrow(/수집 실패/);
    expect(notify).toHaveBeenCalledWith('cairn 실패', expect.stringContaining('수집 실패'));
    expect(notify).not.toHaveBeenCalledWith('cairn 일지', expect.stringContaining('활동 없음'));
  });

  it('local-git repo 에러 + 0건도 실패로 던진다', async () => {
    const { service } = makeDaily({
      localGit: {
        repos: [
          {
            repo: 'cairn',
            commitCount: 0,
            commits: [],
            error: new CairnError(ErrorSource.LocalGit, ErrorCode.NotFound, 'repo path missing'),
          },
        ],
      },
    });
    await expect(service.run(dailyOptions)).rejects.toThrow(/수집 실패 \(cairn\)/);
  });
});

describe('journal 재발행 (Notion 발행만 실패했던 날짜 복구)', () => {
  // backfill 창 3일: 07-07·07-08·07-09. 07-07 은 journal 만 있고 노션에 없음 → 재발행 대상
  const backfillOptions: RunOptions = {
    ...dailyOptions,
    dateExplicit: false,
    force: false,
    backfillDays: 3,
  };
  const summary = {
    paragraph: '요약',
    shareBullets: [],
    doneBullets: ['작업'],
    reviewedBullets: [],
    inProgressBullets: [],
    notesBullets: [],
  };

  it('journal 있음 + published 없음 → 재요약 없이 재발행하고 알림', async () => {
    const { service, notify, publish } = makeRepublish({
      published: ['2026-07-08', '2026-07-09'],
      hasDaily: () => true,
      readDailySummary: () => summary,
      publishResult: { kind: 'created', pageId: 'p1', url: null },
    });
    await expect(service.run(backfillOptions)).resolves.toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-07-07', force: false, summary }),
    );
    expect(notify).toHaveBeenCalledWith('cairn 일지', expect.stringContaining('재발행'));
  });

  it('노션 미연동(no-target)이면 재발행 알림 없이 조용히 종료', async () => {
    const { service, notify } = makeRepublish({
      published: [],
      hasDaily: () => true,
      readDailySummary: () => summary,
      publishResult: { kind: 'no-target' },
    });
    await expect(service.run(backfillOptions)).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('재발행'));
  });

  it('publish 가 던져도(노션 장애 지속) 런은 계속 — 다음 실행에서 재시도', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockRejectedValue(new Error('notion down'));
    const service = new OrchestratorService(
      unusable('githubCollector') as never,
      unusable('localGitCollector') as never,
      { publish, findPublishedDates: vi.fn().mockResolvedValue(new Set()) } as never,
      unusable('summarizer') as never,
      { notify } as never,
      unusable('rollupCollector') as never,
      unusable('rollupSummarizer') as never,
      unusable('rollupPublisher') as never,
      unusable('stats') as never,
      { hasDaily: vi.fn().mockReturnValue(true) } as never,
      { readDailySummary: vi.fn().mockReturnValue(summary) } as never,
      unusable('memoSource') as never,
      logger() as never,
    );
    await expect(service.run(backfillOptions)).resolves.toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(3);
  });
});

describe('rollup 일지 0건 판정', () => {
  const weeklyOptions: RunOptions = { ...dailyOptions, mode: 'weekly' };

  it('에러 없는 0건은 기존대로 "일지 없음" 알림 후 성공', async () => {
    const { service, notify } = makeRollup(emptyRollup());
    await expect(service.run(weeklyOptions)).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('일지 없음'));
  });

  it('수집 error 가 실린 0건은 "일지 없음" 대신 실패로 던진다 (anchor 기록으로 인한 영구 누락 방지)', async () => {
    const collectError = new CairnError(
      ErrorSource.Notion,
      ErrorCode.ServerError,
      'notion 502',
      502,
    );
    const { service, notify } = makeRollup(emptyRollup(collectError));
    await expect(service.run(weeklyOptions)).rejects.toThrow('notion 502');
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('실패'),
      expect.stringContaining('notion 502'),
    );
    expect(notify).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('일지 없음'),
    );
  });
});
