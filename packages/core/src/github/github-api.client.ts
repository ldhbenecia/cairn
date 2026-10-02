import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { canReusePrSearch, isPrSliceComplete, sliceUpdatedSince } from './pr-search-reuse.js';

const CairnOctokit = Octokit.plugin(throttling, retry, restEndpointMethods);
type CairnOctokit = InstanceType<typeof CairnOctokit>;

const GITHUB_REQUEST_TIMEOUT_MS = 20_000;
const MAX_RATE_LIMIT_RETRY_AFTER_SECONDS = 30;
// PR 커밋 목록을 GraphQL alias 로 묶어 REST listCommits N 콜을 한 요청으로
// commits(first:100) 라 100 초과 PR 은 배치에서 빼고 REST 페이징으로 폴백
const GRAPHQL_PR_BATCH_SIZE = 15;
const GRAPHQL_PR_COMMITS_PAGE = 100;

interface PrCommitRef {
  owner: string;
  repo: string;
  number: number;
}

interface GqlCommitNode {
  commit: {
    oid: string;
    messageHeadline: string;
    authoredDate: string;
    committedDate?: string | null;
    author: { user: { login: string } | null } | null;
    parents: { totalCount: number };
  };
}

interface GqlPrResult {
  pullRequest: {
    commits: { totalCount: number; nodes: GqlCommitNode[] };
  } | null;
}

type GqlBatchResponse = Record<string, GqlPrResult | null>;

interface RawPrCommit {
  shortSha: string;
  subject: string;
  authoredAt: string;
  authorLogin: string | null;
  committedAt: string | null;
  isMerge: boolean;
}

interface PrSearchFetchResult {
  items: SearchPrItem[];
  truncated: boolean;
}

interface PrSearchCacheEntry {
  lowerBoundIso: string;
  promise: Promise<PrSearchFetchResult>;
}

export interface SearchPrItem {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  mergedAt: string | null;
  author: string;
  assignees: readonly string[];
  labels: readonly string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GithubApiClient {
  private readonly octokits = new Map<string, CairnOctokit>();
  private readonly loginCache = new Map<string, Promise<string>>();
  private readonly prCommitsCache = new Map<string, Promise<RawPrCommit[]>>();
  private readonly prSearchCache = new Map<string, PrSearchCacheEntry>();

  constructor(
    @InjectPinoLogger(GithubApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async getAuthenticatedLogin(token: string): Promise<string> {
    const cached = this.loginCache.get(token);
    if (cached) return cached;
    const promise = this.getOctokit(token)
      .rest.users.getAuthenticated()
      .then(({ data }) => data.login);
    this.loginCache.set(token, promise);
    promise.catch(() => this.loginCache.delete(token));
    return promise;
  }

  async searchPrs(token: string, query: string): Promise<SearchPrItem[]> {
    const { items, truncated } = await this.fetchSearchPrs(token, query);
    if (truncated)
      this.logger.warn(
        { query, count: items.length },
        'github pr search truncated at cap — oldest results dropped',
      );
    return items;
  }

  // backfill 전용 — lower bound 만 하루씩 다른 동일 검색을 (token, baseQuery) 단위로 캐시하고
  // 더 넓은 lower bound 결과를 client-side 필터로 재사용 (정당성은 pr-search-reuse.ts)
  async searchPrsUpdatedSince(
    token: string,
    baseQuery: string,
    lowerBoundIso: string,
  ): Promise<SearchPrItem[]> {
    const key = `${token}:${baseQuery}`;
    const cached = this.prSearchCache.get(key);
    if (cached && canReusePrSearch(cached.lowerBoundIso, lowerBoundIso)) {
      const { items, truncated } = await cached.promise;
      const sliced = sliceUpdatedSince(items, lowerBoundIso);
      this.logger.info(
        {
          baseQuery,
          lowerBoundIso,
          cachedLowerBoundIso: cached.lowerBoundIso,
          cachedCount: items.length,
          servedCount: sliced.length,
          sliceComplete: isPrSliceComplete(
            truncated,
            items[items.length - 1]?.updatedAt,
            lowerBoundIso,
          ),
        },
        'github pr search served from cache',
      );
      return sliced;
    }
    // get→set 사이 await 없음 — 동시 호출자가 같은 entry 의 fetch 를 함께 기다림
    const entry: PrSearchCacheEntry = {
      lowerBoundIso,
      promise: this.fetchSearchPrs(token, `${baseQuery} updated:>=${lowerBoundIso}`),
    };
    this.prSearchCache.set(key, entry);
    entry.promise.catch(() => {
      if (this.prSearchCache.get(key) === entry) this.prSearchCache.delete(key);
    });
    const { items, truncated } = await entry.promise;
    if (truncated)
      this.logger.warn(
        { baseQuery, lowerBoundIso, count: items.length },
        'github pr search truncated at cap — oldest results dropped',
      );
    return items;
  }

  private async fetchSearchPrs(token: string, query: string): Promise<PrSearchFetchResult> {
    const octokit = this.getOctokit(token);
    const out: SearchPrItem[] = [];
    // 10 페이지가 모두 가득 차면 GitHub 1000 cap 도달 가능 → truncated 로 보수 처리
    let truncated = true;
    // 백필은 updated 범위가 넓어 첫 100건만 받으면 updated_at 이 밀린 오래된 PR 이 누락됨 —
    // updated desc 로 GitHub 상한(1000)까지 페이징
    for (let page = 1; page <= 10; page += 1) {
      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: `is:pr ${query}`,
        per_page: 100,
        page,
        sort: 'updated',
        order: 'desc',
      });
      for (const item of data.items) {
        const [owner, repo] = parseRepoFromUrl(item.repository_url);
        out.push({
          owner,
          repo,
          number: item.number,
          title: item.title,
          body: typeof item.body === 'string' ? item.body : null,
          state: normalizeState(item.state),
          mergedAt: item.pull_request?.merged_at ?? null,
          author: item.user?.login ?? 'unknown',
          assignees: (item.assignees ?? []).flatMap((a) => (a?.login ? [a.login] : [])),
          labels: item.labels.flatMap((l) =>
            typeof l === 'string' ? [l] : l.name ? [l.name] : [],
          ),
          htmlUrl: item.html_url,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        });
      }
      if (data.items.length < 100) {
        truncated = false;
        break;
      }
    }
    return { items: out, truncated };
  }

  async listPrCommitsInRange(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
    sinceIso: string,
    untilIso: string,
    authorLogin?: string,
  ): Promise<Array<{ shortSha: string; subject: string; authoredAt: string }>> {
    const all = await this.listPrCommitsCached(token, owner, repo, pullNumber);
    // authoredAt 은 커미터 offset 보존 ISO, 윈도우는 Z 정규화 — 문자열 대신 instant 로 비교
    const since = Date.parse(sinceIso);
    const until = Date.parse(untilIso);
    // rebase/cherry-pick 은 author date 가 과거라 committer date 로 폴백, 귀속 시각도 윈도우에 든 쪽 사용
    const inWindow = (iso: string | null): boolean => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return t >= since && t <= until;
    };
    return all
      .filter((c) => {
        if (c.isMerge) return false;
        if (authorLogin && c.authorLogin && c.authorLogin !== authorLogin) return false;
        return inWindow(c.authoredAt) || inWindow(c.committedAt);
      })
      .map(({ shortSha, subject, authoredAt, committedAt }) => ({
        shortSha,
        subject,
        authoredAt: inWindow(authoredAt) ? authoredAt : (committedAt ?? authoredAt),
      }));
  }

  private listPrCommitsCached(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<RawPrCommit[]> {
    const key = `${token}:${owner}/${repo}#${pullNumber}`;
    const cached = this.prCommitsCache.get(key);
    if (cached) return cached;
    const promise = this.fetchAllPrCommits(token, owner, repo, pullNumber);
    this.prCommitsCache.set(key, promise);
    promise.catch(() => this.prCommitsCache.delete(key));
    return promise;
  }

  private async fetchAllPrCommits(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<RawPrCommit[]> {
    const octokit = this.getOctokit(token);
    const out: RawPrCommit[] = [];
    let page = 1;
    const perPage = 100;
    // GitHub 가 commit 순서를 author date 로 보장 안 함 — 전부 받은 뒤 client-side 필터
    while (true) {
      const { data } = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      });
      for (const c of data) {
        const authorDate = c.commit.author?.date;
        if (!authorDate) continue;
        const subjectFull = c.commit.message ?? '';
        out.push({
          shortSha: c.sha.slice(0, 7),
          subject: subjectFull.split('\n')[0]?.trim() ?? '',
          authoredAt: authorDate,
          committedAt: c.commit.committer?.date ?? null,
          authorLogin: c.author?.login ?? null,
          isMerge: c.parents.length > 1,
        });
      }
      if (data.length < perPage) break;
      page += 1;
      if (page > 10) break; // PR 에 1000+ commit 은 비정상 — 무한 페이징 방지
    }
    return out;
  }

  // PR 커밋 목록을 GraphQL alias 배치로 prCommitsCache 에 선적재 — 이후 REST N 콜 제거
  // 배치 실패·100+ 커밋·alias 누락은 선적재 안 해 기존 REST 경로로 폴백
  async primePrCommits(token: string, refs: readonly PrCommitRef[]): Promise<void> {
    const pending = new Map<string, PrCommitRef>();
    for (const ref of refs) {
      const key = `${token}:${ref.owner}/${ref.repo}#${ref.number}`;
      // 이미 캐시(REST in-flight 포함)면 건드리지 않음 — 중복 fetch 방지
      if (!this.prCommitsCache.has(key) && !pending.has(key)) pending.set(key, ref);
    }
    const chunks = [...pending.values()];
    for (let i = 0; i < chunks.length; i += GRAPHQL_PR_BATCH_SIZE) {
      const chunk = chunks.slice(i, i + GRAPHQL_PR_BATCH_SIZE);
      const primed = await this.fetchPrCommitsBatch(token, chunk);
      for (const [ref, commits] of primed) {
        const key = `${token}:${ref.owner}/${ref.repo}#${ref.number}`;
        if (!this.prCommitsCache.has(key)) this.prCommitsCache.set(key, Promise.resolve(commits));
      }
    }
  }

  // 완전 수집된(≤100 커밋) PR 만 반환 — null·100+·에러는 빼서 호출자가 REST 로 폴백
  private async fetchPrCommitsBatch(
    token: string,
    chunk: readonly PrCommitRef[],
  ): Promise<Map<PrCommitRef, RawPrCommit[]>> {
    const out = new Map<PrCommitRef, RawPrCommit[]>();
    if (chunk.length === 0) return out;
    const octokit = this.getOctokit(token);
    const commitFields =
      'commits(first: 100) { totalCount nodes { commit { oid messageHeadline authoredDate committedDate author { user { login } } parents { totalCount } } } }';
    const aliases = chunk
      .map(
        (ref, idx) =>
          `pr${idx}: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(
            ref.repo,
          )}) { pullRequest(number: ${ref.number}) { ${commitFields} } }`,
      )
      .join('\n');
    const gqlQuery = `query {\n${aliases}\n}`;

    let response: GqlBatchResponse;
    try {
      response = await octokit.graphql<GqlBatchResponse>(gqlQuery);
    } catch (err) {
      // GraphQL 부분 에러(일부 repo 접근 불가 등)면 resolved alias 만 살려 쓰고 나머지는 REST 폴백
      const partial = (err as { data?: GqlBatchResponse }).data;
      if (partial && typeof partial === 'object') {
        this.logger.warn(
          { count: chunk.length },
          'pr commits graphql batch partial — using resolved aliases, rest fall back to REST',
        );
        response = partial;
      } else {
        this.logger.warn(
          { count: chunk.length },
          'pr commits graphql batch failed — REST fallback for chunk',
        );
        return out;
      }
    }

    chunk.forEach((ref, idx) => {
      const result = response[`pr${idx}`];
      const commits = result?.pullRequest?.commits;
      // null(repo/PR 접근 불가) 또는 100 초과(첫 페이지로 미완)면 선적재 제외 → REST 폴백
      if (!commits || commits.totalCount > GRAPHQL_PR_COMMITS_PAGE) return;
      try {
        out.set(ref, commits.nodes.map(mapGqlCommit));
      } catch (mapErr) {
        // malformed 응답으로 매핑이 던지면 이 PR 만 선적재 스킵 — chunk·계정 전체가 죽지 않게 격리
        this.logger.warn(
          { owner: ref.owner, repo: ref.repo, number: ref.number, err: String(mapErr) },
          'pr commit node mapping failed — rest fallback for this pr',
        );
      }
    });
    return out;
  }

  private getOctokit(token: string): CairnOctokit {
    const cached = this.octokits.get(token);
    if (cached) return cached;

    const octokit = new CairnOctokit({
      auth: token,
      userAgent: 'cairn',
      request: { timeout: GITHUB_REQUEST_TIMEOUT_MS },
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          const willRetry = shouldRetryRateLimit(retryAfter, retryCount);
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount, willRetry },
            'github primary rate limit hit',
          );
          return willRetry;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          const willRetry = shouldRetryRateLimit(retryAfter, retryCount);
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount, willRetry },
            'github secondary rate limit hit',
          );
          return willRetry;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
    this.octokits.set(token, octokit);
    this.logger.debug('octokit initialized for token');
    return octokit;
  }
}

// 산출 필드는 REST fetchAllPrCommits 와 같아야 함 — shortSha 는 oid 앞 7자, subject 는 headline
// authoredDate 는 원본 오프셋을 보존하지만 필터·histogram 이 Date.parse instant 로 다뤄 동치
function mapGqlCommit(node: GqlCommitNode): RawPrCommit {
  const c = node.commit;
  return {
    shortSha: c.oid.slice(0, 7),
    subject: c.messageHeadline?.trim() ?? '',
    authoredAt: c.authoredDate,
    committedAt: c.committedDate ?? null,
    authorLogin: c.author?.user?.login ?? null,
    isMerge: (c.parents?.totalCount ?? 0) > 1,
  };
}

function shouldRetryRateLimit(retryAfterSeconds: number, retryCount: number): boolean {
  return retryCount < 1 && retryAfterSeconds <= MAX_RATE_LIMIT_RETRY_AFTER_SECONDS;
}

function parseRepoFromUrl(repositoryUrl: string): [string, string] {
  const match = repositoryUrl.match(/\/repos\/([^/]+)\/([^/]+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`unexpected repository_url: ${repositoryUrl}`);
  }
  return [match[1], match[2]];
}

function normalizeState(state: string): 'open' | 'closed' {
  return state === 'open' ? 'open' : 'closed';
}
