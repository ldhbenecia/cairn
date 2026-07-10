export type GithubActivityCategory = 'authored' | 'authored_merged' | 'assigned' | 'involved';

export type GithubPrState = 'open' | 'closed' | 'merged';

export interface PrCommitOnDate {
  shortSha: string;
  subject: string;
  authoredAt: string;
}

export interface GithubPrSummary {
  account: string;
  repo: string;
  number: number;
  title: string;
  state: GithubPrState;
  author: string;
  labels: readonly string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  categories: readonly GithubActivityCategory[];
  body: string | null;
  commitsOnDate: readonly PrCommitOnDate[];
}

import type { CairnError } from '../common/error.js';

export interface GithubAccountActivityError {
  account: string;
  error: CairnError;
}

export interface GithubActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  prs: readonly GithubPrSummary[];
  accountLabels: readonly string[];
  accountErrors?: readonly GithubAccountActivityError[];
}
