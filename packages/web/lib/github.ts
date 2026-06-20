export const REPO = 'ldhbenecia/cairn';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_LATEST = `${REPO_URL}/releases/latest`;

type RepoStats = { stars: number; latestTag: string | null };

// 서버 컴포넌트에서 호출 — 1시간 ISR 캐시, 실패해도 사이트 정상 렌더
export async function getRepoStats(): Promise<RepoStats> {
  const fallback: RepoStats = { stars: 0, latestTag: null };
  try {
    const [repoRes, relRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}`, { next: { revalidate: 3600 } }),
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { next: { revalidate: 3600 } }),
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
