import { z } from 'zod';

// .loose(): 사용자가 worklog.config.json 에서 자유 라벨로 박은 token env
// (e.g. GITHUB_TOKEN_<LABEL>, NOTION_TOKEN_<LABEL>) 가 schema 에 안 박혀있어도
// strip 되지 않고 process.env 에 남도록.
export const envSchema = z.looseObject({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MACHINE_NAME: z.string().min(1).default('unknown'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  ANTHROPIC_OAUTH_TOKEN: z.string().optional(),

  CAIRN_CONFIG_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
