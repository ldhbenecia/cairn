import { execFile, spawn, type ChildProcess } from 'node:child_process';
import type { SummaryProvider } from '../shared/ipc-types';
import { broadcast } from './broadcast';
import { claudePathReady, findInPath, resolveClaudePath, searchPathEnv } from './claude-path';
import { envWithoutSecrets } from './secret-store';

const LOGIN_TIMEOUT_MS = 5 * 60_000;

function engineBinary(provider: SummaryProvider): string | null {
  return provider === 'claude' ? resolveClaudePath() : findInPath('codex');
}

// 로그인 CLI 는 브라우저·키체인만 씀 — 발행 토큰은 넘기지 않음
function loginEnv(): NodeJS.ProcessEnv {
  return { ...envWithoutSecrets(), PATH: searchPathEnv() };
}

// 모델을 부르지 않는 로그인 여부 확인 — 쓰지 않는 엔진 상태를 사용량 없이 보여주려는 용도
export async function engineLoggedIn(provider: SummaryProvider): Promise<boolean> {
  await claudePathReady();
  const bin = engineBinary(provider);
  if (!bin) return false;
  const args = provider === 'claude' ? ['auth', 'status', '--json'] : ['login', 'status'];
  return new Promise((resolve) => {
    execFile(bin, args, { env: loginEnv(), timeout: 15_000 }, (err, out, errOut) => {
      // codex 는 로그아웃 상태에서도 종료 코드만으로 구분된다는 보장이 없어 출력으로 판정
      if (provider === 'codex') return resolve(!err && /^Logged in\b/m.test(`${out}\n${errOut}`));
      try {
        resolve((JSON.parse(out) as { loggedIn?: unknown }).loggedIn === true);
      } catch {
        resolve(false);
      }
    });
  });
}

let running: ChildProcess | null = null;

// 브라우저 로그인 후 CLI 가 스스로 끝나면 성공 — 코드가 표시되는 경우만 submitEngineLoginCode 로 이어 줌
export async function startEngineLogin(
  provider: SummaryProvider,
): Promise<{ ok: boolean; error?: 'busy' | 'not-installed' | 'failed' }> {
  if (running) return { ok: false, error: 'busy' };
  await claudePathReady();
  const bin = engineBinary(provider);
  if (!bin) return { ok: false, error: 'not-installed' };
  const args = provider === 'claude' ? ['auth', 'login', '--claudeai'] : ['login'];
  const child = spawn(bin, args, { env: loginEnv(), stdio: ['pipe', 'ignore', 'ignore'] });
  // 사용자가 코드를 넣는 순간 CLI 가 끝나면 EPIPE — 리스너가 없으면 main 프로세스가 uncaught 로 죽음
  child.stdin?.on('error', () => {});
  running = child;
  const timer = setTimeout(() => child.kill(), LOGIN_TIMEOUT_MS);
  return new Promise((resolve) => {
    const finish = (ok: boolean): void => {
      clearTimeout(timer);
      if (running === child) running = null;
      // 로그인 UI 가 닫혀도 상태 표시가 갱신되도록
      if (ok) broadcast('cairn:engine:login-done', provider);
      resolve(ok ? { ok } : { ok, error: 'failed' });
    };
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
  });
}

export function submitEngineLoginCode(code: unknown): boolean {
  if (!running?.stdin?.writable || typeof code !== 'string') return false;
  const clean = code.trim();
  if (!clean || clean.length > 512 || /[\r\n]/.test(clean)) return false;
  running.stdin.write(`${clean}\n`);
  return true;
}

export function cancelEngineLogin(): void {
  running?.kill();
}
