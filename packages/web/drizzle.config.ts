import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local 없으면 환경변수에 의존
}

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
