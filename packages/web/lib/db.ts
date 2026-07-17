import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// dev 핫 리로드마다 Pool 이 새로 생겨 연결 고갈되는 것 방지 — globalThis 캐싱
const globalForDb = globalThis as unknown as { pool?: Pool };

let real: Db | undefined;

function init(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = globalForDb.pool ?? new Pool({ connectionString });
  if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;
  return drizzle(pool, { schema });
}

// env 검증을 첫 사용 시점으로 지연 — DATABASE_URL 없는 프리뷰 빌드가 페이지 수집에서 죽지 않게.
// 메서드는 real 에 bind (private field 브랜드 체크가 Proxy receiver 로 깨지는 것 방지)
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    real ??= init();
    const value = Reflect.get(real as object, prop);
    return typeof value === 'function' ? (value.bind(real) as unknown) : value;
  },
});
