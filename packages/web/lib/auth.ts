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

export const auth = betterAuth({
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
