import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Notification } from 'electron';
import { findInPath, searchPathEnv } from './claude-path';
import { mt } from './i18n';
import { journalFolder } from './journal-reader';
import { readSettings } from './settings';

const execFileAsync = promisify(execFile);

export type BackupErrorCode = 'pull-failed' | 'identity-missing' | 'commit-failed' | 'push-failed';

export type BackupStatus = {
  state: 'disabled' | 'no-git' | 'no-repo' | 'idle' | 'syncing';
  hasRemote: boolean;
  lastBackupAt: number | null;
  error: BackupErrorCode | null;
};

export type BackupDeps = {
  exec: (args: string[], dir: string, timeoutMs: number) => Promise<{ stdout: string }>;
  hasGit: () => boolean;
  journalDir: () => Promise<string>;
  enabled: () => boolean;
  now: () => number;
  notifyPullConflict: () => void;
  debounceMs: number;
};

export function commitMessage(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `cairn: journal backup ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function createJournalBackup(deps: BackupDeps): {
  init: () => void;
  reconfigure: () => void;
  schedule: () => void;
  runNow: () => Promise<BackupStatus>;
  getStatus: () => BackupStatus;
  dispose: () => void;
} {
  let status: BackupStatus = {
    state: 'disabled',
    hasRemote: false,
    lastBackupAt: null,
    error: null,
  };
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let queued = false;
  // pull 충돌 알림은 error 진입 시 1회만 — 매 발행마다 반복 알림 방지
  let pullNotified = false;

  const git = (dir: string, args: string[], timeoutMs = 10_000): Promise<{ stdout: string }> =>
    deps.exec(args, dir, timeoutMs);

  async function isRepoRoot(dir: string): Promise<boolean> {
    try {
      const top = (await git(dir, ['rev-parse', '--show-toplevel'])).stdout.trim();
      // journal 폴더가 repo 루트일 때만 — 상위 repo(홈 등) 오커밋 방지 (ADR 0034)
      return resolve(top) === resolve(dir);
    } catch {
      return false;
    }
  }

  async function doRun(pull: boolean): Promise<void> {
    if (!deps.enabled()) {
      status = { ...status, state: 'disabled' };
      return;
    }
    if (!deps.hasGit()) {
      status = { ...status, state: 'no-git', hasRemote: false, error: null };
      return;
    }
    const dir = await deps.journalDir();
    if (!(await isRepoRoot(dir))) {
      status = { ...status, state: 'no-repo', hasRemote: false, error: null };
      return;
    }
    let hasRemote: boolean;
    try {
      hasRemote = (await git(dir, ['remote'])).stdout.trim().length > 0;
    } catch {
      hasRemote = false;
    }
    status = { ...status, state: 'syncing', hasRemote };

    if (pull && hasRemote) {
      try {
        await git(dir, ['pull', '--ff-only'], 60_000);
        pullNotified = false;
      } catch {
        // 발산/충돌 — 자동 머지 없이 중단, 해소는 사용자 몫 (ADR 0034)
        status = { ...status, state: 'idle', error: 'pull-failed' };
        if (!pullNotified) {
          pullNotified = true;
          deps.notifyPullConflict();
        }
        return;
      }
    }

    try {
      await git(dir, ['config', 'user.email']);
    } catch {
      status = { ...status, state: 'idle', error: 'identity-missing' };
      return;
    }

    await git(dir, ['add', '-A']).catch(() => {});
    let changed = false;
    try {
      await git(dir, ['diff', '--cached', '--quiet']);
    } catch {
      changed = true;
    }
    if (changed) {
      try {
        await git(dir, ['commit', '-m', commitMessage(new Date(deps.now()))]);
        status = { ...status, lastBackupAt: deps.now(), error: null };
      } catch {
        status = { ...status, state: 'idle', error: 'commit-failed' };
        return;
      }
    }

    if (hasRemote) {
      // 변경이 없어도 push — 직전 run 의 push 실패분 회복
      try {
        await git(dir, ['push'], 60_000);
        status = { ...status, error: null };
      } catch {
        // 커밋은 로컬에 남아 데이터는 안전 — 상태 카드로만 노출
        status = { ...status, error: 'push-failed' };
      }
    }
    status = { ...status, state: 'idle' };
  }

  async function run(pull: boolean): Promise<void> {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await doRun(pull);
    } catch {
      status = { ...status, state: 'idle' };
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void run(false);
      }
    }
  }

  return {
    init(): void {
      if (deps.enabled()) void run(true);
    },
    reconfigure(): void {
      if (deps.enabled()) {
        void run(true);
      } else {
        if (timer) clearTimeout(timer);
        timer = null;
        status = { ...status, state: 'disabled' };
      }
    },
    schedule(): void {
      if (!deps.enabled()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run(false);
      }, deps.debounceMs);
    },
    async runNow(): Promise<BackupStatus> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await run(true);
      return { ...status };
    },
    getStatus(): BackupStatus {
      return { ...status };
    },
    dispose(): void {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

function realExec(args: string[], dir: string, timeoutMs: number): Promise<{ stdout: string }> {
  const gitBin = findInPath('git');
  if (!gitBin) return Promise.reject(new Error('git not found'));
  return execFileAsync(gitBin, ['-C', dir, ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, PATH: searchPathEnv() },
  });
}

function notifyPullConflict(): void {
  if (!readSettings().notifications || !Notification.isSupported()) return;
  new Notification({ title: mt('backup.pullFailTitle'), body: mt('backup.pullFailBody') }).show();
}

const backup = createJournalBackup({
  exec: realExec,
  hasGit: () => findInPath('git') !== null,
  journalDir: journalFolder,
  enabled: () => readSettings().backup.enabled,
  now: () => Date.now(),
  notifyPullConflict,
  debounceMs: 30_000,
});

export const initJournalBackup = backup.init;
export const reconfigureJournalBackup = backup.reconfigure;
export const scheduleJournalBackup = backup.schedule;
export const runJournalBackupNow = backup.runNow;
export const getJournalBackupStatus = backup.getStatus;
