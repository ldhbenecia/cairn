import { Client } from '@notionhq/client';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { findInPath, searchPathEnv } from './claude-path';
import { CONFIG_PATH, ENV_PATH } from './setup';

const execFileAsync = promisify(execFile);

export type NotionProbe = {
  ok: boolean;
  persons: { id: string; name: string }[];
  error?: string;
};
export type NotionPage = { id: string; title: string };
export type NotionDb = { databaseId: string; dataSourceId: string; title: string };
export type GithubProbe = { ok: boolean; login?: string; error?: string };

export type DbRef = { databaseId: string; dataSourceId: string };
export type OnboardingPayload = {
  notion: {
    label: string;
    token: string;
    pageId: string;
    myUserId: string;
    worklogDb?: DbRef;
    rollupDb?: DbRef;
  }[];
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

export async function searchNotionPages(token: string, query?: string): Promise<NotionPage[]> {
  const notion = new Client({ auth: token });
  const res = await notion.search({
    query: query?.trim() || undefined,
    filter: { property: 'object', value: 'page' },
    page_size: 25,
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

export async function listNotionDatabases(token: string, pageId: string): Promise<NotionDb[]> {
  const notion = new Client({ auth: token });
  const children = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  const out: NotionDb[] = [];
  for (const b of children.results) {
    const block = b as { id?: string; type?: string; child_database?: { title?: string } };
    if (block.type !== 'child_database' || !block.id) continue;
    try {
      const db = (await notion.databases.retrieve({ database_id: block.id })) as {
        data_sources?: { id?: string }[];
      };
      const dataSourceId = db.data_sources?.[0]?.id;
      if (dataSourceId) {
        out.push({
          databaseId: block.id,
          dataSourceId,
          title: block.child_database?.title || '(제목 없음)',
        });
      }
    } catch {
      // 접근 불가 DB skip
    }
  }
  return out;
}

export type GhCliToken = { ok: boolean; token?: string; login?: string; error?: string };

// 설치된 gh CLI 의 인증을 재사용 — 수동 PAT 생성 없이 토큰 가져오기(Claude Code 재사용과 같은 패턴).
// async execFile 로 메인 스레드 블로킹 회피(gh 호출이 합산 최대 13초 걸릴 수 있음).
export async function githubTokenFromGhCli(): Promise<GhCliToken> {
  const exe = process.platform === 'win32' ? 'gh.exe' : 'gh';
  const gh = findInPath(exe);
  if (!gh) return { ok: false, error: 'gh-not-found' };
  const env = { ...process.env, PATH: searchPathEnv() };
  let token: string;
  try {
    const { stdout } = await execFileAsync(gh, ['auth', 'token'], {
      encoding: 'utf8',
      timeout: 5000,
      env,
    });
    token = stdout.trim();
  } catch {
    return { ok: false, error: 'gh-not-authed' };
  }
  if (!token) return { ok: false, error: 'gh-not-authed' };
  let login: string | undefined;
  try {
    const { stdout } = await execFileAsync(gh, ['api', 'user', '--jq', '.login'], {
      encoding: 'utf8',
      timeout: 8000,
      env,
    });
    login = stdout.trim();
  } catch {
    // 토큰은 받았으니 login 못 가져와도 진행(probe 단계에서 검증).
  }
  return { ok: true, token, login: login || undefined };
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

// 기존 .env 의 주석/순서를 유지한 채 키만 교체·추가.
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
    // 재실행 시 자동 생성된 DB id 보존을 위해 기존 config 를 먼저 읽는다.
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
      // 우선순위: 사용자가 고른 기존 DB > 기존 config 보존 > pageId 만(첫 발행 시 자동 생성)
      const worklog: { pageId: string; databaseId?: string; dataSourceId?: string } = {
        pageId: w.pageId,
      };
      if (w.worklogDb) {
        worklog.databaseId = w.worklogDb.databaseId;
        worklog.dataSourceId = w.worklogDb.dataSourceId;
      } else if (prev?.worklog) {
        if (prev.worklog.databaseId) worklog.databaseId = prev.worklog.databaseId;
        if (prev.worklog.dataSourceId) worklog.dataSourceId = prev.worklog.dataSourceId;
      }
      const ws: Record<string, unknown> = {
        label: w.label,
        tokenEnv,
        myUserId: w.myUserId,
        worklog,
      };
      if (w.rollupDb)
        ws.rollup = { databaseId: w.rollupDb.databaseId, dataSourceId: w.rollupDb.dataSourceId };
      else if (prev?.rollup) ws.rollup = prev.rollup;
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
