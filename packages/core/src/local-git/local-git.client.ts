import { existsSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface RawLocalCommit {
  shortSha: string;
  subject: string;
  authoredAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SLACK_MS = 30 * DAY_MS;
// 미스 때 과거로 더 받아 둘 폭 — 백필 상한(30일)을 한 번에 덮음
const PREFETCH_MS = 60 * DAY_MS;

interface LogRow {
  shortSha: string;
  subject: string;
  authoredAt: string;
  committedAt: string | undefined;
}

@Injectable()
export class LocalGitClient {
  async checkIsRepo(repoPath: string): Promise<boolean> {
    if (!existsSync(repoPath)) return false;
    try {
      return await this.git(repoPath).checkIsRepo();
    } catch {
      return false;
    }
  }

  async getUserEmail(repoPath: string): Promise<string> {
    // user.email 미설정이면 git config 가 exit 1 — '' 를 돌려 collector 의 validation 경로로
    try {
      const out = await this.git(repoPath).raw(['config', 'user.email']);
      return out.trim();
    } catch {
      return '';
    }
  }

  // 백필은 날짜마다 ±30일 git log 를 레포 수만큼 다시 실행 — 넓게 한 번 받아 두고 범위 안이면 메모리에서 필터
  // 필터 규칙이 같아 결과는 날짜별 조회와 동일
  private readonly logCache = new Map<string, { fromMs: number; toMs: number; rows: LogRow[] }>();

  async listCommits(
    repoPath: string,
    since: string,
    until: string,
    author: string,
  ): Promise<RawLocalCommit[]> {
    // git --since/--until 은 committer date 기준이고 리포트는 author date 기준 — rebase/amend 로 갈리면
    // 누락·중복이 생겨 윈도우를 양쪽으로 벌려 받고 GitHub PR commit 경로와 같이 author date instant 로 필터
    const sinceMs = Date.parse(since);
    const untilMs = Date.parse(until);
    if (Number.isNaN(sinceMs) || Number.isNaN(untilMs)) {
      throw new Error(`invalid commit window: since=${since}, until=${until}`);
    }
    const rows = await this.logRows(repoPath, author, sinceMs - SLACK_MS, untilMs + SLACK_MS);
    const inWindow = (iso: string | undefined): boolean => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return t >= sinceMs && t <= untilMs;
    };
    return (
      rows
        // rebase/cherry-pick 은 author date 가 과거라 committer date 폴백, 귀속 시각도 윈도우에 든 쪽
        // (GitHub PR 커밋 경로와 같은 규칙)
        .filter((c) => inWindow(c.authoredAt) || inWindow(c.committedAt))
        .map(({ shortSha, subject, authoredAt, committedAt }) => ({
          shortSha,
          subject,
          authoredAt: inWindow(authoredAt) ? authoredAt : (committedAt ?? authoredAt),
        }))
    );
  }

  private async logRows(
    repoPath: string,
    author: string,
    needFrom: number,
    needTo: number,
  ): Promise<LogRow[]> {
    const key = `${repoPath}\0${author}`;
    const hit = this.logCache.get(key);
    if (hit && hit.fromMs <= needFrom && hit.toMs >= needTo) return hit.rows;
    const fromMs = needFrom - PREFETCH_MS;
    const out = await this.git(repoPath).raw([
      'log',
      '--all',
      `--since=${new Date(fromMs).toISOString()}`,
      `--until=${new Date(needTo).toISOString()}`,
      '--no-merges',
      `--author=${author}`,
      '--pretty=format:%h%x09%s%x09%aI%x09%cI',
    ]);
    const rows = out
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [shortSha, subject, authoredAt, committedAt] = line.split('\t');
        // 빈 subject(--allow-empty-message)도 정상 커밋 — throw 하면 레포 전체가 그 날짜에서 탈락
        if (!shortSha || !authoredAt) {
          throw new Error(`unexpected git log line shape: ${line}`);
        }
        return { shortSha, subject: subject ?? '', authoredAt, committedAt };
      });
    this.logCache.set(key, { fromMs, toMs: needTo, rows });
    return rows;
  }

  // local·remote 를 git 스폰 한 번으로 조회
  async branchesContaining(
    repoPath: string,
    sha: string,
  ): Promise<{ local: string[]; remote: string[] }> {
    const out = await this.git(repoPath).raw([
      'for-each-ref',
      'refs/heads',
      'refs/remotes',
      '--contains',
      sha,
      '--format=%(refname)',
    ]);
    const local: string[] = [];
    const remote: string[] = [];
    for (const line of out.split('\n')) {
      const ref = line.trim();
      if (ref.startsWith('refs/heads/')) local.push(ref.slice('refs/heads/'.length));
      else if (ref.startsWith('refs/remotes/')) remote.push(ref.slice('refs/remotes/'.length));
    }
    return { local, remote };
  }

  private git(repoPath: string): SimpleGit {
    return simpleGit({ baseDir: repoPath });
  }
}
