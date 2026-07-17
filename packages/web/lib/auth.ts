import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, oneTimeToken } from 'better-auth/plugins';

import { db } from './db';
import * as schema from './schema';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

type Auth = ReturnType<typeof init>;

let real: Auth | undefined;

function init() {
  return betterAuth({
    baseURL: required('BETTER_AUTH_URL'),
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    socialProviders: {
      google: {
        clientId: required('GOOGLE_CLIENT_ID'),
        clientSecret: required('GOOGLE_CLIENT_SECRET'),
      },
    },
    plugins: [bearer(), oneTimeToken()],
  });
}

// env 검증을 첫 사용 시점으로 지연 — Sensitive env 는 Vercel 빌드 단계에 주입되지 않아
// 모듈 로드 throw 가 페이지 수집을 죽임 (db.ts 와 동일 패턴)
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    real ??= init();
    const value = Reflect.get(real as object, prop);
    return typeof value === 'function' ? (value.bind(real) as unknown) : value;
  },
  has(_target, prop) {
    real ??= init();
    return Reflect.has(real as object, prop);
  },
});
