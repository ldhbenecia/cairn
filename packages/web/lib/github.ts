import { unstable_cache } from 'next/cache';

export const REPO = 'ldhbenecia/cairn';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_LATEST = `${REPO_URL}/releases/latest`;

type RepoStats = { stars: number; latestTag: string | null };

export const getRepoStats = unstable_cache(
  async (): Promise<RepoStats> => {
    const fallback: RepoStats = { stars: 0, latestTag: null };
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
