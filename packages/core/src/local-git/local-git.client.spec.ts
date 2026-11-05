import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalGitClient } from './local-git.client.js';

const EMAIL = 'dev@example.test';
let repo: string;

function commit(day: string, subject: string): void {
  writeFileSync(join(repo, 'f.txt'), `${subject}\n`);
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: `${day}T10:00:00Z`,
    GIT_COMMITTER_DATE: `${day}T10:00:00Z`,
  };
  execFileSync('git', ['add', '.'], { cwd: repo, env });
  execFileSync('git', ['commit', '-q', '-m', subject], { cwd: repo, env });
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'cairn-git-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', EMAIL], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Dev'], { cwd: repo });
  commit('2026-10-01', 'first');
  commit('2026-10-03', 'second');
  commit('2026-10-20', 'third');
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

const day = (d: string): [string, string] => [`${d}T00:00:00Z`, `${d}T23:59:59Z`];

describe('LocalGitClient.listCommits', () => {
  it('backfill dates reuse one git log and return the same per-day commits', async () => {
    const client = new LocalGitClient();
    const spy = vi.spyOn(client as unknown as { git: (p: string) => unknown }, 'git');
    const subjects = async (d: string) =>
      (await client.listCommits(repo, ...day(d), EMAIL)).map((c) => c.subject);

    expect(await subjects('2026-10-20')).toEqual(['third']);
    expect(await subjects('2026-10-03')).toEqual(['second']);
    expect(await subjects('2026-10-02')).toEqual([]);
    expect(await subjects('2026-10-01')).toEqual(['first']);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fetches again only when a date falls outside the cached range', async () => {
    const client = new LocalGitClient();
    const spy = vi.spyOn(client as unknown as { git: (p: string) => unknown }, 'git');
    await client.listCommits(repo, ...day('2026-10-20'), EMAIL);
    await client.listCommits(repo, ...day('2026-05-01'), EMAIL);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
