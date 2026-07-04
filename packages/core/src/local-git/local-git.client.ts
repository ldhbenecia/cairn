import { existsSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface RawLocalCommit {
  shortSha: string;
  subject: string;
  authoredAt: string;
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
    // user.email 미설정 시 git config 가 exit 1 로 throw — '' 반환해 collector 의 validation 경로로
    try {
      const out = await this.git(repoPath).raw(['config', 'user.email']);
      return out.trim();
    } catch {
      return '';
    }
  }

  async listCommits(
    repoPath: string,
    since: string,
    until: string,
    author: string,
  ): Promise<RawLocalCommit[]> {
    // git --since/--until 은 committer date 기준인데 리포트는 author date(%aI) 기준 —
    // rebase/amend 로 두 날짜가 갈리면 누락·중복 집계가 생긴다. git 윈도우를 양쪽으로
    // 벌려 후보를 받고, GitHub PR commit 경로와 동일하게 author date instant 로 필터.
    const sinceMs = Date.parse(since);
    const untilMs = Date.parse(until);
    if (Number.isNaN(sinceMs) || Number.isNaN(untilMs)) {
      throw new Error(`invalid commit window: since=${since}, until=${until}`);
    }
    const slackMs = 30 * 24 * 60 * 60 * 1000;
    const out = await this.git(repoPath).raw([
      'log',
      '--all',
      `--since=${new Date(sinceMs - slackMs).toISOString()}`,
      `--until=${new Date(untilMs + slackMs).toISOString()}`,
      '--no-merges',
      `--author=${author}`,
      '--pretty=format:%h%x09%s%x09%aI',
    ]);
    return out
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [shortSha, subject, authoredAt] = line.split('\t');
        if (!shortSha || !subject || !authoredAt) {
          throw new Error(`unexpected git log line shape: ${line}`);
        }
        return { shortSha, subject, authoredAt };
      })
      .filter((c) => {
        const t = Date.parse(c.authoredAt);
        return t >= sinceMs && t <= untilMs;
      });
  }

  async localBranchesContaining(repoPath: string, sha: string): Promise<string[]> {
    return this.branchesContaining(repoPath, sha, false);
  }

  async remoteBranchesContaining(repoPath: string, sha: string): Promise<string[]> {
    return this.branchesContaining(repoPath, sha, true);
  }

  private async branchesContaining(
    repoPath: string,
    sha: string,
    remote: boolean,
  ): Promise<string[]> {
    const args = ['branch', '--contains', sha, '--format=%(refname:short)'];
    if (remote) args.splice(1, 0, '-r');
    const out = await this.git(repoPath).raw(args);
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private git(repoPath: string): SimpleGit {
    return simpleGit({ baseDir: repoPath });
  }
}
