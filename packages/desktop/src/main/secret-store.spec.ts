import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// secret-store 가 electron(app.isPackaged)·keychain 을 import — 스펙에선 opts 주입만 쓰므로 모킹
vi.mock('electron', () => ({ app: { isPackaged: false } }));
vi.mock('./keychain-key', () => ({ getOrCreateSecretKey: (): null => null }));

import { decryptSecretJson, encryptSecretJson, isEncryptedPayload } from './secret-crypto';
import { migrateSecretsAtStartup, secretEnv, writeSecretEnvMerged } from './secret-store';

const KEY = randomBytes(32);

describe('secret-crypto — AES-256-GCM 코덱', () => {
  it('라운드트립', () => {
    const text = encryptSecretJson(KEY, { GITHUB_TOKEN: 'ghp_x', N: '한글값' });
    expect(isEncryptedPayload(text)).toBe(true);
    expect(decryptSecretJson(KEY, text)).toEqual({ GITHUB_TOKEN: 'ghp_x', N: '한글값' });
  });

  it('변조(tag 불일치)·다른 키·비암호문 → null', () => {
    const text = encryptSecretJson(KEY, { a: '1' });
    const tampered = text.replace(/"data":"[A-Za-z0-9+/=]{4}/, (m) =>
      m.slice(0, -4) === m.slice(0, -4) ? `${m.slice(0, -4)}AAAA` : m,
    );
    expect(decryptSecretJson(KEY, tampered)).toBeNull();
    expect(decryptSecretJson(randomBytes(32), text)).toBeNull();
    expect(decryptSecretJson(KEY, 'GITHUB_TOKEN=ghp_x')).toBeNull();
    expect(isEncryptedPayload('{"token":"t"}')).toBe(false);
  });
});

describe('secret-store — 읽기/쓰기/이관 (opts 주입)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cairn-secrets-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('키 없음(dev/폴백) — 평문 .env 를 읽고 쓴다', () => {
    writeFileSync(join(root, '.env'), '# 주석\nA_TOKEN=plain\n');
    expect(secretEnv({ root, key: null })).toEqual({ A_TOKEN: 'plain' });
    writeSecretEnvMerged({ B_TOKEN: 'two' }, { root, key: null });
    const raw = readFileSync(join(root, '.env'), 'utf8');
    expect(raw).toContain('# 주석'); // 주석·순서 보존 병합
    expect(secretEnv({ root, key: null })).toEqual({ A_TOKEN: 'plain', B_TOKEN: 'two' });
  });

  it('키 있음 — 쓰면 암호문 저장 + 평문 삭제, 읽기는 enc 우선', () => {
    writeFileSync(join(root, '.env'), 'A_TOKEN=plain\n');
    writeSecretEnvMerged({ B_TOKEN: 'two' }, { root, key: KEY });
    expect(() => readFileSync(join(root, '.env'))).toThrow(); // 평문 제거됨
    const enc = readFileSync(join(root, 'secrets.enc'), 'utf8');
    expect(isEncryptedPayload(enc)).toBe(true);
    expect(enc).not.toContain('plain'); // 내용 노출 없음
    expect(secretEnv({ root, key: KEY })).toEqual({ A_TOKEN: 'plain', B_TOKEN: 'two' });
  });

  it('이관 — .env → secrets.enc, 검증 후 평문 삭제. 재실행은 skipped', () => {
    writeFileSync(join(root, '.env'), 'GH=ghp_1\nNOTION=ntn_2\n');
    expect(migrateSecretsAtStartup({ root, key: KEY })).toBe('migrated');
    expect(() => readFileSync(join(root, '.env'))).toThrow();
    expect(secretEnv({ root, key: KEY })).toEqual({ GH: 'ghp_1', NOTION: 'ntn_2' });
    expect(migrateSecretsAtStartup({ root, key: KEY })).toBe('skipped');
  });

  it('이관 병합 — 기존 enc 위에 평문(.env, 최신 수동 편집) 우선', () => {
    writeSecretEnvMerged({ GH: 'old', KEEP: 'k' }, { root, key: KEY });
    writeFileSync(join(root, '.env'), 'GH=new\n');
    expect(migrateSecretsAtStartup({ root, key: KEY })).toBe('migrated');
    expect(secretEnv({ root, key: KEY })).toEqual({ GH: 'new', KEEP: 'k' });
  });

  it('키가 안 맞는 enc(고아) — 평문 .env 폴백 (fail-open)', () => {
    writeFileSync(join(root, 'secrets.enc'), encryptSecretJson(randomBytes(32), { X: '1' }));
    writeFileSync(join(root, '.env'), 'A_TOKEN=fallback\n');
    expect(secretEnv({ root, key: KEY })).toEqual({ A_TOKEN: 'fallback' });
  });

  it('키 없음 + enc 만 존재 — 빈 맵(평문도 없음)', () => {
    writeFileSync(join(root, 'secrets.enc'), encryptSecretJson(KEY, { X: '1' }));
    expect(secretEnv({ root, key: null })).toEqual({});
  });
});
