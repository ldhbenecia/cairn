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
    logger() as never,
  );
  return { service, notify };
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
  metrics: { prCount: 0, commitCount: 0, notionPageCount: 0, dailyCount: 0 },
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
