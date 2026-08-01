import { BrowserWindow, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { writeFileAtomic } from './atomic-write';
import { isEncryptedPayload } from './secret-crypto';
import { decryptFromStore, encryptForStore } from './secret-store';
import { createServer, type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { CAIRN_ROOT } from './setup';

export const WEB_BASE = process.env.CAIRN_WEB_URL ?? 'https://cairnlog.cloud';
const AUTH_PATH = join(CAIRN_ROOT, 'auth.json');

export type CloudUser = { name: string; email: string; image: string | null };
export type CloudAuthState = { signedIn: boolean; user: CloudUser | null };
type Stored = { token: string; user: CloudUser };

// bearer 토큰 at-rest 암호화 (ADR 0037) — packaged 는 키체인 키로 암호문 저장, 실패/레거시는
// 평문 폴백. 레거시 평문을 읽으면 다음 기회에 암호문으로 재저장(기회적 마이그레이션)
function writeStored(stored: Stored): void {
  mkdirSync(dirname(AUTH_PATH), { recursive: true });
  const enc = encryptForStore(stored);
  writeFileAtomic(AUTH_PATH, enc ?? `${JSON.stringify(stored, null, 2)}\n`, 0o600);
}

function readStored(): Stored | null {
  let text: string;
  try {
    text = readFileSync(AUTH_PATH, 'utf8');
  } catch {
    return null;
  }
  if (isEncryptedPayload(text)) return decryptFromStore<Stored>(text);
  try {
    const legacy = JSON.parse(text) as Stored;
    if (!legacy?.token) return null;
    // 재암호화 실패(키체인 접근 등)가 로그인 상태를 무효화하지 않게 격리 — 평문 인증은 계속 유효
    try {
      if (encryptForStore(legacy)) writeStored(legacy); // 평문 → 암호문 이관
    } catch {
      /* 이관 실패 — 기존 평문 인증 유지 */
    }
    return legacy;
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
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send('cairn:auth:changed', state);
  }
}

const DONE_HTML = `<!doctype html><meta charset="utf-8"><title>cairn</title><body style="margin:0;display:flex;height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif"><div style="text-align:center"><p style="font-size:15px;font-weight:600">로그인 완료</p><p style="font-size:13px;color:#a3a3a3">이제 cairn 앱으로 돌아가세요.</p></div><script>setTimeout(()=>window.close(),1200)</script></body>`;

let server: Server | null = null;
let authTimeout: ReturnType<typeof setTimeout> | null = null;

function stopServer(): void {
  if (server) {
    server.close();
    server = null;
  }
  if (authTimeout) {
    clearTimeout(authTimeout);
    authTimeout = null;
  }
}

export function startCloudSignIn(): void {
  stopServer();
  // login CSRF 방어 — 악성 페이지가 window.open 으로 임의 포트에 토큰을 흘려보내는
  // 드라이브바이를 차단. 우리가 연 플로우의 state 를 에코한 콜백만 수용한다
  const expectedState = randomBytes(16).toString('hex');
  const current = createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const ott = url.searchParams.get('token');
    // favicon 등 토큰 없는 부가 요청은 무시 — 세션 닫지 않음
    if (!ott) {
      res.writeHead(204);
      res.end();
      return;
    }
    // state 불일치는 거부하되 서버는 유지 — 공격 시도가 정상 플로우를 죽이지 못하게
    if (url.searchParams.get('state') !== expectedState) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(DONE_HTML);
    void completeSignIn(ott);
    if (authTimeout) {
      clearTimeout(authTimeout);
      authTimeout = null;
    }
    current.close();
    if (server === current) server = null;
  });
  server = current;
  current.listen(0, '127.0.0.1', () => {
    const addr = current.address();
    const port = addr && typeof addr === 'object' ? addr.port : 0;
    void shell.openExternal(`${WEB_BASE}/desktop-login?port=${port}&state=${expectedState}`);
  });
  // 브라우저 로그인 플로우를 포기하면 포트가 무기한 점유되지 않도록 5분 후 정리
  authTimeout = setTimeout(
    () => {
      if (server === current) stopServer();
    },
    5 * 60 * 1000,
  );
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
    writeStored({
      token,
      user: { name: u.name ?? u.email, email: u.email, image: u.image ?? null },
    });
    broadcastAuth();
    const win = BrowserWindow.getAllWindows()[0];
    win?.show();
    win?.focus();
  } catch {
    // ignore
  }
}

export type CloudSessionHealth = 'ok' | 'expired' | 'unreachable' | 'signed-out';

// 저장 파일 존재만으로 '로그인됨'을 그리던 것과 달리 서버 세션 실검증 — 만료(401/세션 null)면
// syncStats 가 조용히 죽는 상태라 사용자에게 알려야 한다
export async function validateCloudSession(): Promise<CloudSessionHealth> {
  const token = cloudToken();
  if (!token) return 'signed-out';
  try {
    const res = await fetch(`${WEB_BASE}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 401 || res.status === 403) return 'expired';
    if (!res.ok) return 'unreachable';
    const data = (await res.json()) as { user?: { email?: string } } | null;
    return data?.user?.email ? 'ok' : 'expired';
  } catch {
    return 'unreachable';
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
