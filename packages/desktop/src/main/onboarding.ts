import { Client } from '@notionhq/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG_PATH, ENV_PATH } from './setup';

export type NotionProbe = {
  ok: boolean;
  persons: { id: string; name: string }[];
  error?: string;
};
export type NotionPage = { id: string; title: string };
export type GithubProbe = { ok: boolean; login?: string; error?: string };

export type OnboardingPayload = {
  notion: { label: string; token: string; pageId: string; myUserId: string }[];
  github: { label: string; token: string }[];
  anthropicApiKey?: string;
  localGitRepos: string[];
};

export function envKey(prefix: string, label: string): string {
  const norm = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${norm || 'DEFAULT'}`;
}

export async function probeNotion(token: string): Promise<NotionProbe> {
  try {
    const notion = new Client({ auth: token });
    const res = await notion.users.list({ page_size: 100 });
    const persons = res.results
      .filter((u) => u.type === 'person')
      .map((u) => ({ id: u.id, name: u.name ?? '(unnamed)' }));
    return { ok: true, persons };
  } catch (err) {
    return { ok: false, persons: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchNotionPages(token: string): Promise<NotionPage[]> {
  const notion = new Client({ auth: token });
  const res = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 50,
  });
  const pages: NotionPage[] = [];
  for (const item of res.results) {
    if (!('properties' in item)) continue;
    const props = (item as { properties: Record<string, unknown> }).properties;
    let title = '(제목 없음)';
    for (const v of Object.values(props)) {
      const p = v as { type?: string; title?: { plain_text?: string }[] };
      if (p.type === 'title' && p.title) {
        title = p.title.map((t) => t.plain_text ?? '').join('') || title;
        break;
      }
    }
    pages.push({ id: (item as { id: string }).id, title });
  }
  return pages;
}

export async function probeGithub(token: string): Promise<GithubProbe> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'cairn' },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = (await res.json()) as { login?: string };
    return { ok: true, login: body.login };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// .env 라인 보존 병합 — 기존 주석/순서 유지, 키 있으면 교체, 없으면 끝에 추가
function writeEnvMerged(patch: Record<string, string>): void {
  let lines: string[];
  try {
    lines = readFileSync(ENV_PATH, 'utf8').split('\n');
  } catch {
    lines = [];
  }
  const remaining = { ...patch };
  const out = lines.map((line) => {
    const eq = line.indexOf('=');
    if (eq < 0 || line.trim().startsWith('#')) return line;
    const key = line.slice(0, eq).trim();
    if (key in remaining) {
      const v = remaining[key]!;
      delete remaining[key];
      return `${key}=${v}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(remaining)) out.push(`${k}=${v}`);
  mkdirSync(dirname(ENV_PATH), { recursive: true });
  writeFileSync(ENV_PATH, out.join('\n').replace(/\n+$/, '') + '\n');
}

type ExistingWs = {
  worklog?: { pageId?: string; databaseId?: string; dataSourceId?: string };
  rollup?: unknown;
};

export function finishOnboarding(payload: OnboardingPayload): { ok: boolean; error?: string } {
  try {
    // 기존 config 먼저 읽기 — 같은 부모 페이지면 자동 생성된 DB id 보존(재실행 시 DB 연결 유지)
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>;
    } catch {
      existing = {};
    }
    const prevWorkspaces = (existing.notionWorkspaces as ExistingWs[] | undefined) ?? [];

    const env: Record<string, string> = {};
    const notionWorkspaces = payload.notion.map((w) => {
      const tokenEnv = envKey('NOTION_TOKEN', w.label);
      env[tokenEnv] = w.token;
      const prev = prevWorkspaces.find((p) => p.worklog?.pageId === w.pageId);
      const worklog: { pageId: string; databaseId?: string; dataSourceId?: string } = {
        pageId: w.pageId,
      };
      if (prev?.worklog?.databaseId) worklog.databaseId = prev.worklog.databaseId;
      if (prev?.worklog?.dataSourceId) worklog.dataSourceId = prev.worklog.dataSourceId;
      const ws: Record<string, unknown> = {
        label: w.label,
        tokenEnv,
        myUserId: w.myUserId,
        worklog,
      };
      if (prev?.rollup) ws.rollup = prev.rollup;
      return ws;
    });
    const githubAccounts = payload.github.map((g) => {
      const tokenEnv = envKey('GITHUB_TOKEN', g.label);
      env[tokenEnv] = g.token;
      return { label: g.label, tokenEnv };
    });
    if (payload.anthropicApiKey?.trim()) env.ANTHROPIC_API_KEY = payload.anthropicApiKey.trim();

    writeEnvMerged(env);

    const config = {
      ...existing,
      localGitRepos: payload.localGitRepos,
      githubAccounts,
      notionWorkspaces,
    };
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
