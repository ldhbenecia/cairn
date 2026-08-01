import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { pool?: Pool };

let real: Db | undefined;

function init(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = globalForDb.pool ?? new Pool({ connectionString });
  if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;
  return drizzle(pool, { schema });
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    real ??= init();
    const value = Reflect.get(real as object, prop);
    return typeof value === 'function' ? (value.bind(real) as unknown) : value;
  },
});
