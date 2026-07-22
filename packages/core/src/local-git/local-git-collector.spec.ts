import { describe, expect, it, vi } from 'vitest';
import { LocalGitCollectorService, isForbiddenSubject } from './local-git-collector.service.js';

const logger = () => ({ info: vi.fn(), warn: vi.fn() });

describe('LocalGitCollectorService — localGitEnabled 토글', () => {
  it('OFF 면 등록 경로가 있어도 수집을 건너뛰고 빈 활동을 반환한다', async () => {
    const getLocalGitRepos = vi.fn().mockReturnValue(['/repo/a']);
    const client = { checkIsRepo: vi.fn() };
    const worklogConfig = { isLocalGitEnabled: () => false, getLocalGitRepos };
    const svc = new LocalGitCollectorService(
      client as never,
      worklogConfig as never,
      logger() as never,
    );

    const result = await svc.collect('2026-07-09');

    expect(result.repos).toEqual([]);
    expect(svc.isEnabled()).toBe(false);
    // 경로 조회·git 스폰까지 도달하지 않는다 (수집만 중단, 경로는 config 에 보존)
    expect(getLocalGitRepos).not.toHaveBeenCalled();
    expect(client.checkIsRepo).not.toHaveBeenCalled();
  });

  it('ON 이면 등록 경로를 수집한다', async () => {
    const client = {
      checkIsRepo: vi.fn().mockResolvedValue(true),
      getUserEmail: vi.fn().mockResolvedValue('me@example.com'),
      listCommits: vi
        .fn()
        .mockResolvedValue([
          { shortSha: 'abc1234', subject: 'feat: x', authoredAt: '2026-07-09T10:00:00+09:00' },
        ]),
      branchesContaining: vi
        .fn()
        .mockResolvedValue({ local: ['feature/x'], remote: ['origin/feature/x'] }),
    };
    const worklogConfig = { isLocalGitEnabled: () => true, getLocalGitRepos: () => ['/repo/a'] };
    const svc = new LocalGitCollectorService(
      client as never,
      worklogConfig as never,
      logger() as never,
    );

    const result = await svc.collect('2026-07-09');

    expect(svc.isEnabled()).toBe(true);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0]?.commitCount).toBe(1);
    expect(client.checkIsRepo).toHaveBeenCalledWith('/repo/a');
  });
});

describe('isForbiddenSubject', () => {
  it('allows normal commit subjects', () => {
    expect(isForbiddenSubject('feat(summarizer): tools')).toBe(false);
    expect(isForbiddenSubject('fix: password reset flow')).toBe(false);
    expect(isForbiddenSubject('chore: bump token rotation interval')).toBe(false);
  });

  it('flags subjects leaking an absolute path', () => {
    expect(isForbiddenSubject('move config from /Users/me/.env')).toBe(true);
  });

  it('flags subjects containing a pasted secret token', () => {
    expect(isForbiddenSubject(`oops committed sk-ant-${'a'.repeat(30)}`)).toBe(true);
    expect(isForbiddenSubject(`leak ghp_${'a'.repeat(35)}`)).toBe(true);
  });

  it('flags subjects containing diff markers', () => {
    expect(isForbiddenSubject('paste: @@ -1,2 +1,2 @@ hunk')).toBe(true);
  });
});
