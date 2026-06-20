import { BrowserWindow } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { cloudToken, WEB_BASE } from './cloud-auth';

// core WorklogStatsService 와 같은 파일·포맷(`${category}:${date}` → 집계 수치). ADR 0027/0029.
const STATS_PATH = join(homedir(), '.cairn', 'worklog-stats.json');
const CATEGORIES = new Set(['daily', 'weekly', 'monthly']);
const BATCH = 1000;

type Stat = { pr: number; commit: number; hours?: number[]; updatedAt?: string };
type StatsFile = Record<string, Stat>;
type RemoteRow = {
  category: string;
  date: string;
  pr: number;
  commitCount: number;
  hours: number[];
  updatedAt: string;
};

function readLocal(): StatsFile {
  try {
    return JSON.parse(readFileSync(STATS_PATH, 'utf8')) as StatsFile;
  } catch {
    return {};
  }
}

function writeLocal(f: StatsFile): void {
  mkdirSync(dirname(STATS_PATH), { recursive: true });
  writeFileSync(STATS_PATH, JSON.stringify(f), 'utf8');
}

// updatedAt 없으면 worklog 날짜를 보수적 기준으로(같은 날 충돌 first-wins).
// 날짜는 로컬 경계 기준이라 로컬 자정으로 파싱(UTC 단정 금지 — 타임존 규칙).
function tsOf(s: Stat, date: string): number {
  if (s.updatedAt) return Date.parse(s.updatedAt);
  const [y, m, d] = date.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).getTime() : 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMEOUT_MS = 15000;

let running = false;

export async function syncStats(): Promise<void> {
  const token = cloudToken();
  if (!token || running) return;
  running = true;
  try {
    const local = readLocal();

    const pull = await fetch(`${WEB_BASE}/api/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!pull.ok) return;
    const body = (await pull.json()) as { stats?: RemoteRow[] };
    const stats = body?.stats;
    if (!Array.isArray(stats)) return;

    let changed = false;
    for (const r of stats) {
      // 우리 API 가 검증해 저장한 데이터지만, 로컬 파일 오염 방지로 한 번 더 가드.
      if (!r || !CATEGORIES.has(r.category) || !DATE_RE.test(r.date)) continue;
      const key = `${r.category}:${r.date}`;
      const cur = local[key];
      if (!cur || (Date.parse(r.updatedAt) || 0) > tsOf(cur, r.date)) {
        local[key] = { pr: r.pr, commit: r.commitCount, hours: r.hours, updatedAt: r.updatedAt };
        changed = true;
      }
    }
    if (changed) {
      writeLocal(local);
      for (const win of BrowserWindow.getAllWindows()) win.webContents.send('cairn:stats:synced');
    }

    const rows = Object.entries(local)
      .map(([key, s]) => {
        const idx = key.indexOf(':');
        const category = key.slice(0, idx);
        const date = key.slice(idx + 1);
        return {
          category,
          date,
          pr: s.pr,
          commitCount: s.commit,
          hours: s.hours ?? [],
          updatedAt: s.updatedAt ?? new Date(tsOf(s, date)).toISOString(),
        };
      })
      .filter((r) => CATEGORIES.has(r.category) && DATE_RE.test(r.date));

    for (let i = 0; i < rows.length; i += BATCH) {
      const push = await fetch(`${WEB_BASE}/api/stats`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stats: rows.slice(i, i + BATCH) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!push.ok) break;
    }
  } catch {
    // best-effort — 동기화 실패가 앱을 막지 않는다.
  } finally {
    running = false;
  }
}
