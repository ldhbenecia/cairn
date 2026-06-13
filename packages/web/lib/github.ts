export const REPO = 'ldhbenecia/cairn';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_LATEST = `${REPO_URL}/releases/latest`;

type RepoStats = { stars: number; latestTag: string | null; dmgUrl: string | null };

// 서버 컴포넌트에서 호출 — 1시간 ISR 캐시. 실패해도 사이트는 정상 렌더.
export async function getRepoStats(): Promise<RepoStats> {
  const fallback: RepoStats = { stars: 0, latestTag: null, dmgUrl: null };
  try {
    const [repoRes, relRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}`, { next: { revalidate: 3600 } }),
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { next: { revalidate: 3600 } }),
    ]);
    const stars = repoRes.ok
      ? (((await repoRes.json()) as { stargazers_count?: number }).stargazers_count ?? 0)
      : 0;
    let latestTag: string | null = null;
    let dmgUrl: string | null = null;
    if (relRes.ok) {
      const rel = (await relRes.json()) as {
        tag_name?: string;
        assets?: { name: string; browser_download_url: string }[];
      };
      latestTag = rel.tag_name ?? null;
      dmgUrl = rel.assets?.find((a) => a.name.endsWith('.dmg'))?.browser_download_url ?? null;
    }
    return { stars, latestTag, dmgUrl };
  } catch {
    return fallback;
  }
}
