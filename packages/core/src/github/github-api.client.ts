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
// PR 커밋 목록을 GraphQL alias 로 배치 — REST pulls.listCommits N 콜을 한 요청으로.
// commits(first:100) 이므로 100 초과 PR 은 배치에서 제외하고 REST 페이징으로 폴백
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
    const { items } = await this.fetchSearchPrs(token, query);
    return items;
  }

  // backfill 전용: `updated:>=lowerBound` 검색을 (token, baseQuery) 단위로 캐시.
  // 날짜별 backfill 은 lower bound 만 하루씩 다른 동일 검색을 반복하므로,
  // 더 넓은(과거) lower bound 로 받아둔 결과를 client-side 필터로 재사용 (정당성: pr-search-reuse.ts)
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
    // get→set 사이 await 없음 — 동시 호출자는 같은 entry 를 보고 같은 fetch 를 기다린다
    const entry: PrSearchCacheEntry = {
      lowerBoundIso,
      promise: this.fetchSearchPrs(token, `${baseQuery} updated:>=${lowerBoundIso}`),
    };
    this.prSearchCache.set(key, entry);
    entry.promise.catch(() => {
      if (this.prSearchCache.get(key) === entry) this.prSearchCache.delete(key);
    });
    const { items } = await entry.promise;
    return items;
  }

  private async fetchSearchPrs(token: string, query: string): Promise<PrSearchFetchResult> {
    const octokit = this.getOctokit(token);
    const out: SearchPrItem[] = [];
    // 10 페이지 모두 가득 차면 GitHub 1000 cap 도달 가능성 → truncated 로 보수적 처리
    let truncated = true;
    // 페이징 필수: 백필은 넓은 updated 범위라 첫 100건만 받으면 오래된 PR(2월 작성→3월 머지 등
    // updated_at 밀린 케이스)이 잘려 누락 — updated desc 로 결정적, GitHub 상한(1000)까지
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
    // authoredAt 은 커미터 offset 을 보존한 ISO(예: +09:00), sinceIso/untilIso 는 Z 정규화 윈도우.
    // 사전식 문자열 비교는 offset 차이로 어긋나므로 instant(Date.parse) 로 비교한다.
    const since = Date.parse(sinceIso);
    const until = Date.parse(untilIso);
    return all
      .filter((c) => {
        if (c.isMerge) return false;
        if (authorLogin && c.authorLogin && c.authorLogin !== authorLogin) return false;
        const t = Date.parse(c.authoredAt);
        return t >= since && t <= until;
      })
      .map(({ shortSha, subject, authoredAt }) => ({ shortSha, subject, authoredAt }));
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
    // GitHub 가 commit 순서를 author date 로 보장 X — 모두 가져온 뒤 client-side 필터
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
          authorLogin: c.author?.login ?? null,
          isMerge: c.parents.length > 1,
        });
      }
      if (data.length < perPage) break;
      page += 1;
      if (page > 10) break; // 안전 가드 (PR 에 1000+ commit 은 비정상)
    }
    return out;
  }

  // PR 커밋 목록을 GraphQL alias 배치로 미리 받아 prCommitsCache 에 선적재한다.
  // listPrCommitsInRange 가 이후 캐시에서 바로 꺼내 REST N 콜을 없앤다.
  // 배치 실패·PR 100+ 커밋·alias 누락은 선적재하지 않아 기존 REST 경로로 폴백된다.
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

  // 한 chunk(≤15 PR)를 GraphQL alias 한 요청으로. 완전 수집된(≤100 커밋) PR 만 반환,
  // 나머지(null·100+·에러)는 제외해 호출자가 REST 로 폴백하게 한다.
  private async fetchPrCommitsBatch(
    token: string,
    chunk: readonly PrCommitRef[],
  ): Promise<Map<PrCommitRef, RawPrCommit[]>> {
    const out = new Map<PrCommitRef, RawPrCommit[]>();
    if (chunk.length === 0) return out;
    const octokit = this.getOctokit(token);
    const commitFields =
      'commits(first: 100) { totalCount nodes { commit { oid messageHeadline authoredDate author { user { login } } parents { totalCount } } } }';
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
      out.set(ref, commits.nodes.map(mapGqlCommit));
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

// GraphQL 커밋 노드 → RawPrCommit. 산출 필드는 REST fetchAllPrCommits 와 동일:
// shortSha 는 oid 앞 7자(REST sha.slice(0,7) 와 동일), subject 는 headline(첫 줄),
// authoredAt 은 authoredDate(UTC Z — 필터·histogram 모두 instant 기반이라 offset 형과 동치),
// isMerge 는 parents.totalCount > 1
function mapGqlCommit(node: GqlCommitNode): RawPrCommit {
  const c = node.commit;
  return {
    shortSha: c.oid.slice(0, 7),
    subject: c.messageHeadline?.trim() ?? '',
    authoredAt: c.authoredDate,
    authorLogin: c.author?.user?.login ?? null,
    isMerge: c.parents.totalCount > 1,
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
