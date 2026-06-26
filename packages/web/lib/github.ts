export const REPO = 'ldhbenecia/cairn';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_LATEST = `${REPO_URL}/releases/latest`;

type RepoStats = { stars: number; latestTag: string | null };

// 서버 컴포넌트에서 호출 — 1시간 ISR 캐시, 실패해도 사이트 정상 렌더
export async function getRepoStats(): Promise<RepoStats> {
  const fallback: RepoStats = { stars: 0, latestTag: null };
  // 토큰 없으면 미인증 60 req/hr/IP 공유(Vercel serverless 공유 IP) — 부하 시 간헐 403 → fallback(stars 0).
  // GITHUB_TOKEN(read-only) 있으면 사용해 한도를 올린다. ISR(1h)이 호출 빈도를 낮춰 평소엔 충분.
  const ghHeaders: HeadersInit | undefined = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : undefined;
  try {
    const [repoRes, relRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}`, {
        headers: ghHeaders,
        next: { revalidate: 3600 },
      }),
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: ghHeaders,
        next: { revalidate: 3600 },
      }),
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
}
