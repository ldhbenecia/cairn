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
    // 데스크톱 상주 앱의 bearer 세션 — 기본 7일이면 sync 호출이 뜸한 기기에서 조용히 만료된다.
    // 90일 + 사용 시 매일 연장: 주기 sync 가 도는 한 세션이 끊기지 않는다
    session: {
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
    },
    plugins: [bearer(), oneTimeToken()],
  });
}

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
