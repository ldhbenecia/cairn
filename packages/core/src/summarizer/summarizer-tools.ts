import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { assertNoForbiddenPayload, sanitizeCairnError } from '../common/sanitize.js';
import type {
  GithubActivity,
  GithubActivityCategory,
  GithubPrState,
  PrCommitOnDate,
} from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';

export interface SummarizerInput {
  date: string;
  github: GithubActivity | null;
  localGit: LocalGitActivity | null;
}

export const submitSummarySchema = z.object({
  paragraph: z.string().min(1).max(2000),
  shareBullets: z.array(z.string().min(1).max(200)).max(10).default([]),
  doneBullets: z.array(z.string().min(1).max(300)).max(20),
  // 리뷰 활동은 수집·요약하지 않음 — 과거 페이지 호환을 위해 필드만 유지 (생략 시 빈 배열)
  reviewedBullets: z.array(z.string().min(1).max(300)).max(20).default([]),
  inProgressBullets: z.array(z.string().min(1).max(300)).max(20),
  notesBullets: z.array(z.string().min(1).max(300)).max(20),
});

export type SubmitSummaryInput = z.infer<typeof submitSummarySchema>;

interface DonePrItem {
  source: 'github';
  kind: 'pr_merged';
  account: string;
  repo: string;
  number: number;
  title: string;
  state: GithubPrState;
  mergedAt: string;
  categories: readonly GithubActivityCategory[];
  htmlUrl: string;
  body: string | null;
  commitsOnDate: readonly PrCommitOnDate[];
}

interface DoneCommitItem {
  source: 'local-git';
  kind: 'commit_pushed';
  repo: string;
  shortSha: string;
  subject: string;
  branch: string | null;
  authoredAt: string;
}

interface OpenPrItem {
  source: 'github';
  kind: 'pr_open';
  account: string;
  repo: string;
  number: number;
  title: string;
  categories: readonly GithubActivityCategory[];
  htmlUrl: string;
  updatedAt: string;
  body: string | null;
  commitsOnDate: readonly PrCommitOnDate[];
}

interface UnpushedCommitItem {
  source: 'local-git';
  kind: 'commit_unpushed';
  repo: string;
  shortSha: string;
  subject: string;
  branch: string | null;
  authoredAt: string;
}

interface SourceErrorsView {
  github?: { account: string; error: ReturnType<typeof sanitizeCairnError> }[];
  localGit?: { repo: string; error: ReturnType<typeof sanitizeCairnError> }[];
}

export interface ActivityPayload {
  date: string;
  accounts: string[];
  configuredAccounts: string[];
  done: { prs: DonePrItem[]; commits: DoneCommitItem[] };
  inProgress: { prs: OpenPrItem[]; commits: UnpushedCommitItem[] };
  sourceErrors: SourceErrorsView;
}

export function buildActivityPayload(input: SummarizerInput): ActivityPayload {
  const donePrs = computeDonePrs(input);
  const openPrs = computeOpenPrs(input);
  const accounts = [...new Set([...donePrs, ...openPrs].map((p) => p.account))].sort();
  return {
    date: input.date,
    accounts,
    configuredAccounts: [...(input.github?.accountLabels ?? [])],
    done: {
      prs: donePrs,
      commits: computeDoneCommits(input),
    },
    inProgress: {
      prs: openPrs,
      commits: computeUnpushedCommits(input),
    },
    sourceErrors: computeSourceErrors(input),
  };
}

export interface SummarizerToolsBundle {
  server: ReturnType<typeof createSdkMcpServer>;
  getSubmission: () => SubmitSummaryInput | null;
}

export function buildSummarizerTools(input: SummarizerInput): SummarizerToolsBundle {
  let submission: SubmitSummaryInput | null = null;

  const getActivity = tool(
    'get_activity',
    "Returns today's activity in one call: done (authored/assigned merged PRs + pushed commits), inProgress (authored/assigned open PRs + unpushed commits), and sourceErrors. Call this exactly once, then call submit_summary.",
    {},
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      const payload = buildActivityPayload(input);
      assertNoForbiddenPayload(payload, 'tool.get_activity');
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  const submitSummary = tool(
    'submit_summary',
    'Submit the worklog summary and exit. Call exactly once after get_activity has provided context. All text fields must follow the requested output language.',
    submitSummarySchema.shape,
    // eslint-disable-next-line @typescript-eslint/require-await
    async (raw) => {
      submission = submitSummarySchema.parse(raw);
      return { content: [{ type: 'text', text: 'Summary submitted. Exiting.' }] };
    },
  );

  const server = createSdkMcpServer({
    name: 'cairn-summarizer',
    tools: [getActivity, submitSummary],
  });

  return {
    server,
    getSubmission: () => submission,
  };
}

function computeDonePrs(input: SummarizerInput): DonePrItem[] {
  const out: DonePrItem[] = [];
  for (const pr of input.github?.prs ?? []) {
    if (pr.mergedAt && isMyWork(pr)) {
      out.push({
        source: 'github',
        kind: 'pr_merged',
        account: pr.account,
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        mergedAt: pr.mergedAt,
        categories: pr.categories,
        htmlUrl: pr.htmlUrl,
        body: pr.body,
        commitsOnDate: pr.commitsOnDate,
      });
    }
  }
  return out;
}

function computeDoneCommits(input: SummarizerInput): DoneCommitItem[] {
  const out: DoneCommitItem[] = [];
  for (const repo of input.localGit?.repos ?? []) {
    for (const commit of repo.commits) {
      if (commit.pushed) {
        out.push({
          source: 'local-git',
          kind: 'commit_pushed',
          repo: repo.repo,
          shortSha: commit.shortSha,
          subject: commit.subject,
          branch: commit.branch,
          authoredAt: commit.authoredAt,
        });
      }
    }
  }
  return out;
}

function computeOpenPrs(input: SummarizerInput): OpenPrItem[] {
  const out: OpenPrItem[] = [];
  for (const pr of input.github?.prs ?? []) {
    if (pr.state === 'open' && isMyWork(pr)) {
      out.push({
        source: 'github',
        kind: 'pr_open',
        account: pr.account,
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        categories: pr.categories,
        htmlUrl: pr.htmlUrl,
        updatedAt: pr.updatedAt,
        body: pr.body,
        commitsOnDate: pr.commitsOnDate,
      });
    }
  }
  return out;
}

function isMyWork(pr: { categories: readonly GithubActivityCategory[] }): boolean {
  return (
    pr.categories.includes('authored') ||
    pr.categories.includes('authored_merged') ||
    pr.categories.includes('assigned')
  );
}

function computeUnpushedCommits(input: SummarizerInput): UnpushedCommitItem[] {
  const out: UnpushedCommitItem[] = [];
  for (const repo of input.localGit?.repos ?? []) {
    for (const commit of repo.commits) {
      if (!commit.pushed) {
        out.push({
          source: 'local-git',
          kind: 'commit_unpushed',
          repo: repo.repo,
          shortSha: commit.shortSha,
          subject: commit.subject,
          branch: commit.branch,
          authoredAt: commit.authoredAt,
        });
      }
    }
  }
  return out;
}

function computeSourceErrors(input: SummarizerInput): SourceErrorsView {
  const out: SourceErrorsView = {};

  const githubErrors = (input.github?.accountErrors ?? []).map((e) => ({
    account: e.account,
    error: sanitizeCairnError(e.error),
  }));
  if (githubErrors.length > 0) out.github = githubErrors;

  const localGitErrors = (input.localGit?.repos ?? []).flatMap((r) =>
    r.error ? [{ repo: r.repo, error: sanitizeCairnError(r.error) }] : [],
  );
  if (localGitErrors.length > 0) out.localGit = localGitErrors;

  return out;
}
