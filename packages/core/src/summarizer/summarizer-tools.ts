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
  paragraphKo: z.string().min(1).max(2000),
  doneBullets: z.array(z.string().min(1).max(300)).max(20),
  reviewedBullets: z.array(z.string().min(1).max(300)).max(20),
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

interface ReviewedPrItem {
  source: 'github';
  kind: 'pr_reviewed';
  account: string;
  repo: string;
  number: number;
  title: string;
  state: GithubPrState;
  categories: readonly GithubActivityCategory[];
  htmlUrl: string;
  updatedAt: string;
  mergedAt: string | null;
  body: string | null;
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
  done: { prs: DonePrItem[]; commits: DoneCommitItem[] };
  reviewed: { prs: ReviewedPrItem[] };
  inProgress: { prs: OpenPrItem[]; commits: UnpushedCommitItem[] };
  sourceErrors: SourceErrorsView;
}

export function buildActivityPayload(input: SummarizerInput): ActivityPayload {
  return {
    date: input.date,
    done: {
      prs: computeDonePrs(input),
      commits: computeDoneCommits(input),
    },
    reviewed: {
      prs: computeReviewedPrs(input),
    },
    inProgress: {
      prs: computeOpenPrs(input),
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
    "Returns today's activity in one call: done (authored merged PRs + pushed commits), reviewed (reviewed/commented PRs not authored by the user), inProgress (authored open PRs + unpushed commits), and sourceErrors. Call this exactly once, then call submit_summary.",
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
    if (pr.mergedAt && isAuthoredWork(pr)) {
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

function computeReviewedPrs(input: SummarizerInput): ReviewedPrItem[] {
  const out: ReviewedPrItem[] = [];
  for (const pr of input.github?.prs ?? []) {
    if (isAuthoredWork(pr)) continue;
    if (!pr.categories.includes('reviewed') && !pr.categories.includes('commented')) continue;
    out.push({
      source: 'github',
      kind: 'pr_reviewed',
      account: pr.account,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      categories: pr.categories,
      htmlUrl: pr.htmlUrl,
      updatedAt: pr.updatedAt,
      mergedAt: pr.mergedAt,
      body: pr.body,
    });
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
    if (pr.state === 'open' && isAuthoredWork(pr)) {
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

function isAuthoredWork(pr: { categories: readonly GithubActivityCategory[] }): boolean {
  return pr.categories.includes('authored') || pr.categories.includes('authored_merged');
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
