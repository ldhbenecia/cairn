import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitMessage, createJournalBackup, type BackupDeps } from './journal-git-backup';

vi.mock('electron', () => ({ Notification: class {}, app: {} }));
vi.mock('./claude-path', () => ({ findInPath: () => null, searchPathEnv: () => '' }));
vi.mock('./journal-reader', () => ({ journalFolder: () => Promise.resolve('/j') }));
vi.mock('./settings', () => ({
  readSettings: () => ({ backup: { enabled: false }, notifications: false, language: 'ko' }),
}));
vi.mock('./i18n', () => ({ mt: (k: string) => k }));

const DIR = '/journal';

type Call = string;

function fakeDeps(overrides: {
  repoRoot?: string;
  remotes?: string;
  identity?: boolean;
  staged?: boolean;
  pullFails?: boolean;
  pushFails?: boolean;
  enabled?: boolean;
}): { deps: BackupDeps; calls: Call[]; notify: ReturnType<typeof vi.fn> } {
  const calls: Call[] = [];
  const notify = vi.fn();
  const deps: BackupDeps = {
    exec: (args) => {
      const cmd = args.join(' ');
      calls.push(cmd);
      const ok = (stdout = ''): Promise<{ stdout: string }> => Promise.resolve({ stdout });
      const fail = (msg: string): Promise<{ stdout: string }> => Promise.reject(new Error(msg));
      if (cmd === 'rev-parse --show-toplevel') return ok(`${overrides.repoRoot ?? DIR}\n`);
      if (cmd === 'remote') return ok(overrides.remotes ?? 'origin\n');
      if (cmd === 'pull --ff-only') return overrides.pullFails ? fail('diverged') : ok();
      if (cmd === 'config user.email' || cmd === 'config user.name')
        return overrides.identity === false ? fail('exit 1') : ok('a@b\n');
      if (cmd === 'add -A') return ok();
      if (cmd === 'diff --cached --quiet')
        return (overrides.staged ?? true) ? fail('exit 1') : ok();
      if (cmd.startsWith('commit -m')) return ok();
      if (cmd === 'push') return overrides.pushFails ? fail('rejected') : ok();
      return fail(`unexpected git ${cmd}`);
    },
    hasGit: () => true,
    journalDir: () => Promise.resolve(DIR),
    enabled: () => overrides.enabled ?? true,
    now: () => 1_700_000_000_000,
    notifyPullConflict: notify,
    debounceMs: 30_000,
  };
  return { deps, calls, notify };
}

describe('createJournalBackup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('변경 있음 — pull·commit·push 순서 실행, lastBackupAt 기록', async () => {
    const { deps, calls } = fakeDeps({});
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(calls).toEqual([
      'rev-parse --show-toplevel',
      'remote',
      'pull --ff-only',
      'config user.email',
      'config user.name',
      'add -A',
      'diff --cached --quiet',
      `commit -m ${commitMessage(new Date(1_700_000_000_000))}`,
      'push',
    ]);
    expect(s).toMatchObject({ state: 'idle', hasRemote: true, error: null });
    expect(s.lastBackupAt).toBe(1_700_000_000_000);
  });

  it('변경 없음 — 커밋 생략, push 는 수행(직전 실패분 회복)', async () => {
    const { deps, calls } = fakeDeps({ staged: false });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(calls.some((c) => c.startsWith('commit'))).toBe(false);
    expect(calls).toContain('push');
    expect(s.lastBackupAt).toBeNull();
    expect(s.error).toBeNull();
  });

  it('repo 루트 불일치(상위 repo) — no-repo, 커밋 시도 없음', async () => {
    const { deps, calls } = fakeDeps({ repoRoot: '/home/user' });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(s.state).toBe('no-repo');
    expect(calls.some((c) => c.startsWith('add') || c.startsWith('commit'))).toBe(false);
  });

  it('pull 실패(발산) — 커밋/푸시 중단 + 알림 1회, 재실행 시 재알림 없음', async () => {
    const { deps, calls, notify } = fakeDeps({ pullFails: true });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(s.error).toBe('pull-failed');
    expect(calls.some((c) => c.startsWith('add'))).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    await b.runNow();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('push 실패 — 커밋은 성공으로 남고 error 만 push-failed', async () => {
    const { deps } = fakeDeps({ pushFails: true });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(s.lastBackupAt).toBe(1_700_000_000_000);
    expect(s.error).toBe('push-failed');
    expect(s.state).toBe('idle');
  });

  it('user.email 미설정 — identity-missing, 커밋 시도 없음', async () => {
    const { deps, calls } = fakeDeps({ identity: false });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(s.error).toBe('identity-missing');
    expect(calls.some((c) => c.startsWith('commit'))).toBe(false);
  });

  it('remote 없음 — pull/push 생략, 로컬 커밋만', async () => {
    const { deps, calls } = fakeDeps({ remotes: '' });
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(calls).not.toContain('pull --ff-only');
    expect(calls).not.toContain('push');
    expect(calls.some((c) => c.startsWith('commit'))).toBe(true);
    expect(s).toMatchObject({ hasRemote: false, error: null });
  });

  it('비활성 — exec 호출 없음', async () => {
    const { deps, calls } = fakeDeps({ enabled: false });
    const b = createJournalBackup(deps);
    b.schedule();
    await vi.runAllTimersAsync();
    const s = await b.runNow();
    expect(calls).toHaveLength(0);
    expect(s.state).toBe('disabled');
  });

  it('실행 중 runNow — 자신의 run 완료까지 대기하고 pull 의도 보존', async () => {
    const { deps, calls } = fakeDeps({});
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const base = deps.exec;
    deps.exec = async (args, dir, t) => {
      if (args.join(' ') === 'push') await gate;
      return base(args, dir, t);
    };
    const b = createJournalBackup(deps);
    b.init();
    await vi.advanceTimersByTimeAsync(0);
    const second = b.runNow();
    let settled = false;
    void second.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    release();
    const s = await second;
    expect(s.state).toBe('idle');
    expect(calls.filter((c) => c === 'pull --ff-only')).toHaveLength(2);
  });

  it('git add 실패 — commit-failed, 성공으로 삼키지 않음', async () => {
    const { deps } = fakeDeps({});
    const base = deps.exec;
    deps.exec = (args, dir, t) =>
      args.join(' ') === 'add -A' ? Promise.reject(new Error('locked')) : base(args, dir, t);
    const b = createJournalBackup(deps);
    const s = await b.runNow();
    expect(s.error).toBe('commit-failed');
  });

  it('이전 push-failed 는 다음 run 시작 시 초기화 — remote 제거·변경 없음이어도 잔존 안 함', async () => {
    const o: Parameters<typeof fakeDeps>[0] = { pushFails: true, staged: true };
    const { deps } = fakeDeps(o);
    const b = createJournalBackup(deps);
    expect((await b.runNow()).error).toBe('push-failed');
    o.remotes = '';
    o.staged = false;
    expect((await b.runNow()).error).toBeNull();
  });

  it('디바운스 — 연속 schedule 은 1회 실행으로 합침, 시작 pull 없음', async () => {
    const { deps, calls } = fakeDeps({});
    const b = createJournalBackup(deps);
    b.schedule();
    b.schedule();
    b.schedule();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls.filter((c) => c.startsWith('add'))).toHaveLength(1);
    expect(calls).not.toContain('pull --ff-only');
  });
});

describe('commitMessage', () => {
  it('로컬 시간 고정 포맷 — 내용 유래 텍스트 없음', () => {
    const m = commitMessage(new Date(2026, 6, 17, 9, 5));
    expect(m).toBe('cairn: journal backup 2026-07-17 09:05');
  });
});
