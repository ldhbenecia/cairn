import { app } from 'electron';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeFileAtomic } from './atomic-write';
import { getOrCreateSecretKey } from './keychain-key';
import { decryptSecretJson, encryptSecretJson } from './secret-crypto';
import { CAIRN_ROOT, ENV_PATH, readEnvFile } from './setup';

// 시크릿(.env 토큰들) at-rest 암호화 스토어 (ADR 0037) — packaged 에서만 활성.
// dev 는 CAIRN_ROOT 가 레포 루트라 기존 평문 .env 워크플로우를 그대로 유지한다.
// 키가 없거나 복호화가 실패하면 항상 평문 .env 로 폴백(fail-open — 잠금이 발행을 막지 않는다)

const SECRETS_FILE = 'secrets.enc';

export type SecretStoreOpts = { root?: string; key?: Buffer | null; packaged?: boolean };

let cachedKey: Buffer | null | undefined;

function resolveKey(opts?: SecretStoreOpts): Buffer | null {
  if (opts && 'key' in opts) return opts.key ?? null;
  const packaged = opts?.packaged ?? app.isPackaged;
  if (!packaged) return null;
  if (cachedKey === undefined) cachedKey = getOrCreateSecretKey();
  return cachedKey;
}

const secretsPath = (opts?: SecretStoreOpts): string =>
  join(opts?.root ?? CAIRN_ROOT, SECRETS_FILE);
const envPath = (opts?: SecretStoreOpts): string =>
  opts?.root ? join(opts.root, '.env') : ENV_PATH;

function readPlainEnv(opts?: SecretStoreOpts): Record<string, string> {
  if (!opts?.root) return readEnvFile();
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(envPath(opts), 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* 없음 */
  }
  return out;
}

function readEncrypted(key: Buffer, opts?: SecretStoreOpts): Record<string, string> | null {
  try {
    const text = readFileSync(secretsPath(opts), 'utf8');
    return decryptSecretJson<Record<string, string>>(key, text);
  } catch {
    return null; // 파일 없음
  }
}

// 토큰 env 맵 — 암호화 스토어 우선, 폴백은 평문 .env
export function secretEnv(opts?: SecretStoreOpts): Record<string, string> {
  const key = resolveKey(opts);
  if (key) {
    const enc = readEncrypted(key, opts);
    if (enc) return enc;
  }
  return readPlainEnv(opts);
}

// 기존 .env 의 주석/순서를 유지한 채 키만 교체·추가 (평문 폴백 경로 — onboarding 에서 이동)
function writeEnvPlainMerged(patch: Record<string, string>, opts?: SecretStoreOpts): void {
  const path = envPath(opts);
  let lines: string[];
  try {
    lines = readFileSync(path, 'utf8').split('\n');
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, out.join('\n').replace(/\n+$/, '') + '\n', 0o600); // 토큰 포함 — owner-only
}

// 토큰 저장 — 암호화 활성이면 enc 병합 저장 후 평문 .env 제거, 아니면 기존 평문 병합
export function writeSecretEnvMerged(patch: Record<string, string>, opts?: SecretStoreOpts): void {
  const key = resolveKey(opts);
  if (!key) {
    writeEnvPlainMerged(patch, opts);
    return;
  }
  const merged = { ...secretEnv(opts), ...patch };
  writeFileAtomic(secretsPath(opts), encryptSecretJson(key, merged), 0o600);
  rmSync(envPath(opts), { force: true });
}

// 시작 시 1회 — 평문 .env 가 남아 있으면 암호화 스토어로 이관하고 평문을 지운다.
// 복호화 검증(round-trip)까지 성공했을 때만 평문을 삭제한다
export function migrateSecretsAtStartup(opts?: SecretStoreOpts): 'migrated' | 'skipped' {
  const key = resolveKey(opts);
  if (!key) return 'skipped';
  const plain = readPlainEnv(opts);
  if (Object.keys(plain).length === 0) return 'skipped';
  // 기존 enc 가 있으면 병합 — 평문(.env)이 마지막 수동 편집일 수 있어 평문 우선
  const merged = { ...(readEncrypted(key, opts) ?? {}), ...plain };
  writeFileAtomic(secretsPath(opts), encryptSecretJson(key, merged), 0o600);
  const verify = readEncrypted(key, opts);
  if (!verify || Object.entries(plain).some(([k, v]) => verify[k] !== v)) {
    rmSync(secretsPath(opts), { force: true }); // 검증 실패 — 평문 유지(fail-open)
    return 'skipped';
  }
  rmSync(envPath(opts), { force: true });
  return 'migrated';
}

// auth.json 등 다른 시크릿 파일이 같은 키·코덱을 재사용하기 위한 헬퍼 — 키 없으면 null(평문 유지)
export function encryptForStore(obj: unknown, opts?: SecretStoreOpts): string | null {
  const key = resolveKey(opts);
  return key ? encryptSecretJson(key, obj) : null;
}
export function decryptFromStore<T>(text: string, opts?: SecretStoreOpts): T | null {
  const key = resolveKey(opts);
  return key ? decryptSecretJson<T>(key, text) : null;
}
