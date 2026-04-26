export type GithubActivityCategory = 'authored' | 'authored_merged' | 'reviewed' | 'commented';

export type GithubPrState = 'open' | 'closed' | 'merged';

export interface GithubPrSummary {
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
}

export interface GithubActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  prs: readonly GithubPrSummary[];
}
