import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { assertNoForbiddenPayload, sanitizeCairnError } from '../common/sanitize.js';
import type {
  GithubActivity,
  GithubActivityCategory,
  GithubPrState,
} from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { NotionActivity, NotionParentType } from '../contracts/notion-activity.types.js';

export interface SummarizerInput {
  date: string;
  github: GithubActivity | null;
  localGit: LocalGitActivity | null;
  notion: NotionActivity | null;
}

export const submitSummarySchema = z.object({
  paragraphKo: z.string().min(1).max(2000),
  doneBullets: z.array(z.string().min(1).max(300)).max(20),
  inProgressBullets: z.array(z.string().min(1).max(300)).max(20),
  notesBullets: z.array(z.string().min(1).max(300)).max(20),
});

export type SubmitSummaryInput = z.infer<typeof submitSummarySchema>;

interface DonePrItem {
  source: 'github';
  kind: 'pr_merged';
  repo: string;
  number: number;
  title: string;
  state: GithubPrState;
  mergedAt: string;
  categories: readonly GithubActivityCategory[];
  htmlUrl: string;
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
  repo: string;
  number: number;
  title: string;
  categories: readonly GithubActivityCategory[];
  htmlUrl: string;
  updatedAt: string;
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

interface NoteItem {
  workspace: string;
  title: string;
  url: string;
  lastEditedAt: string;
  parentType: NotionParentType;
}

interface SourceErrorsView {
  github?: ReturnType<typeof sanitizeCairnError>;
  localGit?: { repo: string; error: ReturnType<typeof sanitizeCairnError> }[];
  notion?: { workspace: string; error: ReturnType<typeof sanitizeCairnError> }[];
}

interface ActivityPayload {
  date: string;
  done: { prs: DonePrItem[]; commits: DoneCommitItem[] };
  inProgress: { prs: OpenPrItem[]; commits: UnpushedCommitItem[] };
  notes: NoteItem[];
  sourceErrors: SourceErrorsView;
}

export interface SummarizerToolsBundle {
  server: ReturnType<typeof createSdkMcpServer>;
  getSubmission: () => SubmitSummaryInput | null;
}

export function buildSummarizerTools(input: SummarizerInput): SummarizerToolsBundle {
  let submission: SubmitSummaryInput | null = null;

  const getActivity = tool(
    'get_activity',
    "Returns today's activity in one call: done (merged PRs + pushed commits), inProgress (open PRs + unpushed commits), notes (edited Notion pages), and sourceErrors. Call this exactly once, then call submit_summary.",
    {},
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      const payload: ActivityPayload = {
        date: input.date,
        done: {
          prs: computeDonePrs(input),
          commits: computeDoneCommits(input),
        },
        inProgress: {
          prs: computeOpenPrs(input),
          commits: computeUnpushedCommits(input),
        },
        notes: computeNotes(input),
        sourceErrors: computeSourceErrors(input),
      };
      assertNoForbiddenPayload(payload, 'tool.get_activity');
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  const submitSummary = tool(
    'submit_summary',
    'Submit the Korean worklog summary and exit. Call exactly once after get_activity has provided context. paragraphKo + bullets must be Korean.',
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
    if (pr.mergedAt) {
      out.push({
        source: 'github',
        kind: 'pr_merged',
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        mergedAt: pr.mergedAt,
        categories: pr.categories,
        htmlUrl: pr.htmlUrl,
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
    if (pr.state === 'open') {
      out.push({
        source: 'github',
        kind: 'pr_open',
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        categories: pr.categories,
        htmlUrl: pr.htmlUrl,
        updatedAt: pr.updatedAt,
      });
    }
  }
  return out;
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

function computeNotes(input: SummarizerInput): NoteItem[] {
  const out: NoteItem[] = [];
  for (const ws of input.notion?.workspaces ?? []) {
    for (const page of ws.pages) {
      out.push({
        workspace: ws.workspace,
        title: page.title,
        url: page.url,
        lastEditedAt: page.lastEditedAt,
        parentType: page.parentType,
      });
    }
  }
  return out;
}

function computeSourceErrors(input: SummarizerInput): SourceErrorsView {
  const out: SourceErrorsView = {};

  if (input.github?.error) {
    out.github = sanitizeCairnError(input.github.error);
  }

  const localGitErrors = (input.localGit?.repos ?? []).flatMap((r) =>
    r.error ? [{ repo: r.repo, error: sanitizeCairnError(r.error) }] : [],
  );
  if (localGitErrors.length > 0) out.localGit = localGitErrors;

  const notionErrors = (input.notion?.workspaces ?? []).flatMap((w) =>
    w.error ? [{ workspace: w.workspace, error: sanitizeCairnError(w.error) }] : [],
  );
  if (notionErrors.length > 0) out.notion = notionErrors;

  return out;
}
