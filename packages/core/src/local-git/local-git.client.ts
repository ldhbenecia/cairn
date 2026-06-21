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
    const out = await this.git(repoPath).raw(['config', 'user.email']);
    return out.trim();
  }

  async listCommits(
    repoPath: string,
    since: string,
    until: string,
    author: string,
  ): Promise<RawLocalCommit[]> {
    const out = await this.git(repoPath).raw([
      'log',
      '--all',
      `--since=${since}`,
      `--until=${until}`,
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
