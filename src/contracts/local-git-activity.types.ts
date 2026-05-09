export interface LocalGitCommitSummary {
  shortSha: string;
  subject: string;
  authoredAt: string;
  branch: string | null;
  pushed: boolean;
}

import type { CairnError } from '../common/error.js';

export interface LocalGitRepoActivity {
  repo: string;
  commitCount: number;
  commits: readonly LocalGitCommitSummary[];
  error?: CairnError;
}

export interface LocalGitActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  repos: readonly LocalGitRepoActivity[];
}
