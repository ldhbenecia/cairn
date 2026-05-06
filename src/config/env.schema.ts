import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MACHINE_NAME: z.string().min(1).default('unknown'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  GITHUB_TOKEN: z.string().optional(),
  ANTHROPIC_OAUTH_TOKEN: z.string().optional(),

  CAIRN_CONFIG_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
