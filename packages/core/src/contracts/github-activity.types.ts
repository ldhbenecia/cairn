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
  changedFileNames: readonly string[];
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
  // 설정된 GitHub 계정 라벨 전체(활동 유무 무관). 2개 이상이면 발행 시 계정별 ### 서브헤딩.
  accountLabels: readonly string[];
  accountErrors?: readonly GithubAccountActivityError[];
}
