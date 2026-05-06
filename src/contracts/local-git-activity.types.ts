export interface LocalGitCommitSummary {
  shortSha: string;
  subject: string;
  authoredAt: string;
  branch: string | null;
  pushed: boolean;
}

export interface LocalGitRepoActivity {
  repo: string;
  commitCount: number;
  commits: readonly LocalGitCommitSummary[];
  error?: string;
}

export interface LocalGitActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  repos: readonly LocalGitRepoActivity[];
}
