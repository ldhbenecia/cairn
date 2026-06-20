import { BrowserWindow, shell } from 'electron';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { CAIRN_ROOT } from './setup';

export const WEB_BASE = process.env.CAIRN_WEB_URL ?? 'https://cairn-web-ruby.vercel.app';
const AUTH_PATH = join(CAIRN_ROOT, 'auth.json');

export type CloudUser = { name: string; email: string; image: string | null };
export type CloudAuthState = { signedIn: boolean; user: CloudUser | null };
type Stored = { token: string; user: CloudUser };

function readStored(): Stored | null {
  try {
    return JSON.parse(readFileSync(AUTH_PATH, 'utf8')) as Stored;
  } catch {
    return null;
  }
}

export function cloudAuthState(): CloudAuthState {
  const s = readStored();
  return s ? { signedIn: true, user: s.user } : { signedIn: false, user: null };
}

export function cloudToken(): string | null {
  return readStored()?.token ?? null;
}

function broadcastAuth(): void {
  const state = cloudAuthState();
  for (const win of BrowserWindow.getAllWindows())
    win.webContents.send('cairn:auth:changed', state);
}

const DONE_HTML = `<!doctype html><meta charset="utf-8"><title>cairn</title><body style="margin:0;display:flex;height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif"><div style="text-align:center"><p style="font-size:15px;font-weight:600">로그인 완료</p><p style="font-size:13px;color:#a3a3a3">이제 cairn 앱으로 돌아가세요.</p></div><script>setTimeout(()=>window.close(),1200)</script></body>`;

let server: Server | null = null;

function stopServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}

export function startCloudSignIn(): void {
  stopServer();
  const current = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const ott = url.searchParams.get('token');
    // favicon 등 토큰 없는 부가 요청은 무시 — 세션을 닫지 않는다.
    if (!ott) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(DONE_HTML);
    void completeSignIn(ott);
    current.close();
    if (server === current) server = null;
  });
  server = current;
  current.listen(0, '127.0.0.1', () => {
    const addr = current.address();
    const port = addr && typeof addr === 'object' ? addr.port : 0;
    void shell.openExternal(`${WEB_BASE}/desktop-login?port=${port}`);
  });
}

async function completeSignIn(ott: string): Promise<void> {
  try {
    const verify = await fetch(`${WEB_BASE}/api/auth/one-time-token/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: ott }),
    });
    const token = verify.headers.get('set-auth-token');
    if (!token) return;
    const sess = await fetch(`${WEB_BASE}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await sess.json()) as {
      user?: { name?: string; email?: string; image?: string | null };
    };
    const u = data.user;
    if (!u?.email) return;
    mkdirSync(dirname(AUTH_PATH), { recursive: true });
    writeFileSync(
      AUTH_PATH,
      `${JSON.stringify({ token, user: { name: u.name ?? u.email, email: u.email, image: u.image ?? null } }, null, 2)}\n`,
    );
    chmodSync(AUTH_PATH, 0o600); // bearer 토큰 보호
    broadcastAuth();
    const win = BrowserWindow.getAllWindows()[0];
    win?.show();
    win?.focus();
  } catch {
    // 실패 시 상태 유지
  }
}

export async function cloudSignOut(): Promise<void> {
  const token = cloudToken();
  if (token) {
    try {
      await fetch(`${WEB_BASE}/api/auth/sign-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // 서버 실패해도 로컬 토큰은 지운다
    }
  }
  rmSync(AUTH_PATH, { force: true });
  broadcastAuth();
}
