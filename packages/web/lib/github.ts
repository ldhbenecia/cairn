import { unstable_cache } from 'next/cache';

export const REPO = 'ldhbenecia/cairn';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_LATEST = `${REPO_URL}/releases/latest`;

type RepoStats = { stars: number; latestTag: string | null };

// 서버 컴포넌트에서 호출. Authorization 헤더가 붙으면 Next 의 fetch 캐시가 비활성화되고(보안 기본값),
// 루트 레이아웃이 동적 렌더라 매 요청 호출됨 → unstable_cache 로 함수 결과 자체를 1h 캐시(토큰 한도 보호).
// 실패해도 사이트 정상 렌더(fallback).
export const getRepoStats = unstable_cache(
  async (): Promise<RepoStats> => {
    const fallback: RepoStats = { stars: 0, latestTag: null };
    // GITHUB_TOKEN(read-only) 있으면 미인증 60 req/hr/IP 한도를 올림
    const ghHeaders: HeadersInit | undefined = process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : undefined;
    try {
      const [repoRes, relRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders }),
        fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: ghHeaders }),
      ]);
      const stars = repoRes.ok
        ? (((await repoRes.json()) as { stargazers_count?: number }).stargazers_count ?? 0)
        : 0;
      let latestTag: string | null = null;
      if (relRes.ok) {
        latestTag = ((await relRes.json()) as { tag_name?: string }).tag_name ?? null;
      }
      return { stars, latestTag };
    } catch {
      return fallback;
    }
  },
  ['github-repo-stats'],
  { revalidate: 3600 },
);
