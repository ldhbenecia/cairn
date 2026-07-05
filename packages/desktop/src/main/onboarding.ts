import { Client } from '@notionhq/client';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { errorMessage } from './error-message';
import { writeFileAtomic } from './atomic-write';
import { withFileLock } from './file-lock';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { findInPath, searchPathEnv } from './claude-path';
import { CONFIG_PATH, ENV_PATH, readEnvFile } from './setup';

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

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isDbRef = (v: unknown): v is DbRef =>
  typeof v === 'object' &&
  v !== null &&
  isStr((v as Record<string, unknown>).databaseId) &&
  isStr((v as Record<string, unknown>).dataSourceId);

export type NotionWorkspacePayload = OnboardingPayload['notion'][number];

// 렌더러 IPC 입력은 신뢰 불가 — env/config 에 그대로 쓰기 전에 shape 검증.
export function parseNotionWorkspacePayload(
  w: unknown,
): { ok: true; entry: NotionWorkspacePayload } | { ok: false; error: string } {
  if (typeof w !== 'object' || w === null) return { ok: false, error: 'invalid-notion' };
  const n = w as Record<string, unknown>;
  if (!isStr(n.label) || !isStr(n.token) || !isStr(n.pageId) || !isStr(n.myUserId)) {
    return { ok: false, error: 'invalid-notion' };
  }
  if (n.worklogDb !== undefined && !isDbRef(n.worklogDb)) return { ok: false, error: 'invalid-db' };
  if (n.rollupDb !== undefined && !isDbRef(n.rollupDb)) return { ok: false, error: 'invalid-db' };
  return {
    ok: true,
    entry: {
      label: n.label,
      token: n.token,
      pageId: n.pageId,
      myUserId: n.myUserId,
      ...(n.worklogDb ? { worklogDb: n.worklogDb } : {}),
      ...(n.rollupDb ? { rollupDb: n.rollupDb } : {}),
    },
  };
}

export function parseOnboardingPayload(
  raw: unknown,
): { ok: true; payload: OnboardingPayload } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'invalid-payload' };
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.notion) || !Array.isArray(o.github) || !Array.isArray(o.localGitRepos)) {
    return { ok: false, error: 'invalid-payload-shape' };
  }

  const notion: OnboardingPayload['notion'] = [];
  for (const w of o.notion) {
    const parsed = parseNotionWorkspacePayload(w);
    if (!parsed.ok) return parsed;
    notion.push(parsed.entry);
  }

  const github: OnboardingPayload['github'] = [];
  for (const g of o.github) {
    const gg = g as Record<string, unknown>;
    if (typeof g !== 'object' || g === null || !isStr(gg.label) || !isStr(gg.token)) {
      return { ok: false, error: 'invalid-github' };
    }
    github.push({ label: gg.label, token: gg.token });
  }

  if (!o.localGitRepos.every((r) => isStr(r))) {
    return { ok: false, error: 'invalid-local-repos' };
  }
  if (o.anthropicApiKey !== undefined && typeof o.anthropicApiKey !== 'string') {
    return { ok: false, error: 'invalid-anthropic-key' };
  }

  return {
    ok: true,
    payload: {
      notion,
      github,
      localGitRepos: o.localGitRepos,
      ...(typeof o.anthropicApiKey === 'string' ? { anthropicApiKey: o.anthropicApiKey } : {}),
    },
  };
}

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
    return { ok: false, persons: [], error: errorMessage(err) };
  }
}

export async function searchNotionPages(token: string, query?: string): Promise<NotionPage[]> {
  const notion = new Client({ auth: token });
  const res = await notion.search({
    query: query?.trim() || undefined,
    filter: { property: 'object', value: 'page' },
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
    page_size: 25,
  });
  const pages: NotionPage[] = [];
  for (const item of res.results) {
    if (!('properties' in item)) continue;
    // 연결한 최상위 페이지만 — 그 하위/관련 페이지는 제외
    if ((item as { parent?: { type?: string } }).parent?.type !== 'workspace') continue;
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

export type GhCliAccounts = {
  ok: boolean;
  accounts?: { login: string; token: string }[];
  error?: string;
};

// async execFile 로 메인 스레드 블로킹 회피. gh 에 로그인된 모든 계정의 토큰을 가져온다.
export async function githubAccountsFromGhCli(): Promise<GhCliAccounts> {
  const exe = process.platform === 'win32' ? 'gh.exe' : 'gh';
  const gh = findInPath(exe);
  if (!gh) return { ok: false, error: 'gh-not-found' };
  const env = { ...process.env, PATH: searchPathEnv() };

  let logins: string[];
  try {
    const { stdout, stderr } = await execFileAsync(
      gh,
      ['auth', 'status', '--hostname', 'github.com'],
      { encoding: 'utf8', timeout: 5000, env },
    );
    logins = [...new Set([...`${stdout}\n${stderr}`.matchAll(/account (\S+)/g)].map((m) => m[1]!))];
  } catch {
    return { ok: false, error: 'gh-not-authed' };
  }
  if (logins.length === 0) return { ok: false, error: 'gh-not-authed' };

  const accounts: { login: string; token: string }[] = [];
  for (const login of logins) {
    try {
      const { stdout } = await execFileAsync(
        gh,
        ['auth', 'token', '--hostname', 'github.com', '--user', login],
        { encoding: 'utf8', timeout: 5000, env },
      );
      const token = stdout.trim();
      if (token) accounts.push({ login, token });
    } catch {
      // 해당 계정 토큰 못 가져오면 skip
    }
  }
  if (accounts.length === 0) return { ok: false, error: 'gh-not-authed' };
  return { ok: true, accounts };
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
    return { ok: false, error: errorMessage(err) };
  }
}

export type ConnectionAccounts = {
  github: { label: string; login?: string }[];
  notion: { label: string; workspace?: string }[];
};

const PROBE_TIMEOUT_MS = 6000;

// 단일 느린 네트워크 호출이 연결 탭 응답 전체를 붙잡지 않도록 — 타임아웃 시 fallback 반환
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

async function notionWorkspaceName(token: string): Promise<string | undefined> {
  const me = (await new Client({ auth: token }).users.me({})) as {
    name?: string;
    bot?: { workspace_name?: string };
  };
  return me.bot?.workspace_name ?? me.name ?? undefined;
}

type ConnConfig = {
  githubAccounts?: { label: string; tokenEnv: string }[];
  notionWorkspaces?: { label: string; tokenEnv?: string }[];
};

// 연결 탭용: config + .env 토큰으로 각 계정 식별자만 조회. 토큰은 renderer 로 내보내지 않는다.
export async function probeConnectionAccounts(): Promise<ConnectionAccounts> {
  let config: ConnConfig;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as ConnConfig;
  } catch {
    config = {};
  }
  const envMap = readEnvFile();
  // GitHub·Notion probe 를 동시에 — 순차 대기하면 연결 탭 최악 지연이 2배
  const [github, notion] = await Promise.all([
    Promise.all(
      (config.githubAccounts ?? []).map(async (g) => {
        const token = envMap[g.tokenEnv];
        if (!token) return { label: g.label };
        try {
          const probe = await withTimeout(probeGithub(token), PROBE_TIMEOUT_MS, { ok: false });
          return probe.ok ? { label: g.label, login: probe.login } : { label: g.label };
        } catch {
          return { label: g.label };
        }
      }),
    ),
    Promise.all(
      (config.notionWorkspaces ?? []).map(async (w) => {
        const token = envMap[w.tokenEnv ?? envKey('NOTION_TOKEN', w.label)];
        if (!token) return { label: w.label };
        try {
          const workspace = await withTimeout(
            notionWorkspaceName(token),
            PROBE_TIMEOUT_MS,
            undefined,
          );
          return { label: w.label, workspace };
        } catch {
          return { label: w.label };
        }
      }),
    ),
  ]);
  return { github, notion };
}

// 기존 .env 의 주석/순서를 유지한 채 키만 교체·추가
function writeEnvMerged(patch: Record<string, string>): void {
  let lines: string[];
  try {
    lines = readFileSync(ENV_PATH, 'utf8').split('\n');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
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
  writeFileAtomic(ENV_PATH, out.join('\n').replace(/\n+$/, '') + '\n', 0o600); // 토큰 포함 — owner-only
}

type ExistingWs = {
  label?: string;
  worklog?: { pageId?: string; databaseId?: string; dataSourceId?: string };
  rollup?: unknown;
};

function buildNotionWorkspace(
  w: NotionWorkspacePayload,
  prevWorkspaces: ExistingWs[],
  env: Record<string, string>,
): Record<string, unknown> {
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
}

export function finishOnboarding(payload: OnboardingPayload): { ok: boolean; error?: string } {
  try {
    // 재실행 시 자동 생성된 DB id 보존을 위해 기존 config 를 먼저 읽음.
    // core(worklog-config) 가 첫 발행 후 같은 파일에 DB id 를 자동저장하므로 동일 락으로 직렬화.
    return withFileLock(CONFIG_PATH, () => {
      let existing: Record<string, unknown>;
      try {
        existing = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>;
      } catch {
        existing = {};
      }
      const prevWorkspaces = (existing.notionWorkspaces as ExistingWs[] | undefined) ?? [];

      const env: Record<string, string> = {};
      // 온보딩은 더 이상 노션을 다루지 않음 — 빈 배열이면 Preferences 에서 연결한 기존 워크스페이스 보존
      const notionWorkspaces = payload.notion.length
        ? payload.notion.map((w) => buildNotionWorkspace(w, prevWorkspaces, env))
        : prevWorkspaces;
      const githubAccounts = payload.github.map((g) => {
        const tokenEnv = envKey('GITHUB_TOKEN', g.label);
        env[tokenEnv] = g.token;
        return { label: g.label, tokenEnv };
      });
      if (payload.anthropicApiKey?.trim()) env.ANTHROPIC_API_KEY = payload.anthropicApiKey.trim();

      writeEnvMerged(env);
      for (const [k, v] of Object.entries(env)) process.env[k] = v;

      const config = {
        ...existing,
        localGitRepos: payload.localGitRepos,
        githubAccounts,
        notionWorkspaces,
      };
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      writeFileAtomic(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
      return { ok: true };
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
