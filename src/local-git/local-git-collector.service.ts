import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import type {
  LocalGitActivity,
  LocalGitCommitSummary,
  LocalGitRepoActivity,
} from '../contracts/local-git-activity.types.js';
import { kstDateToUtcWindow } from '../github/date-window.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { LocalGitClient, type RawLocalCommit } from './local-git.client.js';

const TRUNK_NAMES = new Set(['main', 'master', 'develop', 'release']);
const TRUNK_PREFIXES = ['release/'];

@Injectable()
export class LocalGitCollectorService {
  constructor(
    private readonly client: LocalGitClient,
    private readonly worklogConfig: WorklogConfigService,
    @InjectPinoLogger(LocalGitCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(date: string): Promise<LocalGitActivity> {
    const window = kstDateToUtcWindow(date);
    const repoPaths = this.worklogConfig.getLocalGitRepos();

    if (repoPaths.length === 0) {
      this.logger.warn('no localGitRepos configured — empty activity');
      return { date, rangeStart: window.startIso, rangeEnd: window.endIso, repos: [] };
    }

    this.logger.info(
      { date, repoCount: repoPaths.length, since: window.startIso, until: window.endIso },
      'local-git collect start',
    );

    const settled = await Promise.allSettled(
      repoPaths.map((path) => this.collectRepo(path, window.startIso, window.endIso)),
    );

    const repos: LocalGitRepoActivity[] = settled.map((result, idx) => {
      if (result.status === 'fulfilled') return result.value;
      const path = repoPaths[idx];
      const repo = path ? basename(path) : 'unknown';
      const error = CairnError.from(result.reason, 'local-git');
      this.logger.warn({ path, error }, 'local-git repo failed');
      return { repo, commitCount: 0, commits: [], error };
    });

    this.logger.info(
      {
        date,
        repoCount: repos.length,
        commitCountTotal: repos.reduce((acc, r) => acc + r.commitCount, 0),
      },
      'local-git collect done',
    );

    return { date, rangeStart: window.startIso, rangeEnd: window.endIso, repos };
  }

  private async collectRepo(
    repoPath: string,
    since: string,
    until: string,
  ): Promise<LocalGitRepoActivity> {
    const repo = basename(repoPath);

    if (!(await this.client.checkIsRepo(repoPath))) {
      return { repo, commitCount: 0, commits: [], error: CairnError.gitRepoNotFound() };
    }

    const email = await this.client.getUserEmail(repoPath);
    if (!email) {
      return { repo, commitCount: 0, commits: [], error: CairnError.gitEmailMissing() };
    }

    const raw = await this.client.listCommits(repoPath, since, until, email);
    const commits = await Promise.all(raw.map((c) => this.enrich(repoPath, c)));

    return { repo, commitCount: commits.length, commits };
  }

  private async enrich(repoPath: string, raw: RawLocalCommit): Promise<LocalGitCommitSummary> {
    const [localBranches, remoteBranches] = await Promise.all([
      this.client.localBranchesContaining(repoPath, raw.shortSha),
      this.client.remoteBranchesContaining(repoPath, raw.shortSha),
    ]);

    return {
      shortSha: raw.shortSha,
      subject: raw.subject,
      authoredAt: raw.authoredAt,
      branch: pickBranch(localBranches),
      pushed: remoteBranches.length > 0,
    };
  }
}

// 한 commit 이 여러 branch 에 포함될 때 작업 브랜치(feature/* 등) 우선 선택.
// 트렁크 / 통합 브랜치는 후순위로 밀고, 트렁크밖에 없으면 그제서야 노출.
function pickBranch(branches: readonly string[]): string | null {
  if (branches.length === 0) return null;
  const named = branches.filter((b) => !b.startsWith('('));
  const nonTrunk = named.find((b) => !isTrunkBranch(b));
  if (nonTrunk) return nonTrunk;
  return named[0] ?? null;
}

function isTrunkBranch(branch: string): boolean {
  if (TRUNK_NAMES.has(branch)) return true;
  return TRUNK_PREFIXES.some((prefix) => branch.startsWith(prefix));
}
