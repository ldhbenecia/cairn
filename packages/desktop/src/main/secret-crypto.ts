import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// 시크릿 at-rest 암호화 코덱 (ADR 0037) — AES-256-GCM, 키는 macOS 키체인 보관(keychain-key).
// electron 무의존 순수 모듈이라 단위 테스트 가능. 어떤 실패든 null(호출측 평문 폴백 — fail-open)

type EncryptedPayload = { v: 1; alg: 'aes-256-gcm'; iv: string; tag: string; data: string };

export function encryptSecretJson(key: Buffer, obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const payload: EncryptedPayload = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
  return `${JSON.stringify(payload)}\n`;
}

export function decryptSecretJson<T>(key: Buffer, text: string): T | null {
  try {
    const p = JSON.parse(text) as Partial<EncryptedPayload>;
    if (p.v !== 1 || p.alg !== 'aes-256-gcm' || !p.iv || !p.tag || !p.data) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(p.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(p.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(p.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

// 파일/문자열이 이 코덱의 암호문 형태인지 — 레거시 평문(JSON·dotenv)과 구분용
export function isEncryptedPayload(text: string): boolean {
  try {
    const p = JSON.parse(text) as Partial<EncryptedPayload>;
    return p.v === 1 && p.alg === 'aes-256-gcm' && !!p.iv && !!p.tag && !!p.data;
  } catch {
    return false;
  }
}
